import { useState } from 'react'
import { Minus } from 'iconoir-react'
import { resolveLobbyDisplayName, type LobbySummary, type LobbyMemberSummary } from '../lib/lobby-summary'
import { supabase } from '../lib/supabase'
import { steamHeaderImageUrl } from '../lib/steam-images'
import LobbyMemberList from './LobbyMemberList'
import LobbyVisibilityPanel from './LobbyVisibilityPanel'
import LobbyRequirementsDialog from './LobbyRequirementsDialog'
import LobbyChatPanel from './LobbyChatPanel'
import ReportMemberModal from './ReportMemberModal'

interface LobbyRoomProps {
  lobby: LobbySummary
  currentUserId: string
  onMinimize: () => void
}

function labelForStatus(status: LobbySummary['status']): string {
  switch (status) {
    case 'open':
      return 'Open'
    case 'playing':
      return 'Playing'
    case 'closed':
      return 'Closed'
  }
}

async function leaveLobby(lobbyId: string, userId: string): Promise<void> {
  await supabase
    .from('lobby_members')
    .update({ left_at: new Date().toISOString(), member_state: 'left' })
    .eq('lobby_id', lobbyId)
    .eq('user_id', userId)
}

/**
 * The floating panel's expanded content: header (thumbnail, lobby name/game/
 * status, a minimize button, Leave lobby) -> scrollable member-card list ->
 * LobbyVisibilityPanel -> chat filling the remaining flexible height. Fills
 * the fixed-size panel FloatingLobbyPanel.tsx gives it entirely (`h-full`),
 * rather than sizing itself, since that panel now owns the expanded/
 * minimized dimensions.
 *
 * Ownership transfer / lobby close on an owner leaving, and the departing
 * client's own panel collapsing, are both already handled by existing
 * Phase 2/6 logic (handle_member_departure() trigger, useActiveLobby) — no
 * new code needed here beyond the button and the one UPDATE call.
 */
export default function LobbyRoom({ lobby, currentUserId, onMinimize }: LobbyRoomProps) {
  const [leaving, setLeaving] = useState(false)
  const [reportTarget, setReportTarget] = useState<LobbyMemberSummary | null>(null)
  const [requirementsOpen, setRequirementsOpen] = useState(false)
  const isOwner = lobby.ownerId === currentUserId

  async function handleLeave(): Promise<void> {
    setLeaving(true)
    try {
      await leaveLobby(lobby.id, currentUserId)
    } finally {
      setLeaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-neutral-800 p-4">
        <img
          src={steamHeaderImageUrl(lobby.appid)}
          alt=""
          className="h-10 w-16 shrink-0 rounded object-cover"
          onError={(event) => {
            event.currentTarget.style.visibility = 'hidden'
          }}
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-medium text-foreground">{resolveLobbyDisplayName(lobby)}</h2>
          <p className="truncate text-xs text-neutral-400">
            {lobby.gameName} &middot; {labelForStatus(lobby.status)}
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary shrink-0 px-2 py-2"
          onClick={onMinimize}
          aria-label="Minimize lobby panel"
        >
          <Minus width={16} height={16} strokeWidth={2} />
        </button>
        <button type="button" className="btn-secondary shrink-0" disabled={leaving} onClick={() => void handleLeave()}>
          {leaving ? 'Leaving…' : 'Leave lobby'}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="max-h-56 overflow-y-auto pr-1">
          <LobbyMemberList lobby={lobby} currentUserId={currentUserId} onReport={setReportTarget} />
        </div>

        <LobbyVisibilityPanel lobby={lobby} isOwner={isOwner} onOpenRequirements={() => setRequirementsOpen(true)} />

        <div className="min-h-0 flex-1">
          <LobbyChatPanel lobbyId={lobby.id} currentUserId={currentUserId} members={lobby.members} />
        </div>
      </div>

      <LobbyRequirementsDialog
        open={requirementsOpen}
        lobby={lobby}
        isOwner={isOwner}
        onClose={() => setRequirementsOpen(false)}
      />

      <ReportMemberModal
        open={reportTarget !== null}
        lobbyId={lobby.id}
        reportedUserId={reportTarget?.userId ?? ''}
        reportedDisplayName={reportTarget?.displayName ?? ''}
        onClose={() => setReportTarget(null)}
      />
    </div>
  )
}
