import { expect, test } from '@playwright/test'
import { db, signInAs } from './helpers'

test('a trader buys YES, sees the position update live, then sells', async ({ page }) => {
  const [market] = await db<{ id: number }[]>`
    select id from public.v_market_cards where status = 'open' and closes_in_seconds > 86400 * 30 order by volume_24h desc limit 1`
  await signInAs(page, 'trader@example.com')
  await page.goto(`/markets/${market!.id}`)

  const ticket = page.getByRole('form', { name: 'Trade ticket' })
  await ticket.getByRole('button', { name: /^YES/ }).click()
  await ticket.getByRole('textbox').fill('25')
  await expect(ticket.getByTestId('submit-trade')).toHaveText(/Buy YES for 2\d\.\d\d/)
  await ticket.getByTestId('submit-trade').click()
  await expect(page.getByText(/Bought [\d.]+ YES for/)).toBeVisible()

  const position = page.getByRole('region', { name: 'Your position' }).first()
  await expect(position).toContainText('YES shares')

  await ticket.getByRole('tab', { name: 'Sell' }).click()
  await ticket.getByRole('button', { name: 'Max' }).click()
  await ticket.getByTestId('submit-trade').click()
  await expect(page.getByText(/Sold [\d.]+ YES for/)).toBeVisible()
})
