import type { ReactNode } from 'react'
import { Label } from './ui/label'
import { Checkbox, type CheckboxProps } from './animate-ui/components/radix/checkbox'

interface LabeledCheckboxProps {
  checked: boolean | 'indeterminate'
  onCheckedChange: (checked: boolean | 'indeterminate') => void
  children: ReactNode
  variant?: CheckboxProps['variant']
  size?: CheckboxProps['size']
  disabled?: boolean
  className?: string
}

/**
 * The one checkbox every checkbox in the app should use — a thin,
 * fully-controlled wrapper around the installed animate-ui Checkbox
 * (src/renderer/src/components/animate-ui/components/radix/checkbox.tsx)
 * and shadcn Label, instead of a raw `<input type="checkbox">`.
 *
 * Fully controlled, not internally-mirrored: the underlying Checkbox
 * supports its own uncontrolled mode via `defaultChecked`, but every call
 * site in this app already owns its own state (e.g. LobbyFilterPopover's
 * `filters.ownedOnly`), so there's nothing to duplicate into a second
 * internal `useState`.
 */
export default function LabeledCheckbox({
  checked,
  onCheckedChange,
  children,
  variant,
  size,
  disabled,
  className
}: LabeledCheckboxProps) {
  return (
    <Label className={className ?? 'flex items-center gap-2 text-sm text-foreground'}>
      <Checkbox checked={checked} onCheckedChange={onCheckedChange} variant={variant} size={size} disabled={disabled} />
      {children}
    </Label>
  )
}
