-- Bug fix discovered while building Phase 6 (Find lobby / create lobby): creating a
-- lobby fails with "infinite recursion detected in policy for relation lobby_members".
--
-- Root cause: `lobbies`' "lobby readable by its members" SELECT policy queries
-- `lobby_members`, and `lobby_members`' "lobby members readable with the lobby" SELECT
-- policy queries `lobbies` right back. Each table's RLS rewrite re-enters the other
-- table's policies, which re-enters the first again, forever. This was latent in the
-- Phase 2 migration from the start — it only surfaces once a `lobbies` row actually
-- exists to evaluate the qualifier against (an empty table never triggers the
-- correlated subqueries), which is why it went unnoticed until Phase 6 became the
-- first phase to actually insert a lobby row.
--
-- Fix: move each cross-table check into a small SECURITY DEFINER helper function.
-- Functions created here are owned by the migration role (the same role
-- sweep_lobbies() already relies on to bypass RLS for its own cross-user updates),
-- so their internal reads skip RLS entirely instead of re-entering the other table's
-- policies, breaking the cycle.

create or replace function is_lobby_member(p_lobby_id uuid, p_user_id uuid)
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

create or replace function get_lobby_status(p_lobby_id uuid)
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
  using (is_lobby_member(id, auth.uid()));

drop policy if exists "lobby members readable with the lobby" on lobby_members;
create policy "lobby members readable with the lobby"
  on lobby_members for select
  to authenticated
  using (
    get_lobby_status(lobby_id) = 'open'
    or is_lobby_member(lobby_id, auth.uid())
  );
