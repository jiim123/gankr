import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Tables } from '@shared/db-types'
import EmptyState from '../components/EmptyState'
import GameOwnershipAction from '../components/GameOwnershipAction'
import { getOwnershipStatus } from '../lib/ownership'
import { syncSteamLibrary } from '../lib/librarySync'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'

interface GameWithPlaytime {
  appid: string
  name: string
  headerImage: string | null
  playtimeForeverMinutes: number
}

type ProfileRow = Pick<Tables<'users'>, 'id' | 'display_name' | 'avatar_url' | 'region'>
type ProfileVisibility = Tables<'steam_identities'>['profile_visibility']
type GameRow = Pick<Tables<'games'>, 'appid' | 'name' | 'header_image'>

/** Minutes -> hours, one decimal place, e.g. 90 minutes -> 1.5. Never
 * display raw minutes as if they were hours. */
function minutesToHours(minutes: number): number {
  return Math.round(minutes / 6) / 10
}

interface ProfileData {
  profile: ProfileRow | null
  visibility: ProfileVisibility | null
  games: GameWithPlaytime[]
}

/** Loads everything the profile page shows for one user. RLS means a
 * `user_games`/`steam_identities` query for anyone other than the caller
 * (or an active lobby co-member, for steam_identities) simply comes back
 * empty rather than erroring — that's the intended Phase 2 behaviour, not
 * a bug to route around here. */
async function loadProfile(userId: string): Promise<ProfileData> {
  const [{ data: profile }, { data: identity }, { data: userGames }] = await Promise.all([
    supabase.from('users').select('id, display_name, avatar_url, region').eq('id', userId).maybeSingle(),
    supabase.from('steam_identities').select('profile_visibility').eq('user_id', userId).maybeSingle(),
    supabase
      .from('user_games')
      .select('appid, playtime_forever_minutes')
      .eq('user_id', userId)
      .order('playtime_forever_minutes', { ascending: false })
  ])

  const rows = userGames ?? []
  let gameRows: GameRow[] = []
  if (rows.length > 0) {
    const { data } = await supabase
      .from('games')
      .select('appid, name, header_image')
      .in(
        'appid',
        rows.map((row) => row.appid)
      )
    gameRows = data ?? []
  }

  const gamesByAppid = new Map(gameRows.map((game) => [game.appid, game]))
  const games: GameWithPlaytime[] = rows.map((row) => {
    const game = gamesByAppid.get(row.appid)
    return {
      appid: row.appid,
      name: game?.name ?? row.appid,
      headerImage: game?.header_image ?? null,
      playtimeForeverMinutes: row.playtime_forever_minutes
    }
  })

  return { profile: profile ?? null, visibility: identity?.profile_visibility ?? null, games }
}

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { session, loading: sessionLoading } = useSession()

  const targetUserId = id === 'me' ? session?.user.id : id
  const isOwnProfile = Boolean(session && targetUserId === session.user.id)

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ProfileData>({ profile: null, visibility: null, games: [] })
  const [syncing, setSyncing] = useState(false)

  const refresh = useCallback(async () => {
    if (!targetUserId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await loadProfile(targetUserId)
    setData(result)
    setLoading(false)
  }, [targetUserId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const ownedAppids = useMemo(() => data.games.map((game) => ({ appid: game.appid })), [data.games])

  async function handleSync(): Promise<void> {
    setSyncing(true)
    try {
      await syncSteamLibrary(true)
      await refresh()
    } finally {
      setSyncing(false)
    }
  }

  if (sessionLoading || loading) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-neutral-800 px-6 py-4">
          <h1 className="text-lg font-semibold text-foreground">Profile</h1>
        </div>
      </div>
    )
  }

  if (!session || !data.profile) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-1">
          <EmptyState
            title="No profile data yet"
            description="Steam sign-in fills in an avatar, name, and library. Sign in to build out this profile."
            actionLabel="Go to sign in"
            onAction={() => navigate('/login')}
          />
        </div>
      </div>
    )
  }

  const { profile, visibility, games } = data

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-800 px-6 py-4">
        <h1 className="text-lg font-semibold text-foreground">Profile</h1>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
        <section className="surface flex items-center gap-4 p-4">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-16 w-16 rounded-full" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-neutral-800" aria-hidden="true" />
          )}
          <div>
            <div className="text-lg font-semibold text-foreground">{profile.display_name}</div>
            <div className="text-sm text-neutral-400">{profile.region ?? 'Region not set'}</div>
          </div>
        </section>

        <section className="surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Top games by playtime</h2>
            {isOwnProfile && (
              <button type="button" className="btn-secondary" onClick={() => void handleSync()} disabled={syncing}>
                {syncing ? 'Syncing…' : 'Sync library'}
              </button>
            )}
          </div>

          {!isOwnProfile && (
            <p className="text-sm text-neutral-400">This player&apos;s game list is only visible to them.</p>
          )}
          {isOwnProfile && visibility === 'private' && games.length > 0 && (
            <p className="mb-3 text-sm text-neutral-400">
              Your Steam profile is set to private, so Gankr can&apos;t read your current library.
              The games below are from the last time it was visible.
            </p>
          )}

          {games.length === 0 ? (
            <EmptyState
              title={visibility === 'private' ? 'Library not visible' : 'No games synced yet'}
              description={
                !isOwnProfile
                  ? 'This player has not synced a public library yet.'
                  : visibility === 'private'
                    ? 'Make your Steam game details public, then sync again.'
                    : 'Sync your Steam library to see your games here.'
              }
              actionLabel={isOwnProfile ? 'Sync library' : undefined}
              onAction={isOwnProfile ? () => void handleSync() : undefined}
            />
          ) : (
            <ul className="divide-y divide-neutral-800">
              {games.map((game) => (
                <li key={game.appid} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex items-center gap-3">
                    {game.headerImage && <img src={game.headerImage} alt="" className="h-8 w-8 rounded" />}
                    <div>
                      <div className="text-sm font-medium text-foreground">{game.name}</div>
                      <div className="text-xs text-neutral-500">
                        {minutesToHours(game.playtimeForeverMinutes)} hrs
                      </div>
                    </div>
                  </div>
                  <GameOwnershipAction
                    appid={game.appid}
                    status={getOwnershipStatus(game.appid, ownedAppids, visibility ?? 'unknown')}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
