-- Private lobbies: join requests. A denied request can be re-requested later
-- (a person's circumstances can change), so the "one request per user per
-- lobby" constraint is a partial unique index scoped to status='pending',
-- not a blanket one — otherwise a denied row would permanently block any
-- future request from that user for that lobby.

create type join_request_status as enum ('pending', 'accepted', 'denied');

create table lobby_join_requests (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references lobbies (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  status join_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create unique index lobby_join_requests_one_pending_per_user
  on lobby_join_requests (lobby_id, user_id) where status = 'pending';

alter table lobby_join_requests enable row level security;

create policy "request to join a private lobby as yourself" on lobby_join_requests
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from lobbies
      where lobbies.id = lobby_join_requests.lobby_id
        and lobbies.status = 'open'
        and lobbies.locked = false
        and lobbies.visibility = 'private'
    )
  );

create policy "join requests readable by requester or lobby owner" on lobby_join_requests
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from lobbies
      where lobbies.id = lobby_join_requests.lobby_id and lobbies.owner_id = auth.uid()
    )
  );

create policy "join requests decided by lobby owner" on lobby_join_requests
  for update to authenticated
  using (
    exists (
      select 1 from lobbies
      where lobbies.id = lobby_join_requests.lobby_id and lobbies.owner_id = auth.uid()
    )
  )
  with check (
    status in ('accepted', 'denied')
    and exists (
      select 1 from lobbies
      where lobbies.id = lobby_join_requests.lobby_id and lobbies.owner_id = auth.uid()
    )
  );

alter publication supabase_realtime add table public.lobby_join_requests;
