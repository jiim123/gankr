-- Find lobby's browse grid ranks games by real cross-user popularity
-- (how many Gankr users own each game), not just "has an open lobby right
-- now". user_games itself is RLS-locked to `user_id = auth.uid()` -- a
-- client can only ever read their own rows -- so a client-side aggregate
-- across all users is impossible. This view does the aggregation
-- server-side and exposes only the count, never any individual user's
-- library, which is not sensitive the way the raw rows are.
--
-- Views without an explicit `security_invoker` run with the view OWNER's
-- privileges for the underlying tables' RLS (the Postgres 15+ default,
-- confirmed against this project's major_version = 17 in supabase/config.toml).
-- The migration role that creates this view has BYPASSRLS, so the grouped
-- query below sees every user's row regardless of who queries the view
-- afterward -- same mechanism already relied on for private.is_lobby_member()
-- etc., just for a view instead of a function.

create view public.game_popularity as
  select appid, count(*)::bigint as owner_count
  from user_games
  group by appid;

grant select on public.game_popularity to authenticated;
