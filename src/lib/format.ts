// Number and date formatting. Percentages show at most one decimal, credits use thousands
// separators, and every figure renders with tabular numerals (set globally in index.css).

const MINUS = '−'

/** Decimal places for a probability: whole percent in the middle, one decimal near the edges. */
export function pctDigits(p: number): 0 | 1 {
  return p < 0.01 || p > 0.99 ? 1 : 0
}

/** 0.6243 -> "62%", 0.004 -> "0.4%", 0.0004 -> "<0.1%". */
export function formatPct(p: number | null | undefined): string {
  if (p == null || Number.isNaN(p)) return 'n/a'
  if (p < 0.001) return '<0.1%'
  if (p > 0.999) return '>99.9%'
  const digits = pctDigits(p)
  return `${(p * 100).toFixed(digits)}%`
}

/** Change in percentage points: +3 pts, −0.4 pts, 0 pts. */
export function formatPoints(delta: number | null | undefined): string {
  if (delta == null || Number.isNaN(delta)) return 'n/a'
  const pts = delta * 100
  const abs = Math.abs(pts)
  if (abs < 0.05) return '0 pts'
  const text = abs < 1 ? abs.toFixed(1) : abs.toFixed(0)
  return `${pts > 0 ? '+' : MINUS}${text} pts`
}

const creditFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const wholeFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const shareFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

/** Balances and trade amounts: 1,234.56. */
export function formatCredits(value: number | string | null | undefined): string {
  const n = Number(value)
  if (value == null || Number.isNaN(n)) return 'n/a'
  const text = creditFormat.format(Math.abs(n))
  return n < 0 ? `${MINUS}${text}` : text
}

/** Signed credit amounts for P&L: +12.40, −3.10. */
export function formatSignedCredits(value: number | string | null | undefined): string {
  const n = Number(value)
  if (value == null || Number.isNaN(n)) return 'n/a'
  if (Math.abs(n) < 0.005) return '0.00'
  return `${n > 0 ? '+' : MINUS}${creditFormat.format(Math.abs(n))}`
}

/** Volumes and counts: 12,345. */
export function formatWhole(value: number | string | null | undefined): string {
  const n = Number(value)
  if (value == null || Number.isNaN(n)) return 'n/a'
  return wholeFormat.format(Math.round(n))
}

const fixedShareFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Shares in table columns: always two decimals so columns align. */
export function formatSharesFixed(value: number | string | null | undefined): string {
  const n = Number(value)
  if (value == null || Number.isNaN(n)) return 'n/a'
  return fixedShareFormat.format(n)
}

/**
 * A market's resolve time is midnight at the end of its deadline day (Toronto). This is the
 * deadline day itself, which is what people mean by "resolves after Sep 1".
 */
export function deadlineDay(resolvesAt: string | Date): Date {
  return new Date(new Date(resolvesAt).getTime() - 1)
}

export function formatShares(value: number | string | null | undefined): string {
  const n = Number(value)
  if (value == null || Number.isNaN(n)) return 'n/a'
  return shareFormat.format(n)
}

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Toronto' })
const dateTimeFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto',
})
const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' })

/** Sep 1, 2028 (Toronto time, the zone markets are defined in). */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return 'n/a'
  return dateFormat.format(new Date(value))
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return 'n/a'
  return dateTimeFormat.format(new Date(value))
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return 'n/a'
  return timeFormat.format(new Date(value))
}

/** Duration until (or since) a moment, in the largest sensible unit: "3 days", "5 h", "12 min". */
export function formatDuration(ms: number): string {
  const abs = Math.abs(ms)
  if (abs < 60_000) return 'under a minute'
  const minutes = Math.round(abs / 60_000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(abs / 3_600_000)
  if (hours < 48) return `${hours} h`
  const days = Math.round(abs / 86_400_000)
  if (days < 60) return `${days} days`
  const months = Math.round(days / 30.44)
  if (months < 24) return `${months} months`
  return `${(days / 365.25).toFixed(1)} years`
}

/** "closes in 3 days" / "closed 2 h ago". */
export function formatClosesIn(closesAt: string | Date, now: number): string {
  const diff = new Date(closesAt).getTime() - now
  return diff > 0 ? `closes in ${formatDuration(diff)}` : `closed ${formatDuration(diff)} ago`
}

/** "4 min ago" for trade tapes. */
export function formatAgo(value: string | Date, now: number): string {
  const diff = now - new Date(value).getTime()
  if (diff < 45_000) return 'just now'
  return `${formatDuration(diff)} ago`
}
