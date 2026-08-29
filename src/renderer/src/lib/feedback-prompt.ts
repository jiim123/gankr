import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { LobbySummary } from './lobby-summary'

export interface FeedbackCandidate {
  userId: string
  displayName: string
  avatarUrl: string | null
}

/**
 * Every member who was ever in this lobby, not just currently-active ones
 * (unlike LobbySummary.members, which is left_at-is-null-filtered) — a
 * lobbymate who already left is still a valid feedback target, since the
 * shared session already happened.
 */
export async function loadFeedbackCandidates(lobbyId: string, excludeUserId: string): Promise<FeedbackCandidate[]> {
  const { data: memberRows } = await supabase.from('lobby_members').select('user_id').eq('lobby_id', lobbyId)
  const userIds = (memberRows ?? []).map((row) => row.user_id).filter((id) => id !== excludeUserId)
  if (userIds.length === 0) return []

  const { data: userRows } = await supabase.from('users').select('id, display_name, avatar_url').in('id', userIds)
  return (userRows ?? []).map((row) => ({
    userId: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url
  }))
}

export interface FeedbackPromptState {
  /** The lobby to prompt feedback for, or null when nothing should show.
   * Kept as a lobby id (not a boolean) since the modal needs it to look up
   * the other members to give feedback about. */
  promptLobbyId: string | null
  dismiss: () => void
}

/**
 * Watches the current user's own member_state for the 'in_game' -> 'in_lobby'
 * transition specifically — CLAUDE.md's Phase 10 trigger ("the feedback
 * window opens per member when that member's game exits"). This is the
 * exact transition useLaunchDetection's exit-debounce writes
 * (src/renderer/src/lib/launch-detection.ts) when a real detected process
 * disappears — never fires on a manual Leave, since leaving writes
 * member_state: 'left' directly and never passes through 'in_lobby' first,
 * so the two paths are mutually exclusive by construction of the existing
 * state machine. No extra logic is needed to tell them apart.
 *
 * Mounted in AppShell alongside useLaunchDetection, for the same reason:
 * LobbyRoom unmounts when the floating panel is minimized, but this has to
 * keep watching regardless.
 */
export function useFeedbackPrompt(lobby: LobbySummary | null, userId: string | undefined): FeedbackPromptState {
  const [promptLobbyId, setPromptLobbyId] = useState<string | null>(null)
  const prevRef = useRef<{ lobbyId: string; memberState: string } | undefined>(undefined)

  useEffect(() => {
    const ownMember = lobby?.members.find((member) => member.userId === userId)
    const current = lobby && ownMember ? { lobbyId: lobby.id, memberState: ownMember.memberState } : undefined
    const prev = prevRef.current

    if (
      prev &&
      current &&
      prev.lobbyId === current.lobbyId &&
      prev.memberState === 'in_game' &&
      current.memberState === 'in_lobby'
    ) {
      setPromptLobbyId(current.lobbyId)
    }

    prevRef.current = current
  }, [lobby, userId])

  // Memoized so the caller's own dismiss-after-10-minutes timer effect
  // doesn't re-arm itself on every unrelated re-render (an inline arrow
  // function here would be a fresh reference each render, resetting that
  // timer before it ever fires).
  const dismiss = useCallback(() => setPromptLobbyId(null), [])

  return { promptLobbyId, dismiss }
}
