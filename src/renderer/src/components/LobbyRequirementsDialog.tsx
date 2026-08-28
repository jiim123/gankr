import { useEffect, useState } from 'react'
import { resolveLobbyDisplayName, type LobbySummary } from '../lib/lobby-summary'
import { supabase } from '../lib/supabase'
import LobbyRequirementsPanel from './LobbyRequirementsPanel'

interface LobbyRequirementsDialogProps {
  open: boolean
  lobby: LobbySummary
  isOwner: boolean
  onClose: () => void
}

/**
 * Reuses CreateLobbyModal/ReportMemberModal's exact modal chrome verbatim
 * (backdrop/panel/heading/footer classes) — no backdrop-click-close,
 * Escape, or focus trap, consistent with both existing modals and
 * deliberately not a place to add new affordances. Wraps
 * LobbyRequirementsPanel's existing owner-edit/read-only content verbatim,
 * plus the one new field this redesign adds: the lobby's owner-settable
 * `name`, saved on blur the same "no staged form" way every other
 * Requirements field saves (see LobbyRequirementsPanel.tsx).
 */
export default function LobbyRequirementsDialog({ open, lobby, isOwner, onClose }: LobbyRequirementsDialogProps) {
  const [nameDraft, setNameDraft] = useState(lobby.name ?? '')
  const [savingName, setSavingName] = useState(false)

  useEffect(() => {
    if (open) setNameDraft(lobby.name ?? '')
  }, [open, lobby.name])

  if (!open) return null

  async function saveName(): Promise<void> {
    const trimmed = nameDraft.trim()
    if (trimmed === (lobby.name ?? '').trim()) return
    setSavingName(true)
    try {
      await supabase.from('lobbies').update({ name: trimmed || null }).eq('id', lobby.id)
    } finally {
      setSavingName(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="surface w-full max-w-md p-5">
        <h2 className="text-sm font-medium text-foreground">Requirements</h2>

        <div className="mt-4">
          {isOwner ? (
            <label className="block text-xs text-neutral-400">
              Lobby name
              <input
                type="text"
                className="field mt-1 w-full"
                value={nameDraft}
                placeholder={resolveLobbyDisplayName(lobby)}
                disabled={savingName}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={() => void saveName()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                }}
              />
            </label>
          ) : (
            <div>
              <span className="block text-xs text-neutral-400">Lobby name</span>
              <p className="mt-1 text-sm text-foreground">{resolveLobbyDisplayName(lobby)}</p>
            </div>
          )}
        </div>

        <div className="mt-4">
          <LobbyRequirementsPanel lobby={lobby} isOwner={isOwner} />
        </div>

        <div className="mt-5 flex justify-end">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
