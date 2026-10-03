import { ArrowLeft } from '@phosphor-icons/react'
import { OTPInput, REGEXP_ONLY_DIGITS } from 'input-otp'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '../components/ui/button'
import { cn } from '../lib/cn'
import { supabase } from '../lib/supabase'

const RESEND_SECONDS = 30

/** Where to go after sign-in: the requested page, onboarding for new students, else markets. */
async function destinationFor(userId: string, next: string | null): Promise<string> {
  if (next && next.startsWith('/')) return next
  const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', userId).maybeSingle()
  if (profile?.role === 'student') {
    const { data: student } = await supabase.from('student_profiles').select('grad_year').eq('user_id', userId).maybeSingle()
    return student?.grad_year ? '/me' : '/onboard'
  }
  return '/markets'
}

export function Component() {
  const [params] = useSearchParams()
  const next = params.get('next')
  const navigate = useNavigate()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } })
    setBusy(false)
    if (error) {
      setError(error.status === 429 ? 'Too many codes requested. Wait a minute and try again.' : error.message)
      return
    }
    setStep('code')
    setCode('')
    setCooldown(RESEND_SECONDS)
  }

  const verify = async (token: string) => {
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' })
    if (error || !data.user) {
      setBusy(false)
      setError('That code didn’t work. Check the latest email, or send a new code.')
      return
    }
    navigate(await destinationFor(data.user.id, next), { replace: true })
  }

  return (
    <div className="mx-auto flex w-full max-w-[400px] flex-col px-4 py-16 sm:py-24">
      {step === 'email' ? (
        <form onSubmit={sendCode} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-[-0.01em]">Sign in</h1>
            <p className="text-ink-2">
              We’ll email you a 6-digit code. Use your university email to join as a student; any other email signs you in as a
              trader.
            </p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 rounded-md border border-line-strong bg-surface px-3 text-md text-ink outline-none transition-colors placeholder:text-ink-3 focus-visible:border-focus"
              placeholder="you@uwaterloo.ca"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" disabled={busy || !email.includes('@')}>
            {busy ? 'Sending…' : 'Email me a code'}
          </Button>
          <p className="text-xs text-ink-3">New here? The same step creates your account, with 1,000 play credits to start.</p>
        </form>
      ) : (
        <div className="flex flex-col gap-5">
          <button type="button" onClick={() => setStep('email')} className="flex items-center gap-1 self-start text-sm text-ink-3 hover:text-ink">
            <ArrowLeft aria-hidden className="size-4" /> Use a different email
          </button>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-[-0.01em]">Enter your code</h1>
            <p className="text-ink-2">
              We sent a 6-digit code to <span className="font-medium text-ink">{email}</span>.
            </p>
          </div>
          <OTPInput
            maxLength={6}
            value={code}
            onChange={setCode}
            onComplete={verify}
            pattern={REGEXP_ONLY_DIGITS}
            autoFocus
            disabled={busy}
            aria-label="6-digit code"
            containerClassName="flex items-center gap-2"
            render={({ slots }) => (
              <>
                {slots.map((slot, i) => (
                  <div
                    key={i}
                    className={cn(
                      'relative flex h-12 w-11 items-center justify-center rounded-md border bg-surface text-xl font-semibold text-ink transition-colors duration-100',
                      slot.isActive ? 'border-focus ring-2 ring-focus/25' : 'border-line-strong',
                    )}
                  >
                    {slot.char}
                    {slot.hasFakeCaret && <span aria-hidden className="absolute h-5 w-px animate-pulse bg-ink" />}
                  </div>
                ))}
              </>
            )}
          />
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button variant="primary" size="lg" className="flex-1" disabled={busy || code.length < 6} onClick={() => verify(code)}>
              {busy ? 'Checking…' : 'Sign in'}
            </Button>
            <Button variant="ghost" size="lg" disabled={busy || cooldown > 0} onClick={() => sendCode()}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </Button>
          </div>
          <p className="text-xs text-ink-3">
            Codes expire after an hour. Local development: open <Link to="http://127.0.0.1:54324" target="_blank" className="underline">Mailpit</Link> to read it.
          </p>
        </div>
      )}
    </div>
  )
}
