import { describe, expect, it } from 'vitest'
import {
  formatAgo, formatClosesIn, formatCredits, formatDate, formatDuration, formatPct, formatPoints,
  formatShares, formatSignedCredits, formatWhole,
} from './format'

describe('percentages', () => {
  it('shows whole percent in the middle and one decimal near the edges', () => {
    expect(formatPct(0.6243)).toBe('62%')
    expect(formatPct(0.5)).toBe('50%')
    expect(formatPct(0.004)).toBe('0.4%')
    expect(formatPct(0.9951)).toBe('99.5%')
    expect(formatPct(0.0004)).toBe('<0.1%')
    expect(formatPct(0.9996)).toBe('>99.9%')
    expect(formatPct(null)).toBe('n/a')
  })

  it('formats changes in points with a real minus sign', () => {
    expect(formatPoints(0.032)).toBe('+3 pts')
    expect(formatPoints(-0.004)).toBe('−0.4 pts')
    expect(formatPoints(0.0001)).toBe('0 pts')
  })
})

describe('credits', () => {
  it('uses thousands separators and two decimals', () => {
    expect(formatCredits(1000)).toBe('1,000.00')
    expect(formatCredits('1234567.891')).toBe('1,234,567.89')
    expect(formatCredits(1_000_000)).toBe('1,000,000.00')
    expect(formatCredits(-3.1)).toBe('−3.10')
  })

  it('signs P&L', () => {
    expect(formatSignedCredits(12.4)).toBe('+12.40')
    expect(formatSignedCredits(-3.1)).toBe('−3.10')
    expect(formatSignedCredits(0.001)).toBe('0.00')
  })

  it('formats volumes and shares', () => {
    expect(formatWhole(12345.6)).toBe('12,346')
    expect(formatShares(158.138442)).toBe('158.14')
    expect(formatShares(3)).toBe('3')
  })
})

describe('time', () => {
  const now = Date.parse('2026-10-02T12:00:00Z')
  it('describes durations in the largest sensible unit', () => {
    expect(formatDuration(30_000)).toBe('under a minute')
    expect(formatDuration(12 * 60_000)).toBe('12 min')
    expect(formatDuration(5 * 3_600_000)).toBe('5 h')
    expect(formatDuration(3 * 86_400_000)).toBe('3 days')
    expect(formatDuration(400 * 86_400_000)).toBe('13 months')
    expect(formatDuration(1000 * 86_400_000)).toBe('2.7 years')
  })

  it('says whether a market is open or closed', () => {
    expect(formatClosesIn('2026-10-05T12:00:00Z', now)).toBe('closes in 3 days')
    expect(formatClosesIn('2026-10-02T10:00:00Z', now)).toBe('closed 2 h ago')
    expect(formatAgo('2026-10-02T11:56:00Z', now)).toBe('4 min ago')
    expect(formatAgo('2026-10-02T11:59:50Z', now)).toBe('just now')
  })

  it('formats dates in Toronto time', () => {
    expect(formatDate('2028-09-01T04:00:00Z')).toBe('Sep 1, 2028')
  })
})
