import { Drawer } from '@base-ui/react/drawer'
import { useState, type ComponentProps } from 'react'
import { formatPct } from '../../lib/format'
import type { Side } from '../../lib/lmsr'
import { buttonStyles } from '../ui/button'
import { TradeTicket } from './TradeTicket'

type TicketProps = Omit<ComponentProps<typeof TradeTicket>, 'initialSide' | 'onDone' | 'className'>

/**
 * Mobile: a fixed bar with the two sides; tapping one opens the same ticket as a bottom sheet
 * (Base UI Drawer, swipe to dismiss, iOS-style curve).
 */
export function MobileTradeSheet(props: TicketProps) {
  const [open, setOpen] = useState(false)
  const [side, setSide] = useState<Side>('yes')
  const { market } = props
  if (market.status !== 'open') return null
  const openWith = (s: Side) => {
    setSide(s)
    setOpen(true)
  }
  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => openWith('yes')} className={buttonStyles({ variant: 'yes', size: 'lg' })}>
            Buy YES {formatPct(market.pYes)}
          </button>
          <button type="button" onClick={() => openWith('no')} className={buttonStyles({ variant: 'no', size: 'lg' })}>
            Buy NO {formatPct(1 - market.pYes)}
          </button>
        </div>
      </div>
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-40 bg-ink/30 transition-opacity duration-300 ease-[var(--ease-drawer)] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Drawer.Viewport className="fixed inset-0 z-50 flex items-end">
          <Drawer.Popup className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[14px] bg-bg pb-[env(safe-area-inset-bottom)] shadow-sheet transition-transform duration-300 ease-[var(--ease-drawer)] [transform:translateY(var(--drawer-swipe-movement-y,0px))] data-[ending-style]:[transform:translateY(100%)] data-[starting-style]:[transform:translateY(100%)]">
            <div aria-hidden className="mx-auto mt-2 mb-1 h-1 w-9 rounded-full bg-line-strong" />
            <Drawer.Title className="sr-only">Trade</Drawer.Title>
            <TradeTicket {...props} key={side} initialSide={side} onDone={() => setOpen(false)} className="m-3 border-0" />
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
