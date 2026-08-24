import { useNavigate, useParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-800 px-6 py-4">
        <h1 className="text-lg font-semibold text-white">Profile</h1>
        <p className="text-xs text-neutral-500">id: {id}</p>
      </div>
      <div className="flex-1">
        <EmptyState
          title="No profile data yet"
          description="Steam sign-in fills in an avatar, name, and library. Sign in to build out this profile."
          actionLabel="Go to sign in"
          onAction={() => navigate('/login')}
        />
      </div>
    </div>
  )
}
