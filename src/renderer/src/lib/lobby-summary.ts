import type { Tables } from '@shared/db-types'

export type LobbyRow = Tables<'lobbies'>
export type LobbyMemberRow = Tables<'lobby_members'>
type UserRow = Pick<Tables<'users'>, 'id' | 'display_name' | 'avatar_url'>
type GameRow = Pick<Tables<'games'>, 'appid' | 'name'>

export interface LobbyMemberSummary {
  userId: string
  displayName: string
  avatarUrl: string | null
  memberState: Tables<'lobby_members'>['member_state']
}

/**
 * Everything a lobby card, the docked bar, and the create/join flows need
 * about one lobby: the row itself, its game name, and its currently-active
 * (left_at is null) members joined to their display info. Built once here
 * so lobby-search.ts and active-lobby.ts share one implementation instead
 * of two slightly different joins.
 */
export interface LobbySummary {
  id: string
  appid: string
  gameName: string
  ownerId: string
  status: LobbyRow['status']
  maxMembers: number
  region: string
  mic: LobbyRow['mic']
  tone: LobbyRow['tone']
  locked: boolean
  languages: string[]
  createdAt: string
  members: LobbyMemberSummary[]
}

export function buildLobbySummary(
  lobby: LobbyRow,
  members: readonly LobbyMemberRow[],
  usersById: ReadonlyMap<string, UserRow>,
  gamesByAppid: ReadonlyMap<string, GameRow>
): LobbySummary {
  const game = gamesByAppid.get(lobby.appid)
  return {
    id: lobby.id,
    appid: lobby.appid,
    gameName: game?.name ?? lobby.appid,
    ownerId: lobby.owner_id,
    status: lobby.status,
    maxMembers: lobby.max_members,
    region: lobby.region,
    mic: lobby.mic,
    tone: lobby.tone,
    locked: lobby.locked,
    languages: lobby.languages,
    createdAt: lobby.created_at,
    members: members.map((member) => {
      const user = usersById.get(member.user_id)
      return {
        userId: member.user_id,
        displayName: user?.display_name ?? 'Unknown player',
        avatarUrl: user?.avatar_url ?? null,
        memberState: member.member_state
      }
    })
  }
}

export function buildLobbySummaries(
  lobbies: readonly LobbyRow[],
  membersByLobbyId: ReadonlyMap<string, readonly LobbyMemberRow[]>,
  usersById: ReadonlyMap<string, UserRow>,
  gamesByAppid: ReadonlyMap<string, GameRow>
): LobbySummary[] {
  return lobbies.map((lobby) =>
    buildLobbySummary(lobby, membersByLobbyId.get(lobby.id) ?? [], usersById, gamesByAppid)
  )
}

/** Groups a flat list of rows into a Map keyed by one of its fields. Shared
 * by lobby-search.ts and active-lobby.ts for the lobby_members batch fetch. */
export function groupBy<T, K>(rows: readonly T[], keyOf: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const row of rows) {
    const key = keyOf(row)
    const existing = map.get(key)
    if (existing) {
      existing.push(row)
    } else {
      map.set(key, [row])
    }
  }
  return map
}
