import { useEffect, useRef, useState } from 'react'
import { SendDiagonal } from 'iconoir-react'
import { CHAT_BODY_CAP, useLobbyChat } from '../lib/lobby-chat'
import type { LobbyMemberSummary } from '../lib/lobby-summary'

const COUNTER_THRESHOLD = 400
const NEAR_BOTTOM_PX = 80

interface LobbyChatPanelProps {
  lobbyId: string
  currentUserId: string
  members: readonly LobbyMemberSummary[]
}

/**
 * System messages render centered/muted, no bubble. User messages render
 * flat — avatar, name, plain body text, no bubble either, matching the
 * redesign's Discord-style request. Auto-scroll to bottom only when already
 * near the bottom before a new message arrives — standard "don't yank the
 * scroll position" chat UX.
 */
export default function LobbyChatPanel({ lobbyId, currentUserId, members }: LobbyChatPanelProps) {
  const { messages, sendMessage, sending, error } = useLobbyChat(lobbyId, currentUserId, members)
  const [draft, setDraft] = useState('')

  const scrollRef = useRef<HTMLDivElement>(null)
  const nearBottomRef = useRef(true)

  function handleScroll(): void {
    const el = scrollRef.current
    if (!el) return
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
  }

  useEffect(() => {
    const el = scrollRef.current
    if (el && nearBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages.length])

  async function handleSend(): Promise<void> {
    const trimmed = draft.trim()
    if (!trimmed || sending) return
    const ok = await sendMessage(trimmed)
    if (ok) setDraft('')
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className="surface flex h-full flex-col p-4">
      <h3 className="text-sm font-medium text-foreground">Chat</h3>

      <div ref={scrollRef} onScroll={handleScroll} className="mt-3 flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && <p className="text-sm text-neutral-500">No messages yet.</p>}
        {messages.map((message) =>
          message.kind === 'system' ? (
            <p key={message.id} className="text-center text-xs text-neutral-500">
              {message.body}
            </p>
          ) : (
            <div key={message.id} className="flex items-start gap-2">
              {message.senderAvatarUrl ? (
                <img src={message.senderAvatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full" />
              ) : (
                <div className="h-6 w-6 shrink-0 rounded-full bg-neutral-700" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <span className="text-xs text-neutral-400">{message.senderDisplayName}</span>
                <p className="text-sm text-foreground">{message.body}</p>
              </div>
            </div>
          )
        )}
      </div>

      <div className="mt-3">
        <div className="relative">
          <textarea
            className="field w-full resize-none pr-10"
            rows={2}
            value={draft}
            maxLength={CHAT_BODY_CAP}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message the lobby"
          />
          <button
            type="button"
            className="absolute bottom-2 right-2 rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            disabled={sending || draft.trim().length === 0}
            onClick={() => void handleSend()}
            aria-label="Send message"
          >
            <SendDiagonal width={16} height={16} strokeWidth={2} />
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-red-400">{error ?? ''}</span>
          {draft.length > COUNTER_THRESHOLD && (
            <span className="text-xs text-neutral-500">
              {draft.length}/{CHAT_BODY_CAP}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
