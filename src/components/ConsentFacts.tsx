import { EyeSlash, FileX, Lock, UsersThree } from '@phosphor-icons/react'
import { cn } from '../lib/cn'

/**
 * The four facts a student agrees to, used verbatim in onboarding and on the landing page so the
 * promise is the same wherever it's read.
 */
export const CONSENT_FACTS = [
  {
    Icon: Lock,
    title: 'What we keep',
    body: 'Course codes and titles, the term you took each one, and optional grade bands (A to F, pass, in progress). Plus your university, program and graduation year.',
  },
  {
    Icon: FileX,
    title: 'What we delete',
    body: 'Your transcript PDF, right after you confirm the courses we read from it. We never keep the file.',
  },
  {
    Icon: EyeSlash,
    title: 'What’s public',
    body: 'Only aggregates. Cohorts never go live below 25 people, counts are rounded to the nearest 5, and nobody, admins included, can see who is in a cohort.',
  },
  {
    Icon: UsersThree,
    title: 'What you give up',
    body: 'You can’t trade markets about your own cohorts, because you’d know your own outcome before anyone else. Every other market is open to you.',
  },
] as const

export function ConsentFacts({ className, columns = 1 }: { className?: string; columns?: 1 | 2 }) {
  return (
    <dl className={cn('grid gap-x-10 gap-y-5', columns === 2 && 'sm:grid-cols-2', className)}>
      {CONSENT_FACTS.map(({ Icon, title, body }) => (
        <div key={title} className="flex gap-3">
          <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-2" />
          <div className="flex flex-col gap-1">
            <dt className="font-semibold text-ink">{title}</dt>
            <dd className="text-ink-2">{body}</dd>
          </div>
        </div>
      ))}
    </dl>
  )
}
