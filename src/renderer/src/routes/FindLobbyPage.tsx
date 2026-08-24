import EmptyState from '../components/EmptyState'

export default function FindLobbyPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-neutral-800 px-6 py-4">
        <h1 className="text-lg font-semibold text-white">Find lobby</h1>
      </div>
      <div className="flex-1">
        <EmptyState
          title="No open lobbies yet"
          description="Nobody has opened a lobby for a game you own. Start one and it will be the first result the next person sees."
          actionLabel="Create lobby"
          onAction={() => {
            // Lobby creation ships in Phase 6.
            console.log('create lobby')
          }}
        />
      </div>
    </div>
  )
}
