import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import DockedLobbyBar from '../components/DockedLobbyBar'
import { MOCK_ACTIVE_LOBBY, type MockLobby } from '../state/mock-lobby'

/**
 * The root layout for every authenticated route. The docked lobby bar is
 * mounted here rather than in any individual route, so it survives
 * navigation between Find lobby / Players / Friends / Profile / Settings.
 */
export default function AppShell() {
  // Stub only: no real lobby membership exists yet (Phase 6/7). Defaulting
  // to a mock active lobby makes the docked bar's persistence visible
  // while navigating; a real app would start with `null` here.
  const [activeLobby] = useState<MockLobby | null>(MOCK_ACTIVE_LOBBY)
  const [unreadCount] = useState(3)

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
          <Outlet />
        </main>
        <DockedLobbyBar lobby={activeLobby} />
      </div>
    </div>
  )
}
