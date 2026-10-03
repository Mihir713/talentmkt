import NumberFlow from '@number-flow/react'
import { CaretDown, CaretUp } from '@phosphor-icons/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { formatPoints, pctDigits } from '../../lib/format'

/**
 * Animated probability. Extremes render as text because NumberFlow can't say "<0.1%".
 * Width never changes as digits roll: tabular numerals are global.
 */
export function Pct({ value, className }: { value: number; className?: string }) {
  if (value < 0.001) return <span className={className}>&lt;0.1%</span>
  if (value > 0.999) return <span className={className}>&gt;99.9%</span>
  const digits = pctDigits(value)
  return (
    <NumberFlow
      className={className}
      value={value}
      format={{ style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits }}
      respectMotionPreference
    />
  )
}

/** Animated credit amount with thousands separators and two decimals. */
export function Credits({ value, className, suffix }: { value: number; className?: string; suffix?: string }) {
  return (
    <NumberFlow
      className={className}
      value={value}
      format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
      suffix={suffix}
      respectMotionPreference
    />
  )
}

/**
 * Wraps a figure and gives it a brief tint when `value` changes: cobalt-soft when it rose,
 * vermillion-soft when it fell. 600ms, ease-out, disabled by the global reduced-motion rule.
 */
export function ChangeTint({ value, children, className }: { value: number; children: ReactNode; className?: string }) {
  const previous = useRef(value)
  const [tint, setTint] = useState<{ key: number; dir: 'up' | 'down' } | null>(null)
  useEffect(() => {
    if (value !== previous.current) {
      setTint((t) => ({ key: (t?.key ?? 0) + 1, dir: value > previous.current ? 'up' : 'down' }))
      previous.current = value
    }
  }, [value])
  return (
    <span key={tint?.key ?? 0} className={cn(tint && (tint.dir === 'up' ? 'tint-up' : 'tint-down'), className)}>
      {children}
    </span>
  )
}

/** 24h change in points with a direction glyph, so direction never depends on colour. */
export function Delta({ value, className }: { value: number | null | undefined; className?: string }) {
  if (value == null || Math.abs(value) < 0.0005) {
    return <span className={cn('text-ink-3', className)}>0 pts</span>
  }
  const up = value > 0
  return (
    <span className={cn('inline-flex items-center gap-0.5', up ? 'text-yes' : 'text-no', className)}>
      {up ? <CaretUp weight="fill" aria-hidden className="size-3" /> : <CaretDown weight="fill" aria-hidden className="size-3" />}
      <span className="sr-only">{up ? 'up' : 'down'}</span>
      {formatPoints(value).replace(/^[+−]/, '')}
    </span>
  )
}
