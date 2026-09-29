/* ClipVault · 01 Broadcast: telestrator, reveals, scorebug, ticker, video control */
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const f = n => n.toFixed(1);

  /* ---------- telestrator paths (hand-drawn look, deterministic) ---------- */

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function rng(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Catmull-Rom through points -> cubic Béziers
  function smooth(p) {
    let d = `M${f(p[0][0])} ${f(p[0][1])}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)}` +
        ` ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
    }
    return d;
  }
  // An ellipse drawn in one stroke that overshoots its start, like a telestrator circle.
  function loop(cx, cy, rx, ry, rot, seed) {
    const r = rng(seed);
    const n = 13;
    const start = (-0.8 + r() * 0.3) * Math.PI;
    const sweep = Math.PI * 2 + 0.5 + r() * 0.2;
    const c = Math.cos((rot * Math.PI) / 180), s = Math.sin((rot * Math.PI) / 180);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = start + sweep * t;
      const g = 0.95 + 0.1 * t + (r() - 0.5) * 0.035;
      const x = Math.cos(a) * rx * g, y = Math.sin(a) * ry * g;
      pts.push([cx + x * c - y * s, cy + x * s + y * c]);
    }
    return smooth(pts);
  }
  function arrow(x1, y1, x2, y2, bend) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
    const cx = (x1 + x2) / 2 - (dy / len) * len * bend;
    const cy = (y1 + y2) / 2 + (dx / len) * len * bend;
    const tx = x2 - cx, ty = y2 - cy, tl = Math.hypot(tx, ty);
    const ux = tx / tl, uy = ty / tl;
    const L = Math.max(34, len * 0.2), a = 0.5;
    const rot = ang => [ux * Math.cos(ang) - uy * Math.sin(ang), ux * Math.sin(ang) + uy * Math.cos(ang)];
    const [ax, ay] = rot(Math.PI - a), [bx, by] = rot(Math.PI + a);
    return [
      `M${f(x1)} ${f(y1)} Q${f(cx)} ${f(cy)} ${f(x2)} ${f(y2)}`,
      `M${f(x2 + ax * L)} ${f(y2 + ay * L)} L${f(x2)} ${f(y2)} L${f(x2 + bx * L)} ${f(y2 + by * L)}`,
    ];
  }
  const nums = s => s.trim().split(/\s+/).map(Number);

  document.querySelectorAll('.tl[data-loop]').forEach(el => {
    const [cx, cy, rx, ry, rot = 0] = nums(el.dataset.loop);
    el.setAttribute('d', loop(cx, cy, rx, ry, rot, hash(el.dataset.loop)));
    el.setAttribute('pathLength', '1');
    el.style.setProperty('--d', `${el.dataset.d || 0}s`);
  });
  document.querySelectorAll('.tl[data-arrow]').forEach(el => {
    const [x1, y1, x2, y2, bend = 0.2] = nums(el.dataset.arrow);
    const [shaft, tip] = arrow(x1, y1, x2, y2, bend);
    const d = parseFloat(el.dataset.d || 0);
    el.setAttribute('d', shaft);
    el.setAttribute('pathLength', '1');
    el.style.setProperty('--d', `${d}s`);
    el.style.setProperty('--dur', '.34s');
    const head = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    head.setAttribute('class', 'tl');
    head.setAttribute('d', tip);
    head.setAttribute('pathLength', '1');
    head.style.setProperty('--d', `${d + 0.32}s`);
    head.style.setProperty('--dur', '.18s');
    el.after(head);
  });

  /* ---------- count-ups (final values are already in the markup) ---------- */

  function countUp(el) {
    const target = Number(el.dataset.count);
    const clock = el.dataset.format === 'clock';
    const final = el.textContent;
    const fmt = v => clock ? `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}` : String(Math.round(v));
    const t0 = performance.now(), dur = 650;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = k < 1 ? fmt(target * (1 - Math.pow(1 - k, 3))) : final;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- reveal on scroll ---------- */

  const revealTargets = document.querySelectorAll('.lt, .wipe, .shot, .iso-card, .board, .play__step, .rule');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target;
        el.classList.add('is-in');
        io.unobserve(el);
        if (!reduce && el.classList.contains('board')) el.querySelectorAll('[data-count]').forEach(countUp);
      }
    }, { threshold: 0.2, rootMargin: '0px 0px -6% 0px' });
    revealTargets.forEach(el => io.observe(el));
  } else {
    revealTargets.forEach(el => el.classList.add('is-in'));
  }

  /* ---------- scorebug: current segment ---------- */

  const segEl = document.getElementById('bugSeg');
  const segBox = segEl && segEl.parentElement;
  function setSeg(name) {
    if (!segEl || !name || segEl.textContent === name) return;
    segEl.textContent = name;
    if (reduce) return;
    segBox.classList.remove('flip');
    void segBox.offsetWidth;
    segBox.classList.add('flip');
  }
  if (segEl && 'IntersectionObserver' in window) {
    const segIO = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) setSeg(e.target.dataset.seg);
    }, { rootMargin: '-40% 0px -55% 0px' });
    document.querySelectorAll('[data-seg]').forEach(s => segIO.observe(s));
  }

  /* ---------- autoplay loops: pause offscreen, respect reduced motion ---------- */

  const autos = [...document.querySelectorAll('video[autoplay]')];
  if (reduce) {
    autos.forEach(v => { v.removeAttribute('autoplay'); v.pause(); });
  } else if ('IntersectionObserver' in window) {
    const vio = new IntersectionObserver(entries => {
      for (const e of entries) {
        const v = e.target;
        if (v.dataset.held === '1') continue;
        if (e.isIntersecting) { const p = v.play(); if (p) p.catch(() => {}); } else v.pause();
      }
    }, { threshold: 0.15 });
    autos.forEach(v => vio.observe(v));
  }

  document.querySelectorAll('.vbtn').forEach(btn => {
    const v = document.getElementById(btn.dataset.video);
    if (!v) return;
    const sync = () => {
      btn.textContent = v.paused ? 'Play' : 'Pause';
      btn.setAttribute('aria-label', `${v.paused ? 'Play' : 'Pause'} video`);
    };
    btn.addEventListener('click', () => {
      if (v.paused) { v.dataset.held = '0'; const p = v.play(); if (p) p.catch(() => {}); }
      else { v.dataset.held = '1'; v.pause(); }
    });
    v.addEventListener('play', sync);
    v.addEventListener('pause', sync);
    sync();
  });

  /* ---------- news ticker ---------- */

  const ticker = document.querySelector('.ticker');
  if (ticker && !reduce) {
    const belt = ticker.querySelector('.ticker__belt');
    const track = ticker.querySelector('.ticker__track');
    const clone = track.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    belt.appendChild(clone);
    const setSpeed = () => belt.style.setProperty('--dur', `${Math.max(30, track.scrollWidth / 75)}s`);
    setSpeed();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(setSpeed);
    ticker.classList.add('is-running');
    const btn = ticker.querySelector('.ticker__btn');
    btn.addEventListener('click', () => {
      const paused = ticker.classList.toggle('is-paused');
      btn.setAttribute('aria-label', paused ? 'Play ticker' : 'Pause ticker');
    });
  }
})();
