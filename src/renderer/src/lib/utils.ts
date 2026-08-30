import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Standard shadcn/ui class-merging helper — combines conditional class
 * lists (clsx) and resolves conflicting Tailwind utilities in favor of the
 * last one (tailwind-merge), so a caller's className can safely override a
 * component's own defaults. Used by every shadcn/animate-ui component
 * installed in src/renderer/src/components/{ui,animate-ui}. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
