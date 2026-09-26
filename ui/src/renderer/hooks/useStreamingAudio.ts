import { useCallback, useEffect, useRef } from 'react'
import type { RefObject } from 'react'

type Playback = {
  play: (time: number) => void
  stop: () => void
  sync: () => void
  release: () => void
  setGains: (first: number, second: number) => void
}

const clampVolume = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0

// Let Chromium buffer compressed audio instead of decoding entire clips into RAM.
// The silent video is the clock; each track retains its own independent gain.
export function useStreamingAudio(
  videoRef: RefObject<HTMLVideoElement>,
  firstUrl: string | null,
  secondUrl: string | null,
  firstGain: number,
  secondGain: number,
  onError: () => void
) {
  const playback = useRef<Playback | null>(null)
  const latest = useRef({ firstGain, secondGain, onError })
  latest.current = { firstGain, secondGain, onError }

  useEffect(() => {
    const video = videoRef.current
    if (!video || (!firstUrl && !secondUrl)) return

    let disposed = false
    let playing = false
    let lastSync = 0
    let generation = 0
    const tracks = [firstUrl, secondUrl].flatMap((url, index) => {
      if (!url) return []
      const audio = new Audio()
      audio.crossOrigin = 'anonymous'
      audio.preload = 'auto'
      audio.volume = clampVolume(index === 0 ? latest.current.firstGain : latest.current.secondGain)
      const error = () => {
        if (!disposed) latest.current.onError()
      }
      audio.addEventListener('error', error)
      audio.src = url
      audio.load()
      return [{ audio, index, error }]
    })

    const stop = () => {
      playing = false
      generation += 1
      tracks.forEach(({ audio }) => audio.pause())
    }
    const canPlay = () =>
      !disposed && !video.paused && !video.seeking && document.visibilityState !== 'hidden'

    const play = (_time: number) => {
      if (!canPlay() || playing) return
      playing = true
      const currentGeneration = ++generation
      tracks.forEach(({ audio }) => {
        const time = video.currentTime
        if (Number.isFinite(audio.duration) && time >= audio.duration) return
        audio.currentTime = time
        audio.playbackRate = video.playbackRate
        void audio
          .play()
          .then(() => {
            if (!playing || disposed) {
              audio.pause()
            } else if (currentGeneration === generation && canPlay()) {
              // Loading or seeking can finish after the video has advanced.
              if (Math.abs(audio.currentTime - video.currentTime) > 0.005)
                audio.currentTime = video.currentTime
            }
          })
          .catch((error: unknown) => {
            if (!disposed && !(error instanceof DOMException && error.name === 'AbortError'))
              latest.current.onError()
          })
      })
    }
    const sync = () => {
      if (!playing || disposed) return
      if (!canPlay()) {
        stop()
        return
      }
      const now = performance.now()
      if (now - lastSync < 250) return
      lastSync = now
      tracks.forEach(({ audio }) => {
        if (audio.paused || audio.seeking || audio.readyState < 2) return
        const drift = audio.currentTime - video.currentTime
        if (Math.abs(drift) > 0.06) {
          audio.currentTime = video.currentTime
        }
        // Repeated fractional rate changes accumulate time-stretcher latency in
        // Chromium even when currentTime appears aligned. Keep a stable rate.
        if (audio.playbackRate !== video.playbackRate) audio.playbackRate = video.playbackRate
      })
    }
    const release = () => {
      if (disposed) return
      disposed = true
      stop()
      tracks.forEach(({ audio, error }) => {
        audio.removeEventListener('error', error)
        audio.removeAttribute('src')
        audio.load()
      })
    }
    const player: Playback = {
      play,
      stop,
      sync,
      release,
      setGains: (first, second) =>
        tracks.forEach(({ audio, index }) => {
          audio.volume = clampVolume(index === 0 ? first : second)
        }),
    }
    playback.current = player
    if (canPlay()) play(video.currentTime)
    return () => {
      release()
      if (playback.current === player) playback.current = null
    }
  }, [videoRef, firstUrl, secondUrl])

  useEffect(() => {
    playback.current?.setGains(firstGain, secondGain)
  }, [firstGain, secondGain])

  return {
    startAudioPlayback: useCallback((time: number) => playback.current?.play(time), []),
    stopAudioPlayback: useCallback(() => playback.current?.stop(), []),
    syncAudioPlayback: useCallback(() => playback.current?.sync(), []),
    releaseAudioPlayback: useCallback(() => playback.current?.release(), []),
  }
}
