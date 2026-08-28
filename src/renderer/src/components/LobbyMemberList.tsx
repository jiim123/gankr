import { useEffect, useState } from 'react'
import type { LobbySummary, LobbyMemberSummary } from '../lib/lobby-summary'
import { supabase } from '../lib/supabase'
import { loadMemberSteamIds } from '../lib/lobby-member-steam-ids'
import { loadFriendshipStates, sendFriendRequest, type FriendshipState } from '../lib/lobby-friendships'
import type { LaunchDetectionState } from '../lib/launch-detection'
import LobbyMemberCard from './LobbyMemberCard'

async function removeMember(lobbyId: string, userId: string): Promise<void> {
  await supabase
    .from('lobby_members')
    .update({ left_at: new Date().toISOString(), member_state: 'left' })
    .eq('lobby_id', lobbyId)
    .eq('user_id', userId)
}

interface LobbyMemberListProps {
  lobby: LobbySummary
  currentUserId: string
  onReport: (member: LobbyMemberSummary) => void
  launch: LaunchDetectionState
}

/**
 * Now the data-fetching container for the member-card list: loads
 * `loadMemberSteamIds` and `loadFriendshipStates` on mount and whenever the
 * member set changes, and hands the results down to LobbyMemberCard per
 * row. Kick logic is unchanged from the old inline-`<li>` version — Kick
 * reuses the exact same UPDATE as the room header's Leave button, just
 * targeting another member's row, already RLS-permitted by "update own
 * membership row or as lobby owner." The kicked member's own client reacts
 * automatically via useActiveLobby's existing subscription — no new
 * reactivity needed here.
 */
export default function LobbyMemberList({ lobby, currentUserId, onReport, launch }: LobbyMemberListProps) {
  const [kickingId, setKickingId] = useState<string | null>(null)
  const [addingFriendId, setAddingFriendId] = useState<string | null>(null)
  const [steamIds, setSteamIds] = useState<Map<string, string>>(new Map())
  const [friendshipStates, setFriendshipStates] = useState<Map<string, FriendshipState>>(new Map())
  const isOwner = lobby.ownerId === currentUserId

  // Stable key so the fetch effect only re-runs when the actual member set
  // changes, not on every summary refresh that happens to carry the same members.
  const memberIdsKey = lobby.members
    .map((member) => member.userId)
    .slice()
    .sort()
    .join(',')

  useEffect(() => {
    let cancelled = false
    const memberIds = memberIdsKey ? memberIdsKey.split(',') : []
    void loadMemberSteamIds(memberIds).then((result) => {
      if (!cancelled) setSteamIds(result)
    })
    void loadFriendshipStates(currentUserId, memberIds).then((result) => {
      if (!cancelled) setFriendshipStates(result)
    })
    return () => {
      cancelled = true
    }
  }, [memberIdsKey, currentUserId])

  async function handleKick(userId: string): Promise<void> {
    setKickingId(userId)
    try {
      await removeMember(lobby.id, userId)
    } finally {
      setKickingId(null)
    }
  }

  async function handleAddFriend(userId: string): Promise<void> {
    setAddingFriendId(userId)
    try {
      const ok = await sendFriendRequest(currentUserId, userId)
      if (ok) setFriendshipStates((current) => new Map(current).set(userId, 'outgoing_pending'))
    } finally {
      setAddingFriendId(null)
    }
  }

  return (
    <div className="space-y-2">
      {lobby.members.map((member) => (
        <LobbyMemberCard
          key={member.userId}
          member={member}
          isOwnerCard={member.userId === lobby.ownerId}
          isSelf={member.userId === currentUserId}
          canKick={isOwner && member.userId !== currentUserId}
          steamId64={steamIds.get(member.userId) ?? null}
          friendshipState={friendshipStates.get(member.userId) ?? 'none'}
          addingFriend={addingFriendId === member.userId}
          kicking={kickingId === member.userId}
          onAddFriend={() => void handleAddFriend(member.userId)}
          onAddOnSteam={() => {
            const steamId64 = steamIds.get(member.userId)
            if (steamId64) void window.gankr.openAddSteamFriend(steamId64)
          }}
          onReport={() => onReport(member)}
          onKick={() => void handleKick(member.userId)}
          launch={member.userId === currentUserId ? launch : undefined}
        />
      ))}
    </div>
  )
}
