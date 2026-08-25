import { useEffect, useRef, useState } from 'react'
import type { LobbySummary } from '../lib/lobby-summary'

interface DockedLobbyBarProps {
  lobby: LobbySummary | null
}

/**
 * Persistent bar for the lobby the user is currently in. Lives at the
 * layout level (see AppShell) so it stays mounted across route changes
 * instead of being tied to any one page. Clicking it expands in place into
 * a fuller view; Phase 7 replaces the expanded panel with the real lobby
 * room (member list, requirements, chat).
 *
 * "membersReady" from the Phase 3 stub is gone — no "ready" concept exists
 * anywhere in the schema. It's replaced by the same "N of M in game" line
 * used on LobbyCard, which honestly renders nothing until Phase 8 exists.
 */
export default function DockedLobbyBar({ lobby }: DockedLobbyBarProps) {
  const [expanded, setExpanded] = useState(false)
  // `undefined` means "not yet initialized" so the very first render (which
  // may already have an active lobby, e.g. reopening the app) doesn't
  // auto-expand — only a join/create that happens *during* this session does.
  const previousLobbyId = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    const currentId = lobby?.id ?? null
    const previousId = previousLobbyId.current
    if (previousId !== undefined && currentId !== null && currentId !== previousId) {
      setExpanded(true)
    }
    if (currentId === null) setExpanded(false)
    previousLobbyId.current = currentId
  }, [lobby?.id])

  if (!lobby) return null

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

      {expanded && (
        <div className="border-t border-neutral-800 px-4 py-3 text-sm text-neutral-400">
          Full lobby room is not built yet. This panel will show the member list, game
          requirements, and chat.
        </div>
      )}
    </div>
  )
}
