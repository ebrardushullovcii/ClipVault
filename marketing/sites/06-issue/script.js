(() => {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasIO = 'IntersectionObserver' in window;

  // Masthead: set CLIPVAULT so it fills its grid cell exactly, then size the cover photo
  // so masthead, photo and cover story fit the first screen.
  const mast = document.getElementById('mastText');
  const head = document.querySelector('.top');
  function fit() {
    if (!mast || !head) return;
    const h1 = mast.parentElement;
    h1.style.fontSize = '';
    const fs0 = parseFloat(getComputedStyle(h1).fontSize);
    const w0 = mast.getBoundingClientRect().width;
    const avail = h1.clientWidth;
    if (fs0 > 0 && w0 > 0 && avail > 0) {
      // The span is pulled left by .045em for optical alignment, so it may be that much wider.
      const fs = avail / (w0 / fs0 - 0.045);
      h1.style.fontSize = fs.toFixed(2) + 'px';
    }
    root.style.setProperty('--head-h', head.offsetHeight + 'px');
  }
  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  let frame = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(fit);
  });

  // Fine fade and slide as blocks enter the page.
  const reveal = document.querySelectorAll('.rv');
  if (!reduce && hasIO) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.01 });
    reveal.forEach((el) => io.observe(el));
  } else {
    reveal.forEach((el) => el.classList.add('in'));
  }

  // Looping figures: no autoplay with reduced motion; otherwise play only while visible.
  const loops = document.querySelectorAll('video[data-autoplay]');
  if (reduce) {
    loops.forEach((v) => {
      v.removeAttribute('autoplay');
      v.autoplay = false;
      v.pause();
      v.controls = true;
    });
  } else if (hasIO) {
    const vo = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const v = e.target;
        if (e.isIntersecting) {
          const p = v.play();
          if (p && p.catch) p.catch(() => {});
        } else {
          v.pause();
        }
      }
    }, { threshold: 0.2 });
    loops.forEach((v) => vo.observe(v));
  }

  // Folio in the right margin names the section under the middle of the screen.
  const folio = document.getElementById('folio');
  if (folio && hasIO) {
    const fo = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) folio.textContent = e.target.dataset.folio;
    }, { rootMargin: '-45% 0px -54% 0px' });
    document.querySelectorAll('[data-folio]').forEach((s) => fo.observe(s));
  }

  // Column guides on or off (remembered per browser when storage is available).
  const btn = document.getElementById('gridToggle');
  if (btn) {
    let on = true;
    try { on = localStorage.getItem('clipvault-issue-grid') !== 'off'; } catch (e) { /* storage blocked */ }
    const apply = () => {
      root.classList.toggle('nogrid', !on);
      btn.setAttribute('aria-pressed', String(on));
    };
    apply();
    btn.addEventListener('click', () => {
      on = !on;
      apply();
      try { localStorage.setItem('clipvault-issue-grid', on ? 'on' : 'off'); } catch (e) { /* storage blocked */ }
    });
  }
})();
