import { cn } from '../../lib/cn'

/**
 * Shown only where a realtime subscription is actually connected. The dot is semantic state
 * (an open subscription), not decoration.
 */
export function LiveIndicator({ connected, className }: { connected: boolean; className?: string }) {
  if (!connected) return null
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium text-ink-3', className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-yes" />
      Live
    </span>
  )
}
