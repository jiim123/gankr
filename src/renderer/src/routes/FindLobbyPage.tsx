import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { NavArrowLeft } from 'iconoir-react'
import type { AppOutletContext } from '../layout/AppShell'
import { useSession } from '../lib/session'
import { supabase } from '../lib/supabase'
import { searchLobbies } from '../lib/lobby-search'
import { rankLobbies } from '../lib/lobby-scoring'
import { resolveLobbyDisplayName, type LobbySummary } from '../lib/lobby-summary'
import { loadPopularGames, type PopularGame } from '../lib/game-popularity'
import LobbyFilterPopover, { type LobbyFilterState } from '../components/LobbyFilterPopover'
import LobbyCard from '../components/LobbyCard'
import GameSummaryCard from '../components/GameSummaryCard'
import CreateThisLobbyCard from '../components/CreateThisLobbyCard'
import JoinPrivateLobbyModal from '../components/JoinPrivateLobbyModal'

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
 * Find lobby opens on games, not on individual lobbies — browse as a
 * 5-per-row grid of game cards (cover art, name, lobby count). With "show
 * only games you own" off, the grid is the 50 most-owned games across all
 * Gankr users (game-popularity.ts), paginated with Load more; with it on,
 * the grid is the signed-in user's own owned games instead. Either way,
 * picking a card drills into that game's scored lobby list (LobbyCard).
 * Search is scored, not filtered — the only hard filters are the game, a
 * free slot, and language (lobby-search.ts); region/mic/tone only cost
 * points (lobby-scoring.ts) and are shown as mismatch chips on the lobby
 * card, never used to exclude a result outright.
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
  const [passwordPromptLobby, setPasswordPromptLobby] = useState<LobbySummary | null>(null)

  const [popularGames, setPopularGames] = useState<PopularGame[]>([])
  const [popularOffset, setPopularOffset] = useState(0)
  const [popularHasMore, setPopularHasMore] = useState(false)
  const [loadingPopular, setLoadingPopular] = useState(false)

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

  // The 50-most-popular-games browse list only applies when nothing else is
  // picking the game set (not drilled into one game, not "owned only").
  // Reloads from the top whenever that becomes true again — a stale
  // half-loaded list from a previous visit would be confusing.
  useEffect(() => {
    if (filters.ownedOnly || filters.appid) return
    let cancelled = false
    setLoadingPopular(true)
    void loadPopularGames(0).then((result) => {
      if (cancelled) return
      setPopularGames(result.games)
      setPopularOffset(result.games.length)
      setPopularHasMore(result.hasMore)
      setLoadingPopular(false)
    })
    return () => {
      cancelled = true
    }
  }, [filters.ownedOnly, filters.appid])

  async function handleLoadMorePopular(): Promise<void> {
    setLoadingPopular(true)
    const result = await loadPopularGames(popularOffset)
    setPopularGames((current) => [...current, ...result.games])
    setPopularOffset((current) => current + result.games.length)
    setPopularHasMore(result.hasMore)
    setLoadingPopular(false)
  }

  const ownedAppids = useMemo(() => new Set((context?.ownedGames ?? []).map((game) => game.appid)), [context])

  const ranked = useMemo(
    () => rankLobbies(candidates, { region: filters.region, mic: filters.mic, tone: filters.tone }, ownedAppids),
    [candidates, filters.region, filters.mic, filters.tone, ownedAppids]
  )

  // How many currently-scored lobbies each game has — looked up by both the
  // popular-games grid and the owned-games grid, not recomputed per card.
  const lobbyCountByAppid = useMemo(() => {
    const counts = new Map<string, number>()
    for (const scored of ranked) {
      counts.set(scored.lobby.appid, (counts.get(scored.lobby.appid) ?? 0) + 1)
    }
    return counts
  }, [ranked])

  // "Show only games you own": every owned game, not just ones with a
  // lobby right now — a 0-lobby card is still useful, it invites creating
  // one (CreateThisLobbyCard's same fallback covers that once picked).
  const ownedGameSummaries = useMemo<GameSummary[]>(() => {
    return (context?.ownedGames ?? [])
      .map((game) => ({
        appid: game.appid,
        gameName: game.name,
        lobbyCount: lobbyCountByAppid.get(game.appid) ?? 0
      }))
      .sort((a, b) => b.lobbyCount - a.lobbyCount)
  }, [context, lobbyCountByAppid])

  async function handleJoin(lobby: LobbySummary): Promise<void> {
    if (!userId) return
    if (activeLobby) {
      setJoinError('Leave your current lobby first')
      return
    }
    setJoinError(null)
    if (lobby.visibility === 'open') {
      setJoiningLobbyId(lobby.id)
      const { error } = await supabase.from('lobby_members').insert({ lobby_id: lobby.id, user_id: userId })
      if (error) setJoinError(error.message)
      setJoiningLobbyId(null)
    } else {
      setPasswordPromptLobby(lobby)
    }
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
        ) : filters.ownedOnly ? (
          ownedGameSummaries.length === 0 ? (
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
              {ownedGameSummaries.map((game) => (
                <GameSummaryCard
                  key={game.appid}
                  appid={game.appid}
                  gameName={game.gameName}
                  lobbyCount={game.lobbyCount}
                  onClick={() => setFilters((current) => ({ ...current, appid: game.appid }))}
                />
              ))}
            </div>
          )
        ) : loadingPopular && popularGames.length === 0 ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : popularGames.length === 0 ? (
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
          <>
            <div className="grid grid-cols-5 gap-4">
              {popularGames.map((game) => (
                <GameSummaryCard
                  key={game.appid}
                  appid={game.appid}
                  gameName={game.name}
                  lobbyCount={lobbyCountByAppid.get(game.appid) ?? 0}
                  onClick={() => setFilters((current) => ({ ...current, appid: game.appid }))}
                />
              ))}
            </div>
            {popularHasMore && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => void handleLoadMorePopular()}
                  disabled={loadingPopular}
                >
                  {loadingPopular ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <JoinPrivateLobbyModal
        open={passwordPromptLobby !== null}
        lobbyId={passwordPromptLobby?.id ?? null}
        lobbyName={passwordPromptLobby ? resolveLobbyDisplayName(passwordPromptLobby) : ''}
        onJoined={() => setPasswordPromptLobby(null)}
        onClose={() => setPasswordPromptLobby(null)}
      />
    </div>
  )
}
