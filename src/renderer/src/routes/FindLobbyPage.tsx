import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { AppOutletContext } from '../layout/AppShell'
import { useSession } from '../lib/session'
import { supabase } from '../lib/supabase'
import { searchLobbies } from '../lib/lobby-search'
import { rankLobbies } from '../lib/lobby-scoring'
import type { LobbySummary } from '../lib/lobby-summary'
import LobbyFilterBar, { type LobbyFilterState } from '../components/LobbyFilterBar'
import LobbyCard from '../components/LobbyCard'
import CreateThisLobbyCard from '../components/CreateThisLobbyCard'

interface OwnedGame {
  appid: string
  name: string
}

interface SearchContext {
  ownedGames: OwnedGame[]
  languages: string[]
  region: string | null
}

/** Owned games (for the filter bar's game dropdown, same user_games join
 * games query ProfilePage.tsx already does) plus the profile fields the
 * search needs: languages for the hard filter, region for the default
 * filter value. */
async function loadSearchContext(userId: string): Promise<SearchContext> {
  const [{ data: ownedRows }, { data: profile }] = await Promise.all([
    supabase.from('user_games').select('appid').eq('user_id', userId),
    supabase.from('users').select('region, languages').eq('id', userId).maybeSingle()
  ])

  const appids = (ownedRows ?? []).map((row) => row.appid)
  let ownedGames: OwnedGame[] = []
  if (appids.length > 0) {
    const { data } = await supabase.from('games').select('appid, name').in('appid', appids)
    ownedGames = data ?? []
  }

  return { ownedGames, languages: profile?.languages ?? [], region: profile?.region ?? null }
}

const DEFAULT_FILTERS: LobbyFilterState = {
  appid: null,
  region: null,
  mic: null,
  tone: null,
  minFreeSlots: 1
}

/**
 * Find lobby opens on lobbies, not games. Live lobbies for games the user
 * owns come first (see rankLobbies). Search is scored, not filtered — the
 * only hard filters are the game, a free slot, and language (lobby-search.ts);
 * region/mic/tone only cost points (lobby-scoring.ts) and are shown as
 * mismatch chips on the card, never used to exclude a result.
 */
export default function FindLobbyPage() {
  const { openCreateLobby, activeLobby } = useOutletContext<AppOutletContext>()
  const { session } = useSession()

  const [context, setContext] = useState<SearchContext | null>(null)
  const [filters, setFilters] = useState<LobbyFilterState>(DEFAULT_FILTERS)
  const [candidates, setCandidates] = useState<LobbySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [joiningLobbyId, setJoiningLobbyId] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)

  const userId = session?.user.id

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void loadSearchContext(userId).then((result) => {
      if (cancelled) return
      setContext(result)
      // Prefill the region filter from Settings, once, on first load.
      setFilters((current) => ({ ...current, region: result.region }))
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const runSearch = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const results = await searchLobbies({ appid: filters.appid, minFreeSlots: filters.minFreeSlots }, context?.languages ?? [])
    setCandidates(results)
    setLoading(false)
  }, [userId, filters.appid, filters.minFreeSlots, context?.languages])

  useEffect(() => {
    void runSearch()
  }, [runSearch])

  // Supabase Realtime so a lobby created or joined by anyone appears here
  // without a manual refresh.
  useEffect(() => {
    const channel = supabase
      .channel('find-lobby-search')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobbies' }, () => void runSearch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobby_members' }, () => void runSearch())
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [runSearch])

  const ownedAppids = useMemo(() => new Set((context?.ownedGames ?? []).map((game) => game.appid)), [context])

  const ranked = useMemo(
    () => rankLobbies(candidates, { region: filters.region, mic: filters.mic, tone: filters.tone }, ownedAppids),
    [candidates, filters.region, filters.mic, filters.tone, ownedAppids]
  )

  async function handleJoin(lobby: LobbySummary): Promise<void> {
    if (!userId) return
    if (activeLobby) {
      setJoinError('Leave your current lobby first')
      return
    }
    setJoiningLobbyId(lobby.id)
    setJoinError(null)
    const { error } = await supabase.from('lobby_members').insert({ lobby_id: lobby.id, user_id: userId })
    if (error) setJoinError(error.message)
    setJoiningLobbyId(null)
  }

  const selectedGameName = filters.appid
    ? (context?.ownedGames.find((game) => game.appid === filters.appid)?.name ?? null)
    : null

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
        <h1 className="text-lg font-semibold text-foreground">Find lobby</h1>
        <button type="button" className="btn-secondary" onClick={() => openCreateLobby()}>
          Create lobby
        </button>
      </div>

      <LobbyFilterBar filters={filters} onChange={setFilters} ownedGames={context?.ownedGames ?? []} />

      {joinError && <p className="px-6 pt-3 text-sm text-red-400">{joinError}</p>}

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <p className="text-sm text-neutral-400">Searching…</p>
        ) : ranked.length === 0 ? (
          <CreateThisLobbyCard
            gameName={selectedGameName}
            region={filters.region}
            mic={filters.mic}
            tone={filters.tone}
            onCreate={() =>
              openCreateLobby({
                appid: filters.appid ?? undefined,
                region: filters.region ?? undefined,
                mic: filters.mic ?? undefined,
                tone: filters.tone ?? undefined
              })
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ranked.map((scored) => (
              <LobbyCard
                key={scored.lobby.id}
                scored={scored}
                joining={joiningLobbyId === scored.lobby.id}
                onJoin={() => void handleJoin(scored.lobby)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
