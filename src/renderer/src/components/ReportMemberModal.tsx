import { useState } from 'react'
import { REPORT_REASONS, submitReport, type ReportReason } from '../lib/reports'

interface ReportMemberModalProps {
  open: boolean
  lobbyId: string
  reportedUserId: string
  reportedDisplayName: string
  onClose: () => void
}

/**
 * Opened from any member row in LobbyMemberList.tsx. Fixed reason chips
 * (matching SettingsPage's language-toggle pattern) plus an optional short
 * free-text detail for context. The Edge Function snapshots the surrounding
 * chat at submit time, since the lobby and its chat will be gone by the
 * time anyone reviews it.
 */
export default function ReportMemberModal({
  open,
  lobbyId,
  reportedUserId,
  reportedDisplayName,
  onClose
}: ReportMemberModalProps) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [detail, setDetail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (!open) return null

  function handleClose(): void {
    setReason(null)
    setDetail('')
    setError(null)
    setDone(false)
    onClose()
  }

  async function handleSubmit(): Promise<void> {
    if (!reason) {
      setError('Pick a reason')
      return
    }
    setSubmitting(true)
    setError(null)
    const ok = await submitReport({
      lobbyId,
      reportedUserId,
      reason,
      detail: detail.trim() || undefined
    })
    setSubmitting(false)
    if (!ok) {
      setError('Could not submit the report')
      return
    }
    setDone(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="surface w-full max-w-md p-5">
        <h2 className="text-sm font-medium text-foreground">Report {reportedDisplayName}</h2>

        {done ? (
          <p className="mt-4 text-sm text-neutral-400">
            Report submitted. Thanks for flagging it.
          </p>
        ) : (
          <>
            <div className="mt-4">
              <span className="block text-xs text-neutral-400">Reason</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {REPORT_REASONS.map((option) => {
                  const active = reason === option
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setReason(option)}
                      className={[
                        'rounded-full border px-3 py-1 text-xs transition-colors',
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                      ].join(' ')}
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
            </div>

            <label className="mt-4 block text-xs text-neutral-400">
              Detail (optional)
              <textarea
                className="field mt-1 w-full"
                rows={3}
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                placeholder="Anything that helps explain what happened"
              />
            </label>

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          </>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={handleClose}>
            {done ? 'Close' : 'Cancel'}
          </button>
          {!done && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleSubmit()}
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : 'Submit report'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
