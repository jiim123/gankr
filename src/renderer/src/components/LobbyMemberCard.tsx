import { ShieldQuestion } from 'iconoir-react'
import type { LobbyMemberSummary } from '../lib/lobby-summary'
import type { Tables } from '@shared/db-types'
import type { FriendshipState } from '../lib/lobby-friendships'
import type { LaunchDetectionState } from '../lib/launch-detection'

type MemberState = Tables<'lobby_members'>['member_state']

/** A label map over the full member_state enum, so this is structurally
 * ready for Phase 8 without fabricating anything — today every row is
 * always 'in_lobby' and just reads "In lobby". Carried over unchanged from
 * the old LobbyMemberList.tsx. */
const MEMBER_STATE_LABELS: Record<MemberState, string> = {
  in_lobby: 'In lobby',
  launching: 'Launching',
  in_game: 'In game',
  launch_failed: 'Launch failed',
  left: 'Left'
}

const ADD_FRIEND_LABELS: Record<FriendshipState, string> = {
  none: 'Add friend',
  outgoing_pending: 'Requested',
  incoming_pending: 'Pending',
  friends: 'Friends'
}

interface LobbyMemberCardProps {
  member: LobbyMemberSummary
  isOwnerCard: boolean
  isSelf: boolean
  canKick: boolean
  steamId64: string | null
  friendshipState: FriendshipState
  addingFriend: boolean
  kicking: boolean
  onAddFriend: () => void
  onAddOnSteam: () => void
  onReport: () => void
  onKick: () => void
  /** Only ever passed for the row matching the current user — see
   * LobbyMemberList, which owns the single useLaunchDetection instance and
   * only threads it to its own member's row. */
  launch?: LaunchDetectionState
}

/**
 * Replaces LobbyMemberList's old `<li>` rows. Reputation is always a
 * neutral, non-numeric placeholder — CLAUDE.md's reputation rule (Phase 10)
 * says it must never render as a number, rank, or count, and Phase 10 isn't
 * built yet regardless. The owner gets a lighter card border instead of the
 * removed "Owner" chip: `border-2 border-neutral-600` vs. the plain
 * `border-neutral-800` every other card gets.
 */
export default function LobbyMemberCard({
  member,
  isOwnerCard,
  isSelf,
  canKick,
  steamId64,
  friendshipState,
  addingFriend,
  kicking,
  onAddFriend,
  onAddOnSteam,
  onReport,
  onKick,
  launch
}: LobbyMemberCardProps) {
  return (
    <div
      className={[
        'rounded-lg border bg-neutral-900 p-3',
        isOwnerCard ? 'border-2 border-neutral-600' : 'border-neutral-800'
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        {member.avatarUrl ? (
          <img src={member.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full" />
        ) : (
          <div className="h-9 w-9 shrink-0 rounded-full bg-neutral-700" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-foreground">{member.displayName}</p>
          <p className="text-xs text-neutral-500">{MEMBER_STATE_LABELS[member.memberState]}</p>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
        <ShieldQuestion width={14} height={14} strokeWidth={2} />
        <span>Reputation not available yet</span>
      </div>

      {isSelf && launch && (member.memberState === 'in_lobby' || member.memberState === 'launch_failed') && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-primary px-2 py-1 text-xs"
            onClick={() => void (member.memberState === 'launch_failed' ? launch.retry() : launch.startGame())}
          >
            {member.memberState === 'launch_failed' ? 'Retry' : 'Start game'}
          </button>
          {member.memberState === 'launch_failed' && (
            <button
              type="button"
              className="btn-secondary px-2 py-1 text-xs"
              onClick={() => void launch.continueWithoutDetection()}
            >
              I&apos;m in, continue without me
            </button>
          )}
          {launch.steamRunning === false && (
            <span className="text-xs text-neutral-400">Steam isn&apos;t running — start it first</span>
          )}
        </div>
      )}

      {isSelf && launch && member.memberState === 'launching' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-400">Launching…</span>
          <button
            type="button"
            className="btn-secondary px-2 py-1 text-xs"
            onClick={() => void launch.continueWithoutDetection()}
          >
            I&apos;m in, continue without me
          </button>
        </div>
      )}

      {!isSelf && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-secondary px-2 py-1 text-xs"
            disabled={friendshipState !== 'none' || addingFriend}
            onClick={onAddFriend}
          >
            {ADD_FRIEND_LABELS[friendshipState]}
          </button>
          <button
            type="button"
            className="btn-secondary px-2 py-1 text-xs"
            disabled={!steamId64}
            onClick={onAddOnSteam}
          >
            Add on Steam
          </button>
          <button
            type="button"
            className="text-xs text-neutral-400 transition-colors hover:text-neutral-200"
            onClick={onReport}
          >
            Report
          </button>
          {canKick && (
            <button
              type="button"
              className="text-xs text-neutral-400 transition-colors hover:text-red-400"
              disabled={kicking}
              onClick={onKick}
            >
              {kicking ? 'Kicking…' : 'Kick'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
