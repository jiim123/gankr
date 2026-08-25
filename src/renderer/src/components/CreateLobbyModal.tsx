import { useEffect, useState } from 'react'
import type { Tables } from '@shared/db-types'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'
import { MIC_OPTIONS, REGIONS, TONE_OPTIONS } from '../lib/lobby-options'
import type { LobbySummary } from '../lib/lobby-summary'

type MicRequirement = Tables<'lobbies'>['mic']
type LobbyTone = Tables<'lobbies'>['tone']

export interface CreateLobbyPrefill {
  appid?: string
  region?: string
  mic?: MicRequirement
  tone?: LobbyTone
}

interface OwnedGame {
  appid: string
  name: string
}

interface CreateLobbyContext {
  games: OwnedGame[]
  region: string | null
  languages: string[]
}

async function loadCreateLobbyContext(userId: string): Promise<CreateLobbyContext> {
  const [{ data: ownedRows }, { data: profile }] = await Promise.all([
    supabase.from('user_games').select('appid').eq('user_id', userId),
    supabase.from('users').select('region, languages').eq('id', userId).maybeSingle()
  ])

  const appids = (ownedRows ?? []).map((row) => row.appid)
  let games: OwnedGame[] = []
  if (appids.length > 0) {
    const { data } = await supabase.from('games').select('appid, name').in('appid', appids)
    games = data ?? []
  }

  return { games, region: profile?.region ?? null, languages: profile?.languages ?? [] }
}

const MIN_MEMBERS = 2
const MAX_MEMBERS = 8
const DEFAULT_MEMBERS = 5

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

interface CreateLobbyModalProps {
  open: boolean
  prefill: CreateLobbyPrefill | null
  activeLobby: LobbySummary | null
  onClose: () => void
}

/**
 * A modal, not a route — CLAUDE.md says lobby creation is "available from
 * anywhere," and Phase 7's lobby room doesn't exist to navigate to
 * afterward. Mounted at the AppShell level so it floats above the docked
 * bar too. Fields match the spec exactly: game (owned, required), max
 * members, region/mic/tone. No languages field — inherited silently from
 * the creator's users.languages at insert time.
 */
export default function CreateLobbyModal({ open, prefill, activeLobby, onClose }: CreateLobbyModalProps) {
  const { session } = useSession()

  const [context, setContext] = useState<CreateLobbyContext | null>(null)
  const [loading, setLoading] = useState(false)
  const [appid, setAppid] = useState('')
  const [maxMembers, setMaxMembers] = useState(DEFAULT_MEMBERS)
  const [region, setRegion] = useState<string>(REGIONS[0])
  const [mic, setMic] = useState<MicRequirement>('preferred')
  const [tone, setTone] = useState<LobbyTone>('casual')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !session) return
    setLoading(true)
    setError(null)
    void loadCreateLobbyContext(session.user.id).then((result) => {
      setContext(result)
      setAppid(prefill?.appid ?? result.games[0]?.appid ?? '')
      setRegion(prefill?.region ?? result.region ?? REGIONS[0])
      setMic(prefill?.mic ?? 'preferred')
      setTone(prefill?.tone ?? 'casual')
      setMaxMembers(DEFAULT_MEMBERS)
      setLoading(false)
    })
    // Reload every time the modal opens, since a prefill or owned-games
    // list could have changed since it was last open.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prefill is a plain object literal from the caller; comparing by identity would re-run this on every render instead of only on open.
  }, [open, session])

  if (!open) return null

  async function handleSubmit(): Promise<void> {
    if (!session) return
    if (activeLobby) {
      setError('Leave your current lobby first')
      return
    }
    if (!appid) {
      setError('Pick a game')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const { data: lobby, error: insertError } = await supabase
        .from('lobbies')
        .insert({
          appid,
          owner_id: session.user.id,
          max_members: maxMembers,
          region,
          mic,
          tone,
          languages: context?.languages ?? []
        })
        .select()
        .single()

      if (insertError || !lobby) {
        setError(insertError?.message ?? 'Could not create the lobby')
        return
      }

      // If this second insert fails, deliberately no compensating delete: an
      // owner-only lobby whose join failed gets cleaned up by the same
      // sweep_lobbies() cron that handles every other abandoned lobby.
      await supabase.from('lobby_members').insert({ lobby_id: lobby.id, user_id: session.user.id })

      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="surface w-full max-w-md p-5">
        <h2 className="text-sm font-medium text-white">Create lobby</h2>

        {loading ? (
          <p className="mt-4 text-sm text-neutral-400">Loading your games…</p>
        ) : activeLobby ? (
          <p className="mt-4 text-sm text-neutral-400">
            You&apos;re already in a lobby. Leave it before creating another.
          </p>
        ) : context && context.games.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-400">
            You need an owned game synced to your library before you can create a lobby.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-xs text-neutral-400">
              Game
              <select className="field mt-1 w-full" value={appid} onChange={(event) => setAppid(event.target.value)}>
                {(context?.games ?? []).map((game) => (
                  <option key={game.appid} value={game.appid}>
                    {game.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs text-neutral-400">
              Max members
              <select
                className="field mt-1 w-full"
                value={maxMembers}
                onChange={(event) => setMaxMembers(Number(event.target.value))}
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

            <label className="block text-xs text-neutral-400">
              Region
              <select className="field mt-1 w-full" value={region} onChange={(event) => setRegion(event.target.value)}>
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
                value={mic}
                onChange={(event) => setMic(event.target.value as MicRequirement)}
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
              <select className="field mt-1 w-full" value={tone} onChange={(event) => setTone(event.target.value as LobbyTone)}>
                {TONE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === 'casual' ? 'Casual' : 'Competitive'}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {!loading && !activeLobby && context && context.games.length > 0 && (
            <button type="button" className="btn-primary" onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create lobby'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
