-- Chat needs Realtime the same way Phase 6 needed it for lobbies/lobby_members
-- (see 20260825120001_enable_realtime.sql). RLS already covers this
-- correctly: postgres_changes subscriptions are evaluated against the same
-- SELECT policy as a normal query, and "lobby messages readable by current
-- members" already describes exactly the live-update visibility this needs.
-- No policy changes required.
alter publication supabase_realtime add table public.lobby_messages;
