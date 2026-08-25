import type { Tables } from '@shared/db-types'
import { REGION_NEIGHBORS, type Region } from './lobby-options'
import type { LobbySummary } from './lobby-summary'

type MicRequirement = Tables<'lobbies'>['mic']
type LobbyTone = Tables<'lobbies'>['tone']

/** What the searcher is looking for. Any field left `null` means "any" and
 * contributes no penalty and no reason for that dimension. Region/mic/tone
 * are preferences that cost points, never hard filters — the hard filters
 * (game, free slots, language) already ran in lobby-search.ts before a
 * lobby ever reaches this scorer. */
export interface ScoringTarget {
  region: string | null
  mic: MicRequirement | null
  tone: LobbyTone | null
}

export interface ScoredLobby {
  lobby: LobbySummary
  score: number
  reasons: string[]
}

/** Below this, a lobby is filtered from results but still counts toward
 * "nothing matched" for the create-lobby fallback. A single strong mismatch
 * (mic required vs off, -50) alone drops a lobby to 50, below the floor. A
 * single far-region penalty alone (-40 -> 60) still clears it. */
export const SCORE_FLOOR = 55

const REGION_NEIGHBOR_PENALTY = 15
const REGION_FAR_PENALTY = 40

function regionPenalty(lobbyRegion: string, target: string | null): { penalty: number; reason: string | null } {
  if (!target || lobbyRegion === target) return { penalty: 0, reason: null }
  const neighbors = REGION_NEIGHBORS[target as Region] as readonly string[] | undefined
  // An unrecognised target region (shouldn't happen given the closed
  // REGIONS vocabulary, but defensive) is treated as far, never as a match.
  const penalty = neighbors?.includes(lobbyRegion) ? REGION_NEIGHBOR_PENALTY : REGION_FAR_PENALTY
  return { penalty, reason: lobbyRegion }
}

// Unordered pair -> penalty. Same-value pairs are always 0 and are handled
// before this lookup runs.
const MIC_PENALTIES: Record<string, number> = {
  'off|preferred': 15,
  'off|required': 50,
  'preferred|required': 10
}

function micPenalty(lobbyMic: MicRequirement, target: MicRequirement | null): { penalty: number; reason: string | null } {
  if (!target || lobbyMic === target) return { penalty: 0, reason: null }
  const key = [lobbyMic, target].sort().join('|')
  const penalty = MIC_PENALTIES[key] ?? 0
  return { penalty, reason: `Mic ${lobbyMic}, yours is ${target}` }
}

const TONE_INDEX: Record<LobbyTone, number> = { casual: 0, competitive: 1 }
const TONE_STEP_PENALTY = 20

function tonePenalty(lobbyTone: LobbyTone, target: LobbyTone | null): { penalty: number; reason: string | null } {
  if (!target || lobbyTone === target) return { penalty: 0, reason: null }
  const penalty = Math.abs(TONE_INDEX[lobbyTone] - TONE_INDEX[target]) * TONE_STEP_PENALTY
  return { penalty, reason: `Tone ${lobbyTone}, yours is ${target}` }
}

export function scoreLobby(lobby: LobbySummary, target: ScoringTarget): ScoredLobby {
  const region = regionPenalty(lobby.region, target.region)
  const mic = micPenalty(lobby.mic, target.mic)
  const tone = tonePenalty(lobby.tone, target.tone)

  const reasons = [region.reason, mic.reason, tone.reason].filter((reason): reason is string => reason !== null)
  const score = 100 - region.penalty - mic.penalty - tone.penalty

  return { lobby, score, reasons }
}

/**
 * Scores every candidate lobby, drops anything below the floor, and sorts
 * the rest. "Live lobbies for games the user owns come first" is the
 * primary sort key ahead of score — an ordering rule, not a hard filter.
 */
export function rankLobbies(
  lobbies: readonly LobbySummary[],
  target: ScoringTarget,
  ownedAppids: ReadonlySet<string>
): ScoredLobby[] {
  return lobbies
    .map((lobby) => scoreLobby(lobby, target))
    .filter((scored) => scored.score >= SCORE_FLOOR)
    .sort((a, b) => {
      const aOwned = ownedAppids.has(a.lobby.appid) ? 0 : 1
      const bOwned = ownedAppids.has(b.lobby.appid) ? 0 : 1
      if (aOwned !== bOwned) return aOwned - bOwned
      return b.score - a.score
    })
}
