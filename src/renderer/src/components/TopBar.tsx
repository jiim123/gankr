interface TopBarProps {
  unreadCount: number
  onOpenInvites: () => void
}

/** Bell icon, inlined so the app shell has no icon-library dependency yet. */
function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M6 8a6 6 0 1 1 12 0c0 3.2 1 5 1.5 5.8.3.5-.1 1.2-.7 1.2H5.2c-.6 0-1-.7-.7-1.2C5 13 6 11.2 6 8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 17a2.5 2.5 0 0 0 5 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function TopBar({ unreadCount, onOpenInvites }: TopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-end bg-background px-4">
      <button
        type="button"
        onClick={onOpenInvites}
        aria-label={`Invites and notifications, ${unreadCount} unread`}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-300 transition-colors hover:bg-neutral-900 hover:text-foreground"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </header>
  )
}
