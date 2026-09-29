// man clipvault: typing illustration, hero video control, section tracking, less-style keys.
(() => {
  'use strict'
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /* ── 1. Typed illustration in the hero terminal ─────────────
     The original <pre> stays in the layout (transparent) so the box never changes size
     and screen readers get the full text. A clone on top is typed out. */
  const typer = document.querySelector('[data-typer]')
  if (typer && !reduced) {
    const src = typer.querySelector('.term-out')
    const live = src.cloneNode(true)
    live.setAttribute('aria-hidden', 'true')
    src.classList.add('term-ghost')
    src.after(live)

    const lines = [...live.querySelectorAll('.l')]
    lines.forEach(l => l.classList.add('pending'))
    const walker = document.createTreeWalker(live, NodeFilter.SHOW_TEXT)
    const nodes = []
    while (walker.nextNode()) nodes.push(walker.currentNode)
    const texts = nodes.map(n => n.nodeValue)
    nodes.forEach(n => { n.nodeValue = '' })

    const caret = document.createElement('span')
    caret.className = 'caret'
    live.insertBefore(caret, live.firstChild)
    const placeCaret = node => node.parentNode.insertBefore(caret, node.nextSibling)

    const paused = new WeakSet()
    let ni = 0
    let ci = 0
    const tick = () => {
      while (ni < nodes.length && ci >= texts[ni].length) { ni++; ci = 0 }
      if (ni >= nodes.length) { live.appendChild(caret); return }
      const node = nodes[ni]
      const line = node.parentElement.closest('.l')
      if (line && line.classList.contains('pending')) {
        const wait = Number(line.dataset.p || 0)
        if (wait && !paused.has(line)) { paused.add(line); setTimeout(tick, wait); return }
        line.classList.remove('pending')
      }
      const comment = !!line && line.classList.contains('c')
      let ch = texts[ni][ci++]
      node.nodeValue += ch
      // Event lines print two characters per tick; the comment lines type one at a time.
      if (!comment && ch !== '\n' && ci < texts[ni].length && texts[ni][ci] !== '\n') {
        ch = texts[ni][ci++]
        node.nodeValue += ch
      }
      placeCaret(node)
      let delay = comment ? 11 : 9
      if (ch === '\n') delay = 50
      const key = node.parentElement.closest('.key')
      if (key && ci === texts[ni].length && !(nodes[ni + 1] && key.contains(nodes[ni + 1]))) {
        key.classList.add('flash')
        setTimeout(() => key.classList.remove('flash'), 420)
        delay = 280
      }
      setTimeout(tick, delay)
    }

    let started = false
    const start = () => { if (!started) { started = true; setTimeout(tick, 200) } }
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) { start(); io.disconnect() }
      })
      io.observe(typer)
    } else start()
  }

  /* ── 2. Hero video: no autoplay under reduced motion, pause offscreen, pause button ── */
  const hv = document.getElementById('hero-video')
  const hvBtn = document.querySelector('.vbtn[data-video="hero-video"]')
  if (hv) {
    let userPaused = false
    let offscreenPaused = false
    const sync = () => {
      if (!hvBtn) return
      hvBtn.textContent = hv.paused ? 'play' : 'pause'
      hvBtn.setAttribute('aria-label', (hv.paused ? 'Play' : 'Pause') + ' the fig. 1 video')
    }
    const play = () => { const p = hv.play(); if (p && p.catch) p.catch(() => {}) }

    if (reduced) {
      hv.autoplay = false
      hv.removeAttribute('autoplay')
      hv.pause()
      userPaused = true
    }
    hv.addEventListener('play', sync)
    hv.addEventListener('pause', sync)
    sync()

    if (hvBtn) {
      hvBtn.hidden = false
      hvBtn.addEventListener('click', () => {
        if (hv.paused) { userPaused = false; play() } else { userPaused = true; hv.pause() }
      })
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        for (const e of entries) {
          if (!e.isIntersecting && !hv.paused) { offscreenPaused = true; hv.pause() }
          else if (e.isIntersecting && offscreenPaused && !userPaused) { offscreenPaused = false; play() }
        }
      }, { threshold: 0.1 }).observe(hv)
    }
  }

  /* ── 3. Current section: TOC highlight + less-style status line ── */
  const sections = [document.getElementById('name'), ...document.querySelectorAll('.man > section[id]')].filter(Boolean)
  const toc = new Map([...document.querySelectorAll('.toc a')].map(a => [a.getAttribute('href').slice(1), a]))
  const less = document.getElementById('less')
  const lessSec = document.getElementById('less-sec')
  const lessPct = document.getElementById('less-pct')
  const label = s => (s.id === 'name' ? 'NAME' : s.querySelector('h2').textContent.trim())
  let current = null

  const update = () => {
    const probe = window.scrollY + window.innerHeight * 0.3
    const max = document.documentElement.scrollHeight - window.innerHeight
    let cur = sections[0]
    for (const s of sections) {
      if (s.getBoundingClientRect().top + window.scrollY <= probe) cur = s
    }
    if (window.scrollY >= max - 2) cur = sections[sections.length - 1]
    if (cur !== current) {
      if (current && toc.get(current.id)) toc.get(current.id).removeAttribute('aria-current')
      if (toc.get(cur.id)) toc.get(cur.id).setAttribute('aria-current', 'true')
      if (lessSec) lessSec.textContent = label(cur)
      current = cur
    }
    // The status line stays out of the way over the hero and appears once you are reading the manual.
    if (less) less.classList.toggle('is-top', window.scrollY < 240)
    if (lessPct) {
      const pct = max > 0 ? Math.round((window.scrollY / max) * 100) : 100
      lessPct.textContent = window.scrollY <= 0 ? '(top)' : pct >= 100 ? '(END)' : pct + '%'
    }
  }
  let queued = false
  const onScroll = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => { queued = false; update() })
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  update()

  /* ── 4. j/k/g/G section keys (only while the status line is shown; can be switched off) ── */
  if (!less) return
  less.hidden = false
  // Same condition as the CSS that shows the status line (and its on/off switch).
  const keysMedia = window.matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)')
  const toggle = document.getElementById('keys-toggle')
  const kv = toggle && toggle.querySelector('.kv')
  let keysOn = true
  try { keysOn = localStorage.getItem('clipvault-man-keys') !== 'off' } catch (e) { /* storage blocked */ }
  const showKeys = () => {
    if (!toggle) return
    toggle.setAttribute('aria-pressed', String(keysOn))
    if (kv) kv.textContent = keysOn ? 'keys on' : 'keys off'
  }
  showKeys()
  if (toggle) {
    toggle.addEventListener('click', () => {
      keysOn = !keysOn
      showKeys()
      try { localStorage.setItem('clipvault-man-keys', keysOn ? 'on' : 'off') } catch (e) { /* storage blocked */ }
    })
  }

  let lastTarget = null
  let lastTime = 0
  const go = sec => {
    const behavior = reduced ? 'auto' : 'smooth'
    if (sec === sections[0]) window.scrollTo({ top: 0, behavior })
    else if (sec === sections[sections.length - 1]) window.scrollTo({ top: document.documentElement.scrollHeight, behavior })
    else sec.scrollIntoView({ behavior, block: 'start' })
    const h = sec.querySelector('h1, h2')
    if (h) h.focus({ preventScroll: true })
    lastTarget = sec
    lastTime = Date.now()
  }

  document.addEventListener('keydown', e => {
    if (!keysOn || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
    if (!keysMedia.matches) return
    const t = e.target
    if (t && t.closest && t.closest('input, textarea, select, button, [contenteditable], video, audio')) return
    const k = e.key
    if (k !== 'j' && k !== 'k' && k !== 'g' && k !== 'G') return
    e.preventDefault()
    if (k === 'g') return go(sections[0])
    if (k === 'G') return go(sections[sections.length - 1])
    const from = lastTarget && Date.now() - lastTime < 900 ? lastTarget : current
    const i = Math.max(0, sections.indexOf(from))
    go(sections[Math.min(sections.length - 1, Math.max(0, i + (k === 'j' ? 1 : -1)))])
  })
})()
