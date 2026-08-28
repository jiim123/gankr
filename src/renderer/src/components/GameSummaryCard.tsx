import { useState } from 'react'
import { steamHeaderImageUrl } from '../lib/steam-images'

interface GameSummaryCardProps {
  appid: string
  gameName: string
  lobbyCount: number
  onClick: () => void
}

/**
 * Find lobby's browse view: one card per game, cover art as the full card
 * background with a bottom gradient for legible text, not a separate
 * thumbnail + label layout. ~270x320 is the target size; the card actually
 * fills its grid column (grid-cols-5 on the parent) at that aspect ratio, so
 * it stays exactly 5-per-row at any window width instead of overflowing or
 * wrapping when the window is narrower than 5x270px.
 */
export default function GameSummaryCard({ appid, gameName, lobbyCount, onClick }: GameSummaryCardProps) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      className="surface relative aspect-[270/320] w-full overflow-hidden text-left transition-colors hover:border-neutral-700"
    >
      {imageFailed ? (
        <div className="absolute inset-0 bg-neutral-800" aria-hidden="true" />
      ) : (
        <img
          src={steamHeaderImageUrl(appid)}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      )}

      <div
        className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/95 to-transparent"
        aria-hidden="true"
      />

      <div className="absolute inset-x-0 bottom-0 p-3">
        <h3 className="truncate text-sm font-medium text-foreground">{gameName}</h3>
        <p className="text-xs text-neutral-300">
          {lobbyCount} {lobbyCount === 1 ? 'lobby' : 'lobbies'} available
        </p>
      </div>
    </button>
  )
}
