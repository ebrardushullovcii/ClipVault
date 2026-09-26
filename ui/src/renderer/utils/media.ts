// Pausing alone keeps Chromium's decoder (and its Windows file handle) alive.
export const releaseVideo = (video: HTMLVideoElement): void => {
  video.pause()
  video.removeAttribute('src')
  video.load()
}

// The editor plays the separate audio tracks independently. Native fullscreen
// controls must never enable the MP4's own audio alongside that mix.
export const silenceVideo = (video: HTMLVideoElement): void => {
  video.defaultMuted = true
  if (!video.muted) video.muted = true
  if (video.volume !== 0) video.volume = 0
}
