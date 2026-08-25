-- Phase 7 (lobby room and chat) closes two gaps found while building it:
-- CLAUDE.md requires a server-side 5 messages / 10 seconds rate limit on
-- lobby_messages, and nothing previously restricted `kind`, so any current
-- member could insert a fake `kind='system'` row impersonating an
-- announcement like "Owner locked the lobby." Both are fixed in one policy:
-- a client may only ever insert `kind='user'` rows, as themselves, as a
-- current (left_at is null) member, and only when they haven't already sent
-- 5 messages in the trailing 10 seconds. `kind='system'` becomes writable
-- only by the SECURITY DEFINER triggers added in the next migration.

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
    and (
      select count(*) from lobby_messages recent
      where recent.lobby_id = lobby_messages.lobby_id
        and recent.user_id = auth.uid()
        and recent.created_at > now() - interval '10 seconds'
    ) < 5
  );
