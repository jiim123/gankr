import { useState } from 'react'
import type { ScoredLobby } from '../lib/lobby-scoring'
import { steamHeaderImageUrl } from '../lib/steam-images'

interface LobbyCardProps {
  scored: ScoredLobby
  onJoin: () => void
  joining: boolean
}

function labelForMic(mic: string): string {
  switch (mic) {
    case 'off':
      return 'Mic off'
    case 'preferred':
      return 'Mic preferred'
    case 'required':
      return 'Mic required'
    default:
      return mic
  }
}

/**
 * `surface` card for one search result. Mismatch reasons (region/mic/tone)
 * are shown as plain chips instead of hiding the lobby, per "search is
 * scored, not filtered — the player decides." The "N of M in game" line
 * only renders when inGameCount > 0: structurally correct per spec, but it
 * will never actually render until Phase 8 adds real launch detection.
 */
export default function LobbyCard({ scored, onJoin, joining }: LobbyCardProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const { lobby, reasons } = scored

  const memberCount = lobby.members.length
  const inGameCount = lobby.members.filter((member) => member.memberState === 'in_game').length

  return (
    <div className="surface flex flex-col overflow-hidden">
      {imageFailed ? (
        <div className="h-28 w-full bg-neutral-800" aria-hidden="true" />
      ) : (
        <img
          src={steamHeaderImageUrl(lobby.appid)}
          alt=""
          className="h-28 w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      )}

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">{lobby.gameName}</h3>
          <p className="mt-1 text-xs text-neutral-400">
            {lobby.region} &middot; {labelForMic(lobby.mic)} &middot;{' '}
            {lobby.tone === 'casual' ? 'Casual' : 'Competitive'} &middot; {memberCount}/{lobby.maxMembers}
          </p>
        </div>

        {inGameCount > 0 && (
          <p className="text-xs text-emerald-400">
            {inGameCount} of {memberCount} in game
          </p>
        )}

        {reasons.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {reasons.map((reason) => (
              <span key={reason} className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                {reason}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-1">
          <div className="flex -space-x-2">
            {lobby.members.map((member) =>
              member.avatarUrl ? (
                <img
                  key={member.userId}
                  src={member.avatarUrl}
                  alt=""
                  className="h-7 w-7 rounded-full border-2 border-neutral-900"
                />
              ) : (
                <div
                  key={member.userId}
                  className="h-7 w-7 rounded-full border-2 border-neutral-900 bg-neutral-700"
                  aria-hidden="true"
                />
              )
            )}
          </div>

          <button
            type="button"
            className="btn-primary"
            disabled={lobby.locked || joining}
            onClick={onJoin}
          >
            {lobby.locked ? 'Locked' : joining ? 'Joining…' : 'Join'}
          </button>
        </div>
      </div>
    </div>
  )
}
