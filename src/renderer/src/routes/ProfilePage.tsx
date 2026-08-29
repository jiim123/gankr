import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import GameOwnershipAction from '../components/GameOwnershipAction'
import { getOwnershipStatus } from '../lib/ownership'
import { syncSteamLibrary } from '../lib/librarySync'
import { useSession } from '../lib/session'
import { labelForTag } from '../lib/feedback'
import { loadProfile, minutesToHours, reputationColorClass, type ProfileData } from '../lib/profile'

const EMPTY_PROFILE_DATA: ProfileData = {
  profile: null,
  visibility: null,
  games: [],
  feedbackCounts: [],
  recentFeedback: []
}

function formatMemberSince(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { session, loading: sessionLoading } = useSession()

  const targetUserId = id === 'me' ? session?.user.id : id
  const isOwnProfile = Boolean(session && targetUserId === session.user.id)

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ProfileData>(EMPTY_PROFILE_DATA)
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
        <div className="px-6 pt-6 pb-4">
          <h1 className="text-2xl font-semibold text-foreground">Profile</h1>
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

  const { profile, visibility, games, feedbackCounts, recentFeedback } = data

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-2xl font-semibold text-foreground">Profile</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          {/* Left column: who they are, then what they play. */}
          <div className="space-y-6">
            <section className="surface flex items-center gap-4 p-4">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-16 w-16 rounded-full" />
              ) : (
                <div className="h-16 w-16 rounded-full bg-neutral-800" aria-hidden="true" />
              )}
              <div>
                <div className="text-lg font-semibold text-foreground">{profile.display_name}</div>
                <div className="text-sm text-neutral-400">{profile.region ?? 'Region not set'}</div>
                <div className="text-xs text-neutral-500">Member since {formatMemberSince(profile.created_at)}</div>
              </div>
            </section>

            <section className="surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium text-foreground">Most played</h2>
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
                <ul className="flex flex-wrap gap-3">
                  {games.map((game) => (
                    <li
                      key={game.appid}
                      className="flex min-w-[9rem] flex-1 flex-col items-center gap-2 rounded-lg border border-neutral-800 p-3 text-center"
                    >
                      {game.headerImage ? (
                        <img src={game.headerImage} alt="" className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-neutral-800" aria-hidden="true" />
                      )}
                      <div className="text-sm font-medium text-foreground">{game.name}</div>
                      <div className="text-xs text-neutral-500">{minutesToHours(game.playtimeForeverMinutes)} hrs</div>
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

          {/* Right column: Gankr Status. */}
          <div className="space-y-6">
            <section className="surface p-4">
              <h2 className="text-sm font-medium text-foreground">Gankr Status</h2>
              <p className={`mt-2 text-4xl font-bold ${reputationColorClass(profile.reputation_score)}`}>
                {profile.reputation_score}
              </p>
              <p className="text-xs text-neutral-500">Reputation</p>

              {feedbackCounts.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {feedbackCounts.map(({ tag, polarity, count }) => (
                    <span
                      key={tag}
                      className={[
                        'rounded-full border px-3 py-1 text-xs',
                        polarity === 'positive'
                          ? 'border-emerald-800 bg-emerald-950 text-emerald-400'
                          : 'border-red-900 bg-red-950 text-red-400'
                      ].join(' ')}
                    >
                      {labelForTag(tag)} &times;{count}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section className="surface p-4">
              <h2 className="text-sm font-medium text-foreground">Recent feedback</h2>
              {recentFeedback.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-500">No feedback yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {recentFeedback.map((item) => (
                    <li key={item.id} className="text-sm text-neutral-300">
                      {item.fromDisplayName} gave feedback{' '}
                      <span className={item.polarity === 'positive' ? 'text-emerald-400' : 'text-red-400'}>
                        {labelForTag(item.tag)}
                      </span>{' '}
                      to {profile.display_name}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
