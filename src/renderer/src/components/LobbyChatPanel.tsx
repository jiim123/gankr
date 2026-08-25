import { useEffect, useRef, useState } from 'react'
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
 * left-aligned with a name label above a surface-toned bubble. Auto-scroll
 * to bottom only when already near the bottom before a new message arrives
 * — standard "don't yank the scroll position" chat UX.
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
            <div key={message.id} className="max-w-[85%]">
              <span className="text-xs text-neutral-400">{message.senderDisplayName}</span>
              <div className="surface mt-0.5 px-3 py-2 text-sm text-foreground">{message.body}</div>
            </div>
          )
        )}
      </div>

      <div className="mt-3">
        <textarea
          className="field w-full resize-none"
          rows={2}
          value={draft}
          maxLength={CHAT_BODY_CAP}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message the lobby"
        />
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-red-400">{error ?? ''}</span>
          <div className="flex items-center gap-3">
            {draft.length > COUNTER_THRESHOLD && (
              <span className="text-xs text-neutral-500">
                {draft.length}/{CHAT_BODY_CAP}
              </span>
            )}
            <button
              type="button"
              className="btn-primary"
              disabled={sending || draft.trim().length === 0}
              onClick={() => void handleSend()}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
