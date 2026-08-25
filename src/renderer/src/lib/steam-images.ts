/**
 * Steam's real wide header banner for a game, used on lobby cards instead of
 * the stored `games.header_image` (currently just a small icon from Phase
 * 5's library sync, left as-is). Pure function of appid, no extra API call.
 *
 * Requires `https://cdn.akamai.steamstatic.com` in the renderer's CSP
 * img-src (see src/renderer/index.html) or the image silently fails to load.
 */
export function steamHeaderImageUrl(appid: string): string {
  return `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`
}
