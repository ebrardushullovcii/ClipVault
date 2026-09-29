// Screenshots a landing page for review (desktop viewport, desktop full page, phone full page).
//   node shoot.mjs 01-broadcast        -> ../.out/site-shots/01-broadcast-{desktop,full,mobile}.png
import { chromium } from '../capture/node_modules/playwright-core/index.mjs'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', '.out', 'site-shots')
mkdirSync(outDir, { recursive: true })
const names = process.argv.slice(2)
if (!names.length) throw new Error('usage: node shoot.mjs <site-folder> [...]')

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  for (const name of names) {
    const url = pathToFileURL(join(here, name, 'index.html')).href
    const errors = []
    for (const [label, viewport, full] of [
      ['desktop', { width: 1440, height: 900 }, false],
      ['full', { width: 1440, height: 900 }, true],
      ['mobile', { width: 390, height: 844 }, true],
    ]) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1 })
      page.on('pageerror', e => errors.push(`${label}: ${e.message}`))
      page.on('console', m => m.type() === 'error' && errors.push(`${label}: ${m.text()}`))
      await page.goto(url, { waitUntil: 'load' })
      // Let fonts, videos and reveal-on-scroll effects settle.
      await page.evaluate(async () => {
        await document.fonts.ready
        for (let y = 0; y < document.body.scrollHeight; y += innerHeight / 2) {
          scrollTo(0, y)
          await new Promise(r => setTimeout(r, 60))
        }
        scrollTo(0, 0)
      })
      await page.waitForTimeout(900)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      if (overflow > 1) errors.push(`${label}: horizontal overflow ${overflow}px`)
      await page.screenshot({ path: join(outDir, `${name}-${label}.png`), fullPage: full })
      await page.close()
    }
    console.log(name, errors.length ? errors : 'ok')
  }
} finally {
  await browser.close()
}
