# Product

<!-- impeccable:product-schema 1 -->

<!-- Written from BRIEF.md §1, §2 and §12 after the user said to proceed without an interview.
     Lines marked (inferred) are reasonable readings of the brief, not confirmed answers. -->

## Platform

web

## Users

- **Traders.** Anyone with an account. They browse markets on career outcomes, compare what
  the crowd believes with what they believe, and trade play credits (1,000 to start) to climb
  a leaderboard. Many arrive curious about "how are people with my skills doing", so they read
  more than they trade. (inferred: reading-heavy)
- **Students.** Verified with a university email. They upload a transcript, review what was
  parsed, get placed into anonymous cohorts with peers who share their skills, and see what
  traders believe about people with those skills. They cannot trade their own cohorts' markets
  and can trade any other.
- **Admins.** Approve AI-proposed cohorts and markets, resolve and void markets, and run the
  simulation clock for demos.

## Product Purpose

talentmkt is a play-money prediction market on the career outcomes of anonymous student
cohorts, for example "Will ≥60% of this cohort be employed in the SF Bay Area by Sep 1, 2028?".
It turns scattered opinions about which skills lead where into one public, honest number per
question, and gives students a read on what traders currently believe about people with their
skills. Success: traders understand exactly what each market means and how it resolves before
they trade, and students learn something true about their skills without their privacy ever
being at risk.

## Positioning

Every market is about a frozen, anonymous snapshot of at least 25 people defined by readable
skill rules (not opaque clusters, never individuals), resolved from members' own outcome
reports against a rule written before the market opened. Nobody, including admins, can see who
is in a cohort.

## Operating Context

- Traders use a laptop or phone during the day; markets update live as others trade.
  (inferred)
- Students meet the product once at onboarding (consent, upload, review, confirm), then return
  to see their Skill Signal and their cohorts' markets.
- Admins work a queue: proposals in, approve or reject, resolve when due, and set the clock.

## Capabilities and Constraints

- Play credits only. No real money, deposits, withdrawals, crypto or wallets. Credits have no
  cash value and cannot be bought.
- Markets are binary (YES/NO), priced by an LMSR automated market maker, so there is always a
  price and a counterparty. 1% fee per trade.
- k = 25: cohorts and snapshots below 25 people never go live. Public counts are rounded to
  the nearest 5; resolutions publish YES/NO and a percentage rounded to 5.
- Insider rule: members of a market's cohort or snapshot cannot trade it.
- The transcript PDF is deleted right after the student confirms the parsed courses. Only
  course codes, terms and optional grade bands are kept.
- AI (Claude) parses transcripts and proposes cohorts and markets. It never writes resolution
  rules, never sees names, emails or per-student data beyond the transcript being parsed.
- Out of scope: a chat agent, AI market commentary, individual-level markets, any way to see
  another person's cohort membership.

## Brand Commitments

- Name: talentmkt (lowercase).
- Voice: plain and honest. "Traders put this at 62%." Never "your skills are worth…".
  No hype, no gamification language.
- Character: a serious instrument about people's futures. Calm, precise, legible,
  trustworthy, a little editorial. The clarity of a good newspaper data desk plus Linear-grade
  precision in the product UI. Not a crypto terminal.
- Explicitly rejected (the previous prototype): neon cyan on navy, glassmorphism, grid or
  scanline backdrops, fake terminal chrome, floating cards, gradient-text headlines, pulse dots
  on things that are not live, ticker strips of made-up data, Inter + JetBrains Mono, cards
  nested in cards, gray text on colored backgrounds.

## Evidence on Hand

- A deterministic local seed: 6 Ontario universities, ~5,000 synthetic students, 32 live
  cohorts, 122 markets, ~63,000 trades by simulated traders. All of it is synthetic and must
  never be presented as real people or real outcomes.
- No testimonials, users, press, partners or metrics exist. Every number on screen comes from
  the database; nothing is hardcoded.

## Product Principles

1. **The rule is the product.** A trader should be able to read exactly how a market resolves,
   from what data, and what happens to non-responses, before trading.
2. **Aggregates only.** Every surface shows rounded cohort aggregates; no screen, error or
   export can reveal who is in a cohort.
3. **Say what the number is.** Prices are what traders believe, not what anyone is worth; copy
   states that plainly every time a number could be misread.
4. **Numbers come from the database.** No placeholder figures, fake tickers or invented
   commentary, including on the landing page.

## Accessibility & Inclusion

WCAG 2.2 AA contrast, visible focus, a complete keyboard trading flow (Y / N to switch side,
Enter to submit), `prefers-reduced-motion` respected, YES/NO never distinguished by color
alone, and layouts that work from 360px.
