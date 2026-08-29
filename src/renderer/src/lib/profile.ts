import type { Tables } from '@shared/db-types'
import { supabase } from './supabase'
import { POSITIVE_TAGS, type FeedbackPolarity, type FeedbackTag } from './feedback'

export interface GameWithPlaytime {
  appid: string
  name: string
  headerImage: string | null
  playtimeForeverMinutes: number
}

export type ProfileRow = Pick<
  Tables<'users'>,
  'id' | 'display_name' | 'avatar_url' | 'region' | 'created_at' | 'reputation_score'
>
export type ProfileVisibility = Tables<'steam_identities'>['profile_visibility']
type GameRow = Pick<Tables<'games'>, 'appid' | 'name' | 'header_image'>

export interface FeedbackTagCount {
  tag: FeedbackTag
  polarity: FeedbackPolarity
  count: number
}

export interface RecentFeedbackItem {
  id: string
  fromDisplayName: string
  tag: FeedbackTag
  polarity: FeedbackPolarity
  createdAt: string
}

/** Minutes -> hours, one decimal place, e.g. 90 minutes -> 1.5. Never
 * display raw minutes as if they were hours. */
export function minutesToHours(minutes: number): number {
  return Math.round(minutes / 6) / 10
}

const MOST_PLAYED_GAME_LIMIT = 4
const RECENT_FEEDBACK_LIMIT = 5

export interface ProfileData {
  profile: ProfileRow | null
  visibility: ProfileVisibility | null
  games: GameWithPlaytime[]
  feedbackCounts: FeedbackTagCount[]
  recentFeedback: RecentFeedbackItem[]
}

/** Loads everything the profile page shows for one user. RLS means a
 * `user_games`/`steam_identities` query for anyone other than the caller
 * (or an active lobby co-member, for steam_identities) simply comes back
 * empty rather than erroring — that's the intended Phase 2 behaviour, not
 * a bug to route around here. `feedback` is publicly readable (Phase 10 —
 * see supabase/migrations/20260829120100_feedback_schema.sql), so those two
 * queries work the same for any profile, own or not. */
export async function loadProfile(userId: string): Promise<ProfileData> {
  const [{ data: profile }, { data: identity }, { data: userGames }, { data: feedbackRows }, { data: recentRows }] =
    await Promise.all([
      supabase
        .from('users')
        .select('id, display_name, avatar_url, region, created_at, reputation_score')
        .eq('id', userId)
        .maybeSingle(),
      supabase.from('steam_identities').select('profile_visibility').eq('user_id', userId).maybeSingle(),
      supabase
        .from('user_games')
        .select('appid, playtime_forever_minutes')
        .eq('user_id', userId)
        .order('playtime_forever_minutes', { ascending: false })
        .limit(MOST_PLAYED_GAME_LIMIT),
      supabase.from('feedback').select('tag, polarity').eq('to_user_id', userId),
      supabase
        .from('feedback')
        .select('id, from_user_id, tag, polarity, created_at')
        .eq('to_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(RECENT_FEEDBACK_LIMIT)
    ])

  const rows = userGames ?? []
  let gameRows: GameRow[] = []
  if (rows.length > 0) {
    const { data } = await supabase
      .from('games')
      .select('appid, name, header_image')
      .in(
        'appid',
        rows.map((row) => row.appid)
      )
    gameRows = data ?? []
  }

  const gamesByAppid = new Map(gameRows.map((game) => [game.appid, game]))
  const games: GameWithPlaytime[] = rows.map((row) => {
    const game = gamesByAppid.get(row.appid)
    return {
      appid: row.appid,
      name: game?.name ?? row.appid,
      headerImage: game?.header_image ?? null,
      playtimeForeverMinutes: row.playtime_forever_minutes
    }
  })

  const countsByTag = new Map<FeedbackTag, FeedbackTagCount>()
  for (const row of feedbackRows ?? []) {
    const existing = countsByTag.get(row.tag)
    if (existing) {
      existing.count += 1
    } else {
      countsByTag.set(row.tag, { tag: row.tag, polarity: row.polarity, count: 1 })
    }
  }
  const positiveTags = new Set<string>(POSITIVE_TAGS)
  const feedbackCounts = [...countsByTag.values()].sort((a, b) => {
    const aPositive = positiveTags.has(a.tag) ? 0 : 1
    const bPositive = positiveTags.has(b.tag) ? 0 : 1
    return aPositive - bPositive || b.count - a.count
  })

  const recent = recentRows ?? []
  const senderIds = [...new Set(recent.map((row) => row.from_user_id))]
  const namesById = new Map<string, string>()
  if (senderIds.length > 0) {
    const { data: senderRows } = await supabase.from('users').select('id, display_name').in('id', senderIds)
    for (const row of senderRows ?? []) namesById.set(row.id, row.display_name)
  }
  const recentFeedback: RecentFeedbackItem[] = recent.map((row) => ({
    id: row.id,
    fromDisplayName: namesById.get(row.from_user_id) ?? 'Unknown player',
    tag: row.tag,
    polarity: row.polarity,
    createdAt: row.created_at
  }))

  return {
    profile: profile ?? null,
    visibility: identity?.profile_visibility ?? null,
    games,
    feedbackCounts,
    recentFeedback
  }
}

/** Discrete Tailwind color bands rather than runtime-computed
 * interpolation — consistent with this app's fixed-token color convention
 * (every color elsewhere is a named class, nothing computed at runtime). */
export function reputationColorClass(score: number): string {
  if (score <= -300) return 'text-red-500'
  if (score < -50) return 'text-red-400'
  if (score < 50) return 'text-neutral-300'
  if (score < 300) return 'text-emerald-400'
  return 'text-emerald-500'
}
