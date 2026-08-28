import { supabase } from './supabase'

/**
 * Per-member friendship state relative to the current user, for
 * LobbyMemberCard's "Add friend" button. Four states, not three — an
 * *incoming* pending row (someone else already requested the current user)
 * needs its own state so the button doesn't insert a redundant reverse row;
 * it renders "Pending" and waits for the existing request to be accepted
 * from the Friends page instead.
 */
export type FriendshipState = 'none' | 'outgoing_pending' | 'incoming_pending' | 'friends'

/**
 * Batched over every member id at once — one query each direction, joined
 * with a Map, same shape as every other batch lookup in this codebase
 * (lobby-summary.ts, notifications.ts).
 */
export async function loadFriendshipStates(
  currentUserId: string,
  memberIds: readonly string[]
): Promise<Map<string, FriendshipState>> {
  const others = memberIds.filter((id) => id !== currentUserId)
  const states = new Map<string, FriendshipState>(others.map((id) => [id, 'none']))
  if (others.length === 0) return states

  const { data: rows } = await supabase
    .from('friendships')
    .select('user_id, friend_id, status')
    .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`)

  for (const row of rows ?? []) {
    const otherId = row.user_id === currentUserId ? row.friend_id : row.user_id
    if (!states.has(otherId)) continue

    if (row.status === 'accepted') {
      states.set(otherId, 'friends')
    } else if (row.status === 'pending') {
      states.set(otherId, row.user_id === currentUserId ? 'outgoing_pending' : 'incoming_pending')
    }
    // 'blocked' rows fall through and leave the default 'none' — nothing in
    // this lobby-scoped UI needs to distinguish "blocked" from "no relation".
  }

  return states
}

export async function sendFriendRequest(currentUserId: string, targetUserId: string): Promise<boolean> {
  const { error } = await supabase
    .from('friendships')
    .insert({ user_id: currentUserId, friend_id: targetUserId })
  return !error
}
