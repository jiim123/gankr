import { useState } from 'react'
import { steamHeaderImageUrl } from '../lib/steam-images'

interface GameSummaryCardProps {
  appid: string
  gameName: string
  lobbyCount: number
  onClick: () => void
}

/**
 * Find lobby's browse view: one card per game with at least one lobby
 * matching the current filters, not one per lobby (see LobbyCard for that,
 * used once a game is picked). Clicking drills into that game's lobby list.
 */
export default function GameSummaryCard({ appid, gameName, lobbyCount, onClick }: GameSummaryCardProps) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      className="surface flex flex-col overflow-hidden text-left transition-colors hover:border-neutral-700"
    >
      {imageFailed ? (
        <div className="aspect-[460/215] w-full bg-neutral-800" aria-hidden="true" />
      ) : (
        <img
          src={steamHeaderImageUrl(appid)}
          alt=""
          className="aspect-[460/215] w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      )}
      <div className="flex flex-col gap-0.5 p-3">
        <h3 className="truncate text-sm font-medium text-foreground">{gameName}</h3>
        <p className="text-xs text-neutral-400">
          {lobbyCount} {lobbyCount === 1 ? 'lobby' : 'lobbies'} available
        </p>
      </div>
    </button>
  )
}
