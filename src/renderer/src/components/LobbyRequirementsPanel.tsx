import { useState } from 'react'
import type { Tables, TablesUpdate } from '@shared/db-types'
import { supabase } from '../lib/supabase'
import { MAX_MEMBERS, MIC_OPTIONS, MIN_MEMBERS, REGIONS, TONE_OPTIONS } from '../lib/lobby-options'
import type { LobbySummary } from '../lib/lobby-summary'

type MicRequirement = Tables<'lobbies'>['mic']
type LobbyTone = Tables<'lobbies'>['tone']

function labelForMic(mic: MicRequirement): string {
  switch (mic) {
    case 'off':
      return 'Off'
    case 'preferred':
      return 'Preferred'
    case 'required':
      return 'Required'
  }
}

interface LobbyRequirementsPanelProps {
  lobby: LobbySummary
  isOwner: boolean
}

/**
 * Read-only for non-owners. For the owner, each field saves on change with
 * one single-field UPDATE lobbies call — not a staged "Save changes" form,
 * since this room is live and other members see changes immediately via the
 * existing subscription; a lingering unsaved-edit state would be confusing
 * in a multi-viewer context. Lock/Unlock does the same, one field at a time.
 */
export default function LobbyRequirementsPanel({ lobby, isOwner }: LobbyRequirementsPanelProps) {
  const [savingField, setSavingField] = useState<string | null>(null)

  async function updateField(field: keyof TablesUpdate<'lobbies'>, patch: TablesUpdate<'lobbies'>): Promise<void> {
    setSavingField(field)
    try {
      await supabase.from('lobbies').update(patch).eq('id', lobby.id)
    } finally {
      setSavingField(null)
    }
  }

  if (!isOwner) {
    return (
      <div>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-neutral-400">Region</dt>
            <dd className="text-neutral-200">{lobby.region}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-400">Mic</dt>
            <dd className="text-neutral-200">{labelForMic(lobby.mic)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-400">Tone</dt>
            <dd className="text-neutral-200">{lobby.tone === 'casual' ? 'Casual' : 'Competitive'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-400">Max members</dt>
            <dd className="text-neutral-200">{lobby.maxMembers}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-400">Lock</dt>
            <dd className="text-neutral-200">{lobby.locked ? 'Locked' : 'Unlocked'}</dd>
          </div>
        </dl>
      </div>
    )
  }

  return (
    <div>
      <div className="space-y-3">
        <label className="block text-xs text-neutral-400">
          Region
          <select
            className="field mt-1 w-full"
            value={lobby.region}
            disabled={savingField === 'region'}
            onChange={(event) => void updateField('region', { region: event.target.value })}
          >
            {REGIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-neutral-400">
          Mic
          <select
            className="field mt-1 w-full"
            value={lobby.mic}
            disabled={savingField === 'mic'}
            onChange={(event) => void updateField('mic', { mic: event.target.value as MicRequirement })}
          >
            {MIC_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {labelForMic(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-neutral-400">
          Tone
          <select
            className="field mt-1 w-full"
            value={lobby.tone}
            disabled={savingField === 'tone'}
            onChange={(event) => void updateField('tone', { tone: event.target.value as LobbyTone })}
          >
            {TONE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === 'casual' ? 'Casual' : 'Competitive'}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-neutral-400">
          Max members
          <select
            className="field mt-1 w-full"
            value={lobby.maxMembers}
            disabled={savingField === 'max_members'}
            onChange={(event) => void updateField('max_members', { max_members: Number(event.target.value) })}
          >
            {Array.from({ length: MAX_MEMBERS - MIN_MEMBERS + 1 }, (_, index) => MIN_MEMBERS + index).map(
              (count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              )
            )}
          </select>
        </label>

        <button
          type="button"
          className="btn-secondary w-full"
          disabled={savingField === 'locked'}
          onClick={() => void updateField('locked', { locked: !lobby.locked })}
        >
          {lobby.locked ? 'Unlock lobby' : 'Lock lobby'}
        </button>
      </div>
    </div>
  )
}
