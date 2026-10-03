import { cn } from '../../lib/cn'

/** Placeholder block that matches the final element's size. Never a spinner inside content. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('skeleton block', className)} />
}
