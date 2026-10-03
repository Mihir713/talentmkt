import { Link } from 'react-router'
import { buttonStyles } from '../components/ui/button'

export function Component() {
  return (
    <div className="mx-auto flex max-w-[640px] flex-col items-start gap-3 px-4 py-24">
      <h1 className="text-3xl font-bold tracking-[-0.01em]">Page not found</h1>
      <p className="text-ink-2">That address doesn’t match a market, cohort or page.</p>
      <Link to="/markets" className={buttonStyles({ variant: 'primary' })}>
        Browse markets
      </Link>
    </div>
  )
}
