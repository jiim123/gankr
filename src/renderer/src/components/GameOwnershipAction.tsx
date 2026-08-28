import { useState } from 'react'
import type { OwnershipStatus } from '../lib/ownership'
import { launchGameStandalone } from '../lib/launch-game'

interface GameOwnershipActionProps {
  appid: string
  status: OwnershipStatus
  onManualAdd?: () => void
}

/**
 * Renders the launch-adjacent action for a game, in whichever of the three
 * ownership states applies. Shipping only two of these three states would
 * tell real owners with an unsynced or private library that they don't own
 * things they do, so every place a launch action appears has to go through
 * this component (or handle all three states itself).
 *
 * This is the standalone case (ProfilePage, arbitrary owned games with no
 * active-lobby relationship) — a one-shot open via launchGameStandalone(),
 * no polling, no lobby_members row to write to. The lobby-integrated launch
 * flow (with real process detection, launch_failed/Retry, manual override)
 * lives on LobbyMemberCard's own-member branch instead, backed by
 * useLaunchDetection — see src/renderer/src/lib/launch-detection.ts.
 *
 * External links open via target="_blank", which main's window-open
 * handler (src/main/window.ts) redirects to the system browser — the
 * renderer never touches shell APIs directly.
 */
export default function GameOwnershipAction({ appid, status, onManualAdd }: GameOwnershipActionProps) {
  const [launching, setLaunching] = useState(false)
  const [steamNotRunning, setSteamNotRunning] = useState(false)

  async function handleStartGame(): Promise<void> {
    setLaunching(true)
    setSteamNotRunning(false)
    try {
      const { opened, steamRunning } = await launchGameStandalone(appid)
      if (!steamRunning) setSteamNotRunning(true)
      void opened
    } finally {
      setLaunching(false)
    }
  }

  if (status === 'owned') {
    return (
      <div className="flex items-center gap-2">
        <button type="button" className="btn-primary" disabled={launching} onClick={() => void handleStartGame()}>
          {launching ? 'Starting…' : 'Start game'}
        </button>
        {steamNotRunning && <span className="text-sm text-neutral-400">Steam isn&apos;t running — start it first</span>}
      </div>
    )
  }

  if (status === 'not_owned') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-neutral-400">You don&apos;t own this game</span>
        <a
          href={`https://store.steampowered.com/app/${appid}`}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary"
        >
          View in store
        </a>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-neutral-400">Can&apos;t check your library</span>
      <a
        href="https://steamcommunity.com/my/edit/settings"
        target="_blank"
        rel="noreferrer"
        className="btn-secondary"
      >
        Check Steam privacy
      </a>
      <button type="button" className="btn-secondary" onClick={onManualAdd}>
        Add manually
      </button>
    </div>
  )
}
