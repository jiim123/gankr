export interface LaunchGameResult {
  opened: boolean
  steamRunning: boolean
}

/**
 * The non-lobby Start-game case: GameOwnershipAction renders for arbitrary
 * owned games on ProfilePage with no active-lobby relationship at all, so it
 * gets this simple one-shot helper instead of useLaunchDetection — no
 * lobby_members row to write to, no polling, no state to track after the
 * click.
 */
export async function launchGameStandalone(appid: string): Promise<LaunchGameResult> {
  const { running } = await window.gankr.isSteamRunning()
  if (!running) return { opened: false, steamRunning: false }

  const { opened } = await window.gankr.launchGame(appid)
  return { opened, steamRunning: true }
}
