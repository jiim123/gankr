-- The Phase-9-anticipated writer for `friend_request_received` — the type
-- and its client-side rendering (renderNotificationSentence in
-- src/renderer/src/lib/notifications.ts) already exist end to end from
-- Phase 9; nothing here needed to add except the trigger that actually
-- writes the row, following notify_lobby_full()'s exact preference-check-
-- before-insert shape (20260828061932_lobby_full_trigger.sql).

create or replace function notify_friend_request_received()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(
    (select (notification_preferences ->> 'friend_request_received')::boolean from users where id = new.friend_id),
    true
  ) then
    insert into notifications (user_id, type, actor_id)
    values (new.friend_id, 'friend_request_received', new.user_id);
  end if;
  return new;
end;
$$;

create trigger on_friendship_requested
  after insert on friendships
  for each row
  when (new.status = 'pending')
  execute function notify_friend_request_received();
