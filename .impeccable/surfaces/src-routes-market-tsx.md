---
version: 1
slug: "src-routes-market-tsx"
primary_target: "src/routes/market.tsx"
related_targets: []
---

# Market detail (`/markets/:id`)

Mode: Operate. Dials: DESIGN_VARIANCE 3, MOTION_INTENSITY 4, VISUAL_DENSITY 7.

## Job and audience
A trader (or a curious student, on a cohort they are not in) arrives from the list, ⌘K, a cohort page or a shared link. They need to know in seconds what the market asks, what the crowd believes, and exactly how it resolves; then they may trade. Students arriving at a market on their own cohort see the price and rules but meet the insider block in place of the ticket.

## Outcome and proof
- Primary task: understand, then place a YES or NO trade with a known cost, payout and fee.
- Proof is the market's own data: live price, history, trades, rounded snapshot size, the frozen rule text.

## Structure
- Header: question (the page's h1), cohort chip linking to the cohort, status, close and resolve dates in plain words.
- Price: one sentence-figure, "Traders put this at 62%", the percentage set large with NumberFlow and the 24h change beside it. Live chart (Liveline) under it with a 1D / 1W / 1M / All toggle on the chart's top edge; historical ranges from candles (recharts) when Liveline doesn't suit them.
- Trade ticket: right rail on desktop (sticky), bottom sheet on mobile. Buy/Sell tabs, YES/NO segmented control showing each side's price, amount in credits with quick chips, the quote spelled out (shares, average price, price after, max payout, fee), a slippage note, one submit. States: signed out, insider, insufficient balance, market closed or resolved, price moved, submitting, success. Keys: Y, N, Enter.
- Rules box: the frozen resolution rule verbatim, the data source, the non-response rule, the snapshot size (rounded), the dates. Stripe-docs register: heading, one-line summary, the exact text.
- Below: your position (if any), the live trade tape (virtualized), and the cohort profile (top-skills bars, rounded size).

## States and ranges
Questions 60 to 200 characters. Prices 0.1% to 99.9%. 0 to 2,000+ trades. Balances 0 to 1,000,000. Markets open, closed (awaiting resolution), resolved YES/NO (with rounded %), voided (refunded).

## Direction contract
THESIS: The number is a sentence. Every key figure is typeset inside the plain-language claim it supports ("Traders put this at 62%"), the way a news graphic headlines its figure; the page refuses the casino layout of two big YES/NO slabs above the fold.
OWN-WORLD: Cool paper ground and ink text; hairline rules that organize data, never decorate; one cobalt (YES, focus, selection) and its vermillion counterpart (NO); Schibsted Grotesk throughout with tabular figures; 6px control radius, 10px panels, no nested cards.
STORY: The visitor reads the question, sees the crowd's number and its trend, reads the exact rule, then trades knowing cost, payout and fee before they press anything.
FIRST VIEWPORT: Left 2/3: question h1 (2 lines max at 1440), cohort chip and dates on one line under it, then the figure sentence at display size with the 24h change, then the chart filling the remaining height to the fold with the range toggle on its top edge. Right 1/3: the ticket, sticky, its submit button visible without scrolling. Rules box starts right under the chart.
FORM: Brief-pinned world (BRIEF §12: newspaper data desk plus Linear precision); no concept roll. Signature move: the sentence-figure.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
