/* ClipVault · 07 Scrub
   Scroll position drives a playhead across a 2:00 sequence. Each section is a clip on V1;
   each step inside a section is a marker. On desktop a sticky program monitor shows the
   media for the current step. */
(() => {
  'use strict'

  const TOTAL = 120
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s))
  const root = document.documentElement

  const mqDesk = matchMedia('(min-width: 1024px) and (min-height: 640px)')
  const mqRM = matchMedia('(prefers-reduced-motion: reduce)')
  let desk = mqDesk.matches
  let rm = mqRM.matches

  const header = $('.appbar')
  const timeline = $('#timeline')
  const panelTab = $('.panel-tab')
  const tcEls = $$('[data-readout]')
  const nowEls = $$('[data-now]')
  const links = $$('.v1 a')
  const monView = $('#monView')
  const monPlay = $('#monPlay')
  const monCap = $('#monCap')
  const monFile = $('#monFile')

  const pad = n => String(n).padStart(2, '0')
  const fmt = t => {
    const cs = Math.max(0, Math.round(t * 100))
    return `${pad(Math.floor(cs / 6000))}:${pad(Math.floor(cs / 100) % 60)}.${pad(cs % 100)}`
  }

  const secs = $$('main .clip').map((el, i) => ({
    el,
    i,
    id: el.id,
    tin: parseFloat(el.dataset.in),
    tout: parseFloat(el.dataset.out),
    label: `${pad(i + 1)} ${el.dataset.name}`,
    steps: $$('.step', el),
    link: links[i],
    segs: [],
  }))
  const allSteps = secs.flatMap(s => s.steps)

  /* ── Build the decorative parts of the timeline ─────────────── */
  const segHosts = $$('.lane .segs')
  for (const s of secs) {
    for (const host of segHosts) {
      const seg = document.createElement('i')
      seg.style.setProperty('--in', s.tin)
      seg.style.setProperty('--out', s.tout)
      host.appendChild(seg)
      s.segs.push(seg)
    }
  }
  const marks = $('.ruler .marks')
  const miniSegs = $('.mini-segs')
  for (const s of secs) {
    s.steps.forEach((st, j) => {
      if (j > 0 && marks) {
        const m = document.createElement('i')
        m.style.setProperty('--t', st.dataset.tc)
        marks.appendChild(m)
      }
    })
    if (miniSegs && s.i > 0) {
      const m = document.createElement('i')
      m.style.setProperty('--t', s.tin)
      miniSegs.appendChild(m)
    }
  }

  /* ── Scroll → timecode map ──────────────────────────────────── */
  let points = []
  let maxScroll = 1
  let lineY = 0

  function measure() {
    const tlH = timeline && getComputedStyle(timeline).display !== 'none' ? timeline.offsetHeight : 0
    const topInset = header.offsetHeight + (desk && panelTab ? 12 + panelTab.offsetHeight : 0)
    const avail = innerHeight - topInset - tlH
    // A step (and with its first step, a section) becomes current when its top reaches
    // a line just above the middle of the visible area. Timeline clicks land there too.
    lineY = Math.round(topInset + avail * 0.42)
    root.style.setProperty('--line-y', `${Math.round(topInset + 16)}px`)

    maxScroll = Math.max(1, root.scrollHeight - innerHeight)
    points = []
    for (const s of secs) {
      s.steps.forEach(st => {
        const pos = st.getBoundingClientRect().top + scrollY - lineY
        points.push({ s: Math.round(pos), tc: parseFloat(st.dataset.tc), sec: s, step: st })
      })
    }
    const n = points.length
    points[0].s = 0
    for (let k = 1; k < n; k++) {
      points[k].s = Math.min(Math.max(points[k].s, points[k - 1].s + 1), maxScroll - (n - k))
    }
    points.push({ s: maxScroll, tc: TOTAL, sec: points[n - 1].sec, step: points[n - 1].step })
  }

  function locate(y) {
    let k = 0
    while (k < points.length - 2 && points[k + 1].s <= y) k++
    const a = points[k]
    const b = points[k + 1]
    const f = Math.min(1, Math.max(0, (y - a.s) / Math.max(1, b.s - a.s)))
    return { tc: a.tc + f * (b.tc - a.tc), pt: a }
  }

  /* ── State ──────────────────────────────────────────────────── */
  let curSec = null
  let curStep = null

  function setSection(sec) {
    if (curSec) {
      curSec.link && curSec.link.removeAttribute('aria-current')
      curSec.segs.forEach(g => g.classList.remove('on'))
    }
    curSec = sec
    sec.link && sec.link.setAttribute('aria-current', 'location')
    sec.segs.forEach(g => g.classList.add('on'))
    root.dataset.sec = sec.id
    timeline.style.setProperty('--rin', (sec.tin / TOTAL).toFixed(5))
    timeline.style.setProperty('--rout', (sec.tout / TOTAL).toFixed(5))
    nowEls.forEach(e => { e.textContent = sec.label })
  }

  function setStep(step) {
    if (curStep) curStep.classList.remove('is-live')
    curStep = step
    step.classList.add('is-live')
    if (desk) showInMonitor(step)
  }

  let lastTcText = ''
  function update() {
    ticking = false
    if (!points.length) return
    const { tc, pt } = locate(scrollY)
    if (pt.sec !== curSec) setSection(pt.sec)
    if (pt.step !== curStep) setStep(pt.step)
    // Reduced motion: no continuous scrub, the playhead sits on the current clip's in point.
    const shown = rm ? curSec.tin : tc
    timeline.style.setProperty('--p', (shown / TOTAL).toFixed(5))
    const text = fmt(shown)
    if (text !== lastTcText) {
      lastTcText = text
      tcEls.forEach(e => { e.textContent = text })
    }
  }

  let ticking = false
  function onScroll() {
    if (!ticking) {
      ticking = true
      requestAnimationFrame(update)
    }
  }

  /* ── Program monitor ────────────────────────────────────────── */
  const layers = new Map()
  const moved = [] // videos moved into the monitor: { video, placeholder }
  let activeLayer = null

  function layerFor(step) {
    const key = step && step.dataset.shot
    if (!key) return null
    if (layers.has(key)) return layers.get(key)
    let layer
    if (key === 'slate') {
      layer = $('#slate')
      layer.dataset.cap = 'ClipVault 1.7.6 · Windows 10 and 11'
      layer.dataset.file = 'end slate'
    } else {
      const fig = $('.shot', step)
      if (!fig) return null
      layer = document.createElement('div')
      layer.className = 'mlayer'
      const cap = $('figcaption', fig)
      layer.dataset.cap = cap ? cap.textContent.trim() : ''
      layer.dataset.file = fig.dataset.file || ''
      const video = $('video', fig)
      if (video) {
        const placeholder = document.createComment('video')
        video.parentNode.insertBefore(placeholder, video)
        layer.appendChild(video)
        moved.push({ video, placeholder })
      } else {
        const img = $('img', fig).cloneNode()
        img.loading = 'eager'
        img.decoding = 'async'
        img.sizes = '(min-width: 1800px) 1250px, 62vw'
        layer.appendChild(img)
      }
      monView.appendChild(layer)
    }
    layers.set(key, layer)
    return layer
  }

  function layerVideo(layer) {
    return layer ? $('video', layer) : null
  }

  function canAutoplay(v) {
    return v && v.dataset.auto === '1' && !rm && !v.dataset.userPaused
  }

  function showInMonitor(step) {
    const layer = layerFor(step)
    if (!layer) return
    if (activeLayer && activeLayer !== layer) {
      activeLayer.classList.remove('on')
      const old = layerVideo(activeLayer)
      if (old && !old.paused) old.pause()
    }
    activeLayer = layer
    layer.classList.add('on')
    monCap.textContent = layer.dataset.cap || ''
    monFile.textContent = layer.dataset.file || ''
    const v = layerVideo(layer)
    if (canAutoplay(v)) v.play().catch(() => {})
    syncPlay()
    // Warm the neighbours so the next cut is instant.
    const i = allSteps.indexOf(step)
    layerFor(allSteps[i + 1])
    layerFor(allSteps[i - 1])
  }

  function syncPlay() {
    const v = layerVideo(activeLayer)
    monPlay.disabled = !v
    const paused = !v || v.paused
    monPlay.classList.toggle('is-paused', paused)
    monPlay.setAttribute('aria-label', paused ? 'Play video' : 'Pause video')
  }

  monPlay.addEventListener('click', () => {
    const v = layerVideo(activeLayer)
    if (!v) return
    if (v.paused) {
      delete v.dataset.userPaused
      v.play().catch(() => {})
    } else {
      v.dataset.userPaused = '1'
      v.pause()
    }
  })

  const videos = $$('main video')
  const tourVideo = $('#tour video')
  videos.forEach(v => {
    v.addEventListener('play', syncPlay)
    v.addEventListener('pause', syncPlay)
  })

  function enterDesk() {
    curStep = null
    activeLayer = null
  }

  function leaveDesk() {
    for (const { video, placeholder } of moved.splice(0)) {
      placeholder.parentNode.insertBefore(video, placeholder)
      placeholder.remove()
    }
    for (const [key, layer] of layers) {
      if (key !== 'slate') layer.remove()
      else layer.classList.remove('on')
    }
    layers.clear()
    activeLayer = null
    curStep = null
  }

  /* Inline (stacked layout) autoplay videos pause when off screen. */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      if (desk) return
      for (const e of entries) {
        const v = e.target
        if (e.isIntersecting && canAutoplay(v)) v.play().catch(() => {})
        else if (!e.isIntersecting && !v.paused) v.pause()
      }
    }, { threshold: 0.25 })
    videos.forEach(v => io.observe(v))
  }

  function applyMotionPref() {
    videos.forEach(v => {
      if (v.dataset.auto !== '1') return
      if (rm) {
        v.removeAttribute('autoplay')
        v.pause()
      }
    })
  }

  /* ── Navigation ─────────────────────────────────────────────── */
  function scrollToSection(sec, focus) {
    const pt = points.find(p => p.sec === sec)
    const top = pt ? Math.min(pt.s, maxScroll) : sec.el.offsetTop
    window.scrollTo({ top, behavior: rm ? 'auto' : 'smooth' })
    if (focus) {
      const h = $('h1, h2', sec.el)
      if (h) {
        h.setAttribute('tabindex', '-1')
        h.focus({ preventScroll: true })
      }
    }
  }

  links.forEach((a, i) => {
    a.addEventListener('click', e => {
      e.preventDefault()
      scrollToSection(secs[i], true)
      history.replaceState(null, '', `#${secs[i].id}`)
    })
  })

  // Arrow keys move between clips on V1.
  const v1 = $('.v1')
  v1 && v1.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return
    const i = links.indexOf(document.activeElement)
    if (i < 0) return
    e.preventDefault()
    let j = i
    if (e.key === 'ArrowRight') j = Math.min(links.length - 1, i + 1)
    if (e.key === 'ArrowLeft') j = Math.max(0, i - 1)
    if (e.key === 'Home') j = 0
    if (e.key === 'End') j = links.length - 1
    links[j].focus()
  })

  // Other in-page links land on the same line the playhead uses.
  $$('a[href^="#"]').forEach(a => {
    if (links.includes(a) || a.classList.contains('skip')) return
    const id = a.getAttribute('href').slice(1)
    const sec = secs.find(s => s.id === id)
    if (!sec) return
    a.addEventListener('click', e => {
      e.preventDefault()
      scrollToSection(sec, true)
      history.replaceState(null, '', `#${id}`)
    })
  })

  // "Play the tour"
  const tourBtn = $('[data-play-tour]')
  const tourSec = secs.find(s => s.id === 'tour')
  tourBtn && tourBtn.addEventListener('click', () => {
    const v = tourVideo
    if (!v) return
    if (desk) {
      if (curSec !== tourSec) scrollToSection(tourSec, false)
    } else {
      v.scrollIntoView({ block: 'center', behavior: rm ? 'auto' : 'smooth' })
    }
    delete v.dataset.userPaused
    v.play().catch(() => {})
  })

  /* ── Wiring ─────────────────────────────────────────────────── */
  function relayout() {
    measure()
    update()
  }

  mqDesk.addEventListener('change', e => {
    desk = e.matches
    if (desk) enterDesk()
    else leaveDesk()
    relayout()
    if (!desk && curStep) curStep.classList.add('is-live')
  })
  mqRM.addEventListener('change', e => {
    rm = e.matches
    applyMotionPref()
    lastTcText = ''
    update()
  })

  applyMotionPref()
  measure()
  update()
  if (location.hash) {
    const sec = secs.find(s => `#${s.id}` === location.hash)
    if (sec && sec.i > 0) {
      const pt = points.find(p => p.sec === sec)
      if (pt) window.scrollTo(0, Math.min(pt.s, maxScroll))
    }
  }

  addEventListener('scroll', onScroll, { passive: true })
  addEventListener('resize', () => requestAnimationFrame(relayout))
  addEventListener('load', relayout)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout)
  if ('ResizeObserver' in window) {
    let t = 0
    new ResizeObserver(() => {
      cancelAnimationFrame(t)
      t = requestAnimationFrame(relayout)
    }).observe($('main'))
  }
})()
