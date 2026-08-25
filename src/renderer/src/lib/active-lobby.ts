import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { buildLobbySummary, type LobbySummary } from './lobby-summary'

async function loadLobbySummary(lobbyId: string): Promise<LobbySummary | null> {
  const { data: lobby } = await supabase.from('lobbies').select('*').eq('id', lobbyId).maybeSingle()
  if (!lobby) return null

  const { data: memberRows } = await supabase
    .from('lobby_members')
    .select('*')
    .eq('lobby_id', lobbyId)
    .is('left_at', null)
  const members = memberRows ?? []

  const memberUserIds = members.map((member) => member.user_id)
  const [{ data: userRows }, { data: gameRows }] = await Promise.all([
    memberUserIds.length > 0
      ? supabase.from('users').select('id, display_name, avatar_url').in('id', memberUserIds)
      : Promise.resolve({ data: [] }),
    supabase.from('games').select('appid, name').eq('appid', lobby.appid)
  ])

  const usersById = new Map((userRows ?? []).map((user) => [user.id, user]))
  const gamesByAppid = new Map((gameRows ?? []).map((game) => [game.appid, game]))

  return buildLobbySummary(lobby, members, usersById, gamesByAppid)
}

async function loadActiveLobbyId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('lobby_members')
    .select('lobby_id')
    .eq('user_id', userId)
    .is('left_at', null)
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.lobby_id ?? null
}

/**
 * The lobby the current user is currently a member of, kept live with
 * Supabase Realtime. Backs the docked lobby bar (AppShell) and the
 * single-active-lobby guard used by Create/Join.
 *
 * Two subscriptions, re-established as needed:
 * 1. One filtered to `lobby_members` rows for this user, catching this
 *    user's own join/leave (which lobby is "active" can change).
 * 2. Once a lobby id is known, a second one scoped to that lobby's
 *    `lobbies` and `lobby_members` rows, catching other members joining,
 *    leaving, or the lobby's own state changing. Re-subscribed whenever
 *    the active lobby id changes.
 */
export function useActiveLobby(userId: string | undefined): LobbySummary | null {
  const [lobby, setLobby] = useState<LobbySummary | null>(null)

  const refresh = useCallback(async () => {
    if (!userId) {
      setLobby(null)
      return
    }
    const lobbyId = await loadActiveLobbyId(userId)
    if (!lobbyId) {
      setLobby(null)
      return
    }
    const summary = await loadLobbySummary(lobbyId)
    setLobby(summary)
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!userId) return undefined

    const channel = supabase
      .channel(`active-lobby-membership-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lobby_members', filter: `user_id=eq.${userId}` },
        () => void refresh()
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, refresh])

  useEffect(() => {
    const lobbyId = lobby?.id
    if (!lobbyId) return undefined

    const channel = supabase
      .channel(`active-lobby-${lobbyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` },
        () => void refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lobby_members', filter: `lobby_id=eq.${lobbyId}` },
        () => void refresh()
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the lobby id should re-trigger this subscription, not every summary change it causes.
  }, [lobby?.id, refresh])

  return lobby
}
