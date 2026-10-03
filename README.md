# talentmkt

A play-money prediction market on the career outcomes of anonymous student cohorts.
The build plan lives in [BRIEF.md](BRIEF.md). Design system: [DESIGN.md](DESIGN.md); product context:
[PRODUCT.md](PRODUCT.md); schema and invariants: [docs/database.md](docs/database.md).

## Local setup

Prerequisites: Node 22.12+, a Docker-compatible runtime (this machine uses Colima).

```sh
colima start                  # once per boot, if using Colima
npm install
npx supabase start            # local Postgres, Auth, Storage, Realtime, Edge Functions
npx supabase status -o env    # copy API_URL and ANON_KEY into .env.local (see .env.example)
npm run seed                  # resets the database, then seeds it (about 5 minutes)
npm run dev
```

Local email (OTP codes) is readable in Mailpit at http://127.0.0.1:54324. Seeded demo
accounts: `admin@example.com`, `trader@example.com`, `student@uwaterloo.ca`.

The seed is deterministic for a given day: its 150-day trading history ends at the current
hour, so "24h" figures stay meaningful. See [docs/database.md](docs/database.md) for the schema.

## Environment

| Variable | Where | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` | Local API URL from `supabase status` |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` | Anon (publishable) key; safe in the client |
| `ANTHROPIC_API_KEY` | Edge Function secrets | Never in `VITE_*` vars or client code |

The service-role key is only ever used inside Edge Functions. For AI transcript parsing and
proposals locally, copy `supabase/functions/.env.example` to `supabase/functions/.env` and set
`ANTHROPIC_API_KEY`, then restart the stack. Without it, onboarding falls back to entering
courses by hand and the AI proposal buttons say they aren't configured.

## Demo script

1. Sign in as `admin@example.com` (code in Mailpit) and open **Admin → Proposals**. Approve a
   market proposal: its cohort's snapshot freezes and the market opens.
2. In another browser profile, sign in as `trader@example.com`, open that market and buy YES.
   The price, tape and position update live.
3. Back in **Admin → Simulation**, set the clock a few days past the market's deadline. A banner
   across the app shows the simulated time.
4. Choose the market under **Synthetic outcome reports**, set the true rate (for example 100%),
   and generate reports.
5. **Admin → Resolution**: click **Resolve** on the market (or **Resolve all due markets**).
6. The trader's **Portfolio** shows the market under Settled with the payout; the balance went up.
7. **Simulation → Back to real time** when done.

Sign in as `student@uwaterloo.ca` to see the student side: **My skills** (Skill Signal, cohorts,
privacy controls) and the insider block on any of their cohorts' markets.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on :5173 |
| `npm run seed` | Reset the local DB and load the deterministic seed |
| `npm run check` | Typecheck, lint, unit, pgTAP, DB integration and e2e tests (needs a seeded local stack) |
| `npm test` | Unit tests (no database) |
| `npm run db:test` | pgTAP tests in `supabase/tests/` |
| `npm run test:db` | TS↔SQL parity, concurrency and API-level RLS tests |
| `npm run test:e2e` | Playwright: student onboarding, trading, insider block, admin resolution |
| `npm run db:reset` | Recreate the local DB from `supabase/migrations/` (empty) |
