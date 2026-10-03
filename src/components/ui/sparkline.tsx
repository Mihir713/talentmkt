import { cn } from '../../lib/cn'

/**
 * Tiny price history drawn from data (0–1 probabilities). Coloured by direction over the window,
 * with a faint 50% reference so flat lines still read.
 */
export function Sparkline({ points, className }: { points: number[] | null | undefined; className?: string }) {
  const w = 72
  const h = 24
  if (!points || points.length < 2) {
    return <svg aria-hidden viewBox={`0 0 ${w} ${h}`} className={cn('h-6 w-[72px]', className)} />
  }
  const lo = Math.min(...points, 0.5)
  const hi = Math.max(...points, 0.5)
  const span = Math.max(hi - lo, 0.04)
  const mid = (lo + hi) / 2
  const y = (p: number) => h / 2 - ((p - mid) / span) * (h - 4)
  const x = (i: number) => (i / (points.length - 1)) * w
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ')
  const rising = points[points.length - 1]! >= points[0]!
  return (
    <svg aria-hidden viewBox={`0 0 ${w} ${h}`} className={cn('h-6 w-[72px] overflow-visible', className)}>
      <line x1="0" x2={w} y1={y(0.5)} y2={y(0.5)} className="stroke-line" strokeDasharray="2 3" strokeWidth="1" />
      <path d={d} fill="none" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" className={rising ? 'stroke-yes' : 'stroke-no'} />
    </svg>
  )
}
