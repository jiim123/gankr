-- Lobby lifecycle enforcement that must never depend on a client staying connected.

create extension if not exists pg_cron with schema extensions;

-- Closes lobbies nobody is still heartbeating in, or that have run past the hard ceiling.
-- Grace windows are intentionally asymmetric with the "playing" transition itself:
-- reaching `playing` needs every member, but closing needs *no* member checking in.
create or replace function sweep_lobbies()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update lobbies
  set status = 'closed',
      closed_at = now()
  where status in ('open', 'playing')
    and (
      now() - created_at > interval '12 hours'
      or not exists (
        select 1
        from lobby_members
        where lobby_members.lobby_id = lobbies.id
          and lobby_members.left_at is null
          and lobby_members.last_heartbeat > now() - (
            case lobbies.status
              when 'open' then interval '2 minutes'
              else interval '10 minutes'
            end
          )
      )
    );
end;
$$;

select cron.schedule('sweep_lobbies', '* * * * *', $$select sweep_lobbies();$$);

-- When the owner leaves but other members remain, ownership passes to whoever has
-- been in the lobby the longest, instead of the lobby closing under them.
create or replace function handle_member_departure()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_next_owner uuid;
begin
  select owner_id into v_owner_id from lobbies where id = new.lobby_id;

  if v_owner_id = new.user_id then
    select user_id into v_next_owner
    from lobby_members
    where lobby_id = new.lobby_id
      and left_at is null
      and user_id <> new.user_id
    order by joined_at asc
    limit 1;

    if v_next_owner is not null then
      update lobbies set owner_id = v_next_owner where id = new.lobby_id;
    else
      update lobbies
      set status = 'closed', closed_at = now()
      where id = new.lobby_id and status <> 'closed';
    end if;
  end if;

  return new;
end;
$$;

create trigger on_member_left
  after update of left_at on lobby_members
  for each row
  when (new.left_at is not null and old.left_at is null)
  execute function handle_member_departure();
