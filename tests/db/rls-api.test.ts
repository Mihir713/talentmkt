// RLS through the real API: sign JWTs for two different students with the local JWT secret and
// query PostgREST the way the browser does. Complements the claim-based checks in pgTAP.
import { createHmac } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connect } from '../../scripts/lib/db'

const API_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
// The fixed secret every local Supabase stack uses. Never a production value.
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? 'super-secret-jwt-token-with-at-least-32-characters-long'

const b64url = (value: string | Buffer) => Buffer.from(value).toString('base64url')

function sign(claims: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({ aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 600, ...claims }))
  const signature = createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${signature}`
}

const anonKey = sign({ role: 'anon', aud: undefined })

type Rows = Record<string, string>[]

async function rest<T = Rows>(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`${API_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  })
  return { status: res.status, body: (res.status === 204 ? null : await res.json()) as T }
}

const sql = connect()
let alice: { id: string; token: string }
let bob: { id: string; token: string }

beforeAll(async () => {
  const students = await sql<{ user_id: string }[]>`
    select m.user_id from public.cohort_memberships m
      join public.cohorts c on c.id = m.cohort_id and c.status = 'active'
     group by m.user_id having count(*) >= 2
     order by m.user_id limit 2`
  if (students.length < 2) throw new Error('run `npm run seed` first')
  alice = { id: students[0]!.user_id, token: sign({ sub: students[0]!.user_id, role: 'authenticated' }) }
  bob = { id: students[1]!.user_id, token: sign({ sub: students[1]!.user_id, role: 'authenticated' }) }
})
afterAll(() => sql.end())

describe('RLS over the API, as different JWTs', () => {
  it('a student reads only their own cohort memberships', async () => {
    const mine = await rest('cohort_memberships?select=user_id,cohort_id', alice.token)
    expect(mine.status).toBe(200)
    expect(mine.body.length).toBeGreaterThan(0)
    expect(new Set(mine.body.map((r) => r.user_id))).toEqual(new Set([alice.id]))

    const theirs = await rest(`cohort_memberships?select=cohort_id&user_id=eq.${bob.id}`, alice.token)
    expect(theirs.body).toEqual([])
  })

  it('a student cannot read another student\'s transcript or snapshot rows', async () => {
    expect((await rest(`transcript_courses?select=course_id&user_id=eq.${bob.id}`, alice.token)).body).toEqual([])
    expect((await rest(`snapshot_members?select=snapshot_id&user_id=eq.${bob.id}`, alice.token)).body).toEqual([])
    const own = await rest('transcript_courses?select=user_id', alice.token)
    expect(own.body.length).toBeGreaterThan(0)
    expect(own.body.every((r) => r.user_id === alice.id)).toBe(true)
  })

  it('anonymous visitors see markets but no memberships', async () => {
    expect((await rest('cohort_memberships?select=user_id', anonKey)).body).toEqual([])
    const cards = await rest('v_market_cards?select=id,p_yes&limit=3', anonKey)
    expect(cards.status).toBe(200)
    expect(cards.body).toHaveLength(3)
  })

  it('clients cannot write tables directly or call admin functions', async () => {
    const insert = await rest('cohort_memberships', alice.token, {
      method: 'POST',
      body: JSON.stringify({ cohort_id: 1, user_id: alice.id }),
    })
    expect([401, 403]).toContain(insert.status)

    const resolve = await rest<{ message: string }>('rpc/resolve_market', alice.token, { method: 'POST', body: JSON.stringify({ p_market_id: 1 }) })
    expect(resolve.status).toBeGreaterThanOrEqual(400)
    expect(resolve.body.message).toBe('forbidden')
  })
})
