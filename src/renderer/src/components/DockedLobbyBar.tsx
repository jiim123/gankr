import { useEffect, useRef, useState } from 'react'
import type { LobbySummary } from '../lib/lobby-summary'
import { supabase } from '../lib/supabase'
import LobbyRoom from './LobbyRoom'

interface DockedLobbyBarProps {
  lobby: LobbySummary | null
  currentUserId: string | undefined
}

/**
 * Persistent bar for the lobby the user is currently in. Lives at the
 * layout level (see AppShell) so it stays mounted across route changes
 * instead of being tied to any one page. Clicking it expands in place into
 * the full Phase 7 lobby room (member list, requirements, chat).
 *
 * "membersReady" from the Phase 3 stub is gone — no "ready" concept exists
 * anywhere in the schema. It's replaced by the same "N of M in game" line
 * used on LobbyCard, which honestly renders nothing until Phase 8 exists.
 */
export default function DockedLobbyBar({ lobby, currentUserId }: DockedLobbyBarProps) {
  const [expanded, setExpanded] = useState(false)
  // `undefined` means "not yet initialized" so the very first render (which
  // may already have an active lobby, e.g. reopening the app) doesn't
  // auto-expand — only a join/create that happens *during* this session does.
  const previousLobbyId = useRef<string | null | undefined>(undefined)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const currentId = lobby?.id ?? null
    const previousId = previousLobbyId.current
    if (previousId !== undefined && currentId !== null && currentId !== previousId) {
      setExpanded(true)
    }
    if (currentId === null) setExpanded(false)
    previousLobbyId.current = currentId
  }, [lobby?.id])

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

  const memberCount = lobby.members.length
  const inGameCount = lobby.members.filter((member) => member.memberState === 'in_game').length

  return (
    <div className="shrink-0 border-t border-neutral-800 bg-neutral-900">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-800/60"
      >
        <span
          className={[
            'h-2 w-2 shrink-0 rounded-full',
            lobby.status === 'open' ? 'bg-emerald-500' : 'bg-neutral-500'
          ].join(' ')}
          aria-hidden="true"
        />
        <span className="flex-1 truncate text-sm font-medium text-white">{lobby.gameName}</span>
        <span className="text-sm text-neutral-400">
          {memberCount}/{lobby.maxMembers} in lobby
        </span>
        {inGameCount > 0 && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
            {inGameCount} of {memberCount} in game
          </span>
        )}
        {!expanded && unreadCount > 0 && (
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-neutral-950">
            {unreadCount}
          </span>
        )}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path
            d="M6 15l6-6 6 6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {expanded && <LobbyRoom lobby={lobby} currentUserId={currentUserId} />}
    </div>
  )
}
