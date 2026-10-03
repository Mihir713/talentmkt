import { Link } from 'react-router'

export function Wordmark() {
  return (
    <Link to="/" className="text-md font-bold tracking-[-0.02em] text-ink no-underline" aria-label="talentmkt home">
      talent<span className="text-ink-3">mkt</span>
    </Link>
  )
}
