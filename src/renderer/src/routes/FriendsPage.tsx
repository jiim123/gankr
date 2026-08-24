import { useNavigate } from 'react-router-dom'
import EmptyState from '../components/EmptyState'

export default function FriendsPage() {
  const navigate = useNavigate()

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-800 px-6 py-4">
        <h1 className="text-lg font-semibold text-white">Friends</h1>
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
