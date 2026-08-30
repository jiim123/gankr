import { useState } from 'react'
import { joinPrivateLobby } from '../lib/lobby-password'

interface JoinPrivateLobbyModalProps {
  open: boolean
  lobbyId: string | null
  lobbyName: string
  onJoined: () => void
  onClose: () => void
}

/**
 * Reuses the standard modal chrome (CreateLobbyModal/ReportMemberModal's
 * exact backdrop/panel/heading/footer classes). A wrong password shows an
 * error and stays open for a retry rather than closing — there's no
 * pending/denied limbo like the old request flow, just immediate accept or
 * reject. On success the joiner's own useActiveLobby picks up the new
 * membership via its existing Realtime subscription, same as every other
 * join path this session — no new reactivity needed here.
 */
export default function JoinPrivateLobbyModal({ open, lobbyId, lobbyName, onJoined, onClose }: JoinPrivateLobbyModalProps) {
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open || !lobbyId) return null

  function handleClose(): void {
    setPassword('')
    setError(null)
    onClose()
  }

  async function handleSubmit(): Promise<void> {
    if (!lobbyId) return
    if (!password.trim()) {
      setError('Enter the password')
      return
    }
    setSubmitting(true)
    setError(null)
    const result = await joinPrivateLobby(lobbyId, password)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error ?? 'Could not join that lobby')
      return
    }
    setPassword('')
    onJoined()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="surface w-full max-w-md p-5">
        <h2 className="text-sm font-medium text-foreground">Join {lobbyName}</h2>

        <label className="mt-4 block text-xs text-neutral-400">
          Password
          <input
            type="password"
            className="field mt-1 w-full"
            value={password}
            disabled={submitting}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleSubmit()
            }}
            autoFocus
          />
        </label>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={handleClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? 'Joining…' : 'Join'}
          </button>
        </div>
      </div>
    </div>
  )
}
