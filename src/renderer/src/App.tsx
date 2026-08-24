import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './layout/AppShell'
import LoginPage from './routes/LoginPage'
import FindLobbyPage from './routes/FindLobbyPage'
import PlayersPage from './routes/PlayersPage'
import FriendsPage from './routes/FriendsPage'
import ProfilePage from './routes/ProfilePage'
import SettingsPage from './routes/SettingsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Docked lobby bar lives on this layout, not on any one route, so it
          survives navigation between these pages. */}
      <Route element={<AppShell />}>
        <Route path="/find" element={<FindLobbyPage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/profile/:id" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/" element={<Navigate to="/find" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/find" replace />} />
    </Routes>
  )
}
