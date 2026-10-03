import { expect, test } from '@playwright/test'
import { db, signInAs } from './helpers'

test.afterAll(async () => {
  await db`update public.app_settings set value = 'null'::jsonb where key = 'sim_now'`
  await db.end()
})

test('an admin opens a proposed market, moves the clock, resolves it, and the payout lands', async ({ browser }) => {
  const admin = await (await browser.newContext()).newPage()
  const trader = await (await browser.newContext()).newPage()
  await signInAs(admin, 'admin@example.com')
  await signInAs(trader, 'trader@example.com')

  // A fresh, uniquely tagged proposal on a live cohort (the database validates it as usual).
  const tag = `e2e-${Date.now()}`
  const day = String(1 + (Date.now() % 28)).padStart(2, '0')
  await db`
    select public.propose_market(
      (select id from public.v_cohort_public order by id limit 1), 'grad_school',
      ${db.json({ threshold_pct: 5, deadline: `2029-11-${day}` })}, ${`Created by the admin e2e test (${tag}).`})`

  await admin.goto('/admin')
  const proposal = admin.getByTestId('market-proposal').filter({ hasText: tag })
  await proposal.getByRole('button', { name: 'Approve' }).click()
  await expect(admin.getByText('Snapshot frozen; the market is open.')).toBeVisible()
  const [market] = await db<{ id: number; question: string; resolves_at: Date }[]>`
    select m.id, m.question, m.resolves_at from public.markets m
      join public.market_proposals p on p.id = m.proposal_id
     where p.rationale like ${`%${tag}%`}`

  // A trader takes a YES position.
  await trader.goto(`/markets/${market!.id}`)
  const ticket = trader.getByRole('form', { name: 'Trade ticket' })
  await ticket.getByRole('textbox').fill('30')
  await ticket.getByTestId('submit-trade').click()
  await expect(trader.getByText(/Bought [\d.]+ YES for/)).toBeVisible()
  const [beforeRow] = await db<{ balance: string }[]>`
    select balance from public.accounts a join auth.users u on u.id = a.user_id where u.email = 'trader@example.com'`

  // Move the clock two days past the deadline, write outcomes where everyone meets the rule, resolve.
  await admin.getByRole('tab', { name: 'Simulation' }).click()
  const after = new Date(market!.resolves_at.getTime() + 2 * 86_400_000)
  const local = new Date(after.getTime() - after.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  await admin.getByTestId('sim-time').fill(local)
  await admin.getByTestId('set-sim').click()
  await expect(admin.getByText('Simulation clock set.')).toBeVisible()
  await admin.getByTestId('gen-market').selectOption(String(market!.id))
  await admin.getByLabel('True rate').fill('100')
  await admin.getByLabel('Response').fill('100')
  await admin.getByTestId('gen-outcomes').click()
  await expect(admin.getByText('Synthetic reports written.')).toBeVisible()

  await admin.getByRole('tab', { name: 'Resolution' }).click()
  const row = admin.getByTestId('due-markets').getByRole('listitem').filter({ has: admin.locator(`a[href="/markets/${market!.id}"]`) })
  await row.getByRole('button', { name: 'Resolve' }).click()
  await expect(admin.getByText('Market resolved and paid out.')).toBeVisible()

  // The payout shows up in the trader's portfolio.
  await trader.goto('/portfolio')
  const settled = trader.getByRole('region', { name: 'Settled' })
  await expect(settled.getByRole('listitem').filter({ has: trader.locator(`a[href="/markets/${market!.id}"]`) })).toContainText('Resolved YES')
  const [afterRow] = await db<{ balance: string }[]>`
    select balance from public.accounts a join auth.users u on u.id = a.user_id where u.email = 'trader@example.com'`
  expect(Number(afterRow!.balance)).toBeGreaterThan(Number(beforeRow!.balance))
})
