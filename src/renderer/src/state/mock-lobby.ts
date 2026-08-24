/**
 * Stub state for the docked lobby bar (Phase 3). There is no real lobby
 * data or Supabase connection yet — this is just enough shape to prove the
 * bar lives at the layout level and survives navigation. Phase 6/7 replace
 * this with a real lobby subscription.
 */
export interface MockLobby {
  gameName: string
  memberCount: number
  maxMembers: number
  membersReady: number
  status: 'open' | 'playing' | 'closed'
}

export const MOCK_ACTIVE_LOBBY: MockLobby = {
  gameName: 'Deep Rock Galactic',
  memberCount: 3,
  maxMembers: 4,
  membersReady: 2,
  status: 'open'
}
