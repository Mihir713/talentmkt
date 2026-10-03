import { expect, test } from '@playwright/test'
import { db, signInAs } from './helpers'

test('a cohort member is blocked from trading their own cohort and told why', async ({ page }) => {
  const [market] = await db<{ id: number }[]>`
    select m.id from public.markets m
      join public.snapshot_members sm on sm.snapshot_id = m.snapshot_id
      join auth.users u on u.id = sm.user_id
     where u.email = 'student@uwaterloo.ca' and m.status = 'open' and m.closes_at > now() + interval '30 days'
     limit 1`
  await signInAs(page, 'student@uwaterloo.ca')
  await page.goto(`/markets/${market!.id}`)
  const block = page.getByTestId('insider-block')
  await expect(block).toContainText('You’re in this market’s cohort')
  await expect(block).toContainText('they know their own outcomes before anyone else does')
  await expect(page.getByTestId('submit-trade')).toHaveCount(0)
})
