-- Accepting a join request inserts the lobby_members row itself, server-side,
-- rather than relying on a second client write after the owner clicks
-- Accept — the requester never gets a chance to race or skip that insert.
-- This also means zero new client reactivity is needed on the requester's
-- side: useActiveLobby (src/renderer/src/lib/active-lobby.ts) already
-- Realtime-subscribes to `lobby_members` inserts for its own user_id from
-- any source, so their floating panel appears automatically.

create or replace function handle_lobby_join_request_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' then
    insert into lobby_members (lobby_id, user_id) values (new.lobby_id, new.user_id);
  end if;
  new.decided_at = now();
  return new;
end;
$$;

create trigger on_lobby_join_request_decided
  before update on lobby_join_requests
  for each row
  when (old.status = 'pending' and new.status in ('accepted', 'denied'))
  execute function handle_lobby_join_request_decision();
