import { useEffect, useState } from 'react'
import { loadFeedbackCandidates, type FeedbackCandidate } from '../lib/feedback-prompt'
import { submitFeedback, labelForTag, POSITIVE_TAGS, NEGATIVE_TAGS, type FeedbackTag } from '../lib/feedback'

interface FeedbackPromptModalProps {
  open: boolean
  lobbyId: string | null
  currentUserId: string | undefined
  onClose: () => void
}

/**
 * Opens when the current user's own game exits (see useFeedbackPrompt) and
 * stays open for up to 10 minutes (owned by the caller — see AppShell's
 * dismiss timer). Reuses ReportMemberModal's exact chrome, widened to
 * max-w-lg since this has more content: a row per lobbymate (including ones
 * who already left — the shared session already happened), each expandable
 * to pick one tag and submit.
 */
export default function FeedbackPromptModal({ open, lobbyId, currentUserId, onClose }: FeedbackPromptModalProps) {
  const [candidates, setCandidates] = useState<FeedbackCandidate[]>([])
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [submittingUserId, setSubmittingUserId] = useState<string | null>(null)
  const [doneUserIds, setDoneUserIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !lobbyId || !currentUserId) return
    setCandidates([])
    setExpandedUserId(null)
    setDoneUserIds(new Set())
    setError(null)
    void loadFeedbackCandidates(lobbyId, currentUserId).then(setCandidates)
  }, [open, lobbyId, currentUserId])

  if (!open || !lobbyId) return null

  async function handlePickTag(toUserId: string, tag: FeedbackTag): Promise<void> {
    if (!lobbyId) return
    const polarity = (POSITIVE_TAGS as readonly string[]).includes(tag) ? 'positive' : 'negative'
    setSubmittingUserId(toUserId)
    setError(null)
    const ok = await submitFeedback({ lobbyId, toUserId, tag, polarity })
    setSubmittingUserId(null)
    if (!ok) {
      setError('Could not submit that feedback')
      return
    }
    setDoneUserIds((current) => new Set(current).add(toUserId))
    setExpandedUserId(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="surface w-full max-w-lg p-5">
        <h2 className="text-sm font-medium text-foreground">How was that session?</h2>
        <p className="mt-1 text-xs text-neutral-400">Give feedback to anyone you played with. Optional.</p>

        <div className="mt-4 space-y-2">
          {candidates.length === 0 && <p className="text-sm text-neutral-500">No one else was in that lobby.</p>}

          {candidates.map((candidate) => {
            const done = doneUserIds.has(candidate.userId)
            const expanded = expandedUserId === candidate.userId

            return (
              <div key={candidate.userId} className="rounded-lg border border-neutral-800 p-3">
                <div className="flex items-center gap-3">
                  {candidate.avatarUrl ? (
                    <img src={candidate.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full" />
                  ) : (
                    <div className="h-8 w-8 shrink-0 rounded-full bg-neutral-700" aria-hidden="true" />
                  )}
                  <span className="flex-1 truncate text-sm text-foreground">{candidate.displayName}</span>
                  {done ? (
                    <span className="text-xs text-neutral-400">Feedback sent</span>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary px-2 py-1 text-xs"
                      onClick={() => setExpandedUserId(expanded ? null : candidate.userId)}
                    >
                      {expanded ? 'Cancel' : 'Give feedback'}
                    </button>
                  )}
                </div>

                {expanded && !done && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {POSITIVE_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        disabled={submittingUserId === candidate.userId}
                        onClick={() => void handlePickTag(candidate.userId, tag)}
                        className="rounded-full border border-emerald-800 bg-emerald-950 px-3 py-1 text-xs text-emerald-400 transition-colors hover:bg-emerald-900"
                      >
                        {labelForTag(tag)}
                      </button>
                    ))}
                    {NEGATIVE_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        disabled={submittingUserId === candidate.userId}
                        onClick={() => void handlePickTag(candidate.userId, tag)}
                        className="rounded-full border border-red-900 bg-red-950 px-3 py-1 text-xs text-red-400 transition-colors hover:bg-red-900"
                      >
                        {labelForTag(tag)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
