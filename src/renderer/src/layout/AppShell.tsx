import { useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import FloatingLobbyPanel from '../components/FloatingLobbyPanel'
import NotificationToasts from '../components/NotificationToasts'
import CreateLobbyModal, { type CreateLobbyPrefill } from '../components/CreateLobbyModal'
import { useActiveLobby } from '../lib/active-lobby'
import { useLaunchDetection } from '../lib/launch-detection'
import { useFeedbackPrompt } from '../lib/feedback-prompt'
import { useSession } from '../lib/session'
import { useNotifications, resolveNotificationTarget, type NotificationItem } from '../lib/notifications'
import type { LobbySummary } from '../lib/lobby-summary'
import FeedbackPromptModal from '../components/FeedbackPromptModal'

const FEEDBACK_PROMPT_DURATION_MS = 10 * 60 * 1000

/** Handed to every routed page via <Outlet context> so Find lobby (and any
 * future page) can open the create-lobby modal or read the active lobby for
 * the single-active-lobby guard, without prop-drilling through the router
 * or duplicating the Realtime subscription in useActiveLobby(). */
export interface AppOutletContext {
  openCreateLobby: (prefill?: CreateLobbyPrefill) => void
  activeLobby: LobbySummary | null
}

/**
 * The root layout for every authenticated route. The docked lobby bar is
 * mounted here rather than in any individual route, so it survives
 * navigation between Find lobby / Players / Friends / Profile / Settings.
 * CreateLobbyModal is mounted here too, since creating a lobby has to be
 * reachable from anywhere, not just from Find lobby.
 */
export default function AppShell() {
  const { session } = useSession()
  const userId = session?.user.id
  const activeLobby = useActiveLobby(userId)
  // Mounted here, not inside LobbyRoom — LobbyRoom unmounts whenever the
  // floating panel is minimized, but an in-progress launch/heartbeat has to
  // keep polling regardless. Same reasoning as useActiveLobby living here.
  const launch = useLaunchDetection(activeLobby, userId)
  // Same layout-level reasoning as useLaunchDetection: must survive
  // LobbyRoom unmounting when the floating panel is minimized. CLAUDE.md's
  // Phase 10: the prompt stays open for up to 10 minutes, owned here rather
  // than inside the hook since it's a UI-lifetime concern, not a detection
  // concern.
  const feedbackPrompt = useFeedbackPrompt(activeLobby, userId)
  useEffect(() => {
    if (!feedbackPrompt.promptLobbyId) return undefined
    const timeout = setTimeout(feedbackPrompt.dismiss, FEEDBACK_PROMPT_DURATION_MS)
    return () => clearTimeout(timeout)
  }, [feedbackPrompt.promptLobbyId, feedbackPrompt.dismiss])
  const navigate = useNavigate()
  const [createLobbyOpen, setCreateLobbyOpen] = useState(false)
  const [createLobbyPrefill, setCreateLobbyPrefill] = useState<CreateLobbyPrefill | null>(null)

  const { items, unreadCount, actorNames, gameNames, toasts, dismissToast, markRead } = useNotifications(userId)

  // Docked lobby bar's expand state, lifted up here (Phase 9) so a
  // notification click can drive it alongside the bar's own toggle button.
  // `dockedExpanded` starts collapsed; this effect auto-expands it exactly
  // when the active lobby id *changes* to a new non-null value during this
  // session (a join or create), never on the very first render — that's
  // what the `undefined` sentinel below guards against, since the first
  // render may already have an active lobby (e.g. reopening the app).
  const [dockedExpanded, setDockedExpanded] = useState(false)
  const previousLobbyId = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const currentId = activeLobby?.id ?? null
    const previousId = previousLobbyId.current
    if (previousId !== undefined && currentId !== null && currentId !== previousId) {
      setDockedExpanded(true)
    }
    if (currentId === null) setDockedExpanded(false)
    previousLobbyId.current = currentId
  }, [activeLobby?.id])

  function openCreateLobby(prefill?: CreateLobbyPrefill): void {
    setCreateLobbyPrefill(prefill ?? null)
    setCreateLobbyOpen(true)
  }

  /** Shared by a bell-panel click, a toast click, and a native notification
   * click (see the effect below) — marks the item read, then routes to
   * wherever that type's target resolves: expands the docked lobby bar for
   * the three lobby-scoped types, navigates for friend/invite types, or
   * does nothing for an announcement. */
  function handleNotificationClick(item: NotificationItem): void {
    void markRead(item)
    const target = resolveNotificationTarget(item.type)
    if (target.kind === 'expand-docked-lobby') {
      setDockedExpanded(true)
    } else if (target.kind === 'route') {
      navigate(target.path)
    }
  }

  // A native OS notification's click (see src/main/notifications.ts) pushes
  // this event instead of calling back through the in-app panel — it only
  // ever fires for `notifications`-sourced items (main never shows a native
  // popup for an announcement), so the reconstructed item's announcement-only
  // fields (body, createdAt) are unused by handleNotificationClick's logic.
  useEffect(() => {
    return window.gankr.onNotificationClicked((payload) => {
      handleNotificationClick({
        id: payload.notificationId,
        source: 'notification',
        type: payload.type,
        actorId: null,
        lobbyId: payload.lobbyId,
        body: null,
        isRead: false,
        createdAt: new Date().toISOString()
      })
    })
    // Re-subscribes if markRead or navigate identity changes (e.g. a
    // different signed-in user), so the listener never closes over a stale
    // markRead — handleNotificationClick itself isn't memoized, so it isn't
    // listed here directly; it's recreated fresh on every render and this
    // effect's own deps are what decide whether to re-subscribe.
  }, [markRead, navigate])

  const outletContext: AppOutletContext = { openCreateLobby, activeLobby }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          items={items}
          unreadCount={unreadCount}
          actorNames={actorNames}
          gameNames={gameNames}
          onNotificationClick={handleNotificationClick}
        />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet context={outletContext} />
        </main>
      </div>

      <FloatingLobbyPanel
        lobby={activeLobby}
        currentUserId={userId}
        expanded={dockedExpanded}
        onExpandedChange={setDockedExpanded}
        launch={launch}
      />

      <CreateLobbyModal
        open={createLobbyOpen}
        prefill={createLobbyPrefill}
        activeLobby={activeLobby}
        onClose={() => setCreateLobbyOpen(false)}
      />

      <NotificationToasts
        toasts={toasts}
        actorNames={actorNames}
        gameNames={gameNames}
        onDismiss={dismissToast}
        onItemClick={handleNotificationClick}
      />

      <FeedbackPromptModal
        open={feedbackPrompt.promptLobbyId !== null}
        lobbyId={feedbackPrompt.promptLobbyId}
        currentUserId={userId}
        onClose={feedbackPrompt.dismiss}
      />
    </div>
  )
}
