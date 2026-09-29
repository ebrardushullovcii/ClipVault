// ClipVault concept 09: motion control, scroll-driven type, offscreen video pausing.
(() => {
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = document.getElementById('motion');
  const autoVideos = Array.from(document.querySelectorAll('video[data-auto]'));
  const hero = document.querySelector('.hero');
  const word = document.querySelector('.hw');
  const drifters = Array.from(document.querySelectorAll('[data-drift]'));

  let still = reduced.matches;
  const visible = new WeakMap();

  // Videos: play only when on screen and motion is allowed.
  const syncVideo = (v) => {
    if (!still && visible.get(v)) {
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } else {
      v.pause();
    }
  };

  if (still) autoVideos.forEach((v) => { v.removeAttribute('autoplay'); v.pause(); });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { visible.set(e.target, e.isIntersecting); syncVideo(e.target); });
    }, { threshold: 0.1 });
    autoVideos.forEach((v) => io.observe(v));
  } else {
    autoVideos.forEach((v) => { visible.set(v, true); syncVideo(v); });
  }

  // Scroll-driven transforms on the big type.
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  let queued = false;

  const update = () => {
    queued = false;
    if (still) return;
    const vh = window.innerHeight;
    if (hero && word) {
      const r = hero.getBoundingClientRect();
      word.style.setProperty('--hp', clamp(-r.top / Math.max(r.height, 1), 0, 1).toFixed(4));
    }
    for (const el of drifters) {
      const r = el.getBoundingClientRect();
      const p = clamp((vh - r.top) / (vh + r.height), 0, 1);
      el.style.setProperty('--p', p.toFixed(4));
    }
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };

  const clearDrift = () => {
    if (word) word.style.removeProperty('--hp');
    drifters.forEach((el) => el.style.removeProperty('--p'));
  };

  const apply = () => {
    root.classList.toggle('still', still);
    root.classList.toggle('drift', !still);
    if (toggle) toggle.setAttribute('aria-pressed', String(still));
    autoVideos.forEach(syncVideo);
    if (still) clearDrift(); else update();
  };

  if (toggle) toggle.addEventListener('click', () => { still = !still; apply(); });
  const onReducedChange = () => { still = reduced.matches; apply(); };
  if (reduced.addEventListener) reduced.addEventListener('change', onReducedChange);
  else if (reduced.addListener) reduced.addListener(onReducedChange);

  // Screenshots stay lazy for the first paint; once the page has loaded, fetch the rest
  // in idle time so fast scrollers and "jump to section" links never land on empty frames.
  const warmImages = () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => { img.loading = 'eager'; });
  };
  window.addEventListener('load', () => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(warmImages, { timeout: 1200 });
    else window.setTimeout(warmImages, 800);
  });

  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  apply();
})();
