// Copies a curated set of real clips into the isolated capture library.
// Sources are only read; copies get current backend naming, recent dates,
// and ClipVault metadata (game, favorites, tags).
//   node seed-library.mjs            # seed .out/clips
//   node seed-library.mjs --stage    # copy the held-back clip to .out/staging
//   node seed-library.mjs --live     # move it into the library (F9 moment)
//   node seed-library.mjs --unlive   # move it back out
import { copyFile, mkdir, writeFile, rm, rename } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, '..', '.out')
const SOURCE = process.env.CLIPVAULT_SOURCE || 'D:\\Clips\\ClipVault'
const clipsDir = join(OUT, 'clips')

// Newest first. `ago` is hours before the capture "now" (2026-09-28 23:30 local).
export const LIBRARY = [
  { src: 'TEKKEN-8__2025-06-21__07-09-44', game: 'TEKKEN 8', ago: 21, fav: true, tags: ['combo'] },
  { src: '2026-02-26_21-01-37_League_of_Legends', game: 'League of Legends', ago: 26, tags: ['teamfight'] },
  { src: 'VALORANT__2025-12-25__21-43-54', game: 'VALORANT', ago: 44 },
  { src: 'TEKKEN-8__2025-04-02__01-59-19', game: 'TEKKEN 8', ago: 47, tags: ['ranked'] },
  { src: '2026-08-05_22-27-29_League_of_Legends', game: 'League of Legends', ago: 70, fav: true, tags: ['teamfight'] },
  { src: 'Counter-Strike-2__2025-11-03__22-03-48', game: 'Counter-Strike 2', ago: 73, tags: ['funny'] },
  { src: 'VALORANT__2025-10-16__23-07-55', game: 'VALORANT', ago: 95, fav: true, tags: ['1v3'] },
  { src: '2026-06-19_23-30-18_League_of_Legends', game: 'League of Legends', ago: 99 },
  { src: 'VALORANT__2025-10-15__19-31-40', game: 'VALORANT', ago: 105.3 },
  { src: 'TEKKEN-8__2025-01-29__19-27-45', game: 'TEKKEN 8', ago: 117.2, tags: ['combo'] },
  { src: 'League-of-Legends__2025-12-23__21-21-26', game: 'Teamfight Tactics', ago: 140.6 },
  { src: 'VALORANT__2024-12-31__01-32-36', game: 'VALORANT', ago: 163.5, tags: ['clutch'] },
  { src: '2026-02-15_21-38-30_League_of_Legends', game: 'League of Legends', ago: 188.2, tags: ['teamfight'] },
  { src: 'TEKKEN-8__2025-02-05__06-00-14', game: 'TEKKEN 8', ago: 216.7 },
  { src: 'VALORANT__2024-09-08__22-13-15', game: 'VALORANT', ago: 236.1, fav: true, tags: ['ace'] },
  { src: '2026-09-23_01-00-26_League_of_Legends', game: 'League of Legends', ago: 258.9 },
  { src: 'VALORANT__2024-09-29__18-13-02', game: 'VALORANT', ago: 284.4 },
  { src: 'League-of-Legends__2025-03-09__23-13-27', game: 'League of Legends', ago: 311.2 },
  { src: 'TEKKEN-8__2025-02-04__15-53-41', game: 'TEKKEN 8', ago: 329.8 },
  { src: 'VALORANT__2024-09-12__06-03-32', game: 'VALORANT', ago: 356.3 },
  { src: '2026-04-25_01-12-06_League_of_Legends', game: 'League of Legends', ago: 380.6 },
  { src: 'VALORANT__2024-09-09__19-37-53', game: 'VALORANT', ago: 403.9 },
  { src: 'League-of-Legends__2025-01-24__01-35-53', game: 'League of Legends', ago: 427.2 },
]
// Saved live during capture (the F9 moment); its round win at 0:47 is the trim demo.
export const LIVE = { src: 'VALORANT__2024-09-29__18-45-45', game: 'VALORANT', ago: 0 }

const NOW = new Date('2026-09-28T23:30:00')

function clipName(entry) {
  const d = new Date(NOW.getTime() - entry.ago * 3600e3 + (entry.ago ? (entry.ago * 7919) % 1800 : 0) * 1000)
  const p = n => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
  return { id: `${stamp}_${entry.game.replace(/ /g, '_')}`, date: d }
}

async function seed(entries) {
  await mkdir(join(clipsDir, 'clips-metadata'), { recursive: true })
  const times = []
  for (const entry of entries) {
    const { id, date } = clipName(entry)
    const target = join(clipsDir, `${id}.mp4`)
    if (!existsSync(target)) await copyFile(join(SOURCE, `${entry.src}.mp4`), target)
    const metadata = { game: entry.game }
    if (entry.fav) metadata.favorite = true
    if (entry.tags?.length) metadata.tags = entry.tags
    await writeFile(join(clipsDir, 'clips-metadata', `${id}.json`), JSON.stringify(metadata, null, 2))
    times.push({ path: target, iso: date.toISOString() })
    console.log(id)
  }
  setTimes(times)
}

// Library order comes from file creation time.
function setTimes(times) {
  const script = times
    .map(t => `$f = Get-Item -LiteralPath '${t.path}'; $d = [datetime]::Parse('${t.iso}').ToLocalTime(); $f.CreationTime = $d; $f.LastWriteTime = $d`)
    .join('; ')
  execFileSync('powershell', ['-NoProfile', '-Command', script], { stdio: 'inherit' })
}

const staging = join(OUT, 'staging')
const live = clipName(LIVE)
const liveVideo = join(clipsDir, `${live.id}.mp4`)
const stagedVideo = join(staging, `${live.id}.mp4`)

if (process.argv.includes('--live')) {
  // The saved-clip moment: move a finished file into place like the backend does.
  await mkdir(staging, { recursive: true })
  if (!existsSync(stagedVideo) && !existsSync(liveVideo)) {
    await copyFile(join(SOURCE, `${LIVE.src}.mp4`), stagedVideo)
  }
  await writeFile(join(clipsDir, 'clips-metadata', `${live.id}.json`), JSON.stringify({ game: LIVE.game }, null, 2))
  if (existsSync(stagedVideo)) await rename(stagedVideo, liveVideo)
  console.log('live clip added:', live.id)
} else if (process.argv.includes('--unlive')) {
  await mkdir(staging, { recursive: true })
  if (existsSync(liveVideo)) await rename(liveVideo, stagedVideo)
  await rm(join(clipsDir, 'clips-metadata', `${live.id}.json`), { force: true })
  console.log('live clip staged:', live.id)
} else if (process.argv.includes('--stage')) {
  await mkdir(staging, { recursive: true })
  if (!existsSync(stagedVideo) && !existsSync(liveVideo)) await copyFile(join(SOURCE, `${LIVE.src}.mp4`), stagedVideo)
  setTimes([{ path: stagedVideo, iso: live.date.toISOString() }])
  console.log('staged:', live.id)
} else {
  if (process.argv.includes('--clean')) await rm(clipsDir, { recursive: true, force: true })
  await seed(LIBRARY)
}
