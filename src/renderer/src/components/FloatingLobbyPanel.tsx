import { useEffect, useState } from 'react'
import type { LobbySummary } from '../lib/lobby-summary'
import { supabase } from '../lib/supabase'
import type { LaunchDetectionState } from '../lib/launch-detection'
import LobbyRoom from './LobbyRoom'
import LobbyMinimizedCard from './LobbyMinimizedCard'

interface FloatingLobbyPanelProps {
  lobby: LobbySummary | null
  currentUserId: string | undefined
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  /** Owned by AppShell (useLaunchDetection lives at that layout level so it
   * survives minimize) — only threaded into LobbyRoom, the minimized card
   * stays display-only. */
  launch: LaunchDetectionState
}

/**
 * Floating panel for the lobby the user is currently in — fixed to the
 * bottom of the content area (rounded-2xl, shadow, full-width) rather than
 * docked in normal document flow, so it no longer squeezes <main>. Lives at
 * the layout level (see AppShell) so it stays mounted across route changes.
 *
 * `expanded` is a controlled prop owned by AppShell, merged there with its
 * own auto-expand-on-new-lobby-id effect and the notification-click-expands-
 * it wiring — unchanged by this redesign, just relocated from the old
 * DockedLobbyBar.tsx.
 */
export default function FloatingLobbyPanel({
  lobby,
  currentUserId,
  expanded,
  onExpandedChange,
  launch
}: FloatingLobbyPanelProps) {
  const [unreadCount, setUnreadCount] = useState(0)

  // Unread count: only lives here, the only consumer, and only while the
  // room isn't actually open. A second, independent Realtime subscription
  // from useLobbyChat's (which only runs while the room is mounted) — the
  // two are mutually exclusive by `expanded`, so no persisted "last read"
  // watermark is needed.
  useEffect(() => {
    setUnreadCount(0)
  }, [lobby?.id])

  useEffect(() => {
    const lobbyId = lobby?.id
    if (expanded || !lobbyId) return undefined

    const channel = supabase
      .channel(`lobby-chat-unread-${lobbyId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lobby_messages', filter: `lobby_id=eq.${lobbyId}` },
        () => setUnreadCount((count) => count + 1)
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [expanded, lobby?.id])

  useEffect(() => {
    if (expanded) setUnreadCount(0)
  }, [expanded])

  if (!lobby || !currentUserId) return null

  return (
    // Sidebar is a fixed w-56 (14rem) — this strip spans the content area to
    // its right, not the full window. `px-6` matches the old bottom-6/
    // right-6 margin. Both states are full-width now, only the height
    // (and what's rendered inside) differs between minimized and expanded.
    <div className="pointer-events-none fixed bottom-6 left-56 right-0 z-40 px-6">
      <div
        className={[
          'pointer-events-auto flex w-full flex-col overflow-hidden rounded-2xl border border-neutral-800 shadow-2xl transition-[height] duration-200',
          expanded ? 'h-[38rem] bg-neutral-900' : 'h-24'
        ].join(' ')}
      >
        {expanded ? (
          <LobbyRoom
            lobby={lobby}
            currentUserId={currentUserId}
            onMinimize={() => onExpandedChange(false)}
            launch={launch}
          />
        ) : (
          <LobbyMinimizedCard lobby={lobby} unreadCount={unreadCount} onExpand={() => onExpandedChange(true)} />
        )}
      </div>
    </div>
  )
}
