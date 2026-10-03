import type { Page } from '@playwright/test'
import { connect } from '../../scripts/lib/db'
import { localStack, sessionFor, storageKeyFor } from '../../scripts/lib/session'

export const db = connect({ max: 2 })

/** Signs in through the real UI: email, then the 6-digit code read from Mailpit. */
export async function signInWithOtp(page: Page, email: string, next = '/markets') {
  await page.goto(`/signin?next=${encodeURIComponent(next)}`)
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await page.getByRole('heading', { name: 'Enter your code' }).waitFor()
  const code = await latestCode(email)
  await page.getByLabel('6-digit code').fill(code)
}

async function latestCode(email: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)
    const body = (await res.json()) as { messages: { ID: string }[] }
    if (body.messages?.length) {
      const msg = (await (await fetch(`http://127.0.0.1:54324/api/v1/message/${body.messages[0]!.ID}`)).json()) as { Text: string; HTML: string }
      const match = (msg.Text || msg.HTML).match(/\b(\d{6})\b/)
      if (match) return match[1]!
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`No sign-in code arrived for ${email}`)
}

/** Faster sign-in for tests that aren't about auth: inject a real session for a seeded user. */
export async function signInAs(page: Page, email: string) {
  const session = await sessionFor(email)
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k!, v!), [storageKeyFor(localStack().API_URL), JSON.stringify(session)])
}
