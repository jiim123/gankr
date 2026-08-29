// POST endpoint the signed-in renderer calls (see
// src/renderer/src/lib/feedback.ts) to submit a positive or negative tag
// about a lobbymate after a shared session. The giver is identified from
// their Supabase JWT — never from a user id in the request body — and every
// write goes through the service-role client, since `feedback` has zero
// client RLS write policies by design (see
// supabase/migrations/20260829120100_feedback_schema.sql).
//
// ensureSessionHistory()/syncSessionParticipant() below reimplement
// private.ensure_session_history()/private.sync_session_participant()
// (supabase/migrations/20260829120000_session_history_lazy_creation.sql)
// as plain queries under the service-role client, rather than calling them
// over RPC — a service-role client still goes through PostgREST, which is
// blocked from routing to the `private` schema at all (see that
// migration's header comment), the same restriction the renderer has. Keep
// these two implementations in sync if the interval math ever changes.

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const MIN_OVERLAP_MINUTES = 10
const PAIR_COOLDOWN_DAYS = 7
const WEEKLY_NEGATIVE_BUDGET = 5

const POSITIVE_TAGS = ['friendly', 'team_player', 'fun_to_play_with', 'leader', 'respectful'] as const
const NEGATIVE_TAGS = ['toxic', 'rage_quitter', 'poor_teamwork', 'afk', 'untrustworthy'] as const

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS'
}

interface SubmitFeedbackRequestBody {
  lobbyId?: string
  toUserId?: string
  tag?: string
  polarity?: string
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' }
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Deno Edge Function runtime, no shared client type across the boundary
type AdminClient = any

/** Mirrors private.ensure_session_history() — find-or-create by lobby_id,
 * tolerating a lost create race the same way the SQL version does. */
async function ensureSessionHistory(adminClient: AdminClient, lobbyId: string): Promise<string | null> {
  const { data: existing } = await adminClient.from('session_history').select('id').eq('lobby_id', lobbyId).maybeSingle()
  if (existing) return existing.id as string

  const { data: lobby } = await adminClient.from('lobbies').select('appid, created_at').eq('id', lobbyId).maybeSingle()
  if (!lobby) return null

  const { count: memberCount } = await adminClient
    .from('lobby_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('lobby_id', lobbyId)

  const { data: inserted, error: insertError } = await adminClient
    .from('session_history')
    .insert({ lobby_id: lobbyId, appid: lobby.appid, started_at: lobby.created_at, member_count: memberCount ?? 0 })
    .select('id')
    .maybeSingle()

  if (inserted) return inserted.id as string
  if (insertError) {
    // Lost a create race against another caller in the same instant —
    // same recovery as the SQL version's ON CONFLICT DO NOTHING branch.
    const { data: afterRace } = await adminClient.from('session_history').select('id').eq('lobby_id', lobbyId).maybeSingle()
    return afterRace ? (afterRace.id as string) : null
  }
  return null
}

/** Mirrors private.sync_session_participant() — upserts one participant's
 * real in-game interval from their current lobby_members row. */
async function syncSessionParticipant(adminClient: AdminClient, sessionId: string, userId: string, lobbyId: string): Promise<void> {
  const { data: member } = await adminClient
    .from('lobby_members')
    .select('game_started_at, game_ended_at, left_at')
    .eq('lobby_id', lobbyId)
    .eq('user_id', userId)
    .maybeSingle()

  const startedAt: string | null = member?.game_started_at ?? null
  let endedAt: string | null = null
  let minutes = 0

  if (startedAt) {
    endedAt = member.game_ended_at ?? member.left_at ?? new Date().toISOString()
    minutes = Math.max(0, Math.round((+new Date(endedAt) - +new Date(startedAt)) / 60000))
  }

  await adminClient
    .from('session_participants')
    .upsert(
      { session_id: sessionId, user_id: userId, minutes_in_game: minutes, started_at: startedAt, ended_at: endedAt },
      { onConflict: 'session_id,user_id' }
    )
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405)
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[submit-feedback] missing required secret(s)')
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

  // The giver's identity comes only from the verified JWT, never from
  // anything in the request body.
  const { data: userData, error: userError } = await adminClient.auth.getUser(token)
  if (userError || !userData?.user) {
    return jsonResponse({ error: 'invalid session' }, 401)
  }
  const fromUserId = userData.user.id

  let body: SubmitFeedbackRequestBody = {}
  try {
    const text = await req.text()
    if (text) body = JSON.parse(text) as SubmitFeedbackRequestBody
  } catch {
    return jsonResponse({ error: 'invalid request body' }, 400)
  }

  const { lobbyId, toUserId, tag, polarity } = body
  if (!lobbyId || !toUserId || !tag || !polarity) {
    return jsonResponse({ error: 'lobbyId, toUserId, tag, and polarity are required' }, 400)
  }
  if (toUserId === fromUserId) {
    return jsonResponse({ error: 'cannot give yourself feedback' }, 400)
  }

  // 1. Tag must belong to the declared polarity.
  const validTags = polarity === 'positive' ? POSITIVE_TAGS : polarity === 'negative' ? NEGATIVE_TAGS : null
  if (!validTags || !(validTags as readonly string[]).includes(tag)) {
    return jsonResponse({ error: 'tag does not match polarity' }, 400)
  }

  // 2. Both must be (ever-)members of the lobby — same posture as
  // submit-report: left_at is not required to be null.
  const [{ data: fromMembership }, { data: toMembership }] = await Promise.all([
    adminClient.from('lobby_members').select('lobby_id').eq('lobby_id', lobbyId).eq('user_id', fromUserId).maybeSingle(),
    adminClient.from('lobby_members').select('lobby_id').eq('lobby_id', lobbyId).eq('user_id', toUserId).maybeSingle()
  ])
  if (!fromMembership || !toMembership) {
    return jsonResponse({ error: 'not a member of that lobby' }, 403)
  }

  // 3. Resolve/create the session and sync both participants' real
  // intervals, then require real overlap of at least 10 minutes.
  const sessionId = await ensureSessionHistory(adminClient, lobbyId)
  if (!sessionId) {
    console.error('[submit-feedback] could not resolve session for lobby', lobbyId)
    return jsonResponse({ error: 'lookup failed' }, 500)
  }
  await Promise.all([
    syncSessionParticipant(adminClient, sessionId, fromUserId, lobbyId),
    syncSessionParticipant(adminClient, sessionId, toUserId, lobbyId)
  ])

  const [{ data: fromParticipant }, { data: toParticipant }] = await Promise.all([
    adminClient.from('session_participants').select('started_at, ended_at').eq('session_id', sessionId).eq('user_id', fromUserId).maybeSingle(),
    adminClient.from('session_participants').select('started_at, ended_at').eq('session_id', sessionId).eq('user_id', toUserId).maybeSingle()
  ])

  const overlapMinutes =
    fromParticipant?.started_at && fromParticipant?.ended_at && toParticipant?.started_at && toParticipant?.ended_at
      ? Math.max(
          0,
          (Math.min(+new Date(fromParticipant.ended_at), +new Date(toParticipant.ended_at)) -
            Math.max(+new Date(fromParticipant.started_at), +new Date(toParticipant.started_at))) /
            60000
        )
      : 0

  if (overlapMinutes < MIN_OVERLAP_MINUTES) {
    return jsonResponse({ error: 'not enough shared in-game time in this session' }, 400)
  }

  // 4. One submission per (from, to, session) — pre-check for a clean
  // error rather than a raw unique-constraint violation.
  const { data: existingForSession } = await adminClient
    .from('feedback')
    .select('id')
    .eq('from_user_id', fromUserId)
    .eq('to_user_id', toUserId)
    .eq('session_id', sessionId)
    .maybeSingle()
  if (existingForSession) {
    return jsonResponse({ error: 'already submitted feedback for this session' }, 409)
  }

  const cooldownStart = new Date(Date.now() - PAIR_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // 5. Same pair capped at one submission per rolling week, any session.
  const { data: recentForPair } = await adminClient
    .from('feedback')
    .select('id')
    .eq('from_user_id', fromUserId)
    .eq('to_user_id', toUserId)
    .gte('created_at', cooldownStart)
    .limit(1)
  if (recentForPair?.length) {
    return jsonResponse({ error: 'you already gave this player feedback this week' }, 429)
  }

  // 6. Weekly budget of negative tags — positives are uncapped by this rule.
  if (polarity === 'negative') {
    const { count } = await adminClient
      .from('feedback')
      .select('id', { count: 'exact', head: true })
      .eq('from_user_id', fromUserId)
      .eq('polarity', 'negative')
      .gte('created_at', cooldownStart)
    if ((count ?? 0) >= WEEKLY_NEGATIVE_BUDGET) {
      return jsonResponse({ error: 'weekly negative feedback limit reached' }, 429)
    }
  }

  // 7. Insert.
  const { error: insertError } = await adminClient
    .from('feedback')
    .insert({ from_user_id: fromUserId, to_user_id: toUserId, session_id: sessionId, tag, polarity })

  if (insertError) {
    console.error('[submit-feedback] insert failed', insertError)
    return jsonResponse({ error: 'insert failed' }, 500)
  }

  return jsonResponse({ ok: true })
})
