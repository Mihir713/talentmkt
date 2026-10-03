import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  /** Styles applied when this option is the selected one (e.g. YES/NO colours). */
  selectedClassName?: string
  ariaLabel?: string
}

interface Props<T extends string> {
  value: T
  onChange: (value: T) => void
  options: SegmentOption<T>[]
  size?: 'sm' | 'md' | 'lg'
  className?: string
  ariaLabel: string
}

/** Single-choice segmented control. Always keeps one option selected. */
export function Segmented<T extends string>({ value, onChange, options, size = 'md', className, ariaLabel }: Props<T>) {
  return (
    <ToggleGroup
      aria-label={ariaLabel}
      value={[value]}
      onValueChange={(next) => {
        const picked = next[0] as T | undefined
        if (picked) onChange(picked)
      }}
      className={cn('inline-grid auto-cols-fr grid-flow-col gap-1 rounded-md bg-surface-2 p-0.5', className)}
    >
      {options.map((option) => (
        <Toggle
          key={option.value}
          value={option.value}
          aria-label={option.ariaLabel}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-[5px] font-medium text-ink-2 transition-[background-color,color,box-shadow] duration-150',
            'hover:text-ink data-[pressed]:bg-surface data-[pressed]:text-ink data-[pressed]:shadow-raised',
            size === 'sm' && 'h-6 px-2 text-xs',
            size === 'md' && 'h-8 px-3 text-sm',
            size === 'lg' && 'h-11 px-3 text-base',
            option.value === value && option.selectedClassName,
          )}
        >
          {option.label}
        </Toggle>
      ))}
    </ToggleGroup>
  )
}
