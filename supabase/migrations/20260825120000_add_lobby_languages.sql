-- Hard filter for Find lobby needs a lobby-level languages set to compare against a
-- searcher's own users.languages. Defaulted from the creator's languages at insert time
-- in the client (see src/renderer/src/components/CreateLobbyModal.tsx), not by a trigger,
-- since it's a plain copy at creation and never needs to react to later profile edits.
alter table lobbies add column languages text[] not null default '{}';
