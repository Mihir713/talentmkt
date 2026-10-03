import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/cn'

export const Tabs = BaseTabs.Root
export const TabPanel = BaseTabs.Panel

export function TabList({ className, children, ...props }: ComponentProps<typeof BaseTabs.List>) {
  return (
    <BaseTabs.List className={cn('relative flex gap-5 border-b border-line', className)} {...props}>
      {children}
      <BaseTabs.Indicator className="absolute bottom-[-1px] left-[var(--active-tab-left)] h-0.5 w-[var(--active-tab-width)] bg-ink transition-[left,width] duration-200 ease-[var(--ease-out)]" />
    </BaseTabs.List>
  )
}

export function Tab({ className, ...props }: ComponentProps<typeof BaseTabs.Tab>) {
  return (
    <BaseTabs.Tab
      className={cn(
        'relative -mb-px h-9 text-sm font-medium text-ink-3 transition-colors duration-150 hover:text-ink data-[active]:text-ink',
        className,
      )}
      {...props}
    />
  )
}
