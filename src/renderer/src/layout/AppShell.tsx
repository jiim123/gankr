import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import DockedLobbyBar from '../components/DockedLobbyBar'
import CreateLobbyModal, { type CreateLobbyPrefill } from '../components/CreateLobbyModal'
import { useActiveLobby } from '../lib/active-lobby'
import { useSession } from '../lib/session'
import type { LobbySummary } from '../lib/lobby-summary'

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
  const activeLobby = useActiveLobby(session?.user.id)
  const [unreadCount] = useState(3)
  const [createLobbyOpen, setCreateLobbyOpen] = useState(false)
  const [createLobbyPrefill, setCreateLobbyPrefill] = useState<CreateLobbyPrefill | null>(null)

  function openCreateLobby(prefill?: CreateLobbyPrefill): void {
    setCreateLobbyPrefill(prefill ?? null)
    setCreateLobbyOpen(true)
  }

  const outletContext: AppOutletContext = { openCreateLobby, activeLobby }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          unreadCount={unreadCount}
          onOpenInvites={() => {
            // Notifications panel is not built yet (Phase 9).
            console.log('open invites and notifications')
          }}
        />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet context={outletContext} />
        </main>
        <DockedLobbyBar lobby={activeLobby} currentUserId={session?.user.id} />
      </div>

      <CreateLobbyModal
        open={createLobbyOpen}
        prefill={createLobbyPrefill}
        activeLobby={activeLobby}
        onClose={() => setCreateLobbyOpen(false)}
      />
    </div>
  )
}
