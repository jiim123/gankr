import { supabase } from './supabase'

/**
 * Deliberately its own file, never merged into lobby-summary.ts's broad
 * join — CLAUDE.md's hard rule is "never return steam_id64 in general
 * profile or search responses." This is the one place in the renderer that
 * reads `steam_identities`, and it only ever does so for a lobby's own
 * member ids, which is exactly what the lobby-scoped RLS policy ("steam
 * identity readable by owner or active lobby co-member", Phase 2) allows —
 * a non-co-member id passed in here simply comes back absent from the map,
 * enforced server-side, not filtered client-side.
 */
export async function loadMemberSteamIds(userIds: readonly string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map()
  const { data } = await supabase.from('steam_identities').select('user_id, steam_id64').in('user_id', userIds)
  return new Map((data ?? []).map((row) => [row.user_id, row.steam_id64]))
}
