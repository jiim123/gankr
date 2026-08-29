import { supabase } from './supabase'

export const POSITIVE_TAGS = ['friendly', 'team_player', 'fun_to_play_with', 'leader', 'respectful'] as const
export const NEGATIVE_TAGS = ['toxic', 'rage_quitter', 'poor_teamwork', 'afk', 'untrustworthy'] as const

export type PositiveTag = (typeof POSITIVE_TAGS)[number]
export type NegativeTag = (typeof NEGATIVE_TAGS)[number]
export type FeedbackTag = PositiveTag | NegativeTag
export type FeedbackPolarity = 'positive' | 'negative'

const TAG_LABELS: Record<FeedbackTag, string> = {
  friendly: 'Friendly',
  team_player: 'Team Player',
  fun_to_play_with: 'Fun to Play With',
  leader: 'Leader',
  respectful: 'Respectful',
  toxic: 'Toxic',
  rage_quitter: 'Rage Quitter',
  poor_teamwork: 'Poor Teamwork',
  afk: 'AFK',
  untrustworthy: 'Untrustworthy'
}

export function labelForTag(tag: FeedbackTag): string {
  return TAG_LABELS[tag]
}

interface SubmitFeedbackBody {
  lobbyId: string
  toUserId: string
  tag: FeedbackTag
  polarity: FeedbackPolarity
}

/**
 * Calls the `submit-feedback` Edge Function, mirroring reports.ts's
 * submitReport pattern exactly. The function does the real work
 * (authorization, overlap check, abuse-control caps, insert) under the
 * service role — `feedback` has zero client write policies, so this is the
 * only path in.
 */
export async function submitFeedback(body: SubmitFeedbackBody): Promise<boolean> {
  const { error } = await supabase.functions.invoke('submit-feedback', { body })
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[feedback] submit failed', error)
    return false
  }
  return true
}
