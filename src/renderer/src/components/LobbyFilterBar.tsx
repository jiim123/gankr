import type { Tables } from '@shared/db-types'
import { MIC_OPTIONS, REGIONS, TONE_OPTIONS } from '../lib/lobby-options'

type MicRequirement = Tables<'lobbies'>['mic']
type LobbyTone = Tables<'lobbies'>['tone']

/** `null` means "any" for that field. Controlled component — FindLobbyPage
 * owns this in local `useState`, not URL params: no other route in this
 * single-window app uses them for anything beyond a route id. */
export interface LobbyFilterState {
  appid: string | null
  region: string | null
  mic: MicRequirement | null
  tone: LobbyTone | null
  minFreeSlots: number
}

interface OwnedGame {
  appid: string
  name: string
}

interface LobbyFilterBarProps {
  filters: LobbyFilterState
  onChange: (filters: LobbyFilterState) => void
  ownedGames: readonly OwnedGame[]
}

const FREE_SLOTS_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const

function labelForMic(mic: MicRequirement): string {
  switch (mic) {
    case 'off':
      return 'Mic off'
    case 'preferred':
      return 'Mic preferred'
    case 'required':
      return 'Mic required'
  }
}

function labelForTone(tone: LobbyTone): string {
  return tone === 'casual' ? 'Casual' : 'Competitive'
}

/**
 * Filters run across the top of Find lobby: game, region, mic, tone, free
 * slots. Selecting a game is one filter among these, never a required first
 * step — every select defaults to "Any ___". The game dropdown is sourced
 * from the user's owned games only (see FindLobbyPage), since a lobby for a
 * game you don't own can't usefully be searched-for by name yet.
 */
export default function LobbyFilterBar({ filters, onChange, ownedGames }: LobbyFilterBarProps) {
  function set<K extends keyof LobbyFilterState>(key: K, value: LobbyFilterState[K]) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 px-6 py-3">
      <select
        className="field"
        value={filters.appid ?? ''}
        onChange={(event) => set('appid', event.target.value || null)}
      >
        <option value="">Any game</option>
        {ownedGames.map((game) => (
          <option key={game.appid} value={game.appid}>
            {game.name}
          </option>
        ))}
      </select>

      <select
        className="field"
        value={filters.region ?? ''}
        onChange={(event) => set('region', event.target.value || null)}
      >
        <option value="">Any region</option>
        {REGIONS.map((region) => (
          <option key={region} value={region}>
            {region}
          </option>
        ))}
      </select>

      <select
        className="field"
        value={filters.mic ?? ''}
        onChange={(event) => set('mic', (event.target.value || null) as MicRequirement | null)}
      >
        <option value="">Any mic</option>
        {MIC_OPTIONS.map((mic) => (
          <option key={mic} value={mic}>
            {labelForMic(mic)}
          </option>
        ))}
      </select>

      <select
        className="field"
        value={filters.tone ?? ''}
        onChange={(event) => set('tone', (event.target.value || null) as LobbyTone | null)}
      >
        <option value="">Any tone</option>
        {TONE_OPTIONS.map((tone) => (
          <option key={tone} value={tone}>
            {labelForTone(tone)}
          </option>
        ))}
      </select>

      <select
        className="field"
        value={filters.minFreeSlots}
        onChange={(event) => set('minFreeSlots', Number(event.target.value))}
      >
        {FREE_SLOTS_OPTIONS.map((count) => (
          <option key={count} value={count}>
            {count}+ free slot{count > 1 ? 's' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
