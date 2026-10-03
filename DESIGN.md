# Design

talentmkt is a newspaper data desk with Linear-grade precision: calm, legible, a little editorial,
never a crypto terminal. Tokens live in `src/index.css`; components in `src/components/ui/`.

## Principles

1. **The number is a sentence.** Key figures are set inside the plain claim they support:
   "Traders put this at **62%**", "About **540** people today". This is the product's signature
   and its honesty rule in one.
2. **Cobalt means YES.** The only chromatic accent is the YES colour, so generic primary actions
   are ink (newspaper black), never blue. Vermillion is NO. Direction is always also carried by
   a glyph (▲/▼, ↗/↘) or a label, never colour alone.
3. **Rules organise data; they never decorate.** Hairlines separate rows and sections; there are
   no nested cards, no glass, no gradients, no decorative dots (the only dot is the Live indicator,
   shown only while a realtime subscription is connected).
4. **Figures never move the layout.** Tabular numerals everywhere; skeletons match final layouts.

## Colour

OKLCH, light and dark each designed (dark raises surfaces, softens rules, lightens data colours).
Both follow `prefers-color-scheme` in CSS, so there is no flash on load.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `oklch(0.982 0.004 250)` | `oklch(0.172 0.012 258)` | Page ground (cool paper / ink) |
| `surface` | `0.996 0.002 250` | `0.205 0.013 258` | Panels, ticket, tables |
| `surface-2` / `-3` | `0.958` / `0.93` | `0.238` / `0.275` | Sunken areas, hover, skeletons |
| `line` / `line-strong` | `0.90` / `0.80` | `0.29` / `0.37` | Hairlines / control borders |
| `ink` / `ink-2` / `ink-3` | `0.22` / `0.42` / `0.52` | `0.945` / `0.78` / `0.66` | Text: primary / secondary / meta |
| `yes` (+`-strong`, `-soft`, `-line`, `on-yes`) | `oklch(0.50 0.16 258)` | `oklch(0.72 0.13 255)` | YES, focus ring, links in data |
| `no` (+ variants) | `oklch(0.54 0.17 42)` | `oklch(0.74 0.14 48)` | NO, falling figures |
| `danger` / `caution` | `0.50 0.19 24` / `0.52 0.12 75` | `0.72 0.15 24` / `0.80 0.11 80` | Errors / waiting states, sim clock |

Every text pair passes WCAG AA in both themes (tightest: `ink-3` on `surface-2`, 4.87:1).
Canvas/SVG charts can't read CSS variables and mirror these as hex in `PriceChart.tsx` and
`CohortProfile.tsx`.

## Type

Archivo Variable (self-hosted, weight 100–900, width 62–125%), one family for UI, data and
headlines. Chosen because its tabular figures keep punctuation proportional (`650.00`, not
`650 . 00`). Fixed rem scale, ratio ~1.2:

| Token | Size / line height | Use |
|---|---|---|
| `text-2xs`–`text-sm` | 11–13px | Meta, table headers, chips |
| `text-base` | 14px / 21.6px | Default UI text |
| `text-md`–`text-xl` | 16–21px | Body, lead sentences |
| `text-2xl`–`text-3xl` | 26–32px | Page titles (bold, −0.015em) |
| `text-4xl`–`text-6xl` | 44–72px | The sentence-figure and landing headline (−0.02 to −0.025em) |

## Space, shape, depth

Tailwind's 4px scale. Radius: 4px chips, 6px controls, 10px panels and sheets. Shadows only on
things that float (menus, popovers, the mobile sheet), tinted from the ink hue; dark mode uses a
1px ring instead of a cast shadow.

## Motion

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Enters, presses, tints |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | Mobile trade sheet |
| Durations | 120–240ms UI, 300ms sheet, 600ms change tint | |

Moving prices roll with NumberFlow and get a ≤600ms cobalt/vermillion tint. Buttons scale to
0.97 on press. Menus and selects scale in from their trigger. The ⌘K palette opens with no animation
(it's used constantly). Onboarding has one authored moment: skill bars grow in, staggered.
Typing in the ticket never animates the panel. Everything is off under `prefers-reduced-motion`.

## Components

- **Button** (`ui/button.tsx`): `primary` (ink), `yes`, `no`, `secondary`, `ghost`, `danger`;
  sizes `sm` 28px, `md` 36px, `lg` 44px, `icon`.
- **Chip** (`ui/chip.tsx`): `neutral`, `quiet`, `yes`, `no`, `caution`, `danger`.
- **Segmented** (Base UI ToggleGroup): single choice, always one selected; YES/NO fill with their
  colour when selected.
- **Tabs**, **Select**, **Menu**, **AlertDialog**, **Drawer**: Base UI primitives styled to the
  tokens.
- **Figures** (`ui/figures.tsx`): `Pct` (at most one decimal; `<0.1%` / `>99.9%` at the edges),
  `Credits` (thousands separators, two decimals), `ChangeTint`, `Delta` (points with glyph).
- **Sparkline**: drawn from data, coloured by direction, faint 50% reference.
- **States**: `Skeleton`, `EmptyState` (says what fills the space and how), `ErrorState` (names
  the problem, offers retry), `LiveIndicator`.

## Patterns

- **Market rows**: stretched-link rows (the whole row is clickable; the watch star stays a real
  button), right-aligned tabular columns, hairline between rows, columns collapse under 1024px.
- **Trade ticket**: right rail on desktop, bottom sheet on mobile; quote computed client-side on
  every keystroke; every blocked state (insider, closed, balance, price moved) replaces or
  annotates the form with the reason.
- **Rules**: the frozen rule verbatim in a sunken panel (max 72ch), then the terms as a two-column
  definition list.
- **Privacy copy**: the four consent statements are one component, used verbatim in onboarding
  and on the landing page.

Exceptions to these rules are recorded in `docs/design-exceptions.md`.
