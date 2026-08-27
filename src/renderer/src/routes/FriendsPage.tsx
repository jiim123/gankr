import { useNavigate } from 'react-router-dom'
import EmptyState from '../components/EmptyState'

export default function FriendsPage() {
  const navigate = useNavigate()

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-2xl font-semibold text-foreground">Friends</h1>
      </div>
      <div className="flex-1">
        <EmptyState
          title="No Gankr friends yet"
          description="Friends you play with in a lobby end up here. Browse Players to find people to add."
          actionLabel="Browse Players"
          onAction={() => navigate('/players')}
        />
      </div>
    </div>
  )
}
