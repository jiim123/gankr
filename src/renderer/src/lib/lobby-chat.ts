import { useCallback, useEffect, useRef, useState } from 'react'
import type { Tables } from '@shared/db-types'
import { supabase } from './supabase'
import type { LobbyMemberSummary } from './lobby-summary'

type MessageRow = Tables<'lobby_messages'>

export interface ChatMessage {
  id: string
  userId: string | null
  kind: MessageRow['kind']
  body: string
  seq: number
  createdAt: string
  /** null for system messages (user_id is null). */
  senderDisplayName: string | null
  senderAvatarUrl: string | null
}

const HISTORY_LIMIT = 100
const BODY_CAP = 500
const RATE_LIMIT_MESSAGE = 'Slow down, too many messages in a short time.'

interface SenderInfo {
  displayName: string
  avatarUrl: string | null
}

/** Single batched lookup, used both for the initial history fetch (senders
 * no longer in the member list) and, with a one-element array, for a live
 * INSERT from a sender not yet resolvable any other way. */
async function fetchSenders(userIds: readonly string[]): Promise<Map<string, SenderInfo>> {
  if (userIds.length === 0) return new Map()
  const { data } = await supabase.from('users').select('id, display_name, avatar_url').in('id', userIds)
  return new Map(
    (data ?? []).map((user) => [user.id, { displayName: user.display_name, avatarUrl: user.avatar_url }])
  )
}

/**
 * Chat for one lobby room. Initial fetch is the last 100 messages ordered
 * only by `seq` — the monotonic column is sufficient ordering on its own,
 * and `created_at` is a Postgres default, never client time, matching the
 * "never trust client time" rule. No older-history pagination: chat is
 * disposable and short-lived by design, not worth the complexity yet.
 *
 * Realtime adds only new INSERTs; nothing ever updates or deletes a message
 * from the client. Sender display info is resolved from `members` (already
 * in memory from useActiveLobby) first; a sender no longer in the member
 * list (they left) falls back to a batched `users` lookup, cached for the
 * life of the hook.
 *
 * No optimistic local append on send — a sent message renders once the real
 * Realtime INSERT round-trips back, which is what actually proves the
 * plumbing works end to end.
 */
export function useLobbyChat(
  lobbyId: string | null,
  currentUserId: string | undefined,
  members: readonly LobbyMemberSummary[]
) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const membersRef = useRef(members)
  membersRef.current = members

  const senderCacheRef = useRef(new Map<string, SenderInfo>())

  const resolveSender = useCallback(
    (userId: string | null): { displayName: string | null; avatarUrl: string | null } => {
      if (!userId) return { displayName: null, avatarUrl: null }
      const member = membersRef.current.find((candidate) => candidate.userId === userId)
      if (member) return { displayName: member.displayName, avatarUrl: member.avatarUrl }
      const cached = senderCacheRef.current.get(userId)
      if (cached) return { displayName: cached.displayName, avatarUrl: cached.avatarUrl }
      return { displayName: 'Unknown player', avatarUrl: null }
    },
    []
  )

  const toChatMessage = useCallback(
    (row: MessageRow): ChatMessage => {
      const sender = resolveSender(row.user_id)
      return {
        id: row.id,
        userId: row.user_id,
        kind: row.kind,
        body: row.body,
        seq: row.seq,
        createdAt: row.created_at,
        senderDisplayName: sender.displayName,
        senderAvatarUrl: sender.avatarUrl
      }
    },
    [resolveSender]
  )

  useEffect(() => {
    if (!lobbyId) {
      setMessages([])
      return undefined
    }
    let cancelled = false

    void (async () => {
      const { data } = await supabase
        .from('lobby_messages')
        .select('*')
        .eq('lobby_id', lobbyId)
        .order('seq', { ascending: false })
        .limit(HISTORY_LIMIT)
      if (cancelled) return
      const rows = (data ?? []).slice().reverse()

      const knownIds = new Set(membersRef.current.map((member) => member.userId))
      const unresolved = [
        ...new Set(
          rows
            .map((row) => row.user_id)
            .filter((id): id is string => id !== null && !knownIds.has(id))
        )
      ]
      const fetched = await fetchSenders(unresolved)
      if (cancelled) return
      for (const [id, info] of fetched) senderCacheRef.current.set(id, info)

      setMessages(rows.map(toChatMessage))
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the lobby id should re-trigger the initial history fetch, not every member-list or callback-identity change it may cause.
  }, [lobbyId])

  useEffect(() => {
    if (!lobbyId) return undefined

    const channel = supabase
      .channel(`lobby-chat-${lobbyId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lobby_messages', filter: `lobby_id=eq.${lobbyId}` },
        (payload) => {
          const row = payload.new as MessageRow
          void (async () => {
            const knownIds = new Set(membersRef.current.map((member) => member.userId))
            if (row.user_id && !knownIds.has(row.user_id) && !senderCacheRef.current.has(row.user_id)) {
              const fetched = await fetchSenders([row.user_id])
              for (const [id, info] of fetched) senderCacheRef.current.set(id, info)
            }
            setMessages((current) => [...current, toChatMessage(row)])
          })()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the lobby id should re-subscribe; toChatMessage is a stable ref-backed callback.
  }, [lobbyId])

  /** Returns whether the send succeeded, so the caller (LobbyChatPanel) can
   * decide whether to clear its draft — reading the hook's own `error`
   * state right after this resolves would see a stale, pre-update value. */
  const sendMessage = useCallback(
    async (body: string): Promise<boolean> => {
      if (!lobbyId || !currentUserId) return false
      const trimmed = body.trim().slice(0, BODY_CAP)
      if (!trimmed) return false

      setSending(true)
      setError(null)
      try {
        const { error: insertError } = await supabase
          .from('lobby_messages')
          .insert({ lobby_id: lobbyId, user_id: currentUserId, body: trimmed })
        if (insertError) {
          setError(RATE_LIMIT_MESSAGE)
          return false
        }
        return true
      } finally {
        setSending(false)
      }
    },
    [lobbyId, currentUserId]
  )

  return { messages, sendMessage, sending, error }
}

export { BODY_CAP as CHAT_BODY_CAP }
