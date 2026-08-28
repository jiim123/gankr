const STEAM_ID64_PATTERN = /^\d{5,20}$/

/**
 * Builds the `steam://friends/add/<id>` URL for Phase 11's Add-on-Steam
 * handoff. Validates the id shape before returning anything — never opens a
 * protocol URL built from unvalidated input — same posture as
 * buildSteamOpenIdUrl() in src/main/auth.ts, which is why this lives next
 * to it as its own file rather than inline in ipc.ts.
 */
export function buildSteamAddFriendUrl(steamId64: string): string | null {
  if (!STEAM_ID64_PATTERN.test(steamId64)) return null
  return `steam://friends/add/${steamId64}`
}
