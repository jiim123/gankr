-- Fires only on the exact insert that brings a lobby's non-left member count
-- to max_members (never >=), so even though there is no server-side
-- seat-capacity enforcement anywhere yet (join RLS only checks
-- open/unlocked — a known, separately-flagged gap), this can't fire more
-- than once per lobby.
--
-- Every future writer of a notifications row (Phase 8/11's triggers later)
-- must repeat this same preference-check-before-insert guard: a disabled
-- type must never produce a row, badge, toast, or popup, not just be hidden
-- after the fact.
create or replace function notify_lobby_full()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner_id uuid; v_max_members integer; v_member_count integer;
begin
  select owner_id, max_members into v_owner_id, v_max_members from lobbies where id = new.lobby_id;
  select count(*) into v_member_count from lobby_members where lobby_id = new.lobby_id and left_at is null;

  if v_member_count = v_max_members then
    if coalesce((select (notification_preferences ->> 'lobby_full')::boolean from users where id = v_owner_id), true) then
      insert into notifications (user_id, type, actor_id, lobby_id)
      values (v_owner_id, 'lobby_full', new.user_id, new.lobby_id);
    end if;
  end if;
  return new;
end;
$$;

create trigger on_lobby_member_joined_check_full
  after insert on lobby_members for each row execute function notify_lobby_full();
