-- Private lobbies switch from owner-approval to a password (a shareable
-- room code, like a game server password) — the correct password joins
-- immediately. This replaces the request/accept/deny flow entirely, not
-- layers on top of it, per explicit product decision.
drop trigger if exists on_lobby_join_request_decided on lobby_join_requests;
drop function if exists handle_lobby_join_request_decision();
drop table if exists lobby_join_requests;
drop type if exists join_request_status;

-- Separate table (not a lobbies column) so the existing broad "open
-- lobbies are readable by any signed-in user" policy on `lobbies` never
-- exposes it — same reasoning steam_identities is split from users.
-- Plaintext by deliberate choice: the owner needs to be able to view and
-- share this later, unlike a real login password. RLS restricts reads to
-- the owner; join_private_lobby() below never returns the value to a
-- joiner, only accepts or rejects what they submitted.
create table lobby_passwords (
  lobby_id uuid primary key references lobbies (id) on delete cascade,
  password text not null check (char_length(password) between 1 and 100),
  created_at timestamptz not null default now()
);

alter table lobby_passwords enable row level security;

create policy "lobby password readable by its owner"
  on lobby_passwords for select
  to authenticated
  using (
    exists (
      select 1 from lobbies
      where lobbies.id = lobby_passwords.lobby_id and lobbies.owner_id = auth.uid()
    )
  );

-- Set once at creation (no later-edit UI — visibility itself is
-- creation-only per the same product decision). A plain owner-writing-
-- their-own-row policy is enough here; this isn't a trust boundary the
-- way joining is.
create policy "lobby password set by its owner"
  on lobby_passwords for insert
  to authenticated
  with check (
    exists (
      select 1 from lobbies
      where lobbies.id = lobby_passwords.lobby_id and lobbies.owner_id = auth.uid()
    )
  );

-- The only path into a private lobby now — the existing "join a lobby as
-- yourself" policy on lobby_members already requires visibility='open'
-- for a raw client insert
-- (20260828085830_lobby_join_requires_open_visibility.sql), so this
-- security-definer function is what a correct password actually does.
-- Public (not private schema) — meant to be called directly via
-- supabase.rpc(), same precedent as log_manual_launch_override().
create or replace function join_private_lobby(p_lobby_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status lobby_status;
  v_locked boolean;
  v_visibility lobby_visibility;
  v_stored_password text;
  v_member_count integer;
  v_max_members integer;
begin
  select status, locked, visibility, max_members
  into v_status, v_locked, v_visibility, v_max_members
  from lobbies where id = p_lobby_id;

  if v_status is null then
    raise exception 'lobby not found';
  end if;
  if v_visibility <> 'private' then
    raise exception 'this lobby is not private';
  end if;
  if v_status <> 'open' or v_locked then
    raise exception 'this lobby is not open to joins';
  end if;

  select password into v_stored_password from lobby_passwords where lobby_id = p_lobby_id;
  if v_stored_password is null or v_stored_password <> p_password then
    raise exception 'incorrect password';
  end if;

  if exists (
    select 1 from lobby_members
    where lobby_id = p_lobby_id and user_id = auth.uid() and left_at is null
  ) then
    raise exception 'already a member of this lobby';
  end if;

  select count(*) into v_member_count from lobby_members where lobby_id = p_lobby_id and left_at is null;
  if v_member_count >= v_max_members then
    raise exception 'this lobby is full';
  end if;

  insert into lobby_members (lobby_id, user_id) values (p_lobby_id, auth.uid());
end;
$$;

grant execute on function join_private_lobby(uuid, text) to authenticated;
