import { supabase } from './supabase'

/**
 * Calls join_private_lobby() (supabase/migrations/20260829150000_lobby_password_join.sql)
 * — the only path into a private lobby. The function does its own
 * password/capacity/status checks server-side and raises a plain-text
 * exception on any failure, which comes back through `error.message`.
 */
export async function joinPrivateLobby(lobbyId: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('join_private_lobby', { p_lobby_id: lobbyId, p_password: password })
  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/** Owner-only — RLS ("lobby password readable by its owner") returns
 * nothing for anyone else. Used by LobbyRequirementsDialog to let the
 * owner view/copy their own lobby's password later. */
export async function loadOwnLobbyPassword(lobbyId: string): Promise<string | null> {
  const { data } = await supabase.from('lobby_passwords').select('password').eq('lobby_id', lobbyId).maybeSingle()
  return data?.password ?? null
}
