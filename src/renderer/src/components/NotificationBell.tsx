import { useEffect, useRef, useState } from 'react'
import type { NotificationItem } from '../lib/notifications'
import { renderNotificationSentence } from '../lib/notifications'

interface NotificationBellProps {
  items: readonly NotificationItem[]
  unreadCount: number
  actorNames: ReadonlyMap<string, string>
  gameNames: ReadonlyMap<string, string | null>
  onItemClick: (item: NotificationItem) => void
}

/** Bell icon, inlined so the app shell has no icon-library dependency for
 * it — moved here from TopBar.tsx verbatim, TopBar just renders this
 * component now. */
function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M6 8a6 6 0 1 1 12 0c0 3.2 1 5 1.5 5.8.3.5-.1 1.2-.7 1.2H5.2c-.6 0-1-.7-.7-1.2C5 13 6 11.2 6 8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9.5 17a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Same self-contained button + floating-panel shape as LobbyFilterPopover:
 * open state, outside-click-to-close, `absolute right-0 top-full` panel.
 * Reuses TopBar's former bell SVG/badge markup. Panel lists items (unread
 * ones tinted + a small primary-colored dot), empty state
 * "No notifications yet.", click marks read and navigates/expands via
 * `onItemClick` (assembled by AppShell from markRead + resolveNotificationTarget).
 */
export default function NotificationBell({
  items,
  unreadCount,
  actorNames,
  gameNames,
  onItemClick
}: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  function handleItemClick(item: NotificationItem): void {
    setOpen(false)
    onItemClick(item)
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={`Notifications, ${unreadCount} unread`}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-300 transition-colors hover:bg-neutral-900 hover:text-foreground"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="surface absolute right-0 top-full z-20 mt-2 max-h-96 w-80 overflow-y-auto p-2 shadow-lg">
          {items.length === 0 ? (
            <p className="p-3 text-sm text-neutral-400">No notifications yet.</p>
          ) : (
            <ul className="space-y-1">
              {items.map((item) => {
                const actorName = item.actorId ? (actorNames.get(item.actorId) ?? null) : null
                const gameName = item.lobbyId ? (gameNames.get(item.lobbyId) ?? null) : null
                const sentence = renderNotificationSentence(item, actorName, gameName)
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(item)}
                      className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-800"
                    >
                      <span
                        className={[
                          'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                          item.isRead ? 'bg-transparent' : 'bg-primary'
                        ].join(' ')}
                        aria-hidden="true"
                      />
                      <span className={item.isRead ? 'text-neutral-400' : 'font-medium text-foreground'}>
                        {sentence}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
