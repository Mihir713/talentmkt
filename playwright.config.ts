import { defineConfig, devices } from '@playwright/test'

// E2E runs against the seeded local stack (npx supabase start && npm run seed) and the Vite dev
// server. Tests share one database, so they run serially in file order; the admin test moves the
// simulation clock and resets it afterwards.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
