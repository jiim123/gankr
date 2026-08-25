-- The join policy only ever checked identity, never whether the lobby is
-- actually open and unlocked — meaning the Lock toggle Phase 7 adds was
-- purely cosmetic. This is the first phase that makes `locked` mean
-- anything, so this is the phase that closes the gap.
--
-- A seat-capacity check is deliberately NOT added here: "free slot" was
-- already a known, pre-existing, client-side-only gap from Phase 6. This
-- migration closes only the one thing Phase 7 newly makes meaningful.

drop policy if exists "join a lobby as yourself" on lobby_members;

create policy "join a lobby as yourself"
  on lobby_members for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from lobbies
      where lobbies.id = lobby_members.lobby_id
        and status = 'open'
        and locked = false
    )
  );
