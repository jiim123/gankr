// GET endpoint Steam's OpenID provider redirects the user's system browser
// to after they approve sign-in (see src/main/auth.ts for the URL that
// starts this flow, opened via shell.openExternal — never an embedded
// webview, which Steam flags as phishing).
//
// This function verifies the response, finds or creates the matching
// Supabase user keyed on SteamID64, mints a real session, and hands it
// back to the desktop app through the `gankr://` custom protocol.
//
// The incoming openid.* params are never trusted on their own: Steam
// requires posting them back with openid.mode=check_authentication before
// treating a sign-in as real, and this function does that round trip
// before anything else happens.

import { createClient } from 'npm:@supabase/supabase-js@2'

const STEAM_OPENID_URL = 'https://steamcommunity.com/openid/login'
const GANKR_PROTOCOL = 'gankr'

const STEAM_API_KEY = Deno.env.get('STEAM_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

interface SteamPlayerSummary {
  personaname?: string
  avatarfull?: string
}

function errorPage(message: string, status: number): Response {
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Gankr sign-in</title>
<style>
  body { background:#0a0a0a; color:#e5e5e5; font-family: -apple-system, "Segoe UI", Ubuntu, Roboto, sans-serif;
    display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
  main { max-width: 26rem; padding: 2rem; text-align:center; }
  h1 { font-size:1.1rem; font-weight:600; color:#fff; margin: 0 0 .5rem; }
  p { font-size:.9rem; color:#a3a3a3; line-height:1.5; }
</style>
</head>
<body>
  <main>
    <h1>Sign-in did not go through</h1>
    <p>${message} Close this tab and try again from Gankr.</p>
  </main>
</body>
</html>`
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })
}

Deno.serve(async (req: Request) => {
  if (!STEAM_API_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
    console.error('[steam-auth-callback] missing required secret(s)')
    return errorPage('The server is misconfigured.', 500)
  }

  const url = new URL(req.url)
  const params = url.searchParams

  if (!params.has('openid.claimed_id') || !params.has('openid.mode')) {
    return errorPage('Steam did not send a complete response.', 400)
  }

  // Step 1: round-trip the params back to Steam for verification. Every
  // param is copied as-is except openid.mode, which flips to
  // check_authentication. Do not proceed unless Steam confirms is_valid:true.
  const verifyParams = new URLSearchParams(params)
  verifyParams.set('openid.mode', 'check_authentication')

  let verifyText: string
  try {
    const verifyResponse = await fetch(STEAM_OPENID_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: verifyParams.toString()
    })
    verifyText = await verifyResponse.text()
  } catch (error) {
    console.error('[steam-auth-callback] verification request failed', error)
    return errorPage('Could not reach Steam to verify sign-in.', 502)
  }

  if (!/is_valid\s*:\s*true/.test(verifyText)) {
    console.warn('[steam-auth-callback] steam rejected verification')
    return errorPage('Steam could not verify this sign-in.', 401)
  }

  // Step 2: pull the SteamID64 out of the claimed_id URL.
  const claimedId = params.get('openid.claimed_id') ?? ''
  const steamIdMatch = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/.exec(claimedId)
  if (!steamIdMatch) {
    return errorPage('Steam sent back an identity we could not read.', 400)
  }
  const steamId64 = steamIdMatch[1] as string

  // Step 3: fetch the public profile summary.
  const summaryUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_API_KEY}&steamids=${steamId64}`
  let personaName: string
  let avatarFull: string | null
  try {
    const summaryResponse = await fetch(summaryUrl)
    const summaryJson = await summaryResponse.json()
    const player = summaryJson?.response?.players?.[0] as SteamPlayerSummary | undefined
    if (!player) {
      return errorPage('Steam did not return a profile for that account.', 502)
    }
    personaName = player.personaname ?? `Steam ${steamId64}`
    avatarFull = player.avatarfull ?? null
  } catch (error) {
    console.error('[steam-auth-callback] GetPlayerSummaries failed', error)
    return errorPage('Could not reach Steam for your profile.', 502)
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Step 4: find or create the Supabase identity keyed on SteamID64.
  const { data: existingIdentity, error: identityLookupError } = await adminClient
    .from('steam_identities')
    .select('user_id')
    .eq('steam_id64', steamId64)
    .maybeSingle()

  if (identityLookupError) {
    console.error('[steam-auth-callback] identity lookup failed', identityLookupError)
    return errorPage('Something went wrong looking up your account.', 500)
  }

  const syntheticEmail = `steam-${steamId64}@steam.gankr.internal`
  let userId: string

  if (existingIdentity) {
    userId = existingIdentity.user_id
    // People rename their Steam persona; refresh it on every sign-in.
    const { error: updateError } = await adminClient
      .from('users')
      .update({ display_name: personaName, avatar_url: avatarFull, last_seen_at: new Date().toISOString() })
      .eq('id', userId)
    if (updateError) {
      console.error('[steam-auth-callback] users update failed', updateError)
      return errorPage('Something went wrong updating your profile.', 500)
    }
  } else {
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: syntheticEmail,
      email_confirm: true,
      user_metadata: { steamid64: steamId64 }
    })
    if (createError || !created?.user) {
      console.error('[steam-auth-callback] createUser failed', createError)
      return errorPage('Something went wrong creating your account.', 500)
    }
    userId = created.user.id

    const { error: usersInsertError } = await adminClient
      .from('users')
      .insert({ id: userId, display_name: personaName, avatar_url: avatarFull })
    if (usersInsertError) {
      console.error('[steam-auth-callback] users insert failed', usersInsertError)
      return errorPage('Something went wrong creating your profile.', 500)
    }

    const { error: identityInsertError } = await adminClient.from('steam_identities').insert({
      user_id: userId,
      steam_id64: steamId64,
      profile_visibility: 'unknown',
      last_synced_at: null
    })
    if (identityInsertError) {
      console.error('[steam-auth-callback] steam_identities insert failed', identityInsertError)
      return errorPage('Something went wrong linking your Steam account.', 500)
    }
  }

  // Step 5: mint a real session without asking for credentials again. A
  // magic-link OTP is generated and immediately redeemed server-side, so
  // the user never sees an email or types anything.
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: syntheticEmail
  })
  const emailOtp = linkData?.properties?.email_otp
  if (linkError || !emailOtp) {
    console.error('[steam-auth-callback] generateLink failed', linkError)
    return errorPage('Something went wrong starting your session.', 500)
  }

  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const { data: verifyData, error: verifyOtpError } = await anonClient.auth.verifyOtp({
    email: syntheticEmail,
    token: emailOtp,
    type: 'email'
  })
  const session = verifyData?.session
  if (verifyOtpError || !session) {
    console.error('[steam-auth-callback] verifyOtp failed', verifyOtpError)
    return errorPage('Something went wrong finishing your sign-in.', 500)
  }

  // Step 6: hand the session back to the app. A fragment, not a query
  // string, so the tokens never land in a server access log along the way.
  const redirectUrl =
    `${GANKR_PROTOCOL}://auth-callback#` +
    `access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}`

  return new Response(null, { status: 302, headers: { location: redirectUrl } })
})
