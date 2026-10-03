// Local-only helper: mint a real session for a seeded user without reading email, using the
// auth admin API with the local stack's service-role key. Used by screenshots and e2e tests.
import { execSync } from 'node:child_process'
import { createClient, type Session } from '@supabase/supabase-js'

interface LocalStack {
  API_URL: string
  ANON_KEY: string
  SERVICE_ROLE_KEY: string
}

let stack: LocalStack | null = null

export function localStack(): LocalStack {
  if (!stack) stack = JSON.parse(execSync('npx supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString())
  if (!/127\.0\.0\.1|localhost/.test(stack!.API_URL)) throw new Error('Refusing to mint sessions against a non-local stack.')
  return stack!
}

export async function sessionFor(email: string): Promise<Session> {
  const { API_URL, ANON_KEY, SERVICE_ROLE_KEY } = localStack()
  const admin = createClient(API_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw error
  const anon = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } })
  const verified = await anon.auth.verifyOtp({ email, token: data.properties.email_otp, type: 'email' })
  if (verified.error || !verified.data.session) throw verified.error ?? new Error('no session')
  return verified.data.session
}

/** supabase-js stores the session under sb-<first host label>-auth-token. */
export function storageKeyFor(apiUrl: string): string {
  return `sb-${new URL(apiUrl).hostname.split('.')[0]}-auth-token`
}
