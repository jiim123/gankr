import type { Database } from '@shared/db-types'
import { supabase } from './supabase'

type ProfileVisibility = Database['public']['Enums']['profile_visibility']

export interface LibrarySyncResult {
  profileVisibility?: ProfileVisibility
  lastSyncedAt?: string
  gameCount?: number
  skipped?: boolean
}

/**
 * Calls the `steam-library-sync` Edge Function. The function itself decides
 * whether a sync is actually needed — it no-ops when `last_synced_at` is
 * under 24 hours old and `force` is not set — so this can be called freely
 * on login and app startup without duplicating that staleness check here.
 * Pass `force: true` for an explicit "refresh" action.
 */
export async function syncSteamLibrary(force = false): Promise<LibrarySyncResult | null> {
  const { data, error } = await supabase.functions.invoke<LibrarySyncResult>('steam-library-sync', {
    body: { force }
  })
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[library-sync] failed', error)
    return null
  }
  return data
}
