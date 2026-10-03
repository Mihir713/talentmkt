import { Liveline } from 'liveline'
import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAppClockOffset } from '../../lib/clock'
import { formatDateTime, formatPct } from '../../lib/format'
import { usePriceHistory, type HistoryRange } from '../../lib/markets'
import { useColorScheme } from '../../lib/useColorScheme'
import { Segmented } from '../ui/segmented'
import { Skeleton } from '../ui/skeleton'
import { ErrorState } from '../ui/states'

// Canvas and SVG charts can't read CSS variables; these mirror the tokens in index.css.
const CHART = {
  light: { line: '#1d60bc', grid: '#dadee3', axis: '#636972' },
  dark: { line: '#6aa7f4', grid: '#272c32', axis: '#8d9399' },
}

const RANGES: { value: HistoryRange; label: string }[] = [
  { value: '1D', label: '1D' },
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: 'ALL', label: 'All' },
]

const dayTick = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Toronto' })
const hourTick = new Intl.DateTimeFormat('en-US', { hour: 'numeric', timeZone: 'America/Toronto' })

interface Props {
  marketId: number
  pYes: number
  appNow: number
  live: boolean
  settled: boolean
}

export function PriceChart({ marketId, pYes, appNow, live, settled }: Props) {
  const [range, setRange] = useState<HistoryRange>(settled ? 'ALL' : '1D')
  const scheme = useColorScheme()
  const colors = CHART[scheme]
  const offset = useAppClockOffset().data ?? 0
  const { data, isPending, isError, refetch } = usePriceHistory(marketId, range, appNow)

  // Liveline scrolls against the browser clock; shift points by the app-clock offset so a
  // simulated clock still lands the latest trade at the right edge.
  // Prices move in steps (one per trade). Liveline draws smooth curves, so each trade gets a
  // point one second earlier at the previous price: the line holds flat, then jumps, instead of
  // inventing drift between trades.
  const livePoints = useMemo(() => {
    const points = data ?? []
    const out: { time: number; value: number }[] = []
    points.forEach((pt, i) => {
      const time = (pt.ts - offset) / 1000
      const prev = points[i - 1]
      if (prev && time - (prev.ts - offset) / 1000 > 2) out.push({ time: time - 1, value: prev.p * 100 })
      out.push({ time, value: pt.p * 100 })
    })
    return out
  }, [data, offset])
  const historical = useMemo(() => {
    const points = data ?? []
    if (!points.length) return points
    const last = points[points.length - 1]!
    // Extend the line to now at the current price so the latest move is visible.
    return settled ? points : [...points, { ts: Math.max(appNow, last.ts), p: pYes }]
  }, [data, appNow, pYes, settled])

  const domain = useMemo((): [number, number] => {
    const values = historical.map((pt) => pt.p * 100)
    if (!values.length) return [0, 100]
    const lo = Math.min(...values)
    const hi = Math.max(...values)
    const pad = Math.max(4, (hi - lo) * 0.15)
    return [Math.max(0, Math.floor((lo - pad) / 5) * 5), Math.min(100, Math.ceil((hi + pad) / 5) * 5)]
  }, [historical])

  return (
    <section aria-label="Price history" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-3">
          Implied chance of YES{range === '1D' && live ? ', updating live' : ''}
        </p>
        <Segmented ariaLabel="Chart range" size="sm" value={range} onChange={setRange} options={RANGES} />
      </div>
      <div className="h-[260px] sm:h-[300px]">
        {isError ? (
          <ErrorState message="The price history couldn’t be loaded." onRetry={() => refetch()} className="h-full" />
        ) : isPending ? (
          <Skeleton className="h-full w-full" />
        ) : range === '1D' && !settled ? (
          <Liveline
            data={livePoints}
            value={pYes * 100}
            theme={scheme}
            color={colors.line}
            window={86_400}
            grid
            badge={false}
            fill={false}
            momentum={false}
            pulse={live}
            lineWidth={2}
            formatValue={(v: number) => `${v.toFixed(v < 1 || v > 99 ? 1 : 0)}%`}
            formatTime={(t: number) => hourTick.format(new Date(t * 1000 + offset))}
            emptyText="No trades in the last day"
          />
        ) : historical.length < 2 ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-line text-sm text-ink-3">
            Not enough trading in this range to draw a line yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historical} margin={{ top: 8, right: 44, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={colors.grid} vertical={false} />
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(ts: number) => dayTick.format(new Date(ts))}
                stroke={colors.axis}
                tick={{ fontSize: 11, fill: colors.axis }}
                tickLine={false}
                axisLine={false}
                minTickGap={48}
              />
              <YAxis
                orientation="right"
                domain={domain}
                tickFormatter={(v: number) => `${v}%`}
                stroke={colors.axis}
                tick={{ fontSize: 11, fill: colors.axis }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              {domain[0] < 50 && domain[1] > 50 && <ReferenceLine y={50} stroke={colors.grid} strokeDasharray="3 4" />}
              <Tooltip
                cursor={{ stroke: colors.axis, strokeWidth: 1 }}
                content={({ active, payload }) => {
                  const pt = payload?.[0]?.payload as { ts: number; p: number } | undefined
                  if (!active || !pt) return null
                  return (
                    <div className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-popover">
                      <p className="font-semibold text-ink">{formatPct(pt.p)} YES</p>
                      <p className="text-ink-3">{formatDateTime(new Date(pt.ts))}</p>
                    </div>
                  )
                }}
              />
              <Line
                type="stepAfter"
                dataKey={(pt: { p: number }) => pt.p * 100}
                stroke={colors.line}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                activeDot={{ r: 3, strokeWidth: 0, fill: colors.line }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  )
}
