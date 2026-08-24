// POST endpoint the signed-in renderer calls (see
// src/renderer/src/lib/librarySync.ts) to refresh the caller's Steam
// library. The caller is identified from their Supabase JWT — never from a
// user id in the request body — and every write goes through the
// service-role client, which is the only way `games` and `user_games` get
// written (see the RLS policies in supabase/migrations).

import { createClient } from 'npm:@supabase/supabase-js@2'

const STEAM_API_KEY = Deno.env.get('STEAM_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const STALE_AFTER_MS = 24 * 60 * 60 * 1000

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS'
}

interface SyncRequestBody {
  force?: boolean
}

interface SteamOwnedGame {
  appid: number
  name: string
  img_icon_url?: string
  playtime_forever: number
  playtime_2weeks?: number
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' }
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405)
  }
  if (!STEAM_API_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[steam-library-sync] missing required secret(s)')
    return jsonResponse({ error: 'server misconfigured' }, 500)
  }

  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) {
    return jsonResponse({ error: 'missing authorization' }, 401)
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // The caller's identity comes only from the verified JWT, never from
  // anything in the request body.
  const { data: userData, error: userError } = await adminClient.auth.getUser(token)
  if (userError || !userData?.user) {
    return jsonResponse({ error: 'invalid session' }, 401)
  }
  const userId = userData.user.id

  let body: SyncRequestBody = {}
  try {
    const text = await req.text()
    if (text) body = JSON.parse(text) as SyncRequestBody
  } catch {
    body = {}
  }
  const force = body.force === true

  const { data: identity, error: identityError } = await adminClient
    .from('steam_identities')
    .select('steam_id64, profile_visibility, last_synced_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (identityError) {
    console.error('[steam-library-sync] identity lookup failed', identityError)
    return jsonResponse({ error: 'lookup failed' }, 500)
  }
  if (!identity) {
    return jsonResponse({ error: 'no steam identity linked' }, 404)
  }

  if (!force && identity.last_synced_at) {
    const age = Date.now() - new Date(identity.last_synced_at).getTime()
    if (age < STALE_AFTER_MS) {
      return jsonResponse({
        skipped: true,
        profileVisibility: identity.profile_visibility,
        lastSyncedAt: identity.last_synced_at
      })
    }
  }

  const ownedGamesUrl =
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/` +
    `?key=${STEAM_API_KEY}&steamid=${identity.steam_id64}&include_appinfo=1&include_played_free_games=1&format=json`

  let games: SteamOwnedGame[] = []
  try {
    const response = await fetch(ownedGamesUrl)
    const json = await response.json()
    games = Array.isArray(json?.response?.games) ? json.response.games : []
  } catch (error) {
    console.error('[steam-library-sync] GetOwnedGames failed', error)
    return jsonResponse({ error: 'steam request failed' }, 502)
  }

  const now = new Date().toISOString()

  if (games.length === 0) {
    // Steam returns no games array (or an empty one) for a private
    // profile, not for someone who genuinely owns nothing. Never treat
    // this as an empty library, and never touch existing user_games rows.
    const { error: updateError } = await adminClient
      .from('steam_identities')
      .update({ profile_visibility: 'private', last_synced_at: now })
      .eq('user_id', userId)
    if (updateError) {
      console.error('[steam-library-sync] visibility update failed', updateError)
      return jsonResponse({ error: 'update failed' }, 500)
    }
    return jsonResponse({ profileVisibility: 'private', lastSyncedAt: now, gameCount: 0 })
  }

  const gameRows = games.map((game) => ({
    appid: String(game.appid),
    name: game.name,
    // GetOwnedGames only returns the small app icon, not the wide store
    // header banner, so this is built from img_icon_url per the Steam CDN
    // convention rather than fabricated or left pointing at the store page.
    header_image: game.img_icon_url
      ? `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg`
      : null,
    genres: [] as string[] // GetOwnedGames doesn't return genres; never fabricate data.
  }))

  const { error: gamesUpsertError } = await adminClient.from('games').upsert(gameRows, { onConflict: 'appid' })
  if (gamesUpsertError) {
    console.error('[steam-library-sync] games upsert failed', gamesUpsertError)
    return jsonResponse({ error: 'games upsert failed' }, 500)
  }

  const userGameRows = games.map((game) => ({
    user_id: userId,
    appid: String(game.appid),
    // Steam already reports playtime in minutes; stored as-is. The display
    // layer converts minutes -> hours (see src/renderer/src/routes/ProfilePage.tsx).
    playtime_forever_minutes: game.playtime_forever,
    playtime_2weeks_minutes: game.playtime_2weeks ?? 0,
    source: 'steam' as const,
    synced_at: now
  }))

  const { error: userGamesUpsertError } = await adminClient
    .from('user_games')
    .upsert(userGameRows, { onConflict: 'user_id,appid' })
  if (userGamesUpsertError) {
    console.error('[steam-library-sync] user_games upsert failed', userGamesUpsertError)
    return jsonResponse({ error: 'user_games upsert failed' }, 500)
  }

  const { error: visibilityUpdateError } = await adminClient
    .from('steam_identities')
    .update({ profile_visibility: 'public', last_synced_at: now })
    .eq('user_id', userId)
  if (visibilityUpdateError) {
    console.error('[steam-library-sync] visibility update failed', visibilityUpdateError)
    return jsonResponse({ error: 'update failed' }, 500)
  }

  return jsonResponse({ profileVisibility: 'public', lastSyncedAt: now, gameCount: games.length })
})
