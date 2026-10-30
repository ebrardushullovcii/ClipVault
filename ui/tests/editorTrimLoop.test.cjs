// Run: node --test ui/tests/editorTrimLoop.test.cjs
// Requires installed UI dependencies and bin/ffmpeg.exe (or CLIPVAULT_FFMPEG).
// CLIPVAULT_ELECTRON can point to an existing Electron executable.
// Runs the real Editor in a separate Electron profile, with generated video and
// in-memory IPC. Never starts the capture backend or reads/writes user clips.
/* global __dirname, __filename, process, console, Response, setTimeout, clearTimeout */
const path = require('node:path')
const fs = require('node:fs/promises')
const os = require('node:os')

if (process.versions.electron) {
  const { app, BrowserWindow, protocol } = require('electron')
  const scratch = process.argv[2]
  app.disableHardwareAcceleration()
  app.setPath('userData', path.join(scratch, 'profile'))
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'clipvault',
      privileges: {
        standard: true,
        secure: true,
        stream: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ])
  app
    .whenReady()
    .then(async () => {
      const fixture = await fs.readFile(path.join(scratch, 'fixture.mp4'))
      protocol.handle('clipvault', request => {
        const range = /bytes=(\d+)-(\d*)/.exec(request.headers.get('Range') || '')
        const start = range ? Number(range[1]) : 0
        const end = range && range[2] ? Number(range[2]) : fixture.length - 1
        const headers = {
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes',
          'Content-Length': String(end - start + 1),
        }
        if (range) headers['Content-Range'] = `bytes ${start}-${end}/${fixture.length}`
        return new Response(fixture.subarray(start, end + 1), {
          status: range ? 206 : 200,
          headers,
        })
      })
      const window = new BrowserWindow({
        show: false,
        width: 1200,
        height: 900,
        webPreferences: { backgroundThrottling: false },
      })
      window.setIgnoreMouseEvents(true)
      window.showInactive()
      window.webContents.on('console-message', details => {
        if (details.level === 'error') console.error(details.message)
      })
      try {
        await window.loadFile(path.join(scratch, 'index.html'))
        const results = await window.webContents.executeJavaScript('window.trimLoopResults')
        for (const result of results) console.log(JSON.stringify(result))
        app.exit(results.some(result => result.error) ? 1 : 0)
      } catch (error) {
        console.error(error)
        app.exit(1)
      }
    })
    .catch(error => {
      console.error(error)
      app.exit(1)
    })
} else {
  const { test } = require('node:test')
  const assert = require('node:assert/strict')
  const { spawn, execFileSync } = require('node:child_process')
  const { createRequire } = require('node:module')
  const uiRequire = createRequire(path.resolve(__dirname, '../package.json'))

  test(
    'actual Editor loops at selected boundaries, including native EOF',
    { timeout: 90000 },
    async () => {
      const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'clipvault-trim-loop-'))
      try {
        execFileSync(
          process.env.CLIPVAULT_FFMPEG || path.resolve(__dirname, '../../bin/ffmpeg.exe'),
          [
            '-hide_banner',
            '-loglevel',
            'error',
            '-f',
            'lavfi',
            '-i',
            'testsrc2=size=320x180:rate=30:duration=4',
            '-c:v',
            'libx264',
            '-preset',
            'ultrafast',
            '-pix_fmt',
            'yuv420p',
            '-an',
            path.join(scratch, 'fixture.mp4'),
          ],
          { timeout: 15000, windowsHide: true }
        )
        await uiRequire('esbuild').build({
          entryPoints: [path.join(__dirname, 'editorTrimLoop.renderer.jsx')],
          outfile: path.join(scratch, 'renderer.js'),
          bundle: true,
          platform: 'browser',
          jsx: 'automatic',
          define: {
            'process.env.NODE_ENV': '"production"',
            'process.env.CLIPVAULT_TRIM_CASE': JSON.stringify(
              process.env.CLIPVAULT_TRIM_CASE || ''
            ),
          },
        })
        await fs.writeFile(
          path.join(scratch, 'index.html'),
          `<!doctype html>
        <html><body><div id="root"></div><script src="./renderer.js"></script></body></html>`
        )
        const result = await new Promise((resolve, reject) => {
          const env = { ...process.env }
          delete env.ELECTRON_RUN_AS_NODE
          // Resolve the installed binary directly: requiring electron can invoke
          // its auto-installer when the runtime is absent.
          const electronDir = path.dirname(uiRequire.resolve('electron/package.json'))
          const electronPath =
            process.env.CLIPVAULT_ELECTRON ||
            path.join(
              electronDir,
              'dist',
              process.platform === 'win32'
                ? 'electron.exe'
                : process.platform === 'darwin'
                  ? 'Electron.app/Contents/MacOS/Electron'
                  : 'electron'
            )
          const child = spawn(electronPath, [__filename, scratch], { env, windowsHide: true })
          let stdout = ''
          let stderr = ''
          child.stdout.on('data', data => {
            stdout += data
          })
          child.stderr.on('data', data => {
            stderr += data
          })
          const timer = setTimeout(() => {
            child.kill()
            reject(new Error('Electron playback test timed out'))
          }, 75000)
          child.on('error', error => {
            clearTimeout(timer)
            reject(error)
          })
          child.on('exit', code => {
            clearTimeout(timer)
            resolve({ code, stdout, stderr })
          })
        })
        console.log(result.stdout.trim())
        assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`)
      } finally {
        // scratch is an absolute mkdtemp path, never a user-supplied directory.
        await fs.rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
      }
    }
  )
}
