-- Phase 6 needs Realtime so new lobbies and membership changes appear without a
-- refresh. RLS already covers this correctly: postgres_changes subscriptions are
-- evaluated against the same SELECT policies as a normal query, and the existing
-- lobbies/lobby_members policies (open, or already-a-member) already describe exactly
-- the live-update visibility this needs. No policy changes required.
alter publication supabase_realtime add table public.lobbies, public.lobby_members;
