import * as React from 'react';

import {
  Checkbox as CheckboxPrimitive,
  CheckboxIndicator as CheckboxIndicatorPrimitive,
  type CheckboxProps as CheckboxPrimitiveProps,
} from '@renderer/components/animate-ui/primitives/radix/checkbox';
import { cn } from '@renderer/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

// Rewritten from the registry default: the generated classes used
// unbracketed `bg-oklch(...)` literals (invalid Tailwind arbitrary-value
// syntax — Tailwind silently drops them, so the checkbox would render with
// no fill at all when checked) and shadcn's default light-mode palette,
// plus `dark:` variants this app never uses (no light/dark toggle — always
// dark, per CLAUDE.md). Restyled against this app's actual tokens: the
// checked state matches every other "selected/active" control this session
// (bg-primary/text-primary-foreground, e.g. the Visibility toggle in
// CreateLobbyModal.tsx), and the idle state matches `.field`'s existing
// border/background convention (index.css) — plain border-color focus
// state, no ring glow, since nothing else in this app uses one.
const checkboxVariants = cva(
  'peer shrink-0 flex items-center justify-center outline-none border border-neutral-800 transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-neutral-600 [&[data-state=checked],&[data-state=indeterminate]]:border-primary [&[data-state=checked],&[data-state=indeterminate]]:bg-primary [&[data-state=checked],&[data-state=indeterminate]]:text-primary-foreground',
  {
    variants: {
      variant: {
        default: 'bg-neutral-900',
        accent: 'bg-neutral-800',
      },
      size: {
        default: 'size-5 rounded-sm',
        sm: 'size-4.5 rounded-[5px]',
        lg: 'size-6 rounded-[7px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

const checkboxIndicatorVariants = cva('', {
  variants: {
    size: {
      default: 'size-3.5',
      sm: 'size-3',
      lg: 'size-4',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

type CheckboxProps = CheckboxPrimitiveProps &
  VariantProps<typeof checkboxVariants>;

function Checkbox({
  className,
  children,
  variant,
  size,
  ...props
}: CheckboxProps) {
  return (
    <CheckboxPrimitive
      className={cn(checkboxVariants({ variant, size, className }))}
      {...props}
    >
      {children}
      <CheckboxIndicatorPrimitive
        className={cn(checkboxIndicatorVariants({ size }))}
      />
    </CheckboxPrimitive>
  );
}

export { Checkbox, type CheckboxProps };
