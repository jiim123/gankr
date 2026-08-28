-- Lobby room redesign: an owner-settable, nullable display name, and the
-- 'open'/'private' visibility split that the join-request flow (next two
-- migrations) hangs off of. `name` has no fallback stored here on purpose —
-- the "<owner>'s lobby" default is rendered client-side (resolveLobbyDisplayName
-- in lobby-summary.ts) from the owner's current display_name, not baked into
-- a column at insert time, so a later display_name change is reflected
-- automatically instead of going stale.

create type lobby_visibility as enum ('open', 'private');

alter table lobbies
  add column name text,
  add column visibility lobby_visibility not null default 'open';
