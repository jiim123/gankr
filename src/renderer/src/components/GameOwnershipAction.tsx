import type { OwnershipStatus } from '../lib/ownership'

interface GameOwnershipActionProps {
  appid: string
  status: OwnershipStatus
  onManualAdd?: () => void
}

/**
 * Renders the launch-adjacent action for a game, in whichever of the three
 * ownership states applies. There is no real launch flow yet (Phase 8) —
 * `owned` is just a label until then. Shipping only two of these three
 * states would tell real owners with an unsynced or private library that
 * they don't own things they do, so every place a launch action appears
 * has to go through this component (or handle all three states itself).
 *
 * External links open via target="_blank", which main's window-open
 * handler (src/main/window.ts) redirects to the system browser — the
 * renderer never touches shell APIs directly.
 */
export default function GameOwnershipAction({ appid, status, onManualAdd }: GameOwnershipActionProps) {
  if (status === 'owned') {
    return (
      <button type="button" className="btn-primary" disabled title="Real launch logic ships in Phase 8">
        Start game
      </button>
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
