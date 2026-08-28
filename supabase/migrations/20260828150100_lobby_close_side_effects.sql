-- Phase 8: on lobby close, write session_history/session_participants and
-- delete lobby_messages. Hooked to the lobbies.status -> 'closed' transition
-- itself (not duplicated into sweep_lobbies() and handle_member_departure()
-- separately) so it covers BOTH existing close paths: the cron sweep and the
-- owner-leaves-with-nobody-to-inherit case.
create or replace function close_lobby_side_effects()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
begin
  insert into session_history (lobby_id, appid, started_at, ended_at, member_count)
  values (
    old.id,
    old.appid,
    old.created_at,
    now(),
    (select count(*) from lobby_members where lobby_id = old.id)
  )
  returning id into v_session_id;

  -- Every member who ever joined gets a participation row, not just
  -- currently-active ones — someone who left early still gets 0+ minutes.
  insert into session_participants (session_id, user_id, minutes_in_game)
  select
    v_session_id,
    lm.user_id,
    case
      when lm.game_started_at is null then 0
      else greatest(0, round(
        extract(epoch from (coalesce(lm.left_at, now()) - lm.game_started_at)) / 60
      ))::integer
    end
  from lobby_members lm
  where lm.lobby_id = old.id;

  delete from lobby_messages where lobby_id = old.id;

  return old;
end;
$$;

create trigger on_lobby_closed_write_history
  after update of status on lobbies
  for each row
  when (new.status = 'closed' and old.status <> 'closed')
  execute function close_lobby_side_effects();
