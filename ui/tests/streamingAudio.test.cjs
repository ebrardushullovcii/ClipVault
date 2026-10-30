// Run: node --test ui/tests/streamingAudio.test.cjs
/* global process, __dirname, DOMException, setImmediate */
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test } = require('node:test')
const vm = require('node:vm')
const ts = require('../node_modules/typescript')

// Exercise the real hook, with controllable media clocks and play promises.
function mount(firstUrl = 'desktop', secondUrl = 'mic') {
  const effects = []
  const tracks = []
  const errors = []
  const video = { currentTime: 10, paused: false, seeking: false, playbackRate: 1 }
  const document = { visibilityState: 'visible' }
  let now = 1000
  class Audio {
    constructor() {
      this.time = 0
      this.seeks = []
      this.requests = []
      this.paused = true
      this.seeking = false
      this.readyState = 4
      this.duration = 120
      this.listeners = new Map()
      tracks.push(this)
    }
    get currentTime() {
      return this.time
    }
    set currentTime(time) {
      this.seeks.push(time)
      this.time = time
    }
    addEventListener(name, listener) {
      this.listeners.set(name, listener)
    }
    removeEventListener(name) {
      this.listeners.delete(name)
    }
    load() {}
    pause() {
      this.paused = true
    }
    removeAttribute(name) {
      delete this[name]
    }
    play() {
      this.paused = false
      return new Promise((resolve, reject) => this.requests.push({ resolve, reject }))
    }
  }
  const source = ts.transpileModule(
    readFileSync(
      process.env.CLIPVAULT_AUDIO_SOURCE ||
        join(__dirname, '../src/renderer/hooks/useStreamingAudio.ts'),
      'utf8'
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }
  ).outputText
  const exports = {}
  vm.runInNewContext(source, {
    exports,
    Audio,
    document,
    DOMException,
    performance: { now: () => now },
    require: name => {
      assert.equal(name, 'react')
      return {
        useRef: current => ({ current }),
        useCallback: callback => callback,
        useEffect: effect => effects.push(effect),
      }
    },
  })
  const hook = exports.useStreamingAudio({ current: video }, firstUrl, secondUrl, 0.7, 0.4, () =>
    errors.push('error')
  )
  const cleanup = effects.map(effect => effect()).filter(Boolean)
  return {
    hook,
    video,
    document,
    tracks,
    errors,
    advance: () => {
      now += 300
    },
    cleanup: () => cleanup.forEach(fn => fn()),
  }
}
const flush = () => new Promise(resolve => setImmediate(resolve))

test('repeated aligned pause/resume reuses two decoders without seeking', async () => {
  const { hook, video, tracks, cleanup } = mount()
  tracks.forEach(track => track.requests[0].resolve())
  await flush()
  for (let i = 0; i < 12; i++) {
    video.paused = true
    hook.stopAudioPlayback()
    assert.ok(tracks.every(track => track.paused))
    video.currentTime += 1
    tracks.forEach(track => {
      track.time = video.currentTime - 0.025
    })
    video.paused = false
    hook.startAudioPlayback(video.currentTime)
    hook.startAudioPlayback(video.currentTime)
    tracks.forEach(track => track.requests.at(-1).resolve())
    await flush()
  }
  assert.equal(tracks.length, 2)
  tracks.forEach(track => {
    assert.equal(track.requests.length, 13)
    assert.deepEqual(track.seeks, [10])
  })
  assert.equal(tracks[0].volume, 0.7)
  assert.equal(tracks[1].volume, 0.4)
  cleanup()
  assert.ok(tracks.every(track => track.paused && !track.src && track.listeners.size === 0))
})

test('small startup clock skew does not trigger a second seek', async () => {
  const { video, tracks, cleanup } = mount()
  video.currentTime += 0.02
  tracks.forEach(track => track.requests[0].resolve())
  await flush()
  tracks.forEach(track => assert.deepEqual(track.seeks, [10]))
  cleanup()
})

test('real seek, loop and delayed startup still align audio to video', async () => {
  const { hook, video, tracks, cleanup } = mount()
  video.currentTime = 10.5
  tracks.forEach(track => track.requests[0].resolve())
  await flush()
  tracks.forEach(track => assert.equal(track.currentTime, 10.5))
  hook.stopAudioPlayback()
  video.seeking = true
  video.currentTime = 3
  hook.startAudioPlayback(3)
  tracks.forEach(track => assert.equal(track.requests.length, 1))
  video.seeking = false
  hook.startAudioPlayback(3)
  tracks.forEach(track => assert.equal(track.currentTime, 3))
  cleanup()
})

test('stale play failure cannot re-extract audio during a newer resume', async () => {
  const { hook, tracks, errors, cleanup } = mount()
  hook.stopAudioPlayback()
  hook.startAudioPlayback(10)
  tracks.forEach(track => track.requests[0].reject(new Error('old play failed')))
  await flush()
  assert.deepEqual(errors, [])
  tracks[0].requests[1].reject(new Error('current play failed'))
  await flush()
  assert.deepEqual(errors, ['error'])
  cleanup()
})

test('pause/release during pending play stays silent after settlement', async () => {
  for (const action of ['stopAudioPlayback', 'releaseAudioPlayback']) {
    const { hook, tracks, errors, cleanup } = mount()
    hook[action]()
    tracks.forEach(track => track.requests[0].resolve())
    await flush()
    assert.ok(tracks.every(track => track.paused))
    assert.deepEqual(errors, [])
    cleanup()
  }
})

test('sync corrects large drift, preserves stable rate, and stops when hidden', () => {
  const { hook, video, document, tracks, advance, cleanup } = mount('desktop', null)
  tracks[0].time = video.currentTime + 0.04
  hook.syncAudioPlayback()
  assert.deepEqual(tracks[0].seeks, [10])
  tracks[0].time += 0.2
  video.playbackRate = 1.5
  advance()
  hook.syncAudioPlayback()
  assert.equal(tracks[0].currentTime, video.currentTime)
  assert.equal(tracks[0].playbackRate, 1.5)
  document.visibilityState = 'hidden'
  hook.syncAudioPlayback()
  assert.ok(tracks[0].paused)
  cleanup()
})
