import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { buttonStyles } from '../components/ui/button'

export function RouteError() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : 'Something on this page failed to load.'
  return (
    <div className="mx-auto flex max-w-[640px] flex-col items-start gap-3 px-4 py-24">
      <h1 className="text-3xl font-bold tracking-[-0.01em]">This page didn’t load</h1>
      <p className="text-ink-2">{message} Reload to try again; if it keeps happening, the local stack may be stopped.</p>
      <div className="flex gap-2">
        <button type="button" className={buttonStyles({ variant: 'primary' })} onClick={() => window.location.reload()}>
          Reload
        </button>
        <Link to="/markets" className={buttonStyles({ variant: 'secondary' })}>
          Browse markets
        </Link>
      </div>
    </div>
  )
}
