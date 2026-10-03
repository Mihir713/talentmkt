// Deterministic local seed. Run with `npm run seed` (resets the local database first).
//
// Everything flows through the real SQL functions where it matters: cohorts are proposed and
// approved with propose_cohort / admin_review_cohort, markets with propose_market /
// admin_review_market_proposal (which freeze snapshots), every trade goes through execute_trade
// as its trader, and resolutions through admin_generate_outcomes + resolve_market. Only catalog
// rows, users and transcripts are bulk-inserted. Synthetic users go straight into auth.users,
// which is acceptable for the local stack only.
//
// The timeline is anchored to the current hour, so the data is identical for runs on the same day.

import { connect } from './lib/db'
import { Rng } from './lib/rng'
import { CONCEPTS, PROGRAMS, UNIVERSITIES, disciplinesFor, type Concept, type ProgramKey } from './seed/catalog'
import { COHORTS, groupOf, planMarkets, type CohortSpec, type MarketSpec } from './seed/plan'
import { lmsrPrice, quoteTrade, trunc6, type MarketState, type Side } from '../src/lib/lmsr'

if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL ?? '127.0.0.1')) {
  throw new Error('The seed writes synthetic users into auth.users and must only run against the local stack.')
}

const SEED = 20261002
const STUDENTS = 5000
const BOTS = 800
const TARGET_MARKETS = 122
const TARGET_TRADE_EVENTS = 110_000
const BATCH = 500

const HOUR = 3_600_000
const DAY = 24 * HOUR
const END = new Date(Math.floor((Date.now() - 15 * 60_000) / HOUR) * HOUR)
const START = new Date(END.getTime() - 150 * DAY)

const rng = new Rng(SEED)
const sql = connect({ max: 1 })
const log = (...args: unknown[]) => console.log(`[seed ${((performance.now()) / 1000).toFixed(1)}s]`, ...args)

const logistic = (x: number) => 1 / (1 + Math.exp(-x))
const logit = (p: number) => Math.log(p / (1 - p))
const toId = (v: string | number | bigint) => Number(v)

async function setClock(at: Date | null) {
  if (at) await sql`update public.app_settings set value = ${sql.json(at.toISOString())} where key = 'sim_now'`
  else await sql`update public.app_settings set value = 'null'::jsonb where key = 'sim_now'`
}

type Row = Record<string, string | number | boolean | Date | null | ReturnType<typeof sql.json>>

async function insertChunked(table: string, rows: Row[], chunk = 2000) {
  for (let i = 0; i < rows.length; i += chunk) {
    await sql`insert into ${sql(table)} ${sql(rows.slice(i, i + chunk))}`
  }
}

// ---------------------------------------------------------------------------------------------
// Terms: Winter Y has index 2Y, Fall Y has index 2Y+1.
// ---------------------------------------------------------------------------------------------
const termIndex = (season: 'Winter' | 'Fall', year: number) => 2 * year + (season === 'Fall' ? 1 : 0)
const termName = (index: number) => (index % 2 === 1 ? `Fall ${(index - 1) / 2}` : `Winter ${index / 2}`)
const CURRENT_TERM = (() => {
  const month = END.getUTCMonth() + 1
  const year = END.getUTCFullYear()
  if (month >= 9) return termIndex('Fall', year)
  if (month <= 4) return termIndex('Winter', year)
  return termIndex('Fall', year) - 0.5 // summer: Winter done, Fall not started
})()

function gradeFor(r: Rng): string {
  return r.weighted(['A', 'B', 'C', 'D', 'F', 'P'], (g) => ({ A: 35, B: 35, C: 17, D: 5, F: 3, P: 5 })[g]!)
}

// ---------------------------------------------------------------------------------------------
// 1. Catalog
// ---------------------------------------------------------------------------------------------

interface UniRow { id: number; spec: (typeof UNIVERSITIES)[number]; programs: Map<ProgramKey, number>; courses: Map<string, number> }

async function seedCatalog(): Promise<UniRow[]> {
  const tagRows = await sql<{ id: string; slug: string }[]>`select id, slug from public.skill_tags`
  const tagId = new Map(tagRows.map((t) => [t.slug, toId(t.id)]))
  const unis: UniRow[] = []

  for (const spec of UNIVERSITIES) {
    const [u] = await sql<{ id: string }[]>`
      insert into public.universities (name, short_name, email_domain, region)
      values (${spec.name}, ${spec.short}, ${spec.domain}, 'ON') returning id`
    const uniId = toId(u!.id)

    const programRows = await sql<{ id: string; name: string }[]>`
      insert into public.programs ${sql(spec.programs.map((k) => ({ university_id: uniId, name: PROGRAMS[k].name, faculty: PROGRAMS[k].faculty })))}
      returning id, name`
    const programs = new Map<ProgramKey, number>()
    for (const key of spec.programs) programs.set(key, toId(programRows.find((p) => p.name === PROGRAMS[key].name)!.id))

    const core = new Set(spec.programs.flatMap((k) => PROGRAMS[k].core))
    const disciplines = disciplinesFor(spec)
    const offered = CONCEPTS.filter((c) => disciplines.has(c.disc) && (core.has(c.key) || rng.chance(0.55)))

    const counters = new Map<string, number>()
    const courseRows = offered.map((c) => {
      const prefix = spec.depts[c.disc]
      const counterKey = `${prefix}|${c.level}`
      const next = (counters.get(counterKey) ?? rng.int(0, 8)) + rng.int(2, 9)
      counters.set(counterKey, next)
      return { key: c.key, university_id: uniId, code: `${prefix} ${c.level * 100 + (next % 99)}`, title: c.title, level: c.level }
    })
    // Codes must be unique per university; bump any collision.
    const seen = new Set<string>()
    for (const row of courseRows) {
      while (seen.has(row.code)) row.code = row.code.replace(/(\d+)$/, (n) => String(Number(n) + 1))
      seen.add(row.code)
    }
    const inserted = await sql<{ id: string; code: string }[]>`
      insert into public.courses ${sql(courseRows.map((r) => ({ university_id: r.university_id, code: r.code, title: r.title, level: r.level })))}
      returning id, code`
    const byCode = new Map(inserted.map((r) => [r.code, toId(r.id)]))
    const courses = new Map(courseRows.map((r) => [r.key, byCode.get(r.code)!]))

    const tagLinks = offered.flatMap((c) =>
      c.tags.map(([slug, weight]) => ({ course_id: courses.get(c.key)!, skill_tag_id: tagId.get(slug)!, weight })))
    await insertChunked('course_skill_tags', tagLinks)
    unis.push({ id: uniId, spec, programs, courses })
  }
  return unis
}

// ---------------------------------------------------------------------------------------------
// 2. Users and transcripts
// ---------------------------------------------------------------------------------------------

interface Person { id: string; email: string }

function authRows(people: Person[], createdAt: Date) {
  return {
    users: people.map((p) => ({
      instance_id: '00000000-0000-0000-0000-000000000000',
      id: p.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: p.email,
      encrypted_password: '',
      email_confirmed_at: createdAt,
      confirmation_token: '',
      recovery_token: '',
      email_change_token_new: '',
      email_change: '',
      raw_app_meta_data: sql.json({ provider: 'email', providers: ['email'] }),
      raw_user_meta_data: sql.json({}),
      created_at: createdAt,
      updated_at: createdAt,
    })),
    identities: people.map((p) => ({
      provider_id: p.id,
      user_id: p.id,
      identity_data: sql.json({ sub: p.id, email: p.email, email_verified: true }),
      provider: 'email',
      created_at: createdAt,
      updated_at: createdAt,
    })),
  }
}

async function insertPeople(people: Person[], createdAt: Date) {
  const { users, identities } = authRows(people, createdAt)
  await insertChunked('auth.users', users, 1000)
  await insertChunked('auth.identities', identities, 1000)
}

function buildTranscript(r: Rng, uni: UniRow, program: ProgramKey, gradYear: number, forcedInterests?: string[]) {
  const spec = PROGRAMS[program]
  const available = CONCEPTS.filter((c) => uni.courses.has(c.key))
  const electivePool = available.filter((c) => spec.electives.includes(c.disc) && !spec.core.includes(c.key))
  const tagFreq = new Map<string, number>()
  for (const c of electivePool) for (const [slug] of c.tags) tagFreq.set(slug, (tagFreq.get(slug) ?? 0) + 1)
  const tagList = [...tagFreq.keys()]
  const interests = forcedInterests ?? Array.from({ length: 2 }, () => r.weighted(tagList, (t) => tagFreq.get(t)!))

  const coreByLevel = new Map<number, Concept[]>()
  for (const key of spec.core) {
    const c = available.find((x) => x.key === key)
    if (c) coreByLevel.set(c.level, [...(coreByLevel.get(c.level) ?? []), c])
  }

  const taken = new Set<string>()
  const rows: { course_id: number; term: string; grade_band: string }[] = []
  for (let year = 1; year <= 4; year++) {
    const terms = [termIndex('Fall', gradYear - 5 + year), termIndex('Winter', gradYear - 4 + year)]
    const core = coreByLevel.get(year) ?? []
    terms.forEach((ti, half) => {
      if (ti > CURRENT_TERM) return
      const inProgress = ti === CURRENT_TERM
      const slots: Concept[] = core.filter((c, i) => i % 2 === half && !taken.has(c.key)).slice(0, 5)
      const candidates = electivePool.filter((c) => !taken.has(c.key) && c.level <= Math.max(year, 2) && c.level >= year - 1)
      while (slots.length < 5 && candidates.length) {
        const pick = r.weighted(candidates, (c) => 1 + 7 * c.tags.filter(([t]) => interests.includes(t)).reduce((s, [, w]) => s + w, 0))
        candidates.splice(candidates.indexOf(pick), 1)
        if (!slots.includes(pick)) slots.push(pick)
      }
      for (const c of slots) {
        taken.add(c.key)
        rows.push({ course_id: uni.courses.get(c.key)!, term: termName(ti), grade_band: inProgress ? 'IP' : gradeFor(r) })
      }
    })
  }
  return rows
}

interface Demo { admin: Person; trader: Person; student: Person }

async function seedPeople(unis: UniRow[]) {
  const createdAt = new Date(START.getTime() - 30 * DAY)
  const demo: Demo = {
    admin: { id: rng.uuid(), email: 'admin@example.com' },
    trader: { id: rng.uuid(), email: 'trader@example.com' },
    student: { id: rng.uuid(), email: 'student@uwaterloo.ca' },
  }
  const bots: Person[] = Array.from({ length: BOTS }, (_, i) => ({ id: rng.uuid(), email: `trader${i + 1}@example.com` }))

  const students: (Person & { uni: UniRow; program: ProgramKey; gradYear: number })[] = []
  for (let i = 0; i < STUDENTS; i++) {
    const uni = rng.weighted(unis, (u) => u.spec.weight)
    const program = rng.weighted(uni.spec.programs, (k) => PROGRAMS[k].weight)
    const gradYear = rng.weighted([2025, 2026, 2027, 2028, 2029, 2030], (y) => ({ 2025: 8, 2026: 20, 2027: 22, 2028: 22, 2029: 18, 2030: 10 })[y]!)
    students.push({ id: rng.uuid(), email: `student${i + 1}@${uni.spec.domain}`, uni, program, gradYear })
  }

  await insertPeople([demo.admin, demo.trader, demo.student, ...bots, ...students], createdAt)
  await sql`update public.profiles set role = 'admin' where user_id = ${demo.admin.id}`

  const uw = unis.find((u) => u.spec.short === 'UW')!
  const all = [
    ...students.map((s) => ({ ...s, interests: undefined as string[] | undefined })),
    { ...demo.student, uni: uw, program: 'compeng' as ProgramKey, gradYear: 2027, interests: ['embedded-systems', 'ml'] },
  ]
  const profiles = all.map((s) => ({
    user_id: s.id,
    university_id: s.uni.id,
    program_id: s.uni.programs.get(s.program)!,
    grad_year: s.gradYear,
    verified_email_at: createdAt,
    consent_at: createdAt,
  }))
  await insertChunked('student_profiles', profiles)

  const transcriptRows = all.flatMap((s) =>
    buildTranscript(rng, s.uni, s.program, s.gradYear, s.interests).map((r) => ({ user_id: s.id, ...r })))
  await insertChunked('transcript_courses', transcriptRows, 5000)
  log(`people: ${students.length + 1} students, ${bots.length} traders, ${transcriptRows.length} transcript rows`)
  return { demo, bots }
}

// ---------------------------------------------------------------------------------------------
// 3. Cohorts and markets
// ---------------------------------------------------------------------------------------------

async function seedCohorts(): Promise<{ active: CohortSpec[]; ids: Map<string, number> }> {
  await setClock(new Date(START.getTime() - 7 * DAY))
  const active: CohortSpec[] = []
  const ids = new Map<string, number>()
  for (const c of COHORTS) {
    const [row] = await sql<{ id: string }[]>`
      select public.propose_cohort(${c.slug}, ${c.title}, ${sql.json(c.definition)}, ${c.rationale}) as id`
    ids.set(c.slug, toId(row!.id))
    if (c.pending) continue
    try {
      await sql`select public.admin_review_cohort(${ids.get(c.slug)!}, true)`
      active.push(c)
    } catch (e) {
      log(`cohort ${c.slug} stays proposed: ${(e as Error).message}`)
    }
  }
  log(`cohorts: ${active.length} active, ${COHORTS.length - active.length} proposed`)
  return { active, ids }
}

interface LiveMarket {
  id: number
  spec: MarketSpec
  state: MarketState
  opensAt: Date
  closesAt: Date
  resolvesAt: Date
  drift: number[]
  settled: boolean
}

function deadlineCloses(deadline: string): Date {
  // Start of the deadline day in Toronto, matching private.create_market (UTC-4 in summer, -5 in winter).
  const month = Number(deadline.slice(5, 7))
  const offset = month >= 4 && month <= 10 ? 4 : 5
  return new Date(`${deadline}T${String(offset).padStart(2, '0')}:00:00Z`)
}

async function seedMarkets(active: CohortSpec[], cohortIds: Map<string, number>): Promise<LiveMarket[]> {
  const specs = planMarkets(rng, active, TARGET_MARKETS)
  const planned = specs.flatMap((spec) => {
    const closes = deadlineCloses(String(spec.params.deadline))
    const latestOpen = Math.min(closes.getTime() - 20 * DAY, END.getTime() - 3 * DAY)
    const earliest = START.getTime() + DAY
    if (latestOpen <= earliest) return []
    const early = rng.chance(0.55)
    const openMs = early ? earliest + rng.next() * Math.min(30 * DAY, latestOpen - earliest) : earliest + rng.next() * (latestOpen - earliest)
    return [{ spec, opensAt: new Date(Math.floor(openMs / 60_000) * 60_000) }]
  }).sort((a, b) => a.opensAt.getTime() - b.opensAt.getTime())

  const markets: LiveMarket[] = []
  for (const { spec, opensAt } of planned) {
    await setClock(opensAt)
    const [p] = await sql<{ id: string }[]>`
      select public.propose_market(${cohortIds.get(spec.cohortSlug)!}, ${spec.metric}::public.market_metric,
                                   ${sql.json(spec.params)}, ${spec.rationale}) as id`
    const [r] = await sql<{ result: { market_id: number } }[]>`
      select public.admin_review_market_proposal(${toId(p!.id)}, true, ${spec.b},
        ${spec.nonresponse}::public.nonresponse_rule, ${spec.nonresponse === 'exclude_with_quorum' ? 60 : null}) as result`
    const id = r!.result.market_id
    const [m] = await sql<{ closes_at: Date; resolves_at: Date }[]>`select closes_at, resolves_at from public.markets where id = ${id}`
    const days = Math.ceil((Math.min(m!.resolves_at.getTime(), END.getTime()) - opensAt.getTime()) / DAY) + 2
    const drift = [0]
    for (let d = 1; d < days; d++) drift.push(drift[d - 1]! + rng.normal(0, 0.07) + (rng.chance(0.015) ? rng.normal(0, 0.6) : 0))
    markets.push({
      id, spec, opensAt, drift, settled: false,
      state: { qYes: 0, qNo: 0, b: spec.b, feeBps: 100 },
      closesAt: m!.closes_at, resolvesAt: m!.resolves_at,
    })
  }
  log(`markets: ${markets.length} opened`)
  return markets
}

function truthAt(m: LiveMarket, at: Date): number {
  const day = Math.max(0, Math.floor((at.getTime() - m.opensAt.getTime()) / DAY))
  return logistic(logit(m.spec.truth) + (m.drift[Math.min(day, m.drift.length - 1)] ?? 0))
}

// ---------------------------------------------------------------------------------------------
// 4. Trading timeline
// ---------------------------------------------------------------------------------------------

interface Bot {
  id: string
  activity: number
  noise: number
  size: number
  bias: Map<string, number>
  balance: number
  positions: Map<number, { yes: number; no: number }>
  marketNoise: Map<number, number>
}

type TradeRow = { u: string; m: number; s: Side; a: 'buy' | 'sell'; n: number; max: number | null; min: number | null; ts: string }

async function createTradeFunction() {
  await sql.unsafe(`
    create function pg_temp.seed_trades(p jsonb) returns jsonb language plpgsql as $$
    declare t jsonb; ok int := 0; failed jsonb := '[]';
    begin
      for t in select * from jsonb_array_elements(p) loop
        update public.app_settings set value = to_jsonb(t->>'ts') where key = 'sim_now';
        perform set_config('request.jwt.claims', json_build_object('sub', t->>'u', 'role', 'authenticated')::text, true);
        begin
          perform public.execute_trade((t->>'m')::bigint, (t->>'s')::public.trade_side, (t->>'a')::public.trade_action,
            (t->>'n')::numeric, p_max_cost => (t->>'max')::numeric, p_min_return => (t->>'min')::numeric);
          ok := ok + 1;
        exception when others then
          failed := failed || jsonb_build_object('u', t->>'u', 'm', t->>'m', 'err', sqlerrm);
        end;
        perform set_config('request.jwt.claims', '', true);
      end loop;
      return jsonb_build_object('ok', ok, 'failed', failed);
    end $$`)
}

async function seedTrading(markets: LiveMarket[], botPeople: Person[], demo: Demo) {
  const groups = ['software', 'ai', 'hardware', 'mech', 'civil', 'chem', 'finance']
  const bots: Bot[] = botPeople.map((p) => ({
    id: p.id,
    activity: Math.min(1 / Math.pow(rng.next() + 0.02, 0.8), 25),
    noise: rng.range(0.15, 1.1),
    size: rng.range(3, 30),
    bias: new Map(groups.map((g) => [g, rng.chance(0.5) ? rng.normal(0, 0.35) : 0])),
    balance: 1000,
    positions: new Map(),
    marketNoise: new Map(),
  }))
  const botById = new Map(bots.map((b) => [b.id, b]))
  const cumulative: number[] = []
  bots.reduce((sum, b) => (cumulative.push(sum + b.activity), sum + b.activity), 0)
  const pickBot = () => {
    const r = rng.next() * cumulative[cumulative.length - 1]!
    let lo = 0, hi = cumulative.length - 1
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cumulative[mid]! < r) lo = mid + 1; else hi = mid }
    return bots[lo]!
  }

  // Events: trades (Poisson-ish arrivals per market), resolutions and one admin void.
  type Event = { at: number; kind: 'trade' | 'resolve' | 'void'; market: LiveMarket }
  const events: Event[] = []
  const weights = markets.map((m) => m.spec.popularity * Math.max(0, (Math.min(m.closesAt.getTime(), END.getTime()) - m.opensAt.getTime()) / DAY))
  const perUnit = TARGET_TRADE_EVENTS / weights.reduce((a, b) => a + b, 0)
  markets.forEach((m, i) => {
    const from = m.opensAt.getTime() + 5 * 60_000
    const to = Math.min(m.closesAt.getTime(), END.getTime()) - 60_000
    const n = Math.round(weights[i]! * perUnit)
    for (let k = 0; k < n && to > from; k++) events.push({ at: from + rng.next() * (to - from), kind: 'trade', market: m })
    const resolveAt = m.resolvesAt.getTime() + 8 * HOUR
    if (resolveAt < END.getTime()) events.push({ at: resolveAt, kind: 'resolve', market: m })
  })
  const voidable = markets.filter((m) => m.resolvesAt.getTime() > END.getTime() + 60 * DAY)
  const voided = rng.pick(voidable)
  const voidAt = Math.max(voided.opensAt.getTime() + 20 * DAY, END.getTime() - 40 * DAY)
  events.push({ at: voidAt, kind: 'void', market: voided })
  events.sort((a, b) => a.at - b.at)

  await sql`alter table public.trades disable trigger trades_broadcast`
  await createTradeFunction()

  let batch: TradeRow[] = []
  let ok = 0
  let failed = 0
  let dbMs = 0
  const flush = async () => {
    if (!batch.length) return
    const started = performance.now()
    const [res] = await sql<{ r: { ok: number; failed: { u: string; m: string; err: string }[] } }[]>`
      select pg_temp.seed_trades(${sql.json(batch)}) as r`
    ok += res!.r.ok
    failed += res!.r.failed.length
    dbMs += performance.now() - started
    if (res!.r.failed.length) {
      // Resync anything the database rejected so the simulation never drifts from the truth.
      const marketIds = [...new Set(res!.r.failed.map((f) => Number(f.m)))]
      const botIds = [...new Set(res!.r.failed.map((f) => f.u))]
      for (const row of await sql<{ id: string; q_yes: string; q_no: string }[]>`select id, q_yes, q_no from public.markets where id = any(${marketIds})`) {
        const m = markets.find((x) => x.id === toId(row.id))!
        m.state.qYes = Number(row.q_yes)
        m.state.qNo = Number(row.q_no)
      }
      await syncBots(botIds.map((id) => botById.get(id)!), marketIds)
    }
    batch = []
  }

  const syncBots = async (subset: Bot[], marketIds: number[]) => {
    const ids = subset.map((b) => b.id)
    for (const row of await sql<{ user_id: string; balance: string }[]>`select user_id, balance from public.accounts where user_id = any(${ids})`) {
      botById.get(row.user_id)!.balance = Number(row.balance)
    }
    for (const row of await sql<{ user_id: string; market_id: string; yes_shares: string; no_shares: string }[]>`
      select user_id, market_id, yes_shares, no_shares from public.positions
       where user_id = any(${ids}) and market_id = any(${marketIds})`) {
      botById.get(row.user_id)!.positions.set(toId(row.market_id), { yes: Number(row.yes_shares), no: Number(row.no_shares) })
    }
  }

  for (const event of events) {
    const m = event.market
    if (m.settled) continue
    const at = new Date(event.at)

    if (event.kind === 'trade') {
      const bot = pickBot()
      const p = lmsrPrice(m.state.qYes, m.state.qNo, m.state.b)
      if (!bot.marketNoise.has(m.id)) bot.marketNoise.set(m.id, rng.normal(0, bot.noise))
      const belief = logistic(logit(truthAt(m, at)) + (bot.bias.get(groupOf(m.spec.params.field as string ?? '')) ?? 0)
        + bot.marketNoise.get(m.id)! + rng.normal(0, 0.08))
      const edge = belief - p
      const held = bot.positions.get(m.id) ?? { yes: 0, no: 0 }
      let trade: TradeRow | null = null

      const sellSide: Side | null = edge > 0.02 && held.no > 0.01 ? 'no' : edge < -0.02 && held.yes > 0.01 ? 'yes' : null
      if (sellSide && rng.chance(0.7)) {
        const shares = trunc6((sellSide === 'yes' ? held.yes : held.no) * rng.range(0.3, 1))
        const q = shares > 0 ? quoteTrade(m.state, sellSide, 'sell', { shares }) : null
        if (q) {
          trade = { u: bot.id, m: m.id, s: sellSide, a: 'sell', n: q.shares, max: null, min: 0, ts: at.toISOString() }
          bot.balance += q.total
          held[sellSide] = trunc6(held[sellSide] - q.shares)
          if (sellSide === 'yes') m.state.qYes = trunc6(m.state.qYes - q.shares)
          else m.state.qNo = trunc6(m.state.qNo - q.shares)
        }
      } else {
        let side: Side | null = null
        let spend = 0
        if (Math.abs(edge) > 0.02) {
          side = edge > 0 ? 'yes' : 'no'
          spend = bot.size * Math.min(Math.max(Math.abs(edge) / 0.12, 0.25), 2)
        } else if (rng.chance(0.12)) {
          side = rng.chance(0.5) ? 'yes' : 'no'
          spend = rng.range(2, 8)
        }
        spend = Math.floor(Math.min(spend, bot.balance * 0.3) * 100) / 100
        const q = side && spend >= 1 ? quoteTrade(m.state, side, 'buy', { spend }) : null
        if (side && q && q.total < bot.balance - 0.5) {
          trade = { u: bot.id, m: m.id, s: side, a: 'buy', n: q.shares, max: q.total + 0.01, min: null, ts: at.toISOString() }
          bot.balance -= q.total
          held[side] = trunc6(held[side] + q.shares)
          if (side === 'yes') m.state.qYes = trunc6(m.state.qYes + q.shares)
          else m.state.qNo = trunc6(m.state.qNo + q.shares)
        }
      }
      if (trade) {
        bot.positions.set(m.id, held)
        batch.push(trade)
        if (batch.length >= BATCH) await flush()
      }
      continue
    }

    await flush()
    await setClock(at)
    if (event.kind === 'void') {
      await sql`select public.void_market(${m.id}, 'Superseded by a clearer market on the same cohort.')`
    } else {
      // Pick the outcome from the latent truth, then write synthetic reports that produce it.
      const yes = rng.chance(truthAt(m, new Date(m.resolvesAt)))
      const threshold = Number(m.spec.params.threshold_pct) / 100
      const lowResponse = m.spec.nonresponse === 'exclude_with_quorum' && rng.chance(0.4)
      const response = lowResponse ? rng.range(0.35, 0.5) : rng.range(0.82, 0.97)
      const needed = m.spec.nonresponse === 'count_as_no' ? threshold / response : threshold
      const rate = Math.min(1, Math.max(0, yes ? needed + rng.range(0.03, 0.12) : needed - rng.range(0.03, 0.12)))
      await sql`select setseed(${rng.range(-1, 1)})`
      await sql`select public.admin_generate_outcomes(${m.id}, ${rate}, ${response})`
      await sql`select public.resolve_market(${m.id})`
    }
    m.settled = true
    await syncBots(bots, [m.id])
    for (const b of bots) b.positions.delete(m.id)
  }
  await flush()

  // A few trades for the demo trader in the last hours, so their portfolio has data.
  const open = markets.filter((m) => !m.settled && m.closesAt > END).slice(0, 5)
  batch = open.map((m, i) => {
    const side: Side = i % 2 === 0 ? 'yes' : 'no'
    const q = quoteTrade(m.state, side, 'buy', { spend: 40 + i * 15 })!
    if (side === 'yes') m.state.qYes += q.shares
    else m.state.qNo += q.shares
    return { u: demo.trader.id, m: m.id, s: side, a: 'buy', n: q.shares, max: q.total + 0.01, min: null, ts: new Date(END.getTime() - (5 - i) * HOUR).toISOString() }
  })
  await flush()
  await sql`alter table public.trades enable trigger trades_broadcast`
  log(`trades: ${ok} executed, ${failed} rejected by the database (${(dbMs / Math.max(ok, 1)).toFixed(2)} ms each in SQL)`)
}

// ---------------------------------------------------------------------------------------------
// 5. Admin queues
// ---------------------------------------------------------------------------------------------

async function seedQueues(active: CohortSpec[], cohortIds: Map<string, number>) {
  await setClock(new Date(END.getTime() - 2 * HOUR))
  const extra = planMarkets(rng, active, 11)
    .filter((s) => !String(s.params.deadline).startsWith('2026'))
  for (const [i, spec] of extra.entries()) {
    try {
      const [p] = await sql<{ id: string }[]>`
        select public.propose_market(${cohortIds.get(spec.cohortSlug)!}, ${spec.metric}::public.market_metric,
                                     ${sql.json(spec.params)}, ${spec.rationale}) as id`
      if (i < 3) await sql`select public.admin_review_market_proposal(${toId(p!.id)}, false)`
    } catch (e) {
      log(`skipped a queue proposal: ${(e as Error).message}`)
    }
  }
}

async function main() {
  log(`timeline ${START.toISOString()} → ${END.toISOString()}`)
  await sql`alter table public.app_settings disable trigger audit_app_settings`
  try {
    const unis = await seedCatalog()
    log(`catalog: ${unis.length} universities`)
    const { demo, bots } = await seedPeople(unis)
    // Fresh statistics after each bulk load, so cached PL/pgSQL plans (the insider check in
    // execute_trade especially) use indexes instead of plans made for empty tables.
    await sql`analyze`
    const { active, ids } = await seedCohorts()
    const markets = await seedMarkets(active, ids)
    await sql`analyze`
    await seedTrading(markets, bots, demo)
    await seedQueues(active, ids)
    await setClock(null)
    await sql`select private.refresh_read_models()`
  } finally {
    await setClock(null).catch(() => {})
    await sql`alter table public.app_settings enable trigger audit_app_settings`.catch(() => {})
    await sql`alter table public.trades enable trigger trades_broadcast`.catch(() => {})
  }

  const counts = await sql<{ table_name: string; rows: string }[]>`
    select c.relname as table_name, c.reltuples::bigint as rows
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'm') order by c.relname`
  await sql`analyze`
  const exact = await Promise.all(counts.map(async (c) => {
    const [r] = await sql<{ n: string }[]>`select count(*) as n from ${sql('public.' + c.table_name)}`
    return [c.table_name, Number(r!.n)] as const
  }))
  console.table(Object.fromEntries(exact))
  console.log('Demo accounts (OTP codes arrive in Mailpit at http://127.0.0.1:54324):')
  console.log('  admin@example.com      admin')
  console.log('  trader@example.com     trader with open positions')
  console.log('  student@uwaterloo.ca   student with a confirmed transcript')
  await sql.end()
}

main().catch(async (e) => {
  console.error(e)
  await sql.end({ timeout: 1 })
  process.exit(1)
})
