-- A private lobby must go through the join-request flow — full replacement
-- of the direct-join policy (last touched in
-- 20260825125648_lobby_join_requires_open.sql) adding a visibility='open'
-- check, so a raw lobby_members insert can never bypass a private lobby's
-- request/accept flow. The trigger in the previous migration is still the
-- only path that inserts a member row for a private lobby, since it runs as
-- security definer and isn't subject to this policy at all.

drop policy if exists "join a lobby as yourself" on lobby_members;

create policy "join a lobby as yourself"
  on lobby_members for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from lobbies
      where lobbies.id = lobby_members.lobby_id
        and lobbies.status = 'open'
        and lobbies.locked = false
        and lobbies.visibility = 'open'
    )
  );
