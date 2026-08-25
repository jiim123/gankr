import type { Tables } from '@shared/db-types'
import { supabase } from './supabase'
import { buildLobbySummaries, groupBy, type LobbySummary } from './lobby-summary'

type MicRequirement = Tables<'lobbies'>['mic']
type LobbyTone = Tables<'lobbies'>['tone']

/** `null` means "any" for that field. Game/free-slots/language are hard
 * filters (things that genuinely break a session); region/mic/tone are not
 * filtered here at all — they only feed scoring in lobby-scoring.ts. */
export interface LobbySearchFilters {
  appid: string | null
  minFreeSlots: number
}

/** Also exported so FindLobbyPage can build the ScoringTarget without
 * re-deriving these from the filter bar's own state shape. */
export interface LobbyScoringFilters {
  region: string | null
  mic: MicRequirement | null
  tone: LobbyTone | null
}

/**
 * Client-side scoring over a hard-filtered candidate set, following
 * ProfilePage.tsx's fetch-parent -> fetch-children -> join-with-a-Map
 * pattern rather than a Postgres RPC or embedded-aggregate query. RLS
 * already handles the security-relevant filtering at the row level, so
 * ranking here is pure UX.
 */
export async function searchLobbies(filters: LobbySearchFilters, myLanguages: readonly string[]): Promise<LobbySummary[]> {
  let query = supabase.from('lobbies').select('*').eq('status', 'open').limit(100)
  if (filters.appid) query = query.eq('appid', filters.appid)
  const { data: lobbyRows } = await query
  const lobbies = lobbyRows ?? []
  if (lobbies.length === 0) return []

  const lobbyIds = lobbies.map((lobby) => lobby.id)
  const { data: memberRows } = await supabase
    .from('lobby_members')
    .select('*')
    .in('lobby_id', lobbyIds)
    .is('left_at', null)
  const membersByLobbyId = groupBy(memberRows ?? [], (member) => member.lobby_id)

  const candidates = lobbies.filter((lobby) => {
    const members = membersByLobbyId.get(lobby.id) ?? []
    const freeSlots = lobby.max_members - members.length
    if (freeSlots < filters.minFreeSlots) return false

    // Passes when either side hasn't set languages yet (the unset
    // default) — never silently excludes everything before anyone has
    // set their languages.
    if (myLanguages.length > 0 && lobby.languages.length > 0) {
      const overlaps = lobby.languages.some((language) => myLanguages.includes(language))
      if (!overlaps) return false
    }
    return true
  })
  if (candidates.length === 0) return []

  const memberUserIds = [
    ...new Set(candidates.flatMap((lobby) => (membersByLobbyId.get(lobby.id) ?? []).map((member) => member.user_id)))
  ]
  const appids = [...new Set(candidates.map((lobby) => lobby.appid))]

  const [{ data: userRows }, { data: gameRows }] = await Promise.all([
    memberUserIds.length > 0
      ? supabase.from('users').select('id, display_name, avatar_url').in('id', memberUserIds)
      : Promise.resolve({ data: [] }),
    appids.length > 0 ? supabase.from('games').select('appid, name').in('appid', appids) : Promise.resolve({ data: [] })
  ])

  const usersById = new Map((userRows ?? []).map((user) => [user.id, user]))
  const gamesByAppid = new Map((gameRows ?? []).map((game) => [game.appid, game]))

  return buildLobbySummaries(candidates, membersByLobbyId, usersById, gamesByAppid)
}
