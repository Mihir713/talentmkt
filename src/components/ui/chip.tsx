import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export const chipStyles = cva('inline-flex h-6 max-w-full items-center gap-1 rounded-md px-2 text-xs font-medium whitespace-nowrap', {
  variants: {
    tone: {
      neutral: 'border border-line bg-surface text-ink-2',
      quiet: 'bg-surface-2 text-ink-2',
      yes: 'bg-yes-soft text-yes-strong',
      no: 'bg-no-soft text-no-strong',
      caution: 'bg-caution-soft text-caution',
      danger: 'bg-danger-soft text-danger',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

export function Chip({ className, tone, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof chipStyles>) {
  return <span className={cn(chipStyles({ tone }), className)} {...props} />
}
