import type { Tables } from '@shared/db-types'
import { supabase } from './supabase'

type JoinRequestStatus = Tables<'lobby_join_requests'>['status']

export interface PendingJoinRequest {
  id: string
  userId: string
  displayName: string
  avatarUrl: string | null
  createdAt: string
}

/** Owner-side: every pending request for one lobby, with the requester's
 * display info already joined in — RLS ("join requests readable by
 * requester or lobby owner") only lets this return rows at all when the
 * caller actually owns the lobby. */
export async function loadPendingJoinRequests(lobbyId: string): Promise<PendingJoinRequest[]> {
  const { data: rows } = await supabase
    .from('lobby_join_requests')
    .select('id, user_id, created_at')
    .eq('lobby_id', lobbyId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  const requests = rows ?? []
  if (requests.length === 0) return []

  const userIds = [...new Set(requests.map((row) => row.user_id))]
  const { data: userRows } = await supabase.from('users').select('id, display_name, avatar_url').in('id', userIds)
  const usersById = new Map((userRows ?? []).map((user) => [user.id, user]))

  return requests.map((row) => {
    const user = usersById.get(row.user_id)
    return {
      id: row.id,
      userId: row.user_id,
      displayName: user?.display_name ?? 'Unknown player',
      avatarUrl: user?.avatar_url ?? null,
      createdAt: row.created_at
    }
  })
}

/** Owner-side decision. The actual `lobby_members` insert on acceptance
 * happens server-side in the on_lobby_join_request_decided trigger — this
 * is just the one UPDATE that fires it. */
export async function decideJoinRequest(requestId: string, decision: Extract<JoinRequestStatus, 'accepted' | 'denied'>): Promise<boolean> {
  const { error } = await supabase.from('lobby_join_requests').update({ status: decision }).eq('id', requestId)
  return !error
}

export async function requestToJoinLobby(lobbyId: string, userId: string): Promise<boolean> {
  const { error } = await supabase.from('lobby_join_requests').insert({ lobby_id: lobbyId, user_id: userId })
  return !error
}

/** Find-lobby side: per-lobby request state for the current user, batched
 * across every lobby a search returned. 'accepted' isn't surfaced — an
 * accepted requester is already a member, and the lobby drops out of search
 * results on its own once they've joined, so there's nothing to render for
 * it. Most-recent-row-wins, since a denied request can be followed by a
 * fresh pending one for the same lobby. */
export async function loadOwnJoinRequestStates(
  userId: string,
  lobbyIds: readonly string[]
): Promise<Map<string, 'none' | 'pending' | 'denied'>> {
  const states = new Map<string, 'none' | 'pending' | 'denied'>(lobbyIds.map((id) => [id, 'none']))
  if (lobbyIds.length === 0) return states

  const { data: rows } = await supabase
    .from('lobby_join_requests')
    .select('lobby_id, status, created_at')
    .eq('user_id', userId)
    .in('lobby_id', lobbyIds)
    .order('created_at', { ascending: true })

  for (const row of rows ?? []) {
    if (row.status === 'accepted') continue
    states.set(row.lobby_id, row.status)
  }

  return states
}
