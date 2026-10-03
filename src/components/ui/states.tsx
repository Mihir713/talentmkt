import { WarningCircle } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from './button'

/** Empty state that says what would fill this space and how. */
export function EmptyState({ title, children, action, className }: { title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-start gap-2 py-10', className)}>
      <h3 className="text-md font-semibold text-ink">{title}</h3>
      {children && <div className="max-w-[60ch] text-base text-ink-2">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/** Inline error: names the problem and offers the way back. */
export function ErrorState({ title = 'This didn’t load.', message, onRetry, className }: { title?: string; message?: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn('flex items-start gap-3 rounded-lg border border-line bg-surface p-4', className)}>
      <WarningCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-danger" />
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-ink">{title}</p>
        {message && <p className="text-ink-2">{message}</p>}
        {onRetry && (
          <Button size="sm" className="mt-2 self-start" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  )
}
