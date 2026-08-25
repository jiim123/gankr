-- The RLS-recursion fix in 20260825120002 added is_lobby_member() and
-- get_lobby_status() as SECURITY DEFINER functions in the public schema.
-- RLS policies need EXECUTE granted to `authenticated` to invoke them, but
-- that grant also makes PostgREST auto-expose them as directly callable RPC
-- endpoints (confirmed live: `rpc/is_lobby_member` answers even to the
-- anon key, unauthenticated) — anyone could enumerate arbitrary
-- (lobby_id, user_id) membership pairs or any lobby's status, bypassing the
-- visibility RLS is supposed to enforce.
--
-- Fix: move both functions into a `private` schema. `supabase/config.toml`
-- only exposes `public` and `graphql_public` via the API, so PostgREST never
-- routes to `private.*` — but RLS policy evaluation happens inside Postgres
-- itself, not through PostgREST, so a policy can still call a qualified
-- `private.is_lobby_member(...)` exactly as before. Same fix, no longer
-- reachable as an RPC.

create schema if not exists private;

create or replace function private.is_lobby_member(p_lobby_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from lobby_members
    where lobby_id = p_lobby_id
      and user_id = p_user_id
  );
$$;

create or replace function private.get_lobby_status(p_lobby_id uuid)
returns lobby_status
language sql
security definer
set search_path = public
stable
as $$
  select status from lobbies where id = p_lobby_id;
$$;

drop policy if exists "lobby readable by its members" on lobbies;
create policy "lobby readable by its members"
  on lobbies for select
  to authenticated
  using (private.is_lobby_member(id, auth.uid()));

drop policy if exists "lobby members readable with the lobby" on lobby_members;
create policy "lobby members readable with the lobby"
  on lobby_members for select
  to authenticated
  using (
    private.get_lobby_status(lobby_id) = 'open'
    or private.is_lobby_member(lobby_id, auth.uid())
  );

drop function if exists public.is_lobby_member(uuid, uuid);
drop function if exists public.get_lobby_status(uuid);
