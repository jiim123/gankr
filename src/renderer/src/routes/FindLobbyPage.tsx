import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { NavArrowLeft } from 'iconoir-react'
import type { AppOutletContext } from '../layout/AppShell'
import { useSession } from '../lib/session'
import { supabase } from '../lib/supabase'
import { searchLobbies } from '../lib/lobby-search'
import { rankLobbies } from '../lib/lobby-scoring'
import type { LobbySummary } from '../lib/lobby-summary'
import LobbyFilterPopover, { type LobbyFilterState } from '../components/LobbyFilterPopover'
import LobbyCard from '../components/LobbyCard'
import GameSummaryCard from '../components/GameSummaryCard'
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

interface GameSummary {
  appid: string
  gameName: string
  lobbyCount: number
}

/** Owned games (for the filter popover's game dropdown and the "show only
 * games you own" toggle, same user_games join games query ProfilePage.tsx
 * already does) plus the profile fields the search needs: languages for the
 * hard filter, region for the default filter value. */
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
  minFreeSlots: 1,
  ownedOnly: false
}

/**
 * Find lobby opens on games with open lobbies, not on individual lobbies —
 * browse as a 5-per-row grid of game cards (cover art, name, lobby count),
 * pick one to drill into its scored lobby list (LobbyCard). Search is
 * scored, not filtered — the only hard filters are the game, a free slot,
 * and language (lobby-search.ts); region/mic/tone only cost points
 * (lobby-scoring.ts) and are shown as mismatch chips on the lobby card,
 * never used to exclude a result outright.
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

  // Browse view: one card per game, not per lobby. "Show only games you
  // own" filters this grouping, live, off the already-fetched/ranked
  // results — no extra round trip needed for a toggle this cheap.
  const gameSummaries = useMemo<GameSummary[]>(() => {
    const relevant = filters.ownedOnly ? ranked.filter((scored) => ownedAppids.has(scored.lobby.appid)) : ranked

    const byAppid = new Map<string, GameSummary>()
    for (const scored of relevant) {
      const existing = byAppid.get(scored.lobby.appid)
      if (existing) {
        existing.lobbyCount += 1
      } else {
        byAppid.set(scored.lobby.appid, { appid: scored.lobby.appid, gameName: scored.lobby.gameName, lobbyCount: 1 })
      }
    }

    // Games the user owns come first, matching the existing "live lobbies
    // for games the user owns come first" ordering rule.
    return [...byAppid.values()].sort((a, b) => {
      const aOwned = ownedAppids.has(a.appid) ? 0 : 1
      const bOwned = ownedAppids.has(b.appid) ? 0 : 1
      if (aOwned !== bOwned) return aOwned - bOwned
      return b.lobbyCount - a.lobbyCount
    })
  }, [ranked, filters.ownedOnly, ownedAppids])

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
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <h1 className="text-2xl font-semibold text-foreground">Find lobby</h1>
        <div className="flex items-center gap-2">
          <LobbyFilterPopover filters={filters} onChange={setFilters} ownedGames={context?.ownedGames ?? []} />
          <button type="button" className="btn-secondary" onClick={() => openCreateLobby()}>
            Create lobby
          </button>
        </div>
      </div>

      {joinError && <p className="px-6 pb-3 text-sm text-red-400">{joinError}</p>}

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <p className="text-sm text-neutral-400">Searching…</p>
        ) : filters.appid ? (
          <>
            <button
              type="button"
              className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-400 transition-colors hover:text-foreground"
              onClick={() => setFilters((current) => ({ ...current, appid: null }))}
            >
              <NavArrowLeft width={16} height={16} strokeWidth={2} />
              All games
            </button>

            {ranked.length === 0 ? (
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
          </>
        ) : gameSummaries.length === 0 ? (
          <CreateThisLobbyCard
            gameName={null}
            region={filters.region}
            mic={filters.mic}
            tone={filters.tone}
            onCreate={() =>
              openCreateLobby({
                region: filters.region ?? undefined,
                mic: filters.mic ?? undefined,
                tone: filters.tone ?? undefined
              })
            }
          />
        ) : (
          <div className="grid grid-cols-5 gap-4">
            {gameSummaries.map((game) => (
              <GameSummaryCard
                key={game.appid}
                appid={game.appid}
                gameName={game.gameName}
                lobbyCount={game.lobbyCount}
                onClick={() => setFilters((current) => ({ ...current, appid: game.appid }))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
