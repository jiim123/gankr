const APPID_PATTERN = /^\d{1,10}$/

/**
 * Builds the `steam://rungameid/<appid>` URL for Phase 8's "Start game"
 * action. Validates the appid shape before returning anything — same posture
 * as buildSteamAddFriendUrl() in src/main/steam-friend.ts, which this
 * mirrors. Clicking Start game is intent only; a real detected process (see
 * src/main/game-detection) is the only thing that ever marks someone
 * in_game.
 */
export function buildSteamLaunchUrl(appid: string): string | null {
  if (!APPID_PATTERN.test(appid)) return null
  return `steam://rungameid/${appid}`
}
