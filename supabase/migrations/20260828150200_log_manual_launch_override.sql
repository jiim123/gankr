-- Phase 8: "I'm in, continue without me" must be logged somewhere the solo
-- dev can actually see it across every player's machine — a main-process
-- console.info is invisible in a packaged build with no attached terminal.
-- Reuses the existing lobby_messages kind='system' channel instead of a new
-- table. Deliberately in `public` (not `private`) and directly RPC-callable —
-- unlike the private.* helpers, this one is meant to be called from the
-- client, with its own auth.uid() check inside rather than relying on a
-- caller-side RLS policy.
create or replace function log_manual_launch_override(p_lobby_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
begin
  if not exists (
    select 1 from lobby_members
    where lobby_id = p_lobby_id and user_id = auth.uid() and left_at is null
  ) then
    raise exception 'not a member of this lobby';
  end if;

  select display_name into v_display_name from users where id = auth.uid();

  insert into lobby_messages (lobby_id, user_id, kind, body)
  values (
    p_lobby_id,
    null,
    'system',
    coalesce(v_display_name, 'A player') || ' continued without launch detection'
  );
end;
$$;

grant execute on function log_manual_launch_override(uuid) to authenticated;
