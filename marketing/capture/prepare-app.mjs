// Builds an isolated copy of the packaged app for marketing captures.
// - Electron runtime comes from ui/release/win-unpacked (run `npm run package:portable` first).
// - app.asar is repacked from the current ui/dist build.
// - resources/bin gets FFmpeg plus a stub ClipVault.exe that never records.
import { cpSync, existsSync, linkSync, mkdirSync, rmSync, readdirSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..')
const unpacked = join(repo, 'ui', 'release', 'win-unpacked')
const out = join(repo, 'marketing', '.out', 'app')
const require = createRequire(join(repo, 'ui', 'package.json'))
const asar = require('@electron/asar')

if (!existsSync(join(unpacked, 'ClipVault.exe'))) {
  throw new Error(`Packaged app not found at ${unpacked}`)
}

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

// Electron runtime files, minus resources (rebuilt below).
for (const entry of readdirSync(unpacked)) {
  if (entry === 'resources') continue
  cpSync(join(unpacked, entry), join(out, entry), { recursive: true })
}

const resources = join(out, 'resources')
const bin = join(resources, 'bin')
mkdirSync(bin, { recursive: true })
for (const file of ['64x64.png', 'icon.ico', 'tray.ico']) {
  copyFileSync(join(unpacked, 'resources', file), join(resources, file))
}
for (const exe of ['ffmpeg.exe', 'ffprobe.exe']) {
  linkSync(join(unpacked, 'resources', 'bin', exe), join(bin, exe))
}
cpSync(join(unpacked, 'resources', 'bin', 'config'), join(bin, 'config'), { recursive: true })
copyFileSync(join(here, 'fake-backend', 'ClipVault.exe'), join(bin, 'ClipVault.exe'))

// Repack app.asar with the fresh renderer/main build.
const staging = join(repo, 'marketing', '.out', 'asar-staging')
rmSync(staging, { recursive: true, force: true })
asar.extractAll(join(unpacked, 'resources', 'app.asar'), staging)
rmSync(join(staging, 'dist'), { recursive: true, force: true })
cpSync(join(repo, 'ui', 'dist'), join(staging, 'dist'), { recursive: true })
await asar.createPackage(staging, join(resources, 'app.asar'))
rmSync(staging, { recursive: true, force: true })

console.log('Isolated app ready:', out)
