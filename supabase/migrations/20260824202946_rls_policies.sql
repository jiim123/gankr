-- Row Level Security for every table. Nothing is readable or writable by default;
-- each policy below is a deliberate exception.

alter table users enable row level security;
alter table steam_identities enable row level security;
alter table games enable row level security;
alter table user_games enable row level security;
alter table lobbies enable row level security;
alter table lobby_members enable row level security;
alter table lobby_messages enable row level security;
alter table session_history enable row level security;
alter table session_participants enable row level security;
alter table compliments enable row level security;
alter table friendships enable row level security;
alter table reports enable row level security;

-- users: anyone signed in can read profiles; only the owner can write their own.
create policy "users are readable by any signed-in user"
  on users for select
  to authenticated
  using (true);

create policy "users can insert their own row"
  on users for insert
  to authenticated
  with check (id = auth.uid());

create policy "users can update their own row"
  on users for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- steam_identities: owner, or someone who currently shares an open lobby with the owner.
-- No general profile or search query may join this table for anyone else.
create policy "steam identity readable by owner or active lobby co-member"
  on steam_identities for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from lobby_members mine
      join lobby_members theirs
        on theirs.lobby_id = mine.lobby_id
      where mine.user_id = auth.uid()
        and mine.left_at is null
        and theirs.user_id = steam_identities.user_id
        and theirs.left_at is null
    )
  );

create policy "steam identity insert by owner"
  on steam_identities for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "steam identity update by owner"
  on steam_identities for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- games: read-only reference data for the client. Rows are written by the
-- library-sync Edge Function under the service role, never by a client.
create policy "games are readable by any signed-in user"
  on games for select
  to authenticated
  using (true);

-- user_games: a player's own library.
create policy "user_games readable by owner"
  on user_games for select
  to authenticated
  using (user_id = auth.uid());

create policy "user_games writable by owner"
  on user_games for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "user_games updatable by owner"
  on user_games for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- lobbies: open lobbies are public discovery surface; a lobby that has moved on to
-- `playing` or `closed` is only visible to people who were actually in it.
create policy "open lobbies are readable by any signed-in user"
  on lobbies for select
  to authenticated
  using (status = 'open');

create policy "lobby readable by its members"
  on lobbies for select
  to authenticated
  using (
    exists (
      select 1 from lobby_members
      where lobby_members.lobby_id = lobbies.id
        and lobby_members.user_id = auth.uid()
    )
  );

create policy "lobby created by its owner"
  on lobbies for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "lobby updated by its owner"
  on lobbies for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- lobby_members: visible to anyone who can see the lobby itself (open, or already a member).
create policy "lobby members readable with the lobby"
  on lobby_members for select
  to authenticated
  using (
    exists (
      select 1 from lobbies
      where lobbies.id = lobby_members.lobby_id
        and (
          lobbies.status = 'open'
          or exists (
            select 1 from lobby_members mine
            where mine.lobby_id = lobbies.id
              and mine.user_id = auth.uid()
          )
        )
    )
  );

create policy "join a lobby as yourself"
  on lobby_members for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "update own membership row or as lobby owner"
  on lobby_members for update
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from lobbies
      where lobbies.id = lobby_members.lobby_id
        and lobbies.owner_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from lobbies
      where lobbies.id = lobby_members.lobby_id
        and lobbies.owner_id = auth.uid()
    )
  );

-- lobby_messages: readable only by current members; senders must be a member
-- posting as themselves.
create policy "lobby messages readable by current members"
  on lobby_messages for select
  to authenticated
  using (
    exists (
      select 1 from lobby_members
      where lobby_members.lobby_id = lobby_messages.lobby_id
        and lobby_members.user_id = auth.uid()
        and lobby_members.left_at is null
    )
  );

create policy "lobby messages insert by current members as themselves"
  on lobby_messages for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from lobby_members
      where lobby_members.lobby_id = lobby_messages.lobby_id
        and lobby_members.user_id = auth.uid()
        and lobby_members.left_at is null
    )
  );

-- session_history / session_participants: written only by Edge Functions under the
-- service role. Players may read their own participation and the sessions it points to.
create policy "session participants readable by the participant"
  on session_participants for select
  to authenticated
  using (user_id = auth.uid());

create policy "session history readable by its participants"
  on session_history for select
  to authenticated
  using (
    exists (
      select 1 from session_participants
      where session_participants.session_id = session_history.id
        and session_participants.user_id = auth.uid()
    )
  );

-- compliments: insert requires verified session participation on both sides.
create policy "compliments readable by sender or recipient"
  on compliments for select
  to authenticated
  using (from_user_id = auth.uid() or to_user_id = auth.uid());

create policy "compliments insert requires shared session participation"
  on compliments for insert
  to authenticated
  with check (
    from_user_id = auth.uid()
    and exists (
      select 1 from session_participants
      where session_participants.session_id = compliments.session_id
        and session_participants.user_id = compliments.from_user_id
    )
    and exists (
      select 1 from session_participants
      where session_participants.session_id = compliments.session_id
        and session_participants.user_id = compliments.to_user_id
    )
  );

-- friendships: visible and writable only by the two people involved.
create policy "friendships readable by either side"
  on friendships for select
  to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());

create policy "friendship request created by the requester"
  on friendships for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "friendship updated by either side"
  on friendships for update
  to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid())
  with check (user_id = auth.uid() or friend_id = auth.uid());

-- reports: no client select or insert policy at all. Submitting a report and reading
-- one back both go through Edge Functions / the admin tool under the service role,
-- because the message snapshot has to be assembled from server-side truth.
