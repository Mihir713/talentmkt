# talentmkt — Build Brief

> Save this as `BRIEF.md` in the repo root. Then tell Claude Code: **"Read BRIEF.md and start Phase 0."**

---

## 0. Read this first

You are the lead engineer and design engineer on **talentmkt**, a play-money prediction market on the career outcomes of anonymous student cohorts. Two things matter equally: **solid database work** (schema, constraints, SQL, transactions) and a **working, polished app** built on it.

The repo currently holds a vibecoded prototype (`talentmkt-v2`). Before anything else:

1. Create branch `rebuild`. Move the existing `src/`, `api/`, `PRODUCT_SPEC.md`, `PRODUCT_IDEA.md` into `legacy/`. It is an **anti-reference** for visual design and a loose feature reference only. Don't refactor it or lift components out of it. Delete `legacy/` once the rebuild is done.
2. Add `.env*` (except `.env.example`) to `.gitignore`. The Supabase service-role key and `ANTHROPIC_API_KEY` live only in Supabase Edge Function secrets. Never in `VITE_*` vars, never in client code.

### Working rules

- Work in the phases in §15. Stop at every **CHECKPOINT** and show me the results before continuing.
- Don't add features that aren't in this brief. If you think something's missing, list it at the next checkpoint instead of building it.
- **Every number on screen comes from the database.** No hardcoded stats, fake tickers, or placeholder "AI commentary".
- Verify in bounded passes. Build, then do one batched screenshot/test round, fix everything it found in one batch, then confirm with at most one more round. Don't loop on self-QA.
- Verify every dependency exists and check its current API before installing. Don't guess package names.

### Installed tooling

**Skills** (in `.claude/skills/`):

- **`impeccable`** (pbakaus) owns product context and the design system. Use `/impeccable init`, `shape`, `critique`, `audit`, `harden`, `polish`, `animate`, `typeset`, `layout`, `onboard`, `clarify`, `document`, `live`. Also run `npx impeccable detect http://localhost:5173` for the deterministic anti-pattern scan.
- **Emil Kowalski's skills** cover motion and interaction feel: `emil-design-eng`, `animate`, `review-animations`, `improve-animations`, `find-animation-opportunities`, `break-ui`, `apple-design`, `pick-ui-library`.
  - `pick-ui-library` only runs when explicitly invoked.
  - Always invoke these skills with a concrete target. Invoked bare, they only print an intro line.
- **taste-skill** (`design-taste-frontend`) provides anti-slop rules, a "design read", and three dials (VARIANCE / MOTION / DENSITY).

**MCP:** `playwright`. Use it to:

- screenshot reference sites in Phase 3,
- look at your own UI at 1440px and 390px, in light and dark, after every surface,
- drive the e2e flows.

### When guidance conflicts, precedence is:

1. This brief.
2. `PRODUCT.md` / `DESIGN.md` produced by impeccable.
3. Emil's skills for motion, interaction feel, and library choice. His `pick-ui-library` list beats taste-skill's library suggestions.
4. taste-skill for anti-slop rules and landing-page composition.
   - Ignore its suggestion to use Carbon/Fluent/Polaris for dashboard surfaces.
   - Don't use its GSAP scroll skeletons anywhere inside the app. They're optional on the landing page only.

---

## 1. Product

**One-liner:** Students upload a transcript and get placed into anonymous cohorts with peers who share their skills. Traders use play credits to bet on what fraction of each cohort hits a career outcome, for example *"Will ≥60% of this cohort be employed in the SF Bay Area by Sep 1, 2028?"*

### Users

**Students**
- Verify student status with a university email.
- Upload a transcript PDF, review the parsed courses, and get placed in 1–N cohorts.
- See what traders believe about their cohorts and their skills.
- **Cannot trade markets on their own cohorts.**
- Can trade other cohorts' markets like any trader.

**Traders**
- Anyone with an account.
- Start with 1,000 credits, trade YES/NO on markets, and climb a leaderboard.

**Admins**
- Approve AI-proposed cohorts and markets.
- Resolve markets.
- Control the simulation clock.

### What students get

A **Skill Signal** view: an honest read of what traders currently believe about people with their skills. Copy never claims this is what they are "worth".

---

## 2. Non-goals (do not build)

- Real money, deposits, withdrawals, crypto, wallets, ERC-8004, x402. Credits have no cash value and can't be bought.
- A chat agent or an "AI market commentary" feed.
- Individual-level markets. Every market is about a frozen cohort snapshot of at least k people.
- Any way for anyone to see another person's cohort membership.

---

## 3. Stack

- **Frontend:** Vite + React 19 + TypeScript (strict) + Tailwind v4, React Router v7.
- **Supabase:**
  - Postgres
  - Auth (email OTP)
  - Storage (a private `transcripts` bucket)
  - Realtime
  - Edge Functions (Deno) for everything that calls the Claude API
  - Local dev with the Supabase CLI (`supabase start`); migrations in `supabase/migrations/`
- **Architecture rule:** all logic that touches balances, trades, positions, or resolution lives in SQL. That means plain `.sql` migrations, PL/pgSQL functions, triggers, views, and materialized views. No ORM. The client calls functions through `supabase.rpc()` and never writes tables directly.
- **Data:** TanStack Query for server state; zustand for client UI state only.
- **UI libraries** (Emil's curated list):

  | Need | Library |
  |---|---|
  | Accessible primitives | base-ui |
  | Layout and gesture animation | motion |
  | Animated numbers | NumberFlow |
  | Toasts | Sonner |
  | ⌘K palette | cmdk |
  | Static and historical charts | recharts |
  | Live price chart on market detail | Liveline (benjitaylor/liveline) |
  | Trade tape and long tables | react-virtuoso |
  | Email OTP input | input-otp |
  | Class names and variants | clsx + cva |

- **Icons:** Phosphor. Drop lucide.
- **Claude API:** called from Edge Functions only.
  - Check the Anthropic docs for current model IDs; default to the current Sonnet model.
  - Send PDFs as document content blocks.
  - Get structured output with tool use and a strict JSON schema.
- **Tests:** Vitest; pgTAP via `supabase test db`; Playwright for e2e.

---

## 4. Data model

### Conventions

- Design to 3NF/BCNF. There are exactly two deliberate denormalizations, `markets.q_yes/q_no` and `accounts.balance`. Both are maintained **only** by SQL functions or triggers, and both are justified in a comment in the migration that creates them.
- `uuid` PKs for user-owned rows; `bigint generated always as identity` for high-volume rows (trades, ledger, price points).
- Credit amounts are stored as `numeric(18,6)`. Math is done in `double precision`. Costs round **up** (in the house's favor); payouts round **down**.

This is a reference schema. Refine it, and present your version at Checkpoint 1.

### Reference / catalog

- `universities(id, name, short_name, email_domain unique, region)`
- `programs(id, university_id → universities, name, faculty)`
- `courses(id, university_id, code, title, level int, unique(university_id, code))`
- `skill_tags(id, slug unique, label, category)` is a fixed taxonomy of about 40–60 tags, e.g. `embedded-systems`, `rf-analog`, `vlsi-digital`, `ml`, `databases`, `distributed-systems`, `control-systems`, `power-systems`, `cad-mechanical`, `quant-finance`.
- `course_skill_tags(course_id, skill_tag_id, weight numeric check (weight > 0 and weight <= 1), pk(course_id, skill_tag_id))`

### People

- `profiles(user_id pk → auth.users, handle unique, role enum('trader','student','admin'), created_at)`
- `student_profiles(user_id pk → profiles, university_id, program_id, grad_year int check (grad_year between 2024 and 2032), verified_email_at, consent_at not null)`
- `transcript_uploads(id, user_id, storage_path, status enum('uploaded','parsing','needs_review','confirmed','failed'), model, prompt_version, parsed_json jsonb, file_deleted_at, created_at)`
  - The PDF is deleted from Storage as soon as the student confirms. Only `transcript_courses` remains.
- `transcript_courses(user_id, course_id, term, grade_band enum('A','B','C','D','F','P','IP') null, pk(user_id, course_id, term))`

### Cohorts

- `cohorts(id, slug unique, title, definition jsonb not null, status enum('proposed','active','retired'), min_size int not null default 25, proposed_by enum('ai','admin'), approved_by, created_at)`
- `cohort_memberships(cohort_id, user_id, pk(cohort_id, user_id))`. Only the member can read their own rows; nobody else ever can.
- `cohort_snapshots(id, cohort_id, frozen_at, member_count, check (member_count >= 25))`
- `snapshot_members(snapshot_id, user_id, pk(snapshot_id, user_id))`

### Markets

- `market_templates(id, metric enum('employed_in_field','employed_in_region','salary_at_least','grad_school'), question_pattern text, rule_pattern text, param_schema jsonb)`
- `market_proposals(id, cohort_id, template_id, params jsonb, rationale text, model, prompt_version, status enum('pending','approved','rejected'), reviewed_by, reviewed_at)`
- `markets(...)`, one row per market:

  | Column | Type / notes |
  |---|---|
  | `id` | pk |
  | `snapshot_id` | → cohort_snapshots |
  | `template_id` | → market_templates |
  | `question` | text |
  | `params` | jsonb |
  | `resolution_rule` | text not null |
  | `nonresponse_rule` | enum('count_as_no','exclude_with_quorum') |
  | `quorum_pct` | int |
  | `opens_at`, `closes_at`, `resolves_at` | timestamps |
  | `status` | enum('open','closed','resolved','voided') |
  | `b` | numeric not null |
  | `q_yes`, `q_no` | numeric default 0 |
  | `fee_bps` | int default 100 |
  | `outcome` | enum('yes','no') null |
  | `resolved_at` | timestamp |

- `trades(id bigint, market_id, user_id, side enum('yes','no'), action enum('buy','sell'), shares, cost, fee, price_before, price_after, created_at)`
- `positions(user_id, market_id, yes_shares check (>= 0), no_shares check (>= 0), cost_basis, pk(user_id, market_id))`
- `price_points(market_id, ts, p_yes)` gets one row per trade. Candles come from a view.
- `watchlist(user_id, market_id, pk(user_id, market_id))`

### Ledger (append-only)

- `accounts(user_id pk, balance numeric not null check (balance >= 0))`
- `ledger_entries(id bigint, user_id, amount numeric /* signed */, kind enum('signup_grant','trade','fee','payout','refund','admin_adjust'), trade_id null, market_id null, created_at)`
  - `accounts.balance` is maintained by a trigger on ledger inserts and is never updated directly.
  - Ledger rows can never be updated or deleted (enforced by trigger).

### Outcomes (the oracle)

- `outcome_reports(id, user_id, reported_at, status enum('employed','searching','grad_school','other'), region text, field_skill_tag_id null, salary_band enum(...), verification enum('self','verified'))`
- `market_resolutions(market_id pk, numerator int, denominator int, response_rate numeric, outcome, method text, resolved_by, resolved_at)`

### System

- `app_settings(key pk, value jsonb)` includes `sim_now`.
  - **Every time comparison in SQL goes through `app_now()`**, which returns `sim_now` if set and `now()` otherwise. This is how we demo 2028 resolutions today.
- `audit_log(id, actor, action, entity, entity_id, payload jsonb, created_at)`

### Required database features

Each of these must exist and be used by the app.

**Functions**
- `lmsr_cost`, `lmsr_price`, `app_now()`.
- `quote_trade` (read-only).
- `execute_trade(market_id, side, action, amount, max_cost | min_return)`:
  - `security definer`
  - locks the market row with `SELECT … FOR UPDATE`
  - checks status, `closes_at`, balance, and slippage
  - writes the trade, position, ledger entries, and price point in one transaction
- `compute_memberships(cohort_id)`, `freeze_snapshot(cohort_id)`.
- `resolve_market(market_id)`.
- `void_market(market_id)` refunds cost basis.

**Triggers**
- ledger → balance
- ledger is append-only
- **insider rule:** reject any trade where the trader is in the market's snapshot *or* currently in that cohort
- cohort activation is blocked below `min_size`
- every admin action writes to `audit_log`

**Views**
- `v_market_cards`: implied %, 24h change, 24h volume, distinct traders, closes-in.
- `v_public_trades`: no user ids.
- `v_portfolio`: live mark-to-market.
- `v_leaderboard`: window functions for rank, P&L, and Brier score on resolved markets.
- `v_cohort_public`: member count rounded to the nearest 5 and top skills; suppresses anything below k.

**Materialized view**
- `mv_skill_signal`: per skill tag, the volume-weighted mean implied probability across open markets whose cohort definition includes that tag, plus the 7-day change.
- Refresh it with pg_cron, or with an admin button if cron is awkward locally.

**Indexes**
- `trades(market_id, created_at desc)`
- `trades(user_id, created_at desc)`
- `price_points(market_id, ts)`
- `cohort_memberships(user_id)`
- `course_skill_tags(skill_tag_id)`
- `markets(status, closes_at)`
- `pg_trgm` GIN indexes on `markets.question` and `courses.title` for ⌘K search

**Row-level security on every table**

| Access | Tables |
|---|---|
| Public read | markets, public `v_*` views, `v_cohort_public`, skill tags, courses, universities |
| Owner-only | transcript data, memberships, positions, ledger, outcome reports |
| Admin-only | proposals, resolutions, settings, audit log |

All writes go through RPC functions.

---

## 5. Market mechanics: LMSR

Binary markets are priced by Hanson's logarithmic market scoring rule, so every market always has a price and a counterparty (the house).

- **Cost:** `C(qy, qn) = b · ln(e^(qy/b) + e^(qn/b))`. Implement it with log-sum-exp for numerical stability.
- **Price:** `p_yes = e^(qy/b) / (e^(qy/b) + e^(qn/b))`, and `p_no = 1 − p_yes`.
- **Buying and selling:**
  - Buying Δ YES costs `C(qy+Δ, qn) − C(qy, qn)`.
  - Selling Δ YES returns `C(qy, qn) − C(qy−Δ, qn)`.
  - NO is symmetric.
- **Spend-based buys:** solve for Δ in closed form with `qy + Δ = b · ln(e^((C0+S)/b) − e^(qn/b))`, computed stably. No binary search.
- **Fee:** `fee_bps` (default 100 = 1%) is charged on top of cost and recorded as its own ledger entry.
- **House exposure:** max loss per market is `b · ln 2`. Default `b = 150` credits; admins can set it per market.
- **Payout:** each winning share pays 1 credit; losing shares pay 0.
- **Client-side quotes:** mirror the math in `src/lib/lmsr.ts` so quotes are instant.
  - Vitest must prove the TS and SQL implementations agree to 1e-6 across a few hundred random cases.
  - The server is the source of truth: `execute_trade` takes `max_cost` (buys) or `min_return` (sells) and rejects the trade if the price moved past it.

---

## 6. Cohorts & privacy

**Cohorts are readable rules, not opaque clusters, so traders know what they're betting on.**

Example `definition`:

```json
{
  "skills": [{ "tag": "embedded-systems", "min_weighted_courses": 3 }],
  "grad_years": [2027, 2028],
  "regions": ["ON"]
}
```

Titles read like *"Embedded systems · grads 2027–28 · Ontario"*.

**Rules**
- Prefer skill-level definitions that span schools. The proposal validator rejects single-school + single-course definitions.
- **k = 25.** Cohorts below k stay `proposed` and invisible.
- Public counts are rounded to the nearest 5.
- Resolutions publish YES/NO plus a rounded percentage. Never raw numerators.

**Membership**
- Computed in SQL from `transcript_courses × course_skill_tags`.
- Recomputed when a transcript is confirmed.
- Markets reference a **frozen snapshot**, so the denominator never changes after a market opens.
- Students see which cohorts *they* are in. Nobody sees who else is.

**Consent screen before upload**

It states plainly:
- what's stored: course codes, terms, and optional grade bands,
- what's deleted: the PDF, right after confirmation,
- what's public: aggregates only,
- the insider rule.

**Account deletion**

Students can delete their account, which removes them from future snapshots. Frozen snapshots keep an anonymized tombstone so open markets stay resolvable. Document this trade-off in a comment in the migration.

---

## 7. AI features (Supabase Edge Functions)

### 1. `parse-transcript`

1. The student uploads a PDF to the private bucket.
2. The function sends it to Claude as a document block.
3. A tool-use JSON schema returns `[{code, title, term, grade}]` plus guesses for `university` and `program`.
4. Courses not already in `courses` get skill tags from a second call. That call is constrained to the existing `skill_tags` slugs (an enum in the schema), with weights from 0 to 1.
5. Stream progress states to the UI (uploading → reading → matching courses → tagging skills → ready for review).
6. **The student reviews and edits the extraction before confirming.** Nothing is written to `transcript_courses` until they confirm.
7. The PDF is deleted right after confirmation.

### 2. `propose-cohorts` (admin-triggered)

- Input is **aggregated** skill co-occurrence counts only, never individual rows.
- Output is cohort definitions in the JSON shape from §6.
- An admin approves them.

### 3. `propose-markets` (admin-triggered, per active cohort)

- Input is the cohort's public stats.
- Output is a template id, params (threshold %, region, salary band, deadline), and a one-sentence rationale.
- **The model never writes resolution rules.** The question text and `resolution_rule` are rendered from the template and params.
- When an admin approves: the snapshot is frozen, then the market opens.

### Guardrails

- The model never sees names, emails, or any per-student data except the transcript being parsed for that student.
- Log the model and prompt version on every row it creates.

---

## 8. Resolution & the simulation clock

**`resolve_market(id)`:**
1. Evaluates the template's rule against the snapshot members' `outcome_reports` as of `resolves_at`, using `app_now()`.
2. Applies the `nonresponse_rule`:
   - Default is `count_as_no`.
   - `exclude_with_quorum` voids the market and refunds if the response rate is below `quorum_pct`.
3. Writes `market_resolutions`, pays winning shares through the ledger, and sets the market status.

**Admin Simulation panel:**
- Set `sim_now`.
- Generate synthetic outcome reports for a cohort with a chosen true rate.
- Resolve all due markets.

This is the demo path for showing markets resolve today.

---

## 9. Seed data

Write a deterministic TypeScript seeder, `scripts/seed.ts`, with a seeded RNG. It generates:

- 4–6 Ontario universities and about 600 courses with plausible codes and titles, all skill-tagged.
- About 5,000 students with realistic transcripts. Core courses come from their program; electives create real skill variation.
  - Synthetic users may be inserted directly into `auth.users` in the **local** seed only.
- Cohorts, memberships, and snapshots, all produced by the real SQL functions, not inserted by hand.
- About 120 markets across all templates, with deadlines from 2026 to 2029.
- About 60,000 trades from about 800 simulated traders with different beliefs.
  - Each bot holds a private belief per skill tag plus noise, and trades toward it through `execute_trade`.
  - This makes price histories look organic and ensures the ledger reconciles.
- Some outcome reports and a handful of already-resolved and voided markets, so every UI state has real data.


---

## 10. Surfaces

Every surface needs designed **loading** (skeletons that match the final layout, no spinners inside content), **empty**, **error**, and **edge** states.

### `/` Landing (Persuade mode)

- One screen explains what a cohort is, what a market is, and why it's anonymous.
- Use live data, not mockups: a few real open markets from `v_market_cards` and real counts.
- Two CTAs: **Join as a student** and **Browse markets**.
- A short, honest "How it works / What we store" section.

### `/markets` (Operate mode)

- Filter by skill tag, metric, and deadline. Sort by volume, closing soon, biggest 24h move, or newest.
- Each row shows:
  - the question and cohort title,
  - implied % (NumberFlow),
  - 24h change and volume,
  - time until close,
  - a mini sparkline,
  - a watchlist star.
- A ⌘K palette (cmdk) searches markets, cohorts, and skill tags.

### `/markets/:id`, the most important screen

**Header:** question, cohort chip, status, close and resolve dates.

**Price:**
- Large implied % with NumberFlow.
- A Liveline chart that ticks on realtime trades.
- A range toggle (1D / 1W / 1M / All); use recharts for historical ranges if Liveline doesn't suit them.

**Trade ticket:**
- YES/NO segmented control and an amount in credits.
- An instant client-side quote: shares, average price, price after, max payout, fee.
- A slippage note.
- Submit applies an optimistic update, then shows a Sonner toast.
- Design these states explicitly: insider-rule block, insufficient balance, market closed, price moved.
- Keyboard: `Y` / `N` switch side, `Enter` submits.

**Rules box (plain language):**
- the exact resolution rule and data source,
- the non-response rule,
- the snapshot size (rounded),
- the dates.

**Also on the page:** a realtime trades tape (react-virtuoso), the user's position, and a cohort profile (top-skills bar chart, rounded member count).

### `/cohorts/:slug`

- The definition in plain language.
- Skill composition.
- All markets on this cohort.

### `/onboard`, the student flow (use `/impeccable onboard`)

1. Email OTP; the university domain marks the account as a student.
2. Consent screen.
3. Drag-and-drop upload.
4. Parsing with streamed steps.
5. Review table: edit, delete, or add courses, and confirm tags for unknown courses.
6. Confirm.
7. Skill profile reveal.
8. "Your cohorts", with the insider rule explained in one line.

### `/me`, the student home

- Skill Signal: the student's skill tags with `mv_skill_signal` values and trends, framed as "what traders believe".
- Their cohorts and those cohorts' markets (view-only).
- Privacy controls: delete data, delete account.

### `/portfolio`

- Balance (NumberFlow).
- Open positions with live mark-to-market.
- Realized P&L.
- Trade history (virtualized).

### `/leaderboard`

Rank by P&L and by accuracy (Brier score on resolved markets).

### `/admin`

- Proposal queues for cohorts and markets, with approve/reject.
- Market resolution and voiding.
- The simulation panel.

---

## 11. Reactivity

"Reactive" means all of the following:

**Realtime updates**
- Subscribe to `trades` inserts and `markets` updates for the markets currently visible, with channels scoped per page.
- Patch TanStack Query caches directly. Don't refetch whole lists.

**Price animation**
- Prices animate with NumberFlow.
- A changed figure gets a brief tint: at most 600ms, ease-out, and off under reduced motion.
- No flashing whole rows.

**Trading**
- Trades are optimistic, with rollback on RPC error.
- Quotes update on every keystroke with zero network latency (client-side LMSR).

**Layout stability**
- Route transitions keep the layout stable.
- Skeletons match the final layout, and tabular numerals are used everywhere, so price updates never shift the layout.
- Show a "Live" indicator only where a subscription is actually active.

**Targets**
- Interactions respond in under 100ms.
- Landing page LCP under 2.5s.
- CLS ≈ 0 on market pages.

---

## 12. Design direction

### Character

A serious instrument about people's futures. Calm, precise, legible, trustworthy, a little editorial. Think the clarity of a good newspaper data desk plus Linear-grade precision in the product UI, **not** a crypto terminal.

Copy is plain and honest: *"Traders put this at 62%."* Never *"Your skills are worth…"*

### Modes and dials

| Surface | impeccable mode | DESIGN_VARIANCE | MOTION_INTENSITY | VISUAL_DENSITY |
|---|---|---|---|---|
| Landing (`/`) | Persuade | 6 | 5 | 3 |
| Everything else | Operate | 3 | 4 | 7 |

### References

Study these with Playwright for **patterns only**: layout, information hierarchy, trade-ticket flow, and how resolution rules are presented. Never copy brand, assets, or copy. If a site is geo-blocked, skip it.

- **manifold.markets** is the closest model: play money, an AMM, and many markets.
- **kalshi.com** and **polymarket.com**: market detail layout, trade ticket, rules presentation.
- **linear.app**: density and precision in product UI.
- **Stripe's docs**: explaining rules and data clearly.

Save screenshots to `docs/references/`, with one paragraph per site on what we're taking and what we're not.

### Hard bans

Everything the legacy prototype did:

- neon cyan on navy
- glassmorphism
- grid or scanline backdrops
- fake terminal chrome with traffic-light dots
- floating or bobbing cards
- gradient-text headlines
- pulse dots on things that aren't live
- ticker strips of made-up data
- the Inter + JetBrains Mono default pairing
- cards nested in cards
- gray text on colored backgrounds

### Must-haves

- **Themes:** light and dark both designed, not just inverted. Follow the system preference with no flash on load. Tinted neutrals and a single accent.
- **YES/NO colors:** colorblind-safe and always paired with a label or icon. Never color alone.
- **Numbers:**
  - tabular numerals for every figure,
  - percentages with at most one decimal,
  - credits with thousands separators.
- **Accessibility:**
  - base-ui primitives,
  - visible focus,
  - a full keyboard trading flow,
  - WCAG AA contrast,
  - `prefers-reduced-motion` respected.
- **Responsive:** works down to 360px. On mobile, the trade ticket becomes a bottom sheet.

---

## 13. How to use the skills, in order

### Phase 3: design foundation

1. Run `/impeccable init`, answering from §1, §2, and §12 of this brief. Ask me only about genuine gaps. This writes `PRODUCT.md`.
2. Do the Playwright reference study from §12 and save the notes.
3. Run `/impeccable shape` for the market detail page and the onboarding flow, **before writing their code**.
4. Apply `design-taste-frontend`:
   - output its one-line design read,
   - set the dials from §12.
5. Build the tokens (color, type scale, spacing, radius, shadow, motion durations and easings). After the first surfaces exist, run `/impeccable document` to write `DESIGN.md`.
6. Invoke `/pick-ui-library` only if you hit a need that §3 doesn't cover.

### Phase 4: every surface

1. Build it.
2. Take Playwright screenshots at 1440 and 390, in light and dark.
3. Run `/impeccable critique <surface>`.
4. Fix everything in one batch.

Then run `/break-ui` on the market card, trade ticket, onboarding review table, and portfolio row. Feed them worst-case data: 200-character questions, zero trades, 1,000,000 credits, 0.1% and 99.9% prices, non-Latin course titles.

### Phase 5: motion and reactivity

1. Run `/find-animation-opportunities` across the app.
2. Use Emil's `animate` on the items you chose.
3. Run `/review-animations`.

Follow his rules:
- ease-out on enter, with faster exits,
- no animation on high-frequency interactions (typing an amount must not animate the panel),
- springs for layout changes and the mobile sheet,
- roughly 150–300ms for UI transitions.

### Phase 6: hardening

1. `/impeccable audit`
2. `/impeccable harden`
3. `npx impeccable detect http://localhost:5173`. Fix every finding or justify it in `docs/design-exceptions.md`.
4. `/impeccable polish`

---

## 14. Testing & verification

### Vitest

- LMSR math.
- TS↔SQL parity.
- Formatting utilities.

### pgTAP (`supabase test db`)

- Balance is never negative.
- Ledger sums equal `accounts.balance` for every user.
- Positions match trade history.
- The insider trigger blocks member trades.
- Concurrent `execute_trade` calls on one market serialize correctly. Fire parallel clients from a test script and assert the final state.
- Resolution pays exactly the winning shares.
- Voided markets refund cost basis.
- RLS: a student can't read another student's memberships or transcript rows. Test this as different JWTs.

### Playwright e2e

- **Student flow:** sign up, then onboard with a fixture transcript PDF (generate 3 fixtures), ending at the cohort reveal.
- **Trader flow:** buy YES, see the position update live, then sell.
- **Insider attempt:** the trade is blocked, and the UI explains why.
- **Admin flow:** approve a market proposal, advance the sim clock, resolve the market, and see the payout land in the portfolio.

### One command

`npm run check` runs typecheck, lint, Vitest, `supabase test db`, and Playwright.

---

## 15. Phases & checkpoints

**Phase 0: Setup.** Create the branch, move the legacy code, fix `.gitignore`, init the local Supabase stack, and install the §3 dependencies (verify each one first).

**Phase 1: Database.** Migrations, functions, triggers, views, and RLS.

> **CHECKPOINT 1.** Show me a Mermaid ER diagram, the table list, the function signatures, and how the insider, ledger, and LMSR invariants are enforced. Wait for my OK before building on it.

**Phase 2: Seed and SQL tests.**

> **CHECKPOINT 2.** Show me row counts per table and the test output.

**Phase 3: Design foundation.** Steps 1–5 of §13, plus the app shell, auth, and theming.

> **CHECKPOINT 3.** Show me `PRODUCT.md`, the reference notes, the tokens, and screenshots of the shell and a static market detail page in both themes. Wait for my OK on the direction.

**Phase 4: Surfaces.** Build in this order:
1. Market detail and trading
2. Markets list
3. Onboarding and the Edge Functions
4. Portfolio
5. `/me`
6. Cohorts
7. Leaderboard
8. Admin

**Phase 5: Reactivity and motion.**

**Phase 6: Hardening and e2e.**

> **CHECKPOINT 4.** Show me the final screenshots, test results, detector output, and a list of known gaps.

---

## 16. Definition of done

- Every flow in §10 works end to end against seeded data, in both themes, at 390px and 1440px.
- There are no hardcoded or fake numbers anywhere in the UI.
- `npm run check` passes.
- `npx impeccable detect` is clean, or every remaining finding is justified in `docs/design-exceptions.md`.
- The README covers:
  - one-command local setup: `supabase start && npm run seed && npm run dev`
  - the required env vars
  - the demo script: set the sim clock, resolve markets, show payouts
