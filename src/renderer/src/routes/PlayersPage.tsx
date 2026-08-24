import { useNavigate } from 'react-router-dom'
import EmptyState from '../components/EmptyState'

export default function PlayersPage() {
  const navigate = useNavigate()

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-800 px-6 py-4">
        <h1 className="text-lg font-semibold text-white">Players</h1>
      </div>
      <div className="flex-1">
        <EmptyState
          title="No players to show yet"
          description="Set your games and region in Settings so Gankr can rank compatible players for you."
          actionLabel="Go to Settings"
          onAction={() => navigate('/settings')}
        />
      </div>
    </div>
  )
}
