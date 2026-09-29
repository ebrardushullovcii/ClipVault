// ClipVault concept 05 ("Insert Coin"): attract-mode video, SAVE button easter egg, CONTINUE? countdown.
(() => {
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  const reduced = () => !!(mq && mq.matches)
  const hasIO = 'IntersectionObserver' in window

  /* ---------- Hero video: pause button, pause when offscreen ---------- */
  const video = document.getElementById('heroVideo')
  const pauseBtn = document.getElementById('heroPause')
  if (video && pauseBtn) {
    let userPaused = reduced()
    const sync = () => {
      const paused = video.paused
      pauseBtn.textContent = paused ? 'Play' : 'Pause'
      pauseBtn.setAttribute('aria-label', paused ? 'Play video' : 'Pause video')
    }
    const play = () => {
      const p = video.play()
      if (p && typeof p.catch === 'function') p.catch(sync)
    }
    video.addEventListener('play', sync)
    video.addEventListener('pause', sync)
    pauseBtn.addEventListener('click', () => {
      if (video.paused) { userPaused = false; play() } else { userPaused = true; video.pause() }
    })
    if (hasIO) {
      new IntersectionObserver(entries => {
        for (const e of entries) {
          if (!e.isIntersecting) { if (!video.paused) video.pause() }
          else if (!userPaused) play()
        }
      }, { threshold: 0.15 }).observe(video)
    }
    if (mq && mq.addEventListener) {
      mq.addEventListener('change', () => { if (reduced()) { userPaused = true; video.pause() } })
    }
    sync()
  }

  /* ---------- SAVE button easter egg: "CLIP SAVED" ---------- */
  const saveBtn = document.getElementById('saveBtn')
  const countEl = document.getElementById('clipCount')
  const screen = document.getElementById('cabScreen')
  const flash = screen && screen.querySelector('.cab-flash')
  const banner = screen && screen.querySelector('.cab-saved')
  const toast = document.getElementById('toast')
  const toastTitle = document.getElementById('toastTitle')
  const toastText = document.getElementById('toastText')
  let clips = 0
  let toastTimer = 0
  let clearTimer = 0
  let bannerTimer = 0

  const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls) }

  function saveClip () {
    clips = Math.min(clips + 1, 99)
    if (countEl) countEl.textContent = String(clips).padStart(2, '0')

    if (saveBtn) {
      saveBtn.classList.add('is-pressed')
      setTimeout(() => saveBtn.classList.remove('is-pressed'), 160)
    }
    if (flash && !reduced()) restart(flash, 'go')
    if (banner) {
      restart(banner, 'show')
      clearTimeout(bannerTimer)
      bannerTimer = setTimeout(() => banner.classList.remove('show'), 1500)
    }

    if (toast && toastTitle && toastText) {
      clearTimeout(toastTimer)
      clearTimeout(clearTimer)
      // Empty first so screen readers announce repeated saves.
      toastTitle.textContent = ''
      toastText.textContent = ''
      setTimeout(() => {
        toastTitle.textContent = clips > 1 ? `Clip saved ×${clips}` : 'Clip saved'
        toastText.textContent = 'Demo only. In ClipVault, your save hotkey keeps the last 2 minutes as an MP4 in your clips folder.'
        toast.classList.add('show')
      }, 30)
      toastTimer = setTimeout(() => {
        toast.classList.remove('show')
        clearTimer = setTimeout(() => { toastTitle.textContent = ''; toastText.textContent = '' }, 400)
      }, 3400)
    }
  }

  if (saveBtn) saveBtn.addEventListener('click', saveClip)

  /* ---------- Warm up lazy images once the page has loaded ---------- */
  // The first paint only loads what is on screen; the rest follows when the browser is idle,
  // so a quick scroll never lands on empty screens.
  const warm = () => {
    for (const img of document.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager'
  }
  const whenIdle = fn => window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 1000 }) : setTimeout(fn, 400)
  if (document.readyState === 'complete') whenIdle(warm)
  else window.addEventListener('load', () => whenIdle(warm), { once: true })

  /* ---------- CONTINUE? countdown ---------- */
  const cd = document.getElementById('countdown')
  if (cd && hasIO) {
    let n = 9
    let timer = 0
    const tick = () => { n = n <= 0 ? 9 : n - 1; cd.textContent = String(n) }
    const start = () => { if (!timer && !reduced()) timer = setInterval(tick, 1000) }
    const stop = () => { clearInterval(timer); timer = 0 }
    new IntersectionObserver(entries => {
      for (const e of entries) e.isIntersecting ? start() : stop()
    }, { threshold: 0.3 }).observe(cd)
  }
})()
