import { useNavigate } from 'react-router-dom'
import EmptyState from '../components/EmptyState'

export default function PlayersPage() {
  const navigate = useNavigate()

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-2xl font-semibold text-foreground">Players</h1>
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
