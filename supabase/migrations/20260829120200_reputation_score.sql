-- Phase 10 reputation score. Recomputed on a schedule (hourly, matching
-- sweep_lobbies()'s cron.schedule shape) over weighted, decayed feedback —
-- not updated synchronously on every insert, so a single fresh negative
-- doesn't feel like an instant, jarring hit.
--
-- Parameters and reasoning:
-- - Base weight 10 points either direction. Self-limiting against the
--   +/-500 cap given decay: a realistic lifetime feedback volume approaches
--   but doesn't blow through the ceiling.
-- - Half-life 120 days positive / 45 days negative — negatives fade to
--   ~12.5% of original weight in about 4.5 months, which is what makes
--   "climb out through normal play" (CLAUDE.md) actually true.
-- - Revenge-pair cancellation: mutual negatives in the same session damp
--   to 0.05x (near zero, not deleted — still visible as raw feedback rows,
--   just barely counted toward the score).
-- - Serial-negger damping: a giver whose lifetime feedback is >=70%
--   negative on a minimum sample of 10 given reports has their negative
--   submissions damped to 0.3x. Their opinion stops counting before their
--   ability to express it does.
-- - Premade-group damping: reporters of the same recipient in the same
--   session who were already mutual (accepted) Gankr friends with each
--   other before the session started get their weight divided by cluster
--   size — a pairwise approximation of connected components, not a true
--   graph algorithm, but the right direction even when the exact
--   component boundary is fuzzy.
-- - needs_moderation_review flips true at -350 (70% toward the floor) — a
--   sustained pattern, not a single bad session (one fresh negative is
--   -10, nowhere close). This is a data flag only; the actual review UI is
--   Phase 13's "minimal admin view", not built here.

alter table users add column reputation_score integer not null default 0
  check (reputation_score between -500 and 500);
alter table users add column needs_moderation_review boolean not null default false;

create index users_needs_moderation_review_idx on users (needs_moderation_review)
  where needs_moderation_review;

create or replace function recompute_reputation_scores()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with
  -- Telemetry cross-check: a rage_quitter/afk tag is discarded (0.1x) when
  -- Phase 8's own detection shows the accused was actually present until
  -- the session ended. Only meaningful once the session has ended — an
  -- open session's tags pass through unweighted here and get corrected
  -- retroactively on a later run once the lobby closes.
  telemetry_checked as (
    select
      f.id, f.from_user_id, f.to_user_id, f.session_id, f.tag, f.polarity, f.created_at,
      case
        when f.tag in ('rage_quitter', 'afk')
          and sh.ended_at is not null
          and sp.ended_at is not null
          and sp.ended_at >= sh.ended_at - interval '5 minutes'
          then 0.1
        else 1.0
      end as telemetry_multiplier
    from feedback f
    join session_history sh on sh.id = f.session_id
    left join session_participants sp on sp.session_id = f.session_id and sp.user_id = f.to_user_id
  ),

  revenge_checked as (
    select t.*,
      case
        when t.polarity = 'negative' and exists (
          select 1 from feedback r
          where r.session_id = t.session_id
            and r.from_user_id = t.to_user_id
            and r.to_user_id = t.from_user_id
            and r.polarity = 'negative'
        ) then 0.05
        else 1.0
      end as revenge_multiplier
    from telemetry_checked t
  ),

  giver_stats as (
    select from_user_id, count(*) as total_given,
      count(*) filter (where polarity = 'negative') as negative_given
    from feedback group by from_user_id
  ),
  serial_negger_checked as (
    select r.*,
      case
        when r.polarity = 'negative'
          and gs.total_given >= 10
          and gs.negative_given::numeric / gs.total_given >= 0.7
          then 0.3
        else 1.0
      end as serial_negger_multiplier
    from revenge_checked r
    join giver_stats gs on gs.from_user_id = r.from_user_id
  ),

  premade_checked as (
    select s.*,
      1 + (
        select count(*)
        from feedback peer
        join session_history sh2 on sh2.id = peer.session_id
        join friendships fr
          on (fr.user_id = s.from_user_id and fr.friend_id = peer.from_user_id)
          or (fr.friend_id = s.from_user_id and fr.user_id = peer.from_user_id)
        where peer.session_id = s.session_id
          and peer.to_user_id = s.to_user_id
          and peer.from_user_id <> s.from_user_id
          and fr.status = 'accepted'
          and fr.created_at < sh2.started_at
      ) as cluster_size
    from serial_negger_checked s
  ),

  weighted as (
    select to_user_id,
      (case when polarity = 'positive' then 10 else -10 end)
      * power(0.5, extract(epoch from (now() - created_at)) / 86400.0
          / (case when polarity = 'positive' then 120.0 else 45.0 end))
      * telemetry_multiplier * revenge_multiplier * serial_negger_multiplier
      / cluster_size
      as points
    from premade_checked
  ),
  totals as (
    select to_user_id, sum(points) as raw_score from weighted group by to_user_id
  )

  update users u
  set reputation_score = greatest(-500, least(500, round(t.raw_score)::integer)),
      needs_moderation_review = (round(t.raw_score)::integer <= -350)
  from totals t
  where u.id = t.to_user_id;
  -- Users with zero feedback rows ever are absent from `totals` and are
  -- simply left at the column default (0) — nothing to do for them.
end;
$$;

select cron.schedule('recompute_reputation_scores', '0 * * * *', $$select recompute_reputation_scores();$$);
