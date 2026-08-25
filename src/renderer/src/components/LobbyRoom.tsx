import { useState } from 'react'
import type { LobbySummary, LobbyMemberSummary } from '../lib/lobby-summary'
import { supabase } from '../lib/supabase'
import { steamHeaderImageUrl } from '../lib/steam-images'
import LobbyMemberList from './LobbyMemberList'
import LobbyRequirementsPanel from './LobbyRequirementsPanel'
import LobbyChatPanel from './LobbyChatPanel'
import ReportMemberModal from './ReportMemberModal'

interface LobbyRoomProps {
  lobby: LobbySummary
  currentUserId: string
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
 * The full lobby room behind the docked bar's expand panel: header with a
 * persistent, always-visible Leave button (the explicitly-flagged missing
 * piece — placed where it can't be missed, not buried in a per-row menu),
 * member list + requirements panel on the left, chat on the right.
 *
 * Ownership transfer / lobby close on an owner leaving, and the departing
 * client's own docked bar collapsing, are both already handled by existing
 * Phase 2/6 logic (handle_member_departure() trigger, useActiveLobby) — no
 * new code needed here beyond the button and the one UPDATE call.
 */
export default function LobbyRoom({ lobby, currentUserId }: LobbyRoomProps) {
  const [leaving, setLeaving] = useState(false)
  const [reportTarget, setReportTarget] = useState<LobbyMemberSummary | null>(null)
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
    <div className="flex h-[28rem] flex-col gap-3 border-t border-neutral-800 p-4">
      <div className="flex items-center gap-3">
        <img
          src={steamHeaderImageUrl(lobby.appid)}
          alt=""
          className="h-10 w-16 shrink-0 rounded object-cover"
          onError={(event) => {
            event.currentTarget.style.visibility = 'hidden'
          }}
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-medium text-foreground">{lobby.gameName}</h2>
          <p className="text-xs text-neutral-400">{labelForStatus(lobby.status)}</p>
        </div>
        <button type="button" className="btn-secondary shrink-0" disabled={leaving} onClick={() => void handleLeave()}>
          {leaving ? 'Leaving…' : 'Leave lobby'}
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
        <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
          <LobbyMemberList lobby={lobby} currentUserId={currentUserId} onReport={setReportTarget} />
          <LobbyRequirementsPanel lobby={lobby} isOwner={isOwner} />
        </div>
        <div className="min-h-0">
          <LobbyChatPanel lobbyId={lobby.id} currentUserId={currentUserId} members={lobby.members} />
        </div>
      </div>

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
