import type { Database } from '@shared/db-types'

type ProfileVisibility = Database['public']['Enums']['profile_visibility']

export type OwnershipStatus = 'owned' | 'not_owned' | 'unknown'

/**
 * Whether the current user owns a given game, from what we know locally.
 * Never trust the client for launch eligibility beyond this display state —
 * this only decides which of three labels/actions to show, nothing more.
 *
 * - `owned` — a matching `user_games` row exists.
 * - `not_owned` — the library is public and no matching row exists. Only
 *   returned when visibility is public, so a private/unsynced profile is
 *   never mistaken for someone who owns nothing.
 * - `unknown` — visibility is `private` or `unknown` (not yet synced).
 */
export function getOwnershipStatus(
  appid: string,
  userGames: readonly { appid: string }[],
  profileVisibility: ProfileVisibility
): OwnershipStatus {
  const owned = userGames.some((game) => game.appid === appid)
  if (owned) return 'owned'
  if (profileVisibility === 'public') return 'not_owned'
  return 'unknown'
}
