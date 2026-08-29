-- Phase 10 session feedback. Both polarities are public here, including
-- who gave them — a deliberate reversal of this project's original design
-- (see CLAUDE.md's Phase 10 section and top-level hard rules for the note
-- explaining why). Submission is exclusively through the submit-feedback
-- Edge Function's service-role client: the abuse controls (session overlap,
-- one-per-pair-per-week, weekly negative budget, tag/polarity match) all
-- have to be enforced server-side, so there is no client insert policy at
-- all on this table.

create type feedback_polarity as enum ('positive', 'negative');

create type feedback_tag as enum (
  'friendly', 'team_player', 'fun_to_play_with', 'leader', 'respectful',
  'toxic', 'rage_quitter', 'poor_teamwork', 'afk', 'untrustworthy'
);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references users (id) on delete cascade,
  to_user_id uuid not null references users (id) on delete cascade,
  session_id uuid not null references session_history (id) on delete cascade,
  tag feedback_tag not null,
  polarity feedback_polarity not null,
  created_at timestamptz not null default now(),
  unique (from_user_id, to_user_id, session_id),
  check (from_user_id <> to_user_id)
);

create index feedback_to_user_id_idx on feedback (to_user_id);
create index feedback_from_user_id_idx on feedback (from_user_id);
create index feedback_session_id_idx on feedback (session_id);

alter table feedback enable row level security;

-- Not scoped to to_user_id = auth.uid() — any signed-in user can view any
-- other user's received feedback on that user's profile, which is the
-- entire point of the visibility reversal. Same shape as the existing
-- "users are readable by any signed-in user" policy.
create policy "feedback readable by any signed-in user"
  on feedback for select
  to authenticated
  using (true);
