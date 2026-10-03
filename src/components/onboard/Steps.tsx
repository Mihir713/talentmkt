import { Check } from '@phosphor-icons/react'
import { cn } from '../../lib/cn'

export const ONBOARD_STEPS = ['Consent', 'Upload', 'Review', 'Your cohorts'] as const

/** Compact progress: which step this is and what's left. */
export function Steps({ current }: { current: number }) {
  return (
    <ol aria-label="Onboarding progress" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {ONBOARD_STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-2" aria-current={i === current ? 'step' : undefined}>
          <span
            className={cn(
              'flex size-5 items-center justify-center rounded-full border text-2xs font-semibold',
              i < current && 'border-ink bg-ink text-bg',
              i === current && 'border-ink text-ink',
              i > current && 'border-line-strong text-ink-3',
            )}
          >
            {i < current ? <Check aria-hidden weight="bold" className="size-3" /> : i + 1}
          </span>
          <span className={cn(i === current ? 'font-medium text-ink' : 'text-ink-3')}>{label}</span>
          {i < ONBOARD_STEPS.length - 1 && <span aria-hidden className="mx-1 h-px w-5 bg-line-strong" />}
        </li>
      ))}
    </ol>
  )
}
