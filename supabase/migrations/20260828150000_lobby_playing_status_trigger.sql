-- Phase 8: lobbies.status flips open<->playing based on real detected member
-- state, never the client. Fires on both UPDATE (member_state/left_at changes)
-- and INSERT — the private-lobby join-request-acceptance trigger inserts a
-- lobby_members row directly without checking lobbies.status, so a lobby
-- stuck at 'playing' needs this to run on that path too.
create or replace function sync_lobby_playing_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lobby_id uuid;
  v_current_status lobby_status;
  v_all_in_game boolean;
begin
  v_lobby_id := coalesce(new.lobby_id, old.lobby_id);
  select status into v_current_status from lobbies where id = v_lobby_id;

  -- A closed lobby's status is final — same guard sweep_lobbies() and
  -- handle_member_departure() already use, for the same reason.
  if v_current_status is null or v_current_status not in ('open', 'playing') then
    return coalesce(new, old);
  end if;

  select count(*) > 0 and count(*) filter (where member_state <> 'in_game') = 0
  into v_all_in_game
  from lobby_members
  where lobby_id = v_lobby_id and left_at is null;

  if v_all_in_game and v_current_status <> 'playing' then
    update lobbies set status = 'playing' where id = v_lobby_id;
  elsif not v_all_in_game and v_current_status <> 'open' then
    update lobbies set status = 'open' where id = v_lobby_id;
  end if;

  return coalesce(new, old);
end;
$$;

-- Trigger name ("on_lobby_...") sorts alphabetically BEFORE "on_member_departed"/
-- "on_member_left" (Postgres fires same-event triggers in name order, not
-- creation order), so on a left_at transition this one runs FIRST — it may
-- transiently compute status='open' for a lobby that's about to close, but
-- handle_member_departure() runs right after in the same statement and
-- overwrites to 'closed' if needed. No externally visible race, single
-- transaction throughout.
create trigger on_lobby_member_state_changed_sync_status
  after insert or update of member_state, left_at on lobby_members
  for each row
  execute function sync_lobby_playing_status();
