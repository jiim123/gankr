-- Gankr schema: users, Steam identities, games, lobbies, chat, sessions, reputation.

create type profile_visibility as enum ('public', 'private', 'unknown');
create type game_source as enum ('steam', 'manual');
create type lobby_status as enum ('open', 'playing', 'closed');
create type mic_requirement as enum ('required', 'preferred', 'off');
create type lobby_tone as enum ('casual', 'competitive');
create type member_state as enum ('in_lobby', 'launching', 'in_game', 'launch_failed', 'left');
create type message_kind as enum ('user', 'system');
create type friendship_status as enum ('pending', 'accepted', 'blocked');

create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  region text,
  languages text[] not null default '{}',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Separate table on purpose so profile rows can be read freely without exposing the Steam ID.
create table steam_identities (
  user_id uuid primary key references users (id) on delete cascade,
  steam_id64 text not null unique,
  profile_visibility profile_visibility not null default 'unknown',
  last_synced_at timestamptz
);

create table games (
  appid text primary key,
  name text not null,
  header_image text,
  genres text[] not null default '{}'
);

create table user_games (
  user_id uuid not null references users (id) on delete cascade,
  appid text not null references games (appid) on delete cascade,
  playtime_forever_minutes integer not null default 0,
  playtime_2weeks_minutes integer not null default 0,
  source game_source not null default 'steam',
  synced_at timestamptz not null default now(),
  primary key (user_id, appid)
);

create table lobbies (
  id uuid primary key default gen_random_uuid(),
  appid text not null references games (appid),
  owner_id uuid not null references users (id),
  status lobby_status not null default 'open',
  max_members integer not null,
  region text not null,
  mic mic_requirement not null default 'preferred',
  tone lobby_tone not null default 'casual',
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table lobby_members (
  lobby_id uuid not null references lobbies (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  launch_clicked_at timestamptz,
  game_started_at timestamptz,
  left_at timestamptz,
  last_heartbeat timestamptz not null default now(),
  member_state member_state not null default 'in_lobby',
  primary key (lobby_id, user_id)
);

create table lobby_messages (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references lobbies (id) on delete cascade,
  user_id uuid references users (id),
  kind message_kind not null default 'user',
  body text not null check (char_length(body) <= 500),
  seq bigserial not null,
  created_at timestamptz not null default now()
);

create table session_history (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references lobbies (id) on delete set null,
  appid text not null references games (appid),
  started_at timestamptz not null,
  ended_at timestamptz,
  member_count integer not null default 0
);

create table session_participants (
  session_id uuid not null references session_history (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  minutes_in_game integer not null default 0,
  primary key (session_id, user_id)
);

create table compliments (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references users (id) on delete cascade,
  to_user_id uuid not null references users (id) on delete cascade,
  session_id uuid not null references session_history (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now(),
  unique (from_user_id, to_user_id, session_id)
);

create table friendships (
  user_id uuid not null references users (id) on delete cascade,
  friend_id uuid not null references users (id) on delete cascade,
  status friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references users (id),
  reported_user_id uuid not null references users (id),
  lobby_id uuid references lobbies (id) on delete set null,
  reason text not null,
  message_snapshot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index lobbies_status_idx on lobbies (status);
create index lobbies_appid_idx on lobbies (appid);
create index lobby_members_user_id_idx on lobby_members (user_id);
create index lobby_messages_lobby_id_seq_idx on lobby_messages (lobby_id, seq);
create index user_games_user_id_idx on user_games (user_id);
create index session_participants_user_id_idx on session_participants (user_id);
create index friendships_friend_id_idx on friendships (friend_id);
create index reports_reported_user_id_idx on reports (reported_user_id);
