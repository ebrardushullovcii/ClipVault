import React from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { Editor } from '../src/renderer/components/Editor/Editor'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const check = (condition, message) => {
  if (!condition) throw new Error(message)
}
const waitFor = async (predicate, message, timeout = 4000) => {
  const deadline = performance.now() + timeout
  while (!predicate()) {
    if (performance.now() > deadline) throw new Error(message)
    await sleep(10)
  }
}
const metadata = { duration: 4, width: 320, height: 180, fps: 30, bitrate: 100000, audioTracks: 0 }
const root = createRoot(document.getElementById('root'))
let persisted = null
window.electronAPI = {
  on: () => () => {},
  getSettings: async () => ({}),
  editor: { loadState: async () => null },
  saveClipMetadata: async (_id, value) => {
    persisted = value
    return true
  },
  cancelAudioExtraction: async () => {},
}

async function mount(savedTrim) {
  persisted = null
  const clip = {
    id: crypto.randomUUID(),
    filename: 'fixture.mp4',
    path: 'fixture.mp4',
    modifiedAt: 'fixture',
    metadata: savedTrim ? { trim: savedTrim } : null,
  }
  flushSync(() =>
    root.render(<Editor key={clip.id} clip={clip} metadata={metadata} onClose={() => {}} />)
  )
  await waitFor(() => document.querySelector('video')?.readyState >= 2, 'fixture did not load')
  await waitFor(() => persisted !== null, 'editor hydration/autosave did not finish')
  await sleep(100)
  const video = document.querySelector('video')
  await waitFor(() => !video.seeking, 'initial playhead seek did not finish')
  const markers = Array.from(document.querySelectorAll('div')).filter(
    element => element.style.height === '200%'
  )
  check(markers.length === 2, 'could not locate trim handles')
  const timeline = markers[0].parentElement
  timeline.style.width = '800px'
  timeline.style.height = '20px'
  return { video, markers, timeline }
}

async function drag(context, index, seconds) {
  flushSync(() =>
    context.markers[index].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  )
  await sleep(20)
  const bounds = context.timeline.getBoundingClientRect()
  flushSync(() =>
    document.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        clientX: bounds.left + (bounds.width * seconds) / 4,
      })
    )
  )
  flushSync(() => document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })))
  await waitFor(
    () => Math.abs(parseFloat(context.markers[index].style.left) - (seconds / 4) * 100) < 0.01,
    `trim handle ${index} did not move to ${seconds}: ${context.markers[index].style.left}`
  )
  await sleep(20)
}

async function seek(context, seconds) {
  // Use the editor timeline, so the same loop-intent path as a user click runs.
  const bounds = context.timeline.getBoundingClientRect()
  flushSync(() =>
    context.timeline.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        clientX: bounds.left + (bounds.width * seconds) / 4,
      })
    )
  )
  try {
    await waitFor(
      () => !context.video.seeking && Math.abs(context.video.currentTime - seconds) < 0.05,
      'timeline seek failed'
    )
  } catch {
    throw new Error(
      `timeline seek failed: time=${context.video.currentTime}, seeking=${context.video.seeking}, ready=${context.video.readyState}, width=${bounds.width}, trim=${context.markers.map(m => m.style.left)}`
    )
  }
}

async function loops(context, expectedStart, count, { forceNativeEnd = false } = {}) {
  const { video } = context
  const restarts = []
  let ended = 0
  let framesSinceRestart = 0
  let frameHandle
  const onFrame = () => {
    framesSinceRestart += 1
    frameHandle = video.requestVideoFrameCallback(onFrame)
  }
  frameHandle = video.requestVideoFrameCallback(onFrame)
  const onSeeking = () => {
    restarts.push(video.currentTime)
    framesSinceRestart = 0
  }
  const onEnded = () => {
    ended += 1
  }
  video.addEventListener('seeking', onSeeking)
  video.addEventListener('ended', onEnded)
  const nativeRaf = window.requestAnimationFrame
  // Force the native ended path deterministically: ordinary rAF playback may
  // seek first depending on frame timing. Media decoding/events still run.
  if (forceNativeEnd) window.requestAnimationFrame = () => 0
  try {
    video.click()
    await waitFor(() => !video.paused, 'editor did not start playback')
    await waitFor(() => restarts.length >= count, `only ${restarts.length}/${count} loops`, 16000)
    await waitFor(
      () =>
        !video.paused &&
        !video.seeking &&
        video.currentTime > expectedStart + 0.05 &&
        framesSinceRestart > 0,
      'playback did not continue after loop'
    )
    video.pause()
    video.cancelVideoFrameCallback(frameHandle)
    check(
      restarts.slice(0, count).every(time => Math.abs(time - expectedStart) < 0.05),
      `expected restart ${expectedStart}, got ${JSON.stringify(restarts)}`
    )
    if (forceNativeEnd) check(ended >= count, `expected ${count} native ended events, got ${ended}`)
    return { restarts: restarts.slice(0, count), nativeEnded: ended }
  } finally {
    video.pause()
    video.cancelVideoFrameCallback(frameHandle)
    window.requestAnimationFrame = nativeRaf
    video.removeEventListener('seeking', onSeeking)
    video.removeEventListener('ended', onEnded)
  }
}

window.trimLoopResults = (async () => {
  const results = []
  const run = async (name, body) => {
    if (process.env.CLIPVAULT_TRIM_CASE && !name.includes(process.env.CLIPVAULT_TRIM_CASE)) return
    try {
      results.push({ name, ...(await body()) })
    } catch (error) {
      results.push({ name, error: error.message })
    }
  }
  await run('start handle moved; end untouched at EOF; three native loops', async () => {
    const context = await mount()
    await drag(context, 0, 2)
    await seek(context, 2)
    return loops(context, 2, 3, { forceNativeEnd: true })
  })
  await run('untouched EOF with normal frame scheduling; three loops', async () => {
    const context = await mount()
    await drag(context, 0, 2)
    await seek(context, 2)
    return loops(context, 2, 3)
  })
  await run('explicit interior end; three animation-frame loops', async () => {
    const context = await mount()
    await drag(context, 0, 2)
    await drag(context, 1, 3.5)
    await seek(context, 2)
    return loops(context, 2, 3)
  })
  await run('end moved away then back to EOF', async () => {
    const context = await mount()
    await drag(context, 0, 2)
    await drag(context, 1, 3.5)
    await drag(context, 1, 4)
    await seek(context, 2)
    return loops(context, 2, 2, { forceNativeEnd: true })
  })
  await run('persisted nonzero start and EOF end', async () => {
    const context = await mount({ start: 2, end: 4 })
    await seek(context, 2)
    return loops(context, 2, 2, { forceNativeEnd: true })
  })
  await run('untrimmed source still loops to zero', async () => {
    const context = await mount()
    await seek(context, 3.7)
    return loops(context, 0, 1, { forceNativeEnd: true })
  })
  await run('playback begun before trim retains full-source loop intent', async () => {
    const context = await mount({ start: 2, end: 4 })
    await seek(context, 0.5)
    return loops(context, 0, 1, { forceNativeEnd: true })
  })
  await run('playback begun after trim retains full-source loop intent', async () => {
    const context = await mount({ start: 1, end: 3 })
    await seek(context, 3.7)
    return loops(context, 0, 1, { forceNativeEnd: true })
  })
  root.unmount()
  check(results.length > 0, 'no playback cases matched CLIPVAULT_TRIM_CASE')
  return results
})()
