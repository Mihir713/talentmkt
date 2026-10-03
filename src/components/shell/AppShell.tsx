import { Menu } from '@base-ui/react/menu'
import { List, MagnifyingGlass, SignOut, UserCircle } from '@phosphor-icons/react'
import { Suspense } from 'react'
import { Link, NavLink, Outlet, useNavigate, useNavigation } from 'react-router'
import { Toaster } from 'sonner'
import { signOut, useBalance, useProfile, useSession } from '../../lib/auth'
import { useAppNow, useIsSimulatedClock } from '../../lib/clock'
import { cn } from '../../lib/cn'
import { formatDateTime } from '../../lib/format'
import { useCommandPalette } from '../../stores/ui'
import { CommandPalette } from '../CommandPalette'
import { buttonStyles } from '../ui/button'
import { Credits } from '../ui/figures'
import { Kbd } from '../ui/kbd'
import { Skeleton } from '../ui/skeleton'
import { Wordmark } from './Wordmark'

function useNavItems() {
  const { data: profile } = useProfile()
  const items = [
    { to: '/markets', label: 'Markets' },
    { to: '/leaderboard', label: 'Leaderboard' },
  ]
  if (profile) items.push({ to: '/portfolio', label: 'Portfolio' })
  if (profile?.role === 'student') items.push({ to: '/me', label: 'My skills' })
  if (profile?.role === 'admin') items.push({ to: '/admin', label: 'Admin' })
  return items
}

function NavItems({ className }: { className?: string }) {
  const items = useNavItems()
  return (
    <nav aria-label="Main" className={cn('flex items-center gap-1', className)}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              'rounded-md px-2.5 py-1.5 text-sm font-medium no-underline transition-colors duration-150',
              isActive ? 'text-ink' : 'text-ink-3 hover:text-ink',
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

function SearchButton() {
  const open = useCommandPalette((s) => s.setOpen)
  return (
    <button
      type="button"
      onClick={() => open(true)}
      className="flex h-8 items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-sm text-ink-3 transition-colors duration-150 hover:border-line-strong hover:text-ink-2 max-sm:w-8 max-sm:justify-center max-sm:px-0"
      aria-label="Search markets, cohorts and skills"
    >
      <MagnifyingGlass aria-hidden className="size-4" />
      <span className="max-sm:hidden">Search</span>
      <Kbd className="max-sm:hidden">⌘K</Kbd>
    </button>
  )
}

function Balance() {
  const { data, isPending } = useBalance()
  if (isPending) return <Skeleton className="h-5 w-20" />
  if (data == null) return null
  return (
    <Link to="/portfolio" className="flex items-baseline gap-1 text-sm font-semibold text-ink no-underline" title="Your credit balance">
      <Credits value={data} />
      <span className="text-xs font-medium text-ink-3">cr</span>
    </Link>
  )
}

function AccountMenu() {
  const { data: profile } = useProfile()
  const navigate = useNavigate()
  return (
    <Menu.Root>
      <Menu.Trigger className={buttonStyles({ variant: 'ghost', size: 'icon' })} aria-label="Account">
        <UserCircle aria-hidden className="size-5" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="z-50">
          <Menu.Popup className="min-w-52 origin-[var(--transform-origin)] rounded-lg border border-line bg-surface p-1 shadow-popover transition-[opacity,transform] duration-150 ease-[var(--ease-out)] data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0">
            <div className="px-2.5 py-2">
              <p className="text-xs text-ink-3">Signed in as</p>
              <p className="truncate text-sm font-semibold text-ink">{profile?.handle ?? '…'}</p>
            </div>
            <Menu.Item onClick={() => navigate('/portfolio')} className="flex h-8 cursor-default items-center rounded-md px-2.5 text-sm text-ink-2 data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink">
              Portfolio
            </Menu.Item>
            {profile?.role === 'student' && (
              <Menu.Item onClick={() => navigate('/me')} className="flex h-8 cursor-default items-center rounded-md px-2.5 text-sm text-ink-2 data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink">
                My skills and privacy
              </Menu.Item>
            )}
            <Menu.Item
              onClick={async () => {
                await signOut()
                navigate('/')
              }}
              className="flex h-8 cursor-default items-center gap-2 rounded-md px-2.5 text-sm text-ink-2 data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink"
            >
              <SignOut aria-hidden className="size-4" /> Sign out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

function MobileNav() {
  const items = useNavItems()
  const navigate = useNavigate()
  return (
    <Menu.Root>
      <Menu.Trigger className={cn(buttonStyles({ variant: 'ghost', size: 'icon' }), 'md:hidden')} aria-label="Menu">
        <List aria-hidden className="size-5" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="start" className="z-50">
          <Menu.Popup className="min-w-48 origin-[var(--transform-origin)] rounded-lg border border-line bg-surface p-1 shadow-popover transition-[opacity,transform] duration-150 ease-[var(--ease-out)] data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0">
            {items.map((item) => (
              <Menu.Item key={item.to} onClick={() => navigate(item.to)} className="flex h-9 cursor-default items-center rounded-md px-2.5 text-base text-ink-2 data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink">
                {item.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

function SimClockBanner() {
  const simulated = useIsSimulatedClock()
  const now = useAppNow(60_000)
  if (!simulated) return null
  return (
    <div className="border-b border-line bg-caution-soft px-4 py-1.5 text-center text-xs font-medium text-caution">
      Simulation clock is on. The app’s time is {formatDateTime(new Date(now))}.
    </div>
  )
}

function RouteProgress() {
  const navigation = useNavigation()
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-focus transition-[transform,opacity] duration-300 ease-[var(--ease-out)]',
        navigation.state === 'loading' ? 'scale-x-75 opacity-100' : 'scale-x-100 opacity-0',
      )}
    />
  )
}

export function AppShell() {
  const { session, ready } = useSession()
  return (
    <div className="flex min-h-dvh flex-col">
      <RouteProgress />
      <SimClockBanner />
      <header className="sticky top-0 z-40 border-b border-line bg-bg">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <MobileNav />
          <Wordmark />
          <NavItems className="ml-4 max-md:hidden" />
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <SearchButton />
            {!ready ? (
              <Skeleton className="h-8 w-20" />
            ) : session ? (
              <>
                <Balance />
                <AccountMenu />
              </>
            ) : (
              <Link to="/signin" className={buttonStyles({ variant: 'primary', size: 'sm' })}>
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-ink-3 sm:px-6">
          <p>Play credits only. Credits have no cash value and can’t be bought or withdrawn.</p>
          <p>
            Cohorts are anonymous and never smaller than 25 people.{' '}
            <Link to="/#what-we-store" className="text-ink-2 underline">
              What we store
            </Link>
          </p>
        </div>
      </footer>
      <CommandPalette />
      <Toaster position="bottom-right" theme="system" toastOptions={{ className: 'font-sans' }} />
    </div>
  )
}
