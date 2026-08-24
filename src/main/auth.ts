import { SUPABASE_PROJECT_URL } from '@shared/env'

const STEAM_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login'

/**
 * Builds the Steam OpenID URL that kicks off sign-in. The return address
 * points at the `steam-auth-callback` Edge Function, which does the actual
 * verification round trip with Steam (see supabase/functions). Main opens
 * this in the system browser via `shell.openExternal` — never a
 * BrowserWindow/webview, which Steam flags as phishing for embedded logins.
 */
export function buildSteamOpenIdUrl(): string {
  const returnTo = `${SUPABASE_PROJECT_URL}/functions/v1/steam-auth-callback`
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': SUPABASE_PROJECT_URL,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
  })
  return `${STEAM_OPENID_ENDPOINT}?${params.toString()}`
}
