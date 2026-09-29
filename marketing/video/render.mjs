// Render stills for review, full videos, and web versions.
//   node render.mjs stills hero-wide 0,100,200     -> out/stills/hero-wide-100.png
//   node render.mjs video hero-wide,tour-compact   -> out/full/<id>.mp4 (+ out/web/<id>.mp4, poster)
//   node render.mjs video all
import { bundle } from '@remotion/bundler'
import { renderMedia, renderStill, selectComposition, getCompositions } from '@remotion/renderer'
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, 'out')
const [mode, ids = 'all', frames = '0'] = process.argv.slice(2)

const serveUrl = await bundle({ entryPoint: join(here, 'src', 'index.ts') })
const all = (await getCompositions(serveUrl)).map(c => c.id)
const list = ids === 'all' ? all : ids.split(',')

for (const id of list) {
  const composition = await selectComposition({ serveUrl, id })
  if (mode === 'stills') {
    mkdirSync(join(out, 'stills'), { recursive: true })
    for (const f of frames.split(',').map(Number)) {
      const output = join(out, 'stills', `${id}-${f}.png`)
      await renderStill({ serveUrl, composition, frame: f, output })
      console.log(output)
    }
    continue
  }
  mkdirSync(join(out, 'full'), { recursive: true })
  mkdirSync(join(out, 'web'), { recursive: true })
  const full = join(out, 'full', `${id}.mp4`)
  const started = Date.now()
  await renderMedia({
    serveUrl,
    composition,
    codec: 'h264',
    crf: 20,
    concurrency: Number(process.env.CONCURRENCY || 3),
    outputLocation: full,
    muted: true,
    onProgress: ({ progress }) => {
      if (Math.round(progress * 100) % 25 === 0) process.stdout.write(`\r${id} ${Math.round(progress * 100)}%   `)
    },
  })
  console.log(`\n${id}: ${((Date.now() - started) / 1000).toFixed(0)}s`)
  // Web version: 1280 on the long side (960 for square), CRF 27, faststart; poster from the composition's poster frame.
  execFileSync('npx', ['remotion', 'ffmpeg', '-y', '-v', 'error', '-i', full, '-vf', composition.width > composition.height ? 'scale=1280:-2' : composition.width < composition.height ? 'scale=-2:1280' : 'scale=960:960', '-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', join(out, 'web', `${id}.mp4`)], { stdio: 'inherit', shell: true, cwd: here })
  const posterFrame = composition.props?.posterFrame ?? Math.floor(composition.durationInFrames * 0.35)
  await renderStill({ serveUrl, composition, frame: posterFrame, output: join(out, 'web', `${id}.jpg`), imageFormat: 'jpeg', jpegQuality: 88, scale: 2 / 3 })
}
