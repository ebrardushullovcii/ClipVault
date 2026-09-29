// ClipVault · #clips — scroll reveal, channel scrollspy, video handling, screenshot lightbox.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)')
  const hasIO = 'IntersectionObserver' in window

  /* ---------- messages reveal as they scroll in ---------- */
  const revealItems = [...document.querySelectorAll('.reveal')]
  const showAll = () => revealItems.forEach(el => el.classList.add('in'))

  if (document.documentElement.classList.contains('reveal-on') && hasIO) {
    const io = new IntersectionObserver(entries => {
      let n = 0
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const el = entry.target
        el.style.transitionDelay = `${Math.min(n++, 5) * 70}ms`
        el.classList.add('in')
        el.addEventListener('transitionend', () => { el.style.transitionDelay = '' }, { once: true })
        io.unobserve(el)
      }
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.01 })
    revealItems.forEach(el => io.observe(el))
    // If the user switches to reduced motion mid-visit, show everything.
    reduce.addEventListener?.('change', e => { if (e.matches) showAll() })
  } else {
    showAll()
  }

  /* ---------- channel scrollspy: rail, mobile switcher and header ---------- */
  const sections = [...document.querySelectorAll('.chan-section[data-channel]')]
  const navLinks = [...document.querySelectorAll('[data-nav] a[href^="#"]')]
  const nameEls = [...document.querySelectorAll('[data-cur-name]')]
  const topicEl = document.querySelector('[data-cur-topic]')
  let current = null

  function setActive(section) {
    if (!section || section === current) return
    current = section
    const id = section.id
    const order = sections.indexOf(section)
    nameEls.forEach(el => { el.textContent = section.dataset.channel })
    if (topicEl) topicEl.textContent = section.dataset.topic || ''
    navLinks.forEach(a => {
      const target = a.getAttribute('href').slice(1)
      const idx = sections.findIndex(s => s.id === target)
      if (target === id) a.setAttribute('aria-current', 'true')
      else a.removeAttribute('aria-current')
      a.classList.toggle('unread', idx > order)
    })
  }

  let ticking = false
  function spy() {
    ticking = false
    const line = Math.min(innerHeight * 0.35, 320)
    let pick = sections[0]
    for (const s of sections) {
      if (s.getBoundingClientRect().top <= line) pick = s
    }
    const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 4
    if (atBottom) pick = sections[sections.length - 1]
    setActive(pick)
  }
  addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(spy) }
  }, { passive: true })
  addEventListener('resize', spy)
  spy()

  /* ---------- mobile channel switcher ---------- */
  const switcher = document.querySelector('.switcher')
  if (switcher) {
    switcher.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { switcher.open = false }))
    document.addEventListener('click', e => {
      if (switcher.open && !switcher.contains(e.target)) switcher.open = false
    })
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && switcher.open) {
        switcher.open = false
        switcher.querySelector('summary').focus()
      }
    })
  }

  /* ---------- autoplay video: pause offscreen, never autoplay with reduced motion ---------- */
  const autoVideos = [...document.querySelectorAll('video[autoplay]')]
  function stopAutoplay(v) {
    v.removeAttribute('autoplay')
    v.pause()
    v.controls = true
  }
  if (reduce.matches) {
    autoVideos.forEach(stopAutoplay)
  } else if (hasIO) {
    const vio = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const v = entry.target
        if (!v.hasAttribute('autoplay')) continue
        if (entry.isIntersecting) v.play().catch(() => {})
        else v.pause()
      }
    }, { threshold: 0.2 })
    autoVideos.forEach(v => vio.observe(v))
  }
  reduce.addEventListener?.('change', e => { if (e.matches) autoVideos.forEach(stopAutoplay) })

  /* ---------- screenshot lightbox (links open the full image without JS) ---------- */
  const dialog = document.querySelector('.lightbox')
  if (dialog && typeof dialog.showModal === 'function') {
    const img = dialog.querySelector('img')
    const cap = dialog.querySelector('.lb-cap')
    document.addEventListener('click', e => {
      const link = e.target.closest('a[data-lightbox]')
      if (!link || e.ctrlKey || e.metaKey || e.shiftKey) return
      e.preventDefault()
      const thumb = link.querySelector('img')
      img.src = link.href
      img.alt = thumb ? thumb.alt : ''
      cap.textContent = link.dataset.name || ''
      dialog.showModal()
    })
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close() })
    dialog.addEventListener('close', () => { img.removeAttribute('src') })
  }
})()
