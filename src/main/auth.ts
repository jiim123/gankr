const STEAM_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login'

// Steam's OpenID consent page always displays the realm/return_to domain —
// there's no separate "app name" field — so this points at a thin reverse
// proxy on our own domain (see auth-proxy/) rather than the raw Supabase
// project URL, purely so Steam shows "auth.gankr.com" instead of
// "<ref>.supabase.co". The proxy forwards everything, unchanged, to the
// steam-auth-callback Edge Function, which does the actual verification.
const GANKR_AUTH_ORIGIN = 'https://auth.gankr.com'

/**
 * Builds the Steam OpenID URL that kicks off sign-in. Main opens this in
 * the system browser via `shell.openExternal` — never a BrowserWindow/
 * webview, which Steam flags as phishing for embedded logins.
 */
export function buildSteamOpenIdUrl(): string {
  const returnTo = `${GANKR_AUTH_ORIGIN}/api/steam-callback`
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': GANKR_AUTH_ORIGIN,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
  })
  return `${STEAM_OPENID_ENDPOINT}?${params.toString()}`
}
