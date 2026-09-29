// Launches the isolated ClipVault copy with Playwright and keeps it open.
// POST JavaScript to http://127.0.0.1:7788/eval; it runs as an async function
// body with `ctx` in scope (page, app, cdp, shot, setLayout, sleep, OUT).
//
//   node driver.mjs            # launch + serve
//   curl -s --data-binary @step.js http://127.0.0.1:7788/eval
import { _electron as electron } from 'playwright-core'
import { createServer } from 'node:http'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as fs from 'node:fs'
import * as path from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, '..', '.out')
const appExe = join(OUT, 'app', 'ClipVault.exe')
const profile = join(OUT, 'profile')
const appData = join(profile, 'appdata')
const userData = join(profile, 'userdata')
const clipsDir = join(OUT, 'clips')
const PORT = Number(process.env.DRIVER_PORT || 7788)

if (!existsSync(appExe)) throw new Error('Run prepare-app.mjs first')

mkdirSync(join(appData, 'ClipVault'), { recursive: true })
mkdirSync(userData, { recursive: true })
mkdirSync(clipsDir, { recursive: true })

const settingsPath = join(appData, 'ClipVault', 'settings.json')
const baseSettings = JSON.parse(
  readFileSync(join(OUT, 'app', 'resources', 'bin', 'config', 'settings.json'), 'utf-8')
)
const settings = {
  ...baseSettings,
  output_path: clipsDir,
  ui: {
    ...(baseSettings.ui || {}),
    first_run_completed: process.env.FIRST_RUN ? false : true,
    start_with_windows: false,
    show_notifications: false,
    play_sound: false,
    library_hover_preview: true,
  },
}
writeFileSync(settingsPath, JSON.stringify(settings, null, 2))

const app = await electron.launch({
  executablePath: appExe,
  args: [`--user-data-dir=${userData}`],
  env: { ...process.env, APPDATA: appData, CLIPVAULT_FAKE_GAME: 'Velocity Shift' },
  timeout: 60000,
})

// Guard: abort if the app is not using the isolated profile.
const paths = await app.evaluate(({ app }) => ({
  userData: app.getPath('userData'),
  appDataEnv: process.env.APPDATA,
}))
if (paths.userData !== userData || paths.appDataEnv !== appData) {
  await app.close().catch(() => {})
  throw new Error('Isolation check failed: ' + JSON.stringify(paths))
}
console.log('Isolated profile OK', paths)

const page = await app.firstWindow()
await page.waitForLoadState('domcontentloaded')
const cdp = await page.context().newCDPSession(page)

const layouts = {
  wide: { width: 1600, height: 1000 },
  compact: { width: 1280, height: 800 },
}
let currentLayout = 'wide'

async function setLayout(name) {
  const size = layouts[name]
  if (!size) throw new Error('Unknown layout ' + name)
  currentLayout = name
  await app.evaluate(
    ({ BrowserWindow }, s) => {
      const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && w.isVisible())
      if (win.isMaximized()) win.unmaximize()
      win.setContentSize(s.width, s.height)
      win.center()
    },
    size
  )
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: size.width,
    height: size.height,
    deviceScaleFactor: 2,
    mobile: false,
  })
  await sleep(400)
}

async function shot(name, opts = {}) {
  const dir = join(OUT, 'shots', opts.layout || currentLayout)
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${name}.png`)
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  writeFileSync(file, Buffer.from(data, 'base64'))
  return file
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
await setLayout('wide')

const ctx = { page, app, cdp, shot, setLayout, sleep, OUT, clipsDir, userData, fs, path, layouts }
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

// Backstop: never leave a capture instance running if the session is forgotten.
const IDLE_MS = Number(process.env.DRIVER_IDLE_MS || 10 * 60 * 1000)
let idleTimer = null
const armIdle = () => {
  clearTimeout(idleTimer)
  idleTimer = setTimeout(async () => {
    console.log('Idle timeout, closing app')
    await app.close().catch(() => {})
    process.exit(0)
  }, IDLE_MS)
}
armIdle()

const server = createServer(async (req, res) => {
  armIdle()
  if (req.method !== 'POST' || req.url !== '/eval') {
    res.writeHead(404).end()
    return
  }
  let body = ''
  for await (const chunk of req) body += chunk
  try {
    const result = await new AsyncFunction('ctx', body)(ctx)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, result }, null, 2))
  } catch (error) {
    res.writeHead(500, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: String(error?.stack || error) }))
  }
  if (body.includes('/*QUIT*/')) {
    await app.close().catch(() => {})
    server.close()
    process.exit(0)
  }
})
server.listen(PORT, '127.0.0.1', () => console.log(`Driver listening on ${PORT}`))

app.on('close', () => {
  console.log('App closed')
  process.exit(0)
})
