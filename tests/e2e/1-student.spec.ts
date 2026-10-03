import { expect, test } from '@playwright/test'
import { signInWithOtp } from './helpers'

// Adds courses through the catalog search. Used when automatic parsing is unavailable (no
// ANTHROPIC_API_KEY locally) or misses something; the confirm and reveal path is the same either way.
const COURSES = ['Microprocessor Systems', 'Embedded Real-Time', 'Mechatronic System Design', 'Sensors and Actuators', 'Biomedical Instrumentation']

test('a student signs up, onboards a transcript and sees their cohorts', async ({ page }) => {
  const email = `e2e-${Date.now()}@uwaterloo.ca`
  await signInWithOtp(page, email, '/onboard')

  await expect(page.getByRole('heading', { name: 'Before you upload anything' })).toBeVisible()
  await expect(page.getByText('What we delete')).toBeVisible()
  await page.getByRole('button', { name: 'I agree, continue' }).click()

  await expect(page.getByRole('heading', { name: 'Upload your transcript' })).toBeVisible()
  await page.getByTestId('transcript-input').setInputFiles('tests/e2e/fixtures/uw-computer-engineering.pdf')
  await page.getByRole('button', { name: 'Read my transcript' }).click()

  await expect(page.getByRole('heading', { name: 'Check your courses' })).toBeVisible({ timeout: 60_000 })
  for (const title of COURSES) {
    await page.getByPlaceholder('Search by code or title').fill(title)
    // Catalog results read "CODE 123 Title"; the add-new option reads "Add …".
    await page.getByRole('button', { name: new RegExp(`^[A-Z]+ \\d+\\s*${title}`) }).first().click()
  }
  const rows = page.getByTestId('review-row')
  for (let i = 0; i < (await rows.count()); i++) {
    const term = rows.nth(i).getByLabel('Term')
    if (!(await term.inputValue())) await term.selectOption('Fall 2025')
  }
  await page.getByTestId('program-select').selectOption({ label: 'Computer Engineering' })
  await page.getByTestId('grad-year-select').selectOption('2027')
  await page.getByTestId('confirm-transcript').click()

  await expect(page.getByRole('heading', { name: 'Your skill profile' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('skill-profile')).toContainText('Embedded systems')
  await expect(page.getByTestId('my-cohorts')).toContainText('Embedded systems')
  await expect(page.getByText('You can follow their markets but not trade them')).toBeVisible()
})
