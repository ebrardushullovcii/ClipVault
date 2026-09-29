// One capture session: start the driver, run steps, always shut it down.
//   node session.mjs shots wide,compact            # full shot list
//   node session.mjs shots compact 08,17           # selected steps
//   node session.mjs wizard wide,compact           # first-run wizard
import { spawn, execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const [mod = 'shots', layouts = 'wide,compact', only = ''] = process.argv.slice(2)
const PORT = 7788

const env = { ...process.env, DRIVER_PORT: String(PORT) }
if (mod === 'wizard') env.FIRST_RUN = '1'
const driver = spawn(process.execPath, [join(here, 'driver.mjs')], { env, stdio: ['ignore', 'pipe', 'inherit'] })
await new Promise((resolve, reject) => {
  driver.stdout.on('data', d => {
    process.stdout.write(d)
    if (String(d).includes('Driver listening')) resolve()
  })
  driver.on('exit', code => reject(new Error('driver exited ' + code)))
})

const post = body =>
  fetch(`http://127.0.0.1:${PORT}/eval`, { method: 'POST', body }).then(r => r.json())

let failed = false
try {
  const url = pathToFileURL(join(here, `${mod}.mjs`)).href
  for (const layout of layouts.split(',')) {
    const steps = only ? JSON.stringify(only.split(',')) : 'null'
    const res = await post(`return (await import('${url}?' + Date.now())).run(ctx, '${layout}', ${steps})`)
    console.log(layout, JSON.stringify(res))
    if (!res.ok) failed = true
  }
} finally {
  await post("/*QUIT*/ return 'bye'").catch(() => {})
  await new Promise(r => setTimeout(r, 3000))
  if (driver.exitCode === null) driver.kill()
  // Report anything still running from the isolated app copy (never kill by image name).
  const left = execFileSync('powershell', ['-NoProfile', '-Command',
    "(Get-Process | Where-Object { $_.Path -like '*marketing*.out*' }).Id"], { encoding: 'utf-8' }).trim()
  console.log(left ? `Leftover PIDs: ${left}` : 'Session closed, no leftover processes.')
}
process.exit(failed ? 1 : 0)
