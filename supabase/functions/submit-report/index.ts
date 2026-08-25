// POST endpoint the signed-in renderer calls (see
// src/renderer/src/lib/reports.ts) to file a report against another lobby
// member. The reporter is identified from their Supabase JWT — never from a
// user id in the request body — and every write goes through the
// service-role client, since `reports` has zero client RLS policies by
// design (see supabase/migrations/20260824202946_rls_policies.sql).

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const SNAPSHOT_MESSAGE_LIMIT = 40

const REPORT_REASONS = [
  'Harassment or abuse',
  'Cheating',
  'Inappropriate name or content',
  'Other'
] as const

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS'
}

interface SubmitReportRequestBody {
  lobbyId?: string
  reportedUserId?: string
  reason?: string
  detail?: string
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
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[submit-report] missing required secret(s)')
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

  // The reporter's identity comes only from the verified JWT, never from
  // anything in the request body.
  const { data: userData, error: userError } = await adminClient.auth.getUser(token)
  if (userError || !userData?.user) {
    return jsonResponse({ error: 'invalid session' }, 401)
  }
  const reporterId = userData.user.id

  let body: SubmitReportRequestBody = {}
  try {
    const text = await req.text()
    if (text) body = JSON.parse(text) as SubmitReportRequestBody
  } catch {
    return jsonResponse({ error: 'invalid request body' }, 400)
  }

  const { lobbyId, reportedUserId, detail } = body
  const reason = body.reason
  if (!lobbyId || !reportedUserId || !reason) {
    return jsonResponse({ error: 'lobbyId, reportedUserId, and reason are required' }, 400)
  }
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) {
    return jsonResponse({ error: 'invalid reason' }, 400)
  }
  if (reportedUserId === reporterId) {
    return jsonResponse({ error: 'cannot report yourself' }, 400)
  }

  // Authorization: the reporter must have a lobby_members row for this
  // lobby. left_at is not required to be null — a reporter should still be
  // able to report someone from a lobby they've since left. Queried
  // directly via the service-role client (bypasses RLS; no need to reach
  // the non-exposed private.is_lobby_member helper).
  const { data: membership, error: membershipError } = await adminClient
    .from('lobby_members')
    .select('lobby_id')
    .eq('lobby_id', lobbyId)
    .eq('user_id', reporterId)
    .maybeSingle()

  if (membershipError) {
    console.error('[submit-report] membership lookup failed', membershipError)
    return jsonResponse({ error: 'lookup failed' }, 500)
  }
  if (!membership) {
    return jsonResponse({ error: 'not a member of that lobby' }, 403)
  }

  // Snapshot the most recent messages for context. Sender display names are
  // resolved now, at snapshot time, so the JSON stays readable after Phase 8
  // later deletes the live lobby_messages rows on lobby close.
  const { data: recentMessages, error: messagesError } = await adminClient
    .from('lobby_messages')
    .select('seq, created_at, user_id, kind, body')
    .eq('lobby_id', lobbyId)
    .order('seq', { ascending: false })
    .limit(SNAPSHOT_MESSAGE_LIMIT)

  if (messagesError) {
    console.error('[submit-report] message snapshot lookup failed', messagesError)
    return jsonResponse({ error: 'lookup failed' }, 500)
  }

  const messages = (recentMessages ?? []).slice().reverse()
  const senderIds = [...new Set(messages.map((message) => message.user_id).filter((id): id is string => id !== null))]

  const namesById = new Map<string, string>()
  if (senderIds.length > 0) {
    const { data: senderRows } = await adminClient.from('users').select('id, display_name').in('id', senderIds)
    for (const row of senderRows ?? []) namesById.set(row.id, row.display_name)
  }

  const messageSnapshot = messages.map((message) => ({
    seq: message.seq,
    createdAt: message.created_at,
    senderDisplayName: message.user_id ? (namesById.get(message.user_id) ?? 'Unknown player') : null,
    kind: message.kind,
    body: message.body
  }))

  const trimmedDetail = typeof detail === 'string' ? detail.trim() : ''
  const reasonText = trimmedDetail ? `${reason}: ${trimmedDetail}` : reason

  const { error: insertError } = await adminClient.from('reports').insert({
    reporter_id: reporterId,
    reported_user_id: reportedUserId,
    lobby_id: lobbyId,
    reason: reasonText,
    message_snapshot: messageSnapshot
  })

  if (insertError) {
    console.error('[submit-report] insert failed', insertError)
    return jsonResponse({ error: 'insert failed' }, 500)
  }

  return jsonResponse({ ok: true })
})
