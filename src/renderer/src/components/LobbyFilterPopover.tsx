import { useEffect, useRef, useState } from 'react'
import { Filter } from 'iconoir-react'
import type { Tables } from '@shared/db-types'
import { MIC_OPTIONS, REGIONS, TONE_OPTIONS } from '../lib/lobby-options'
import LabeledCheckbox from './LabeledCheckbox'

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
  ownedOnly: boolean
}

interface OwnedGame {
  appid: string
  name: string
}

interface LobbyFilterPopoverProps {
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
 * Filters: game, region, mic, tone, free slots, and "show only games you
 * own" — game is one filter among these, never a required first step, and
 * every select defaults to "Any ___". Sits behind a button + floating panel
 * rather than an always-visible bar, closes on an outside click. Every
 * change calls onChange immediately (FindLobbyPage re-searches/re-ranks off
 * that state directly), so results update in real time as filters change.
 */
export default function LobbyFilterPopover({ filters, onChange, ownedGames }: LobbyFilterPopoverProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  function set<K extends keyof LobbyFilterState>(key: K, value: LobbyFilterState[K]): void {
    onChange({ ...filters, [key]: value })
  }

  const activeFilterCount = [
    filters.region !== null,
    filters.mic !== null,
    filters.tone !== null,
    filters.minFreeSlots !== 1,
    filters.ownedOnly
  ].filter(Boolean).length

  return (
    <div className="relative" ref={containerRef}>
      <button type="button" className="btn-secondary relative" onClick={() => setOpen((current) => !current)}>
        <Filter width={16} height={16} strokeWidth={2} className="mr-1.5" />
        Filters
        {activeFilterCount > 0 && (
          <span className="ml-1.5 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
            {activeFilterCount}
          </span>
        )}
      </button>

      {open && (
        <div className="surface absolute right-0 top-full z-20 mt-2 w-72 space-y-3 p-4 shadow-lg">
          <label className="block text-xs text-neutral-400">
            Game
            <select
              className="field mt-1 w-full"
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
          </label>

          <label className="block text-xs text-neutral-400">
            Region
            <select
              className="field mt-1 w-full"
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
          </label>

          <label className="block text-xs text-neutral-400">
            Mic
            <select
              className="field mt-1 w-full"
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
          </label>

          <label className="block text-xs text-neutral-400">
            Tone
            <select
              className="field mt-1 w-full"
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
          </label>

          <label className="block text-xs text-neutral-400">
            Free slots
            <select
              className="field mt-1 w-full"
              value={filters.minFreeSlots}
              onChange={(event) => set('minFreeSlots', Number(event.target.value))}
            >
              {FREE_SLOTS_OPTIONS.map((count) => (
                <option key={count} value={count}>
                  {count}+ free slot{count > 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </label>

          <LabeledCheckbox
            className="flex items-center gap-2 pt-1 text-sm text-foreground"
            checked={filters.ownedOnly}
            onCheckedChange={(checked) => set('ownedOnly', checked === true)}
            size="sm"
          >
            Show only games you own
          </LabeledCheckbox>
        </div>
      )}
    </div>
  )
}
