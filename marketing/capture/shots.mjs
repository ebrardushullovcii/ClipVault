// Screenshot sequence for one layout. Run through the driver:
//   curl --data-binary "return (await import('file:///.../shots.mjs?' + Date.now())).run(ctx, 'wide')" ...
// Writes .out/shots/<layout>/<name>.png plus rects.json (CSS px) for pointer and spotlight targets.
import { execFileSync } from 'node:child_process'
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const seed = (...args) => execFileSync(process.execPath, [join(here, 'seed-library.mjs'), ...args], { encoding: 'utf-8' })

// The clip saved live in step 03 is also the one edited in steps 09-15.
export const LIVE_CLIP = '2026-09-28_23-30-00_VALORANT'
export const HERO_CLIP = LIVE_CLIP

export async function run(ctx, layout, only = null) {
  const { page: p, sleep } = ctx
  const rectsPath = join(ctx.OUT, 'shots', layout, 'rects.json')
  const rects = existsSync(rectsPath) ? JSON.parse(readFileSync(rectsPath, 'utf-8')) : {}
  const done = []
  const want = name => !only || only.some(o => name.startsWith(o))

  const box = async locator => {
    const b = await locator.first().boundingBox({ timeout: 5000 })
    return b && { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }
  }
  const snap = async (name, targets = {}) => {
    await ctx.shot(name, { layout })
    const r = {}
    for (const [k, loc] of Object.entries(targets)) r[k] = typeof loc === 'function' ? await loc() : await box(loc).catch(() => null)
    rects[name] = r
    done.push(name)
    writeFileSync(rectsPath, JSON.stringify(rects, null, 2))
  }
  const card = name => p.locator('.card', { has: p.locator('h3', { hasText: name }) })
  const parkMouse = () => p.mouse.move(layout === 'wide' ? 760 : 610, 44)
  const waitThumbs = () =>
    p.waitForFunction(
      () => {
        const cards = [...document.querySelectorAll('.card')].filter(c => {
          const r = c.getBoundingClientRect()
          return r.height > 0 && r.top < innerHeight && r.bottom > 0
        })
        return cards.length > 0 && cards.every(c => {
          const i = c.querySelector('img')
          return i && i.complete && i.naturalWidth > 0
        })
      },
      null,
      { timeout: 20000 }
    )
  const waitVideoFrame = async () => {
    await p.waitForFunction(() => {
      const v = document.querySelector('video')
      return v && v.readyState >= 2 && !v.seeking
    }, null, { timeout: 20000 })
    await sleep(700)
  }
  const seekTo = async t => {
    await p.locator('video').first().evaluate(
      (v, t) => new Promise(res => {
        v.pause()
        v.addEventListener('seeked', () => res(), { once: true })
        v.currentTime = t
      }),
      t
    )
    await sleep(600)
  }

  // Reset: close export previews, fresh metadata, live clip out, library view reloaded.
  for (const w of ctx.app.windows()) if (w !== p) await w.close().catch(() => {})
  seed()
  seed('--unlive')
  await ctx.setLayout(layout)
  await p.reload()
  // Library filters persist between sessions; start from an unfiltered view.
  await p.locator('input[placeholder="Search clips..."]').fill('')
  await p.locator('select').nth(1).selectOption('')
  await p.locator('select').nth(2).selectOption('')
  await p.evaluate(() => document.activeElement?.blur())
  await p.waitForSelector('.card', { timeout: 30000 })
  await waitThumbs()
  await parkMouse()
  await sleep(1500)

  const headerTargets = {
    search: p.locator('input[placeholder="Search clips..."]'),
    favorites: p.getByRole('button', { name: 'Favorites', exact: true }),
    gameFilter: p.locator('select').nth(2),
    tagFilter: p.locator('select').nth(1),
    listToggle: p.locator('button:has(svg[class*="lucide-list"])'),
    gridToggle: p.locator('button:has(svg[class*="lucide-grid"])'),
    settings: p.locator('button[aria-label="Settings"]'),
    openFolder: p.getByRole('button', { name: 'Open Folder' }),
    card0: p.locator('.card').nth(0),
    card1: p.locator('.card').nth(1),
    card2: p.locator('.card').nth(2),
    card3: p.locator('.card').nth(3),
    card4: p.locator('.card').nth(4),
    card5: p.locator('.card').nth(5),
  }

  if (want('01')) await snap('01-library', headerTargets)

  if (want('03')) {
    seed('--live')
    await p.waitForSelector(`.card:has(h3:text("${LIVE_CLIP}")) img`, { timeout: 30000 })
    await waitThumbs()
    await sleep(1500)
    await snap('03-library-new-clip', { newCard: card(LIVE_CLIP), card1: p.locator('.card').nth(1) })
  }

  // Hover preview after the new clip arrived, so the library matches the following scenes.
  if (want('02')) {
    const target = p.locator('.card').nth(2)
    const b = await target.boundingBox()
    await p.mouse.move(b.x + b.width * 0.55, b.y + b.height * 0.25)
    await p.waitForFunction(() => {
      const v = document.querySelector('.card video')
      return v && v.readyState >= 3 && v.currentTime > 1.2
    }, null, { timeout: 20000 })
    await sleep(400)
    await snap('02-library-hover', { card: target })
    await parkMouse()
    await sleep(500)
  }

  if (want('04')) {
    await p.locator('select').nth(2).selectOption('VALORANT')
    await sleep(800)
    await p.evaluate(() => document.activeElement?.blur())
    await waitThumbs()
    await snap('04-library-filter-game', { gameFilter: p.locator('select').nth(2), card0: p.locator('.card').nth(0) })
    await p.locator('select').nth(2).selectOption('')
    await sleep(500)
  }

  if (want('05')) {
    await p.getByRole('button', { name: 'Favorites', exact: true }).click()
    await sleep(800)
    await p.evaluate(() => document.activeElement?.blur())
    await waitThumbs()
    await snap('05-library-favorites', { favorites: p.getByRole('button', { name: 'Favorites', exact: true }) })
    await p.getByRole('button', { name: 'All', exact: true }).click()
    await sleep(500)
  }

  if (want('06')) {
    await p.locator('input[placeholder="Search clips..."]').fill('tekken')
    await sleep(900)
    await waitThumbs()
    await snap('06-library-search', { search: p.locator('input[placeholder="Search clips..."]') })
    await p.locator('input[placeholder="Search clips..."]').fill('')
    await sleep(500)
  }

  if (want('07')) {
    await p.locator('button:has(svg[class*="lucide-list"])').first().click()
    await sleep(1000)
    await p.evaluate(() => document.activeElement?.blur())
    await waitThumbs()
    await snap('07-library-list', { listToggle: p.locator('button:has(svg[class*="lucide-list"])') })
    await p.locator('button:has(svg[class*="lucide-grid"])').first().click()
    await sleep(800)
    await waitThumbs()
  }

  if (want('08')) {
    for (const i of [0, 2, 5]) {
      const c = p.locator('.card').nth(i)
      await c.hover()
      await sleep(250)
      await c.locator('button[aria-label="Select clip"]').click()
      await sleep(250)
    }
    await parkMouse()
    await p.evaluate(() => document.querySelectorAll('.overflow-y-auto, .overflow-auto').forEach(e => (e.scrollTop = 0)))
    await sleep(800)
    await snap('08-library-selected', {
      c0: p.locator('.card').nth(0),
      c2: p.locator('.card').nth(2),
      c5: p.locator('.card').nth(5),
      bulkBar: async () =>
        p.evaluate(() => {
          const el = [...document.querySelectorAll('div')].find(d => /selected/i.test(d.textContent || '') && d.children.length > 2 && d.getBoundingClientRect().height < 140)
          if (!el) return null
          const r = el.getBoundingClientRect()
          return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
        }),
    })
    await p.keyboard.press('Escape')
    await sleep(300)
    for (const i of [0, 2, 5]) {
      const btn = p.locator('.card').nth(i).locator('button[aria-label="Deselect clip"]')
      if (await btn.count()) await btn.click()
    }
    await sleep(400)
  }

  // Editor on the newest saved clip.
  const editorTargets = () => ({
    video: p.locator('video').first(),
    startMarker: p.locator('div.cursor-ew-resize.bg-accent-primary').nth(0),
    endMarker: p.locator('div.cursor-ew-resize.bg-accent-primary').nth(1),
    timeline: async () => p.locator('div.cursor-ew-resize.bg-white').first().evaluate(e => {
      const r = e.parentElement.getBoundingClientRect()
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    }),
    desktopAudio: p.locator('input[type=checkbox]').nth(0),
    mic: p.locator('input[type=checkbox]').nth(1),
    desktopVolume: p.locator('input[type=range]').nth(0),
    micVolume: p.locator('input[type=range]').nth(1),
    exportButton: p.locator('button', { hasText: /Export/ }).first(),
    sizeMenu: p.locator('button[title="Select export size target"]'),
    trimOriginal: p.getByRole('button', { name: /Trim Original/ }),
    gameChip: p.locator('button[title^="Game:"]'),
    tagInput: p.locator('input[placeholder="+ tag"]'),
    favorite: p.locator('button[title*="favorites"]'),
    play: p.locator('button:has(svg[class*="lucide-play"]), button:has(svg[class*="lucide-pause"])'),
    back: p.locator('button[title="Back to library"], button[aria-label="Back to library"]'),
    next: p.locator('button[title^="Next clip"]'),
  })

  const needs = re => !only || only.some(o => re.test(o))
  if (needs(/^(09|1\d)/)) {
    if (!(await card(HERO_CLIP).count())) {
      seed('--live')
      await p.waitForSelector(`.card:has(h3:text("${HERO_CLIP}")) img`, { timeout: 30000 })
    }
    await parkMouse()
    await card(HERO_CLIP).click()
    await waitVideoFrame()
    await seekTo(0)
  }

  if (want('09')) await snap('09-editor', editorTargets())

  if (want('09b')) {
    await p.locator('input[placeholder="+ tag"]').click()
    await p.keyboard.type('clutch', { delay: 40 })
    await p.keyboard.press('Enter')
    await sleep(300)
    await p.locator('button[title*="favorites"]').click()
    await parkMouse()
    await sleep(600)
    await snap('09b-editor-tagged', editorTargets())
  }

  if (want('10')) {
    const dur = await p.locator('video').first().evaluate(v => v.duration)
    const track = await p.locator('div.cursor-ew-resize.bg-white').first().evaluate(e => {
      const r = e.parentElement.getBoundingClientRect()
      return { x: r.x, w: r.width }
    })
    const drag = async (i, seconds) => {
      const b = await p.locator('div.cursor-ew-resize.bg-accent-primary').nth(i).boundingBox()
      const x1 = b.x + b.width / 2
      const y = b.y + b.height * 0.25
      const x2 = track.x + (track.w * seconds) / dur
      await p.mouse.move(x1, y)
      await p.mouse.down()
      for (let k = 1; k <= 15; k++) {
        await p.mouse.move(x1 + ((x2 - x1) * k) / 15, y)
        await sleep(25)
      }
      await p.mouse.up()
      await sleep(300)
    }
    await drag(0, 38.4)
    await drag(1, 64.2)
    await parkMouse()
    await seekTo(47.5)
    await snap('10-editor-trimmed', editorTargets())
  }

  if (want('11')) {
    await p.locator('input[type=checkbox]').nth(1).click()
    const r = await p.locator('input[type=range]').nth(0).boundingBox()
    await p.mouse.click(r.x + r.width * 0.9, r.y + r.height / 2)
    await parkMouse()
    await sleep(700)
    await snap('11-editor-audio', editorTargets())
  }

  if (want('12')) {
    await p.locator('button[title="Select export size target"]').click()
    await sleep(600)
    await snap('12-editor-size-menu', {
      ...editorTargets(),
      option10: p.getByRole('button', { name: /Up to 10 MB/ }),
      option50: p.getByRole('button', { name: /Up to 50 MB/ }),
    })
    await p.getByRole('button', { name: /Up to 10 MB/ }).click()
    await sleep(400)
  }

  if (want('13')) {
    const windowsBefore = ctx.app.windows().length
    // Hold the export call so the in-progress state can be captured, then run the real export.
    await ctx.app.evaluate(({ ipcMain }) => {
      const channel = 'editor:exportClip'
      const original = ipcMain._invokeHandlers.get(channel)
      ipcMain.removeHandler(channel)
      ipcMain.handle(channel, async (event, params) => {
        await new Promise(resolve => (globalThis.__releaseExport = resolve))
        ipcMain.removeHandler(channel)
        ipcMain._invokeHandlers.set(channel, original)
        return original(event, params)
      })
    })
    await p.locator('button', { hasText: /^\s*Export/ }).first().click()
    await p.waitForFunction(() => /Exporting\.\.\./.test(document.body.innerText), null, { timeout: 15000 })
    await sleep(600)
    await snap('13-editor-exporting', editorTargets())
    await ctx.app.evaluate(() => globalThis.__releaseExport())
    const preview = await ctx.app.waitForEvent('window', { timeout: 120000 }).catch(() => null)
    await sleep(1200)
    await snap('13b-editor-exported', editorTargets())
    if (preview && ctx.app.windows().length > windowsBefore) {
      const cdp = await preview.context().newCDPSession(preview)
      const size = await ctx.app.evaluate(({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows().find(w => w.getTitle() !== 'ClipVault Editor' && w.isVisible())
        const [width, height] = w.getContentSize()
        return { width, height }
      })
      await cdp.send('Emulation.setDeviceMetricsOverride', { ...size, deviceScaleFactor: 2, mobile: false })
      await preview.waitForFunction(() => {
        const v = document.querySelector('video')
        if (v && !v.paused) v.pause()
        return v && v.readyState >= 2
      }, null, { timeout: 20000 })
      await preview.evaluate(() => new Promise(res => {
        const v = document.querySelector('video')
        v.addEventListener('seeked', res, { once: true })
        v.currentTime = 6.5
      }))
      await sleep(600)
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
      const { mkdirSync } = await import('node:fs')
      mkdirSync(join(ctx.OUT, 'shots', layout), { recursive: true })
      writeFileSync(join(ctx.OUT, 'shots', layout, '14-export-complete.png'), Buffer.from(data, 'base64'))
      rects['14-export-complete'] = { size }
      done.push('14-export-complete')
      await preview.close().catch(() => {})
    }
  }

  if (want('15')) {
    await p.locator('button[title^="Game:"]').click()
    await sleep(800)
    await snap('15-editor-game-picker', {
      dialog: async () =>
        p.evaluate(() => {
          const el = [...document.querySelectorAll('input')].find(i => /game/i.test(i.placeholder))
          const d = el?.closest('[class*="fixed"], [role=dialog]') || el?.parentElement?.parentElement
          if (!d) return null
          const r = d.getBoundingClientRect()
          return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
        }),
    })
    await p.keyboard.press('Escape')
    await sleep(500)
  }

  if (want('16')) {
    await p.locator('button[title^="Next clip"]').click()
    await waitVideoFrame()
    await seekTo(21.0)
    await snap('16-editor-tekken', editorTargets())
  }

  if (want('17')) {
    await p.locator('button[title^="Next clip"]').click()
    await waitVideoFrame()
    await seekTo(0.6)
    await snap('17-editor-league', editorTargets())
  }

  // Settings (never saved: saving restarts the capture service).
  if (needs(/^(18|19|2\d)/)) {
    const back = p.locator('button[title="Back to library"], button[aria-label="Back to library"]')
    if (await back.count()) await back.click()
    await sleep(600)
    await p.locator('button[aria-label="Settings"]').click()
    await sleep(1500)
  }
  const scrollToSection = async title => {
    await p.evaluate(title => {
      const h = [...document.querySelectorAll('h2')].find(h => h.textContent.trim() === title)
      const scroller = h.closest('.overflow-y-auto')
      scroller.scrollTop += h.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 28
    }, title)
    await sleep(500)
  }
  const section = title => async () =>
    p.evaluate(title => {
      const h = [...document.querySelectorAll('h2')].find(h => h.textContent.trim() === title)
      const r = h.parentElement.getBoundingClientRect()
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    }, title)

  if (want('18')) {
    await scrollToSection('Video & Capture')
    await snap('18-settings-capture', { recordSelect: p.locator('select:has(option[value="hybrid"])'), section: section('Video & Capture') })
  }
  if (want('19')) {
    await p.locator('select:has(option[value="hybrid"])').selectOption('game')
    await sleep(700)
    await snap('19-settings-games', { recordSelect: p.locator('select:has(option[value="hybrid"])') })
    await p.locator('select:has(option[value="hybrid"])').selectOption('monitor')
    await sleep(400)
  }
  if (want('20')) {
    await p.evaluate(() => {
      const h = [...document.querySelectorAll('div,label,h3')].find(e => e.textContent.trim() === 'Quality Preset')
      const scroller = h.closest('.overflow-y-auto')
      scroller.scrollTop += h.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 28
    })
    await sleep(500)
    await snap('20-settings-quality', {})
  }
  if (want('21')) {
    await scrollToSection('Audio')
    await snap('21-settings-audio', { section: section('Audio') })
  }
  if (want('22')) {
    await scrollToSection('Hotkey')
    await snap('22-settings-hotkey', { section: section('Hotkey') })
  }
  if (want('23')) {
    await scrollToSection('Startup & Behavior')
    await snap('23-settings-startup', { section: section('Startup & Behavior') })
  }
  if (needs(/^(18|19|2\d)/)) {
    await p.getByRole('button', { name: 'Close', exact: true }).click()
    await sleep(800)
  }

  seed('--unlive')
  seed()
  return done
}
