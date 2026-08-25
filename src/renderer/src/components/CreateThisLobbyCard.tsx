import type { Tables } from '@shared/db-types'

type MicRequirement = Tables<'lobbies'>['mic']
type LobbyTone = Tables<'lobbies'>['tone']

interface CreateThisLobbyCardProps {
  gameName: string | null
  region: string | null
  mic: MicRequirement | null
  tone: LobbyTone | null
  onCreate: () => void
}

function labelForMic(mic: MicRequirement): string {
  switch (mic) {
    case 'off':
      return 'Mic off'
    case 'preferred':
      return 'Mic preferred'
    case 'required':
      return 'Mic required'
  }
}

/**
 * Rendered instead of the results list when nothing scores above the
 * floor — never appended after real results. Converts a dead end into
 * supply for the next person searching, pre-filled with exactly the
 * preferences the player searched for.
 */
export default function CreateThisLobbyCard({ gameName, region, mic, tone, onCreate }: CreateThisLobbyCardProps) {
  const chips = [
    gameName,
    region,
    mic ? labelForMic(mic) : null,
    tone ? (tone === 'casual' ? 'Casual' : 'Competitive') : null
  ].filter((chip): chip is string => Boolean(chip))

  return (
    <div className="surface flex flex-col items-center gap-3 border-dashed p-8 text-center">
      <h3 className="text-sm font-medium text-foreground">Nothing matches this search yet</h3>
      <p className="max-w-sm text-sm text-neutral-400">
        Create a lobby with exactly what you searched for. It becomes the first result the next
        person with the same preferences sees.
      </p>
      {chips.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1">
          {chips.map((chip) => (
            <span key={chip} className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
              {chip}
            </span>
          ))}
        </div>
      )}
      <button type="button" className="btn-primary mt-2" onClick={onCreate}>
        Create this lobby
      </button>
    </div>
  )
}
