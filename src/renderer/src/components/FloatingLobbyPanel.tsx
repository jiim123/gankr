import { useEffect, useState } from 'react'
import type { LobbySummary } from '../lib/lobby-summary'
import { supabase } from '../lib/supabase'
import LobbyRoom from './LobbyRoom'
import LobbyMinimizedCard from './LobbyMinimizedCard'

interface FloatingLobbyPanelProps {
  lobby: LobbySummary | null
  currentUserId: string | undefined
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
}

/**
 * Floating panel for the lobby the user is currently in — fixed to the
 * bottom-right corner (rounded-2xl, shadow) rather than docked in normal
 * document flow, so it no longer squeezes <main>. Lives at the layout level
 * (see AppShell) so it stays mounted across route changes.
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
  onExpandedChange
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
    // its right, not the full window. `justify-center` + `px-6` (matching
    // the old bottom-6/right-6 margin) centers the fixed-size expanded box
    // within that area via plain flexbox, and does nothing for the
    // minimized bar since it's `w-full` and fills the strip either way.
    <div className="pointer-events-none fixed bottom-6 left-56 right-0 z-40 flex justify-center px-6">
      <div
        className={[
          'pointer-events-auto flex flex-col overflow-hidden rounded-2xl border border-neutral-800 shadow-2xl transition-[width,height] duration-200',
          expanded ? 'h-[38rem] w-[26rem] bg-neutral-900' : 'h-24 w-full'
        ].join(' ')}
      >
        {expanded ? (
          <LobbyRoom lobby={lobby} currentUserId={currentUserId} onMinimize={() => onExpandedChange(false)} />
        ) : (
          <LobbyMinimizedCard lobby={lobby} unreadCount={unreadCount} onExpand={() => onExpandedChange(true)} />
        )}
      </div>
    </div>
  )
}
