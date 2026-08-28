import type { NotificationItem } from '../lib/notifications'
import NotificationBell from './NotificationBell'

interface TopBarProps {
  items: readonly NotificationItem[]
  unreadCount: number
  actorNames: ReadonlyMap<string, string>
  gameNames: ReadonlyMap<string, string | null>
  onNotificationClick: (item: NotificationItem) => void
}

export default function TopBar({ items, unreadCount, actorNames, gameNames, onNotificationClick }: TopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-end bg-background px-4">
      <NotificationBell
        items={items}
        unreadCount={unreadCount}
        actorNames={actorNames}
        gameNames={gameNames}
        onItemClick={onNotificationClick}
      />
    </header>
  )
}
