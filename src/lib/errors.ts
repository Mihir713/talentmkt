// Database errors carry a stable code as the message and user-facing copy as the detail
// (see supabase/migrations). This turns either into something we can show.

export interface AppError {
  code: string
  message: string
}

const FALLBACK: Record<string, string> = {
  not_authenticated: 'Sign in to do that.',
  account_deleted: 'This account has been deleted.',
  insider: 'You’re in this market’s cohort, so you can’t trade on it.',
  insufficient_balance: 'You don’t have enough credits for this trade.',
  insufficient_shares: 'You don’t hold that many shares.',
  price_moved: 'The price moved while you were deciding. Check the new quote and try again.',
  market_closed: 'Trading on this market has closed.',
  market_not_found: 'That market doesn’t exist.',
  forbidden: 'This action is for admins only.',
}

export function toAppError(error: unknown): AppError {
  if (error && typeof error === 'object') {
    const e = error as { message?: string; details?: string; code?: string }
    const code = e.message && /^[a-z_]+$/.test(e.message) ? e.message : (e.code ?? 'unknown')
    const message = e.details || FALLBACK[code] || e.message || 'Something went wrong. Try again.'
    return { code, message }
  }
  return { code: 'unknown', message: 'Something went wrong. Try again.' }
}
