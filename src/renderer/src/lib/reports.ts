import { supabase } from './supabase'

/**
 * Fixed reason list (chip buttons in ReportMemberModal.tsx), not free text,
 * because this feeds a future moderation queue (Phase 13) that needs
 * scannable categories. A distinct, earlier mechanism from Phase 10's
 * structured positive/negative tag system, not a reuse of it.
 */
export const REPORT_REASONS = [
  'Harassment or abuse',
  'Cheating',
  'Inappropriate name or content',
  'Other'
] as const

export type ReportReason = (typeof REPORT_REASONS)[number]

interface SubmitReportBody {
  lobbyId: string
  reportedUserId: string
  reason: ReportReason
  detail?: string
}

/**
 * Calls the `submit-report` Edge Function, mirroring librarySync.ts's
 * supabase.functions.invoke pattern. The function does the real work
 * (authorization, message snapshot, insert) under the service role — the
 * `reports` table has zero client RLS policies, so this is the only path in.
 */
export async function submitReport(body: SubmitReportBody): Promise<boolean> {
  const { error } = await supabase.functions.invoke('submit-report', { body })
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[reports] submit failed', error)
    return false
  }
  return true
}
