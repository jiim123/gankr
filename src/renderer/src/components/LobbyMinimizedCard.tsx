import { useState } from 'react'
import { resolveLobbyDisplayName, type LobbySummary } from '../lib/lobby-summary'
import { steamHeaderImageUrl } from '../lib/steam-images'

interface LobbyMinimizedCardProps {
  lobby: LobbySummary
  unreadCount: number
  onExpand: () => void
}

/**
 * The floating panel's minimized state: cover art fills the whole card with
 * a flat full-card scrim (not GameSummaryCard's bottom-only gradient) —
 * deliberate deviation. This card is short and landscape (h-24) with three
 * stacked text lines needing contrast across nearly its full height, unlike
 * GameSummaryCard's tall portrait card where text stays confined to the
 * bottom quarter. A bottom-only gradient here would leave the lobby name
 * (at the top) low-contrast against bright cover art.
 */
export default function LobbyMinimizedCard({ lobby, unreadCount, onExpand }: LobbyMinimizedCardProps) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <button type="button" onClick={onExpand} className="relative h-24 w-80 overflow-hidden text-left">
      {imageFailed ? (
        <div className="absolute inset-0 bg-neutral-800" aria-hidden="true" />
      ) : (
        <img
          src={steamHeaderImageUrl(lobby.appid)}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      )}

      <div className="absolute inset-0 bg-black/55" aria-hidden="true" />

      <div className="absolute inset-0 flex flex-col justify-between p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{resolveLobbyDisplayName(lobby)}</p>
          <p className="truncate text-xs text-neutral-300">{lobby.gameName}</p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-300">
            {lobby.members.length}/{lobby.maxMembers} in lobby
          </span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
