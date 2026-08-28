import { useCallback, useEffect, useState } from 'react'
import type { LobbySummary } from '../lib/lobby-summary'
import { supabase } from '../lib/supabase'
import { decideJoinRequest, loadPendingJoinRequests, type PendingJoinRequest } from '../lib/lobby-join-requests'

type Visibility = LobbySummary['visibility']

interface LobbyVisibilityPanelProps {
  lobby: LobbySummary
  isOwner: boolean
  onOpenRequirements: () => void
}

/**
 * Replaces the old inline requirements spot in LobbyRoom. Owner-editable
 * Open/Private toggle using the same single-field save-on-change pattern as
 * the rest of Requirements (see LobbyRequirementsPanel.tsx), an owner-only
 * pending-join-requests list Realtime-subscribed to `lobby_join_requests`
 * filtered by this lobby, and a trigger button into the new
 * LobbyRequirementsDialog for everything else.
 */
export default function LobbyVisibilityPanel({ lobby, isOwner, onOpenRequirements }: LobbyVisibilityPanelProps) {
  const [savingVisibility, setSavingVisibility] = useState(false)
  const [pending, setPending] = useState<PendingJoinRequest[]>([])
  const [decidingId, setDecidingId] = useState<string | null>(null)

  const refreshPending = useCallback(async () => {
    if (!isOwner) {
      setPending([])
      return
    }
    setPending(await loadPendingJoinRequests(lobby.id))
  }, [isOwner, lobby.id])

  useEffect(() => {
    void refreshPending()
  }, [refreshPending])

  useEffect(() => {
    if (!isOwner) return undefined

    const channel = supabase
      .channel(`lobby-join-requests-${lobby.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lobby_join_requests', filter: `lobby_id=eq.${lobby.id}` },
        () => void refreshPending()
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [isOwner, lobby.id, refreshPending])

  async function handleVisibilityChange(visibility: Visibility): Promise<void> {
    if (visibility === lobby.visibility) return
    setSavingVisibility(true)
    try {
      await supabase.from('lobbies').update({ visibility }).eq('id', lobby.id)
    } finally {
      setSavingVisibility(false)
    }
  }

  async function handleDecide(requestId: string, decision: 'accepted' | 'denied'): Promise<void> {
    setDecidingId(requestId)
    try {
      await decideJoinRequest(requestId, decision)
    } finally {
      setDecidingId(null)
    }
  }

  return (
    <div className="surface p-4">
      <h3 className="text-sm font-medium text-foreground">Visibility</h3>

      {isOwner ? (
        <div className="mt-3 flex gap-2">
          {(['open', 'private'] as const).map((option) => {
            const active = lobby.visibility === option
            return (
              <button
                key={option}
                type="button"
                disabled={savingVisibility}
                onClick={() => void handleVisibilityChange(option)}
                className={[
                  'flex-1 rounded-full border px-3 py-1 text-xs transition-colors',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                ].join(' ')}
              >
                {option === 'open' ? 'Open' : 'Private'}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="mt-2 text-sm text-neutral-400">{lobby.visibility === 'open' ? 'Open' : 'Private'}</p>
      )}

      {isOwner && pending.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-xs font-medium text-neutral-400">Join requests</h4>
          {pending.map((request) => (
            <div key={request.id} className="flex items-center gap-2">
              {request.avatarUrl ? (
                <img src={request.avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full" />
              ) : (
                <div className="h-6 w-6 shrink-0 rounded-full bg-neutral-700" aria-hidden="true" />
              )}
              <span className="flex-1 truncate text-sm text-foreground">{request.displayName}</span>
              <button
                type="button"
                className="btn-secondary px-2 py-1 text-xs"
                disabled={decidingId === request.id}
                onClick={() => void handleDecide(request.id, 'accepted')}
              >
                Accept
              </button>
              <button
                type="button"
                className="text-xs text-neutral-400 transition-colors hover:text-red-400"
                disabled={decidingId === request.id}
                onClick={() => void handleDecide(request.id, 'denied')}
              >
                Deny
              </button>
            </div>
          ))}
        </div>
      )}

      <button type="button" className="btn-secondary mt-4 w-full" onClick={onOpenRequirements}>
        {isOwner ? 'Edit requirements' : 'Requirements'}
      </button>
    </div>
  )
}
