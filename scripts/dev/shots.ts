// Screenshot routes at 1440 and 390, light and dark: npx tsx scripts/dev/shots.ts --routes /markets/5,/ [--as email] [--out dir] [--full]
import { mkdirSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { localStack, sessionFor, storageKeyFor } from '../lib/session'

const args = new Map<string, string>()
process.argv.slice(2).forEach((a, i, all) => {
  if (a.startsWith('--')) args.set(a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] == null ? 'true' : all[i + 1]!)
})
const routes = (args.get('routes') ?? '/').split(',')
const out = args.get('out') ?? '.impeccable/review'
const base = args.get('base') ?? 'http://localhost:5173'
const full = args.get('full') === 'true'
const widths = (args.get('widths') ?? '1440,390').split(',').map(Number)
const schemes = (args.get('schemes') ?? 'light,dark').split(',') as ('light' | 'dark')[]
const wait = Number(args.get('wait') ?? 2500)
mkdirSync(out, { recursive: true })

const as = args.get('as')
const session = as ? await sessionFor(as) : null
const browser = await chromium.launch()
for (const scheme of schemes) {
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: width < 600 ? 844 : 900 },
      deviceScaleFactor: width < 600 ? 2 : 1,
      colorScheme: scheme,
      reducedMotion: 'reduce',
    })
    if (session) {
      const key = storageKeyFor(localStack().API_URL)
      await context.addInitScript(([k, v]) => window.localStorage.setItem(k!, v!), [key, JSON.stringify(session)])
    }
    const page = await context.newPage()
    for (const route of routes) {
      await page.goto(base + route, { waitUntil: 'networkidle' }).catch(() => {})
      await page.waitForTimeout(wait)
      const name = `${route === '/' ? 'home' : route.replace(/^\//, '').replace(/[/?=&]/g, '_')}-${width}-${scheme}.png`
      await page.screenshot({ path: `${out}/${name}`, fullPage: full })
      console.log(`${out}/${name}`)
    }
    await context.close()
  }
}
await browser.close()
