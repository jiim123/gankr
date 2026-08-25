-- System messages for chat: join, leave/kick, and lock. Same SECURITY
-- DEFINER trigger pattern sweep_lobbies.sql already uses for
-- handle_member_departure() — these write `kind='system'` rows, which the
-- previous migration made unwritable by a client, so this is now the only
-- path a system message can come from.
--
-- Deliberately not built here (Phase 8 territory, per the approved plan):
-- "Nadia is ready" / "launch failed" messages, since they reference
-- launch-detection states that don't exist yet. No unlock message either —
-- the spec only calls out the lock case.

create or replace function notify_member_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
begin
  select display_name into v_display_name from users where id = new.user_id;

  insert into lobby_messages (lobby_id, user_id, kind, body)
  values (new.lobby_id, null, 'system', coalesce(v_display_name, 'Someone') || ' joined');

  return new;
end;
$$;

create trigger on_member_joined
  after insert on lobby_members
  for each row
  execute function notify_member_joined();

create or replace function notify_member_departed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
begin
  select display_name into v_display_name from users where id = new.user_id;

  if auth.uid() = new.user_id then
    insert into lobby_messages (lobby_id, user_id, kind, body)
    values (new.lobby_id, null, 'system', coalesce(v_display_name, 'Someone') || ' left');
  else
    -- The "update own membership row or as lobby owner" policy already
    -- guarantees that anyone changing someone else's left_at is the lobby
    -- owner, so no extra ownership check is needed here.
    insert into lobby_messages (lobby_id, user_id, kind, body)
    values (new.lobby_id, null, 'system', coalesce(v_display_name, 'Someone') || ' was removed by the owner');
  end if;

  return new;
end;
$$;

create trigger on_member_departed
  after update of left_at on lobby_members
  for each row
  when (new.left_at is not null and old.left_at is null)
  execute function notify_member_departed();

create or replace function notify_lobby_locked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into lobby_messages (lobby_id, user_id, kind, body)
  values (new.id, null, 'system', 'Owner locked the lobby');

  return new;
end;
$$;

create trigger on_lobby_locked
  after update of locked on lobbies
  for each row
  when (new.locked = true and old.locked = false)
  execute function notify_lobby_locked();
