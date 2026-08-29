-- Phase 10: session_history used to be created only when the whole lobby
-- closes (close_lobby_side_effects, shipped in Phase 8). Feedback needs a
-- session_id the moment a member's OWN game exits, which can happen while
-- the lobby is still open (other members still playing) — CLAUDE.md: "the
-- feedback window opens per member when that member's game exits, not
-- when the whole lobby closes". Switches session_history creation to
-- lazy find-or-create by lobby_id, callable from either the close trigger
-- or (inline, see submit-feedback's own copy of this logic) a feedback
-- request mid-session.

-- Real interval endpoints, not just a derived scalar, so feedback's "10
-- minutes of verified in-game overlap" can be computed as an actual
-- interval intersection between two participants, not just "both
-- independently played 10+ minutes at some point".
alter table lobby_members add column game_ended_at timestamptz;
alter table session_participants add column started_at timestamptz;
alter table session_participants add column ended_at timestamptz;

-- One session_history row per lobby, ever — the invariant the lazy
-- find-or-create model below depends on (used as an ON CONFLICT target).
alter table session_history add constraint session_history_lobby_id_key unique (lobby_id);

-- Not reachable via PostgREST (private schema, see
-- 20260825121636_fix_rls_helper_exposure.sql for why that's a routing-layer
-- block that applies even to a service-role client). Only ever called from
-- another Postgres function in the same transaction (close_lobby_side_effects
-- below) — the submit-feedback Edge Function reimplements this same logic
-- inline via plain .from() calls instead, since it cannot call this over
-- RPC. Keep the two in sync if this formula ever changes.
create or replace function private.ensure_session_history(p_lobby_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
begin
  select id into v_session_id from session_history where lobby_id = p_lobby_id;
  if v_session_id is not null then
    return v_session_id;
  end if;

  insert into session_history (lobby_id, appid, started_at, member_count)
  select l.id, l.appid, l.created_at, (select count(*) from lobby_members where lobby_id = l.id)
  from lobbies l
  where l.id = p_lobby_id
  on conflict (lobby_id) do nothing
  returning id into v_session_id;

  if v_session_id is null then
    -- Lost a create race against another caller in the same instant.
    select id into v_session_id from session_history where lobby_id = p_lobby_id;
  end if;

  return v_session_id;
end;
$$;

-- Upserts one participant's real in-game interval from the current
-- lobby_members row. Idempotent — safe to call repeatedly while a session
-- is still live and the member's state keeps changing.
create or replace function private.sync_session_participant(p_session_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lobby_id uuid;
  v_started_at timestamptz;
  v_ended_at timestamptz;
  v_minutes integer;
begin
  select lobby_id into v_lobby_id from session_history where id = p_session_id;

  select game_started_at into v_started_at
  from lobby_members where lobby_id = v_lobby_id and user_id = p_user_id;

  if v_started_at is null then
    v_ended_at := null;
    v_minutes := 0;
  else
    select coalesce(game_ended_at, left_at, now()) into v_ended_at
    from lobby_members where lobby_id = v_lobby_id and user_id = p_user_id;
    v_minutes := greatest(0, round(extract(epoch from (v_ended_at - v_started_at)) / 60))::integer;
  end if;

  insert into session_participants (session_id, user_id, minutes_in_game, started_at, ended_at)
  values (p_session_id, p_user_id, v_minutes, v_started_at, v_ended_at)
  on conflict (session_id, user_id) do update
    set minutes_in_game = excluded.minutes_in_game,
        started_at = excluded.started_at,
        ended_at = excluded.ended_at;
end;
$$;

-- Replaces the single INSERT...SELECT with find-or-reuse + finalize, since
-- a session_history row may already exist by the time the lobby closes
-- (created earlier by a feedback request mid-session).
create or replace function close_lobby_side_effects()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_user_id uuid;
begin
  v_session_id := private.ensure_session_history(old.id);

  update session_history
  set ended_at = now(),
      member_count = (select count(*) from lobby_members where lobby_id = old.id)
  where id = v_session_id;

  for v_user_id in select user_id from lobby_members where lobby_id = old.id loop
    perform private.sync_session_participant(v_session_id, v_user_id);
  end loop;

  delete from lobby_messages where lobby_id = old.id;

  return old;
end;
$$;
