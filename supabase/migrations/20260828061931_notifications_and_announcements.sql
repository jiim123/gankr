-- Phase 9: notifications + platform announcements.
--
-- `notifications` holds one row per user-facing event, written server-side
-- only (a trigger or an Edge Function) — there is no client insert policy.
-- `announcements` is a different shape on purpose: one row per broadcast
-- plus a small per-user `announcement_reads` row for the ones a user has
-- actually seen, never one notification row fanned out per user.

create type notification_type as enum (
  'friend_request_received', 'friend_request_accepted', 'lobby_invite', 'lobby_full',
  'all_members_ready', 'owner_launched', 'friend_online_in_owned_game', 'announcement'
);
-- 'announcement' is a member so the renderer's unified item type can share one
-- discriminator across both sources, even though no writer ever inserts a
-- notifications row with this type — announcements never fan out into this table.

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  type notification_type not null,
  actor_id uuid references users (id) on delete set null,
  lobby_id uuid references lobbies (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_id_created_at_idx on notifications (user_id, created_at desc);
alter table notifications enable row level security;

create policy "notifications readable by owner" on notifications for select
  to authenticated using (user_id = auth.uid());
create policy "notifications markable read by owner" on notifications for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- RLS with check can't restrict which COLUMNS an update touches. Column-level
-- grant does what it can't: the client can only ever change read_at.
revoke update on notifications from authenticated;
grant update (read_at) on notifications to authenticated;
-- No insert/delete policy — every row is server-side, from a trigger or Edge Function.

create table announcements (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(body) <= 500),
  target_region text,  -- null = everyone; a value = only that REGIONS-vocabulary region
  created_by uuid references users (id),
  created_at timestamptz not null default now()
);
-- No expires_at/"active" lifecycle: the spec doesn't ask for one and Phase 13's
-- admin UI (the only thing that would retire one) doesn't exist yet either.

create table announcement_reads (
  announcement_id uuid not null references announcements (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);
alter table announcements enable row level security;
alter table announcement_reads enable row level security;

create policy "announcements readable if untargeted or region matches" on announcements
  for select to authenticated
  using (target_region is null or target_region = (select region from users where id = auth.uid()));
-- No client insert/update/delete — authored via direct SQL under the service role,
-- same posture as `reports`, until Phase 13 builds an admin view.

create policy "announcement_reads readable by owner" on announcement_reads
  for select to authenticated using (user_id = auth.uid());
create policy "announcement_reads insert by owner" on announcement_reads
  for insert to authenticated with check (user_id = auth.uid());

-- Opt-out semantics: absent key or `true` = enabled, explicit `false` = disabled.
alter table users add column notification_preferences jsonb not null default '{}'::jsonb;

alter publication supabase_realtime add table public.notifications;
-- NOT announcements/announcement_reads — client asks "anything unseen" on
-- startup (a one-time fetch), never a live subscription. They're rare by design.
