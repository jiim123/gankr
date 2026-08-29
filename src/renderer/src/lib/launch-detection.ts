import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { LobbySummary } from './lobby-summary'
import type { TablesUpdate } from '@shared/db-types'

/** Provisional default — Phase 1's real detection spike (which was supposed
 * to measure this across several games) was never run. 90s is generous
 * enough to survive a cold Steam handshake or anti-cheat check; Retry always
 * resets it if it guesses wrong. */
export const LAUNCH_WINDOW_MS = 90_000
const POLL_INTERVAL_MS = 4_000
/** Local-only grace period before demoting out of `in_game` on a process
 * disappearance — survives a launcher hand-off blip without a DB write.
 * Never persisted; there's nothing for another client to see here. */
const EXIT_DEBOUNCE_MS = 15_000
const MAX_LOCAL_RETRIES = 3
/** CLAUDE.md: "the main process pings every 30 seconds with the member's
 * current state" — this app pings from the renderer instead (see the
 * module doc comment), but the cadence and purpose are the same: keep
 * lobby_members.last_heartbeat fresh so sweep_lobbies()'s 2min/10min grace
 * windows don't close a lobby that's genuinely still active. This runs the
 * whole time someone is an active member, independent of the launch-poll
 * effect below (which only runs during launching/in_game). */
const HEARTBEAT_INTERVAL_MS = 30_000

export interface LaunchDetectionState {
  /** null = not checked yet. */
  steamRunning: boolean | null
  /** True once local retries hit MAX_LOCAL_RETRIES — the UI promotes Leave
   * lobby to primary, but keeps Retry/override available alongside it. */
  promoteLeave: boolean
  startGame: () => Promise<void>
  retry: () => Promise<void>
  continueWithoutDetection: () => Promise<void>
}

/**
 * Phase 8's launch/heartbeat poll. Deliberately mounted at the layout level
 * (AppShell), not inside LobbyRoom — LobbyRoom unmounts when the floating
 * panel is minimized, but the lobby (and any in-progress launch) is still
 * very much active. Same reasoning as useActiveLobby living at this level.
 *
 * Runs entirely in the renderer, writing lobby_members directly through the
 * existing Supabase client — this app's main process has no Supabase
 * session anywhere, and keeping business state there consistent with every
 * other feature was chosen over matching CLAUDE.md's literal "main process
 * pings" wording. Reliability while the window is hidden to tray comes from
 * `backgroundThrottling: false` on the BrowserWindow (src/main/window.ts),
 * not from moving this loop into main.
 */
export function useLaunchDetection(lobby: LobbySummary | null, userId: string | undefined): LaunchDetectionState {
  const [steamRunning, setSteamRunning] = useState<boolean | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const lastSeenRunningAtRef = useRef<number | null>(null)

  const lobbyId = lobby?.id
  const appid = lobby?.appid
  const ownMember = lobby?.members.find((member) => member.userId === userId) ?? null
  const memberState = ownMember?.memberState
  const launchClickedAt = ownMember?.launchClickedAt
  const gameStartedAt = ownMember?.gameStartedAt

  useEffect(() => {
    setRetryCount(0)
    lastSeenRunningAtRef.current = null
  }, [lobbyId])

  // Check Steam eagerly whenever launching might happen soon, so "Steam
  // isn't running" is a message the player sees upfront rather than a
  // click-time surprise. Re-verified again right before the actual open in
  // startGame(), since Steam could start or quit in the interim.
  useEffect(() => {
    if (memberState !== 'in_lobby' && memberState !== 'launch_failed') return undefined
    let cancelled = false
    void window.gankr.isSteamRunning().then(({ running }) => {
      if (!cancelled) setSteamRunning(running)
    })
    return () => {
      cancelled = true
    }
  }, [memberState])

  const updateOwnMember = useCallback(
    async (patch: TablesUpdate<'lobby_members'>) => {
      if (!lobbyId || !userId) return
      await supabase.from('lobby_members').update(patch).eq('lobby_id', lobbyId).eq('user_id', userId)
    },
    [lobbyId, userId]
  )

  // Heartbeat: independent of the launch-detection poll below, runs the
  // entire time this user has an active lobby membership (any member_state),
  // not just while launching/in_game. Fires once immediately so rejoining a
  // lobby (or reopening the app) refreshes a stale last_heartbeat right
  // away, rather than waiting a full 30s while sweep_lobbies() might already
  // be evaluating a closed grace window.
  useEffect(() => {
    if (!lobbyId || !userId) return undefined

    const sendHeartbeat = (): void => {
      void updateOwnMember({ last_heartbeat: new Date().toISOString() })
    }

    sendHeartbeat()
    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [lobbyId, userId, updateOwnMember])

  useEffect(() => {
    if (!appid || !lobbyId || !userId) return undefined
    if (memberState !== 'launching' && memberState !== 'in_game') return undefined

    async function tick(): Promise<void> {
      const { running } = await window.gankr.checkGameProcessRunning(appid!)
      const now = Date.now()

      if (running) {
        lastSeenRunningAtRef.current = now
        if (memberState === 'launching') {
          await updateOwnMember({
            member_state: 'in_game',
            // Only stamp game_started_at on the FIRST-ever entry into
            // in_game for this membership — a later demote->relaunch cycle
            // must never overwrite real earlier playtime. This biases the
            // accepted minutes-in-game imprecision toward over-counting,
            // never under-crediting a real session.
            ...(gameStartedAt ? {} : { game_started_at: new Date().toISOString() }),
            // Clear any stale exit stamp from a previous stint — Phase 10's
            // overlap math (private.sync_session_participant) prefers
            // game_ended_at over left_at/now() when present, so a leftover
            // value here would undercredit this new stint's real overlap.
            game_ended_at: null
          })
        }
        return
      }

      if (memberState === 'launching') {
        const deadline = launchClickedAt ? new Date(launchClickedAt).getTime() + LAUNCH_WINDOW_MS : now
        if (now >= deadline) {
          await updateOwnMember({ member_state: 'launch_failed' })
        }
        return
      }

      // memberState === 'in_game', process not currently found.
      const lastSeen = lastSeenRunningAtRef.current ?? now
      if (now - lastSeen >= EXIT_DEBOUNCE_MS) {
        // Not a new enum value — 'in_lobby' correctly lets the
        // sync_lobby_playing_status trigger fall the lobby back out of
        // 'playing' if it needs to, and matches the existing 5-value
        // member_state enum exactly. game_ended_at is Phase 10's real
        // interval endpoint for the feedback overlap check — stamped here,
        // not derived later, since "now" at detection time is the only
        // moment that actually knows when the process really disappeared.
        await updateOwnMember({ member_state: 'in_lobby', game_ended_at: new Date().toISOString() })
      }
    }

    void tick()
    const interval = setInterval(() => void tick(), POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [appid, lobbyId, userId, memberState, launchClickedAt, gameStartedAt, updateOwnMember])

  const startGame = useCallback(async () => {
    if (!appid || !lobbyId || !userId) return
    const { running } = await window.gankr.isSteamRunning()
    setSteamRunning(running)
    if (!running) return

    const { opened } = await window.gankr.launchGame(appid)
    if (!opened) return

    await updateOwnMember({ launch_clicked_at: new Date().toISOString(), member_state: 'launching' })
  }, [appid, lobbyId, userId, updateOwnMember])

  const retry = useCallback(async () => {
    setRetryCount((count) => count + 1)
    await startGame()
  }, [startGame])

  const continueWithoutDetection = useCallback(async () => {
    if (!lobbyId || !appid) return
    // The real, cross-machine "log every use" — visible to lobbymates too,
    // and queryable later by appid. game:log-manual-override is just a
    // local dev-console mirror alongside it.
    await supabase.rpc('log_manual_launch_override', { p_lobby_id: lobbyId })
    void window.gankr.logManualLaunchOverride(lobbyId, appid)

    await updateOwnMember({
      member_state: 'in_game',
      ...(gameStartedAt ? {} : { game_started_at: new Date().toISOString() }),
      game_ended_at: null
    })
  }, [lobbyId, appid, gameStartedAt, updateOwnMember])

  return {
    steamRunning,
    promoteLeave: retryCount >= MAX_LOCAL_RETRIES,
    startGame,
    retry,
    continueWithoutDetection
  }
}
