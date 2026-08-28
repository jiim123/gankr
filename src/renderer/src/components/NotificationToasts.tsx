import { useEffect, useRef } from 'react'
import type { NotificationItem } from '../lib/notifications'
import { renderNotificationSentence } from '../lib/notifications'

interface NotificationToastsProps {
  toasts: readonly NotificationItem[]
  actorNames: ReadonlyMap<string, string>
  gameNames: ReadonlyMap<string, string | null>
  onDismiss: (id: string) => void
  onItemClick: (item: NotificationItem) => void
}

const AUTO_DISMISS_MS = 6000

/**
 * Fixed `right-4 top-16` stack, `surface` cards, 6s auto-dismiss. The
 * hook (useNotifications) already caps the queue at 3 and drops the oldest
 * on a 4th arrival, so this only renders whatever it's handed. Always
 * renders locally regardless of window focus — it's simply unseen if the
 * window happens to be hidden/unfocused, no IPC needed for this half; main
 * independently and authoritatively decides the native-popup question (see
 * src/main/notifications.ts).
 */
export default function NotificationToasts({
  toasts,
  actorNames,
  gameNames,
  onDismiss,
  onItemClick
}: NotificationToastsProps) {
  // Schedules exactly one auto-dismiss timer per toast id, regardless of how
  // many times this effect re-runs while that toast is still visible.
  const scheduledIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    for (const toast of toasts) {
      if (scheduledIds.current.has(toast.id)) continue
      scheduledIds.current.add(toast.id)
      setTimeout(() => {
        scheduledIds.current.delete(toast.id)
        onDismiss(toast.id)
      }, AUTO_DISMISS_MS)
    }
  }, [toasts, onDismiss])

  if (toasts.length === 0) return null

  return (
    <div className="fixed right-4 top-16 z-30 flex w-80 flex-col gap-2">
      {[...toasts].reverse().map((toast) => {
        const actorName = toast.actorId ? (actorNames.get(toast.actorId) ?? null) : null
        const gameName = toast.lobbyId ? (gameNames.get(toast.lobbyId) ?? null) : null
        const sentence = renderNotificationSentence(toast, actorName, gameName)
        return (
          <button
            key={toast.id}
            type="button"
            onClick={() => {
              onDismiss(toast.id)
              onItemClick(toast)
            }}
            className="surface p-3 text-left text-sm text-foreground shadow-lg transition-colors hover:bg-neutral-800"
          >
            {sentence}
          </button>
        )
      })}
    </div>
  )
}
