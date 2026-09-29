// ClipVault · 03 Rewind
(() => {
  const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const pad = n => String(n).padStart(2, '0');

  /* ---------- lazy images: once the visitor starts scrolling, fetch the rest of the page's
     images so fast scrolling does not land on empty screens. Nothing extra loads before that. */

  const lazyImgs = $$('img[loading="lazy"]');
  if (lazyImgs.length) {
    const eager = () => {
      lazyImgs.forEach(img => { img.loading = 'eager'; });
      window.removeEventListener('scroll', eager);
    };
    window.addEventListener('scroll', eager, { passive: true });
  }

  /* ---------- videos: OSD state, play/pause buttons, play only while visible */

  const autoVideos = $$('video[data-auto]');
  const userPaused = new WeakSet();

  if (rm) autoVideos.forEach(v => { v.removeAttribute('autoplay'); v.pause(); });

  function setOsd(v) {
    const mode = $(`[data-osd-mode="${v.id}"]`);
    if (mode) {
      if (v.hidden) mode.textContent = 'STILL ■';
      else if (!v.paused) mode.textContent = 'PLAY ▶';
      else if (v.ended || v.currentTime === 0) mode.textContent = 'STOP ■';
      else mode.textContent = 'PAUSE ‖';
    }
    const btn = $(`[data-toggle="${v.id}"]`);
    if (btn) {
      const paused = v.paused || v.hidden;
      btn.disabled = v.hidden;
      btn.setAttribute('aria-label', paused ? 'Play video' : 'Pause video');
      btn.querySelector('.crt__btn-icon').textContent = paused ? '▶' : '‖';
      btn.querySelector('.crt__btn-text').textContent = paused ? 'Play' : 'Pause';
    }
  }

  $$('video').forEach(v => {
    ['play', 'playing', 'pause', 'ended', 'emptied'].forEach(ev => v.addEventListener(ev, () => setOsd(v)));
    setOsd(v);
  });

  function tryPlay(v) {
    const p = v.play();
    if (p && p.catch) p.catch(() => setOsd(v));
  }

  // A play started by the visitor is allowed even with reduced motion.
  function userPlay(v) {
    v.dataset.user = '1';
    userPaused.delete(v);
    tryPlay(v);
  }

  $$('[data-toggle]').forEach(btn => {
    const v = document.getElementById(btn.dataset.toggle);
    if (!v) return;
    btn.addEventListener('click', () => {
      if (v.paused) userPlay(v);
      else { userPaused.add(v); v.pause(); }
    });
  });

  const canAutoplay = v => (!rm || v.dataset.user) && !userPaused.has(v) && !v.hidden;

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        const v = e.target;
        v.dataset.visible = e.isIntersecting ? '1' : '0';
        if (e.isIntersecting) { if (canAutoplay(v) && v.paused) tryPlay(v); }
        else if (!v.paused) v.pause();
      });
    }, { threshold: 0.2 });
    autoVideos.forEach(v => io.observe(v));
    const bayVideo = $('#bay-video');
    if (bayVideo) {
      new IntersectionObserver(([e]) => { if (!e.isIntersecting && !bayVideo.paused) bayVideo.pause(); }, { threshold: 0 })
        .observe(bayVideo.parentElement);
    }
  }
  const inView = v => v.dataset.visible !== '0';

  // Pause the other videos when the tour starts.
  const tour = $('#tour-video');
  if (tour) {
    tour.addEventListener('play', () => $$('video').forEach(v => { if (v !== tour && !v.paused) v.pause(); }));
    const big = $('[data-play="tour-video"]');
    if (big) {
      big.addEventListener('click', () => { userPlay(tour); tour.focus(); });
      tour.addEventListener('play', () => { big.hidden = true; });
      tour.addEventListener('ended', () => { big.hidden = false; });
    }
    const t = $('[data-osd-time="tour-video"]');
    if (t) tour.addEventListener('timeupdate', () => {
      const s = Math.floor(tour.currentTime);
      t.textContent = `${Math.floor(s / 60)}:${pad(s % 60)}`;
    });
  }

  /* ---------- hero tape counter (keeps counting across loops, like a VCR) */

  const hv = $('#hero-video');
  const counter = $('[data-osd-counter="hero-video"]');
  if (hv && counter) {
    let total = 0;
    let last = 0;
    const fmt = s => {
      s = Math.floor(s);
      return `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
    };
    hv.addEventListener('timeupdate', () => {
      let d = hv.currentTime - last;
      if (d < 0) d += hv.duration || 12;
      if (d > 0 && d < 2) total += d;
      last = hv.currentTime;
      counter.textContent = fmt(total);
    });
  }

  /* ---------- the shelf: pull a tape, play it on the small TV */

  const spines = $$('.spine[data-kind]');
  const vv = $('#viewer-video');
  const vi = $('#viewer-img');
  const screen = $('#viewer-screen');
  const frame = (n, w) => `../assets/frames/${n}-${w}.webp`;

  function selectSpine(sp) {
    const d = sp.dataset;
    spines.forEach(s => s.setAttribute('aria-pressed', String(s === sp)));
    if (!rm) {
      screen.classList.remove('is-switching');
      void screen.offsetWidth;
      screen.classList.add('is-switching');
    }
    $('#viewer-file').textContent = d.file;
    $('#viewer-tags').textContent = d.tags;
    $('#viewer-alt').textContent = d.alt;
    $('#viewer-stamp').textContent = d.stamp;

    if (d.kind === 'video') {
      vi.hidden = true;
      vv.hidden = false;
      vv.poster = frame(d.poster, 960);
      if (vv.getAttribute('src') !== d.src) {
        vv.setAttribute('src', d.src);
        vv.load();
      }
      userPaused.delete(vv);
      if (canAutoplay(vv) && inView(vv)) tryPlay(vv);
    } else {
      vv.pause();
      vv.hidden = true;
      vi.srcset = `${frame(d.poster, 960)} 960w, ${frame(d.poster, 1920)} 1920w`;
      vi.src = frame(d.poster, 960);
      vi.alt = d.alt;
      vi.hidden = false;
    }
    setOsd(vv);
  }

  spines.forEach(sp => sp.addEventListener('click', () => selectSpine(sp)));

  // Arrow keys move along the shelf.
  const row = $('.shelf__row');
  if (row) {
    row.addEventListener('keydown', e => {
      const i = spines.indexOf(document.activeElement);
      if (i < 0) return;
      let j = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % spines.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + spines.length) % spines.length;
      if (j < 0) return;
      e.preventDefault();
      spines[j].focus();
    });
  }

  /* ---------- library channels: 1 is the video tape, 2 to 5 are screenshots */

  const libImg = $('#lib-img');
  const libVideo = $('#lib-video');
  const libCh = $('#lib-ch');
  const channels = $$('.channel');
  channels.forEach((b, i) => b.addEventListener('click', () => {
    channels.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    libCh.textContent = `CH ${i + 1} · ${b.dataset.label}`;
    if (b.dataset.video) {
      libImg.hidden = true;
      libVideo.hidden = false;
      userPaused.delete(libVideo);
      if (canAutoplay(libVideo) && inView(libVideo)) tryPlay(libVideo);
    } else {
      const s = b.dataset.shot;
      libVideo.pause();
      libVideo.hidden = true;
      libImg.srcset = `../assets/shots/${s}-960.webp 960w, ../assets/shots/${s}-1600.webp 1600w`;
      libImg.src = `../assets/shots/${s}-960.webp`;
      libImg.alt = b.dataset.alt;
      libImg.hidden = false;
    }
    setOsd(libVideo);
  }));

  /* ---------- editing bay deck */

  const STATES = {
    play: {
      lcd: [['MODE', 'PLAY'], ['TIME', '0:00'], ['LEN', '0:17']],
      cap: 'The editor on tape: tag the clip, trim it to the moment, mute the mic, and export under 10 MB. 17 seconds, captioned.',
    },
    full: {
      shot: '09-editor',
      lcd: [['IN', '0:00.00'], ['OUT', '2:02.02'], ['LEN', '2:02.02']],
      cap: 'The clip as saved: 2:02.02 of VALORANT at 1920×1080, 60 fps. Both audio tracks are on.',
      alt: 'ClipVault editor on the new VALORANT clip, untrimmed at 2:02.02, with both audio tracks on and the export panel on the right.',
    },
    trim: {
      shot: '10-editor-trimmed',
      lcd: [['IN', '0:38.38'], ['OUT', '1:04.18'], ['LEN', '0:25.79']],
      cap: 'Trim handles set around the “WON” moment: 0:38.38 to 1:04.18, 25.79 seconds. Playback stays inside the trim.',
      alt: 'ClipVault editor on the VALORANT clip, trimmed from 0:38.38 to 1:04.18 around the WON banner. Audio tracks and export settings are on the right.',
    },
    audio: {
      shot: '11-editor-audio',
      lcd: [['GAME', 'ON'], ['MIC', 'OFF'], ['LEN', '0:25.79']],
      cap: 'Microphone off, desktop audio turned up. Disabled tracks are muted while editing and left out of the export.',
      alt: 'ClipVault editor with the Microphone track unchecked and the Desktop Audio volume raised.',
    },
    export: {
      shot: '12-editor-size-menu',
      lcd: [['SIZE', '10 MB'], ['LEN', '0:25.79'], ['MIC', 'OFF']],
      cap: 'The export size menu: keep original, up to 10 MB, up to 50 MB, or up to 100 MB.',
      alt: 'ClipVault editor with the export size menu open: Keep original, Up to 10 MB (selected), Up to 50 MB, Up to 100 MB.',
    },
  };

  const deck = $('.deck');
  const bayImg = $('#bay-img');
  const bayVideo = $('#bay-video');
  const bayCap = $('#bay-cap');
  const keys = $$('.deck-key');
  const setLcd = rows => rows.forEach(([k, v], i) => {
    $(`[data-lcd="k${i}"]`).textContent = k;
    $(`[data-lcd="v${i}"]`).textContent = v;
  });

  keys.forEach(k => k.addEventListener('click', () => {
    const name = k.dataset.state;
    const st = STATES[name];
    if (!st) return;
    keys.forEach(x => x.setAttribute('aria-pressed', String(x === k)));
    deck.dataset.state = name;
    setLcd(st.lcd);
    bayCap.textContent = st.cap;
    if (name === 'play') {
      bayImg.hidden = true;
      bayVideo.hidden = false;
      if (bayVideo.paused) userPlay(bayVideo);
      else { userPaused.add(bayVideo); bayVideo.pause(); }
      return;
    }
    bayVideo.pause();
    bayVideo.hidden = true;
    bayImg.srcset = `../assets/shots/${st.shot}-960.webp 960w, ../assets/shots/${st.shot}-1600.webp 1600w`;
    bayImg.src = `../assets/shots/${st.shot}-960.webp`;
    bayImg.alt = st.alt;
    bayImg.hidden = false;
  }));

  if (bayVideo) {
    bayVideo.addEventListener('timeupdate', () => {
      if (deck.dataset.state !== 'play') return;
      const s = Math.floor(bayVideo.currentTime);
      $('[data-lcd="v1"]').textContent = `0:${pad(s)}`;
    });
    ['play', 'pause'].forEach(ev => bayVideo.addEventListener(ev, () => {
      if (deck.dataset.state === 'play') $('[data-lcd="v0"]').textContent = bayVideo.paused ? 'PAUSE' : 'PLAY';
    }));
  }
})();
