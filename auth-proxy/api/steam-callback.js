// Pure passthrough. Steam's OpenID consent page displays whatever domain
// openid.realm/return_to point at, with no separate "app name" field, so
// this exists solely to put "auth.gankr.com" in front of the user instead
// of the raw Supabase project URL. It does no verification of its own —
// that all happens in the steam-auth-callback Edge Function this forwards
// to, which is the thing that actually round-trips with Steam before
// trusting anything. No secrets live here.
const SUPABASE_FUNCTION_URL = 'https://vqeefvrbxccfmfngwifr.supabase.co/functions/v1/steam-auth-callback'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).send('Method not allowed')
    return
  }

  const queryString = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
  const targetUrl = SUPABASE_FUNCTION_URL + queryString

  let upstream
  try {
    // manual: the Edge Function's success response is a 302 to a gankr://
    // URL, which isn't http(s) — letting fetch auto-follow it would throw.
    // We want that redirect response itself, to re-emit to the browser.
    upstream = await fetch(targetUrl, { method: 'GET', redirect: 'manual' })
  } catch (error) {
    res.status(502).send('Could not reach the sign-in service. Close this tab and try again from Gankr.')
    return
  }

  const location = upstream.headers.get('location')
  if (location) res.setHeader('location', location)

  const contentType = upstream.headers.get('content-type')
  if (contentType) res.setHeader('content-type', contentType)

  const body = await upstream.text()
  res.status(upstream.status).send(body)
}
