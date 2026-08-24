import { useState } from 'react'
import type { MockLobby } from '../state/mock-lobby'

interface DockedLobbyBarProps {
  lobby: MockLobby | null
}

/**
 * Persistent bar for the lobby the user is currently in. Lives at the
 * layout level (see AppShell) so it stays mounted across route changes
 * instead of being tied to any one page. Clicking it expands in place into
 * a fuller view; Phase 7 replaces the expanded panel with the real lobby
 * room (member list, requirements, chat).
 */
export default function DockedLobbyBar({ lobby }: DockedLobbyBarProps) {
  const [expanded, setExpanded] = useState(false)

  if (!lobby) return null

  const isReady = lobby.membersReady === lobby.memberCount

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
          {lobby.memberCount}/{lobby.maxMembers} in lobby
        </span>
        <span
          className={[
            'rounded-full px-2 py-0.5 text-xs font-medium',
            isReady ? 'bg-emerald-500/15 text-emerald-400' : 'bg-neutral-800 text-neutral-300'
          ].join(' ')}
        >
          {isReady ? 'Ready' : `${lobby.membersReady}/${lobby.memberCount} ready`}
        </span>
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
