interface EmptyStateProps {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

/** Shared shape for every stub route's empty state: say what's missing and
 * offer the next action, never just "nothing found". */
export default function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <h2 className="text-base font-medium text-foreground">{title}</h2>
      <p className="max-w-sm text-sm text-neutral-400">{description}</p>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className="btn-primary mt-2">
          {actionLabel}
        </button>
      )}
    </div>
  )
}
