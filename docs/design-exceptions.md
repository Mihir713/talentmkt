# Design exceptions

Findings from `impeccable detect` (source scan: clean; live scan of `/`, `/markets`, `/markets/:id`,
`/leaderboard`, `/cohorts/:slug`) that remain after fixes, and why they stay.

| Finding | Where | Why it stays |
|---|---|---|
| `text-overflow`: "li overflows its box" | The visually hidden (`sr-only`) list under each skill-bar chart | False positive. The list exists so screen readers get the chart's numbers; `sr-only` clips it to 1px by design. Nothing is visible or scrollable. |
| `layout-transition`: `transition: width` | NumberFlow figures (prices, balances) | Internal to NumberFlow, which animates the figure's width as digits roll. Every figure uses tabular numerals, so width only changes when the digit count does (for example 9% to 10%). Disabled under reduced motion. |
| `layout-transition`: `transition: left, width` | Admin tab indicator | Used only on the admin page (low-frequency), 200ms. Base UI exposes the active tab's position as CSS variables; animating them is its documented pattern. |
| Not detectable (canvas) | Live 1-day chart axis labels (Liveline) | Liveline draws its tick labels in SF Mono on a canvas with no font option. They are measurement labels, which the craft rules allow in monospace; the value badge (which would have put the headline price in mono) is turned off. |

Fixed rather than excepted: rule text line length (capped at 72ch) and display-size line height
(raised to 1.08 at 56px, 1.04 at 72px).
