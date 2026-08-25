import { useState } from 'react'
import type { LobbySummary, LobbyMemberSummary } from '../lib/lobby-summary'
import type { Tables } from '@shared/db-types'
import { supabase } from '../lib/supabase'

type MemberState = Tables<'lobby_members'>['member_state']

/** A label map over the full member_state enum, so this is structurally
 * ready for Phase 8 without fabricating anything — today every row is
 * always 'in_lobby' and just reads "In lobby". */
const MEMBER_STATE_LABELS: Record<MemberState, string> = {
  in_lobby: 'In lobby',
  launching: 'Launching',
  in_game: 'In game',
  launch_failed: 'Launch failed',
  left: 'Left'
}

async function removeMember(lobbyId: string, userId: string): Promise<void> {
  await supabase
    .from('lobby_members')
    .update({ left_at: new Date().toISOString(), member_state: 'left' })
    .eq('lobby_id', lobbyId)
    .eq('user_id', userId)
}

interface LobbyMemberListProps {
  lobby: LobbySummary
  currentUserId: string
  onReport: (member: LobbyMemberSummary) => void
}

/**
 * Avatar/name/state-badge per member. Owner gets an "Owner" chip. Row
 * actions: Report (everyone, every row but your own) and Kick (owner only,
 * other rows only) — Kick reuses the exact same UPDATE as the room header's
 * Leave button, just targeting another member's row, already RLS-permitted
 * by "update own membership row or as lobby owner." The kicked member's own
 * client reacts automatically via useActiveLobby's existing subscription —
 * no new reactivity needed here.
 */
export default function LobbyMemberList({ lobby, currentUserId, onReport }: LobbyMemberListProps) {
  const [kickingId, setKickingId] = useState<string | null>(null)
  const isOwner = lobby.ownerId === currentUserId

  async function handleKick(userId: string): Promise<void> {
    setKickingId(userId)
    try {
      await removeMember(lobby.id, userId)
    } finally {
      setKickingId(null)
    }
  }

  return (
    <div className="surface p-4">
      <h3 className="text-sm font-medium text-white">Members</h3>
      <ul className="mt-3 space-y-2">
        {lobby.members.map((member) => {
          const isSelf = member.userId === currentUserId
          const isMemberOwner = member.userId === lobby.ownerId
          return (
            <li key={member.userId} className="flex items-center gap-3 rounded-md px-1 py-1">
              {member.avatarUrl ? (
                <img src={member.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full" />
              ) : (
                <div className="h-8 w-8 shrink-0 rounded-full bg-neutral-700" aria-hidden="true" />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm text-white">{member.displayName}</span>
                  {isMemberOwner && (
                    <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-300">
                      Owner
                    </span>
                  )}
                </div>
                <span className="text-xs text-neutral-500">{MEMBER_STATE_LABELS[member.memberState]}</span>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {!isSelf && (
                  <button
                    type="button"
                    className="text-xs text-neutral-400 transition-colors hover:text-neutral-200"
                    onClick={() => onReport(member)}
                  >
                    Report
                  </button>
                )}
                {isOwner && !isSelf && (
                  <button
                    type="button"
                    className="text-xs text-neutral-400 transition-colors hover:text-red-400"
                    disabled={kickingId === member.userId}
                    onClick={() => void handleKick(member.userId)}
                  >
                    {kickingId === member.userId ? 'Kicking…' : 'Kick'}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
