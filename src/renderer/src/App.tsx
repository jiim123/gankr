import { useEffect, useRef } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import AppShell from './layout/AppShell'
import LoginPage from './routes/LoginPage'
import FindLobbyPage from './routes/FindLobbyPage'
import PlayersPage from './routes/PlayersPage'
import FriendsPage from './routes/FriendsPage'
import ProfilePage from './routes/ProfilePage'
import SettingsPage from './routes/SettingsPage'
import { useSession } from './lib/session'
import { supabase } from './lib/supabase'
import { syncSteamLibrary } from './lib/librarySync'

/**
 * Subscribes once to the session main pushes after a Steam sign-in round
 * trip lands back at `gankr://auth-callback` (see src/main/protocol.ts).
 * Lives at the top of the app rather than inside LoginPage, since the
 * callback can arrive after the user has already navigated elsewhere (or
 * closed and reopened the window while the browser tab was still open).
 */
function useAuthCallbackBridge(): void {
  const navigate = useNavigate()

  useEffect(() => {
    async function applyCallback({
      accessToken,
      refreshToken
    }: {
      accessToken: string
      refreshToken: string
    }): Promise<void> {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      })
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[auth] failed to apply session from callback', error)
        return
      }
      void syncSteamLibrary()
      navigate('/find', { replace: true })
    }

    // Cold-start case: the app can be launched BY the gankr:// click
    // itself, in which case main sends the auth:callback push before this
    // component has even mounted, and it's dropped with nobody listening.
    // Pull once for anything that already arrived, in addition to
    // subscribing below for the already-running/warm case.
    void window.gankr.getPendingAuthCallback().then((callback) => {
      if (callback) void applyCallback(callback)
    })

    const unsubscribe = window.gankr.onAuthCallback((callback) => {
      void applyCallback(callback)
    })
    return unsubscribe
  }, [navigate])
}

/** Fires a library sync once per signed-in user per app session. The Edge
 * Function itself no-ops when the existing sync is under 24h old, so this
 * covers both "just signed in" and "app reopened with a stale library"
 * without duplicating that staleness check on the client. */
function useLibrarySyncOnSignIn(userId: string | undefined): void {
  const syncedForUserId = useRef<string | null>(null)

  useEffect(() => {
    if (!userId) return
    if (syncedForUserId.current === userId) return
    syncedForUserId.current = userId
    void syncSteamLibrary()
  }, [userId])
}

export default function App() {
  const { session, loading } = useSession()
  useAuthCallbackBridge()
  useLibrarySyncOnSignIn(session?.user.id)

  if (loading) return null

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/find" replace /> : <LoginPage />} />

      {/* Docked lobby bar lives on this layout, not on any one route, so it
          survives navigation between these pages. */}
      <Route element={session ? <AppShell /> : <Navigate to="/login" replace />}>
        <Route path="/find" element={<FindLobbyPage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/profile/:id" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/" element={<Navigate to="/find" replace />} />
      </Route>

      <Route path="*" element={<Navigate to={session ? '/find' : '/login'} replace />} />
    </Routes>
  )
}
