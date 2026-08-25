-- Bug fix discovered while manually verifying Phase 7's chat rate limit: any
-- insert into lobby_messages failed with "infinite recursion detected in
-- policy for relation lobby_messages" (Postgres 42P17).
--
-- Root cause: the rate-limit clause added in 20260825125637_lobby_chat_rls.sql
-- put a correlated subquery directly on lobby_messages inside that same
-- table's own INSERT ... WITH CHECK policy:
--   (select count(*) from lobby_messages recent where ...) < 5
-- Evaluating the check requires applying lobby_messages' own RLS to the
-- `recent` subquery, which requires evaluating the INSERT policy again to
-- finish planning, forever. Exactly the same class of bug already fixed for
-- lobbies/lobby_members in 20260825120002_fix_lobby_rls_recursion.sql, this
-- time on a fresh table instead of a pre-existing empty one, which is why it
-- surfaced immediately instead of lying latent.
--
-- Fix: move the count into a SECURITY DEFINER helper in the `private`
-- schema, same as private.is_lobby_member()/private.get_lobby_status() —
-- owned by the migration role, so its internal read skips RLS entirely
-- instead of re-entering this table's own policy. Created directly in
-- `private` (see 20260825121636_fix_rls_helper_exposure.sql) rather than
-- `public`, so it isn't auto-exposed as a callable RPC endpoint.

create or replace function private.recent_message_count(p_lobby_id uuid, p_user_id uuid)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)
  from lobby_messages
  where lobby_id = p_lobby_id
    and user_id = p_user_id
    and created_at > now() - interval '10 seconds';
$$;

drop policy if exists "lobby messages insert by current members as themselves" on lobby_messages;

create policy "lobby messages insert by current members as themselves"
  on lobby_messages for insert
  to authenticated
  with check (
    kind = 'user'
    and user_id = auth.uid()
    and exists (
      select 1 from lobby_members
      where lobby_members.lobby_id = lobby_messages.lobby_id
        and lobby_members.user_id = auth.uid()
        and lobby_members.left_at is null
    )
    and private.recent_message_count(lobby_messages.lobby_id, auth.uid()) < 5
  );
