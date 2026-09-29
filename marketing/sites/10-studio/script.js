(() => {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = window.matchMedia('(min-width: 960px)');
  const header = document.getElementById('site-header');

  /* ---------- Reveal on scroll ---------- */
  const reveals = document.querySelectorAll('.reveal');
  if (reduce.matches || !('IntersectionObserver' in window)) {
    reveals.forEach((el) => el.classList.add('is-in'));
  } else {
    const revealer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            revealer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.06 }
    );
    reveals.forEach((el) => revealer.observe(el));
  }

  /* ---------- Hero video: play/pause control, pause offscreen ---------- */
  const video = document.getElementById('hero-video');
  const toggle = document.querySelector('[data-video-toggle]');
  if (video && toggle) {
    let userPaused = reduce.matches;
    const sync = () => {
      const paused = video.paused;
      toggle.dataset.state = paused ? 'paused' : 'playing';
      toggle.setAttribute('aria-label', paused ? 'Play video' : 'Pause video');
    };
    video.addEventListener('play', sync);
    video.addEventListener('pause', sync);
    sync();

    toggle.addEventListener('click', () => {
      if (video.paused) {
        userPaused = false;
        video.play().catch(() => {});
      } else {
        userPaused = true;
        video.pause();
      }
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            if (!userPaused && video.paused) video.play().catch(() => {});
          } else if (!video.paused) {
            video.pause();
          }
        },
        { threshold: 0.15 }
      ).observe(video);
    }
  }

  /* ---------- Scrollytelling ---------- */
  const steps = Array.from(document.querySelectorAll('.step'));
  const stepBodies = steps.map((s) => s.querySelector('.step__body'));
  const stageImgs = Array.from(document.querySelectorAll('.laptop__screen img'));
  const bars = Array.from(document.querySelectorAll('.story__bars li'));
  const count = document.querySelector('.story__count');
  const label = document.querySelector('.story__name');
  const pin = document.getElementById('story-pin');
  const names = ['Library', 'Preview', 'Trim', 'Audio', 'Size', 'Share'];
  let active = 0;

  const setActive = (i) => {
    if (i === active) return;
    active = i;
    steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
    stageImgs.forEach((img, k) => img.classList.toggle('is-active', k === i));
    bars.forEach((b, k) => {
      b.classList.toggle('is-active', k === i);
      b.classList.toggle('is-done', k < i);
    });
    if (count) count.textContent = String(i + 1).padStart(2, '0');
    if (label) label.textContent = names[i] || '';
  };

  const updateStory = () => {
    if (!desktop.matches || !steps.length) return;
    const line = window.innerHeight * 0.62;
    let idx = 0;
    stepBodies.forEach((body, k) => {
      if (body && body.getBoundingClientRect().top < line) idx = k;
    });
    setActive(idx);
  };

  const measurePin = () => {
    if (pin && desktop.matches) pin.style.setProperty('--pin-h', pin.offsetHeight + 'px');
  };

  /* ---------- Scroll + resize ---------- */
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
      updateStory();
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => {
    measurePin();
    onScroll();
  });
  window.addEventListener('load', measurePin);
  measurePin();
  onScroll();

  /* ---------- Tour dialog ---------- */
  const dialog = document.getElementById('tour');
  const openers = document.querySelectorAll('[data-tour-open]');
  if (dialog && typeof dialog.showModal === 'function') {
    const tourVideo = dialog.querySelector('video');
    const closeBtn = dialog.querySelector('[data-tour-close]');
    const foot = dialog.querySelector('.tour__foot');
    let lastFocus = null;

    const focusables = () =>
      Array.from(dialog.querySelectorAll('button, a[href], video[controls]')).filter(
        (el) => !el.disabled && el.getClientRects().length > 0
      );

    const open = (event) => {
      event.preventDefault();
      lastFocus = document.activeElement;
      if (!tourVideo.getAttribute('src')) {
        tourVideo.poster = tourVideo.dataset.poster;
        tourVideo.src = tourVideo.dataset.src;
      }
      dialog.showModal();
      closeBtn.focus();
      if (!reduce.matches) tourVideo.play().catch(() => {});
    };

    openers.forEach((opener) => {
      opener.setAttribute('role', 'button');
      opener.setAttribute('aria-haspopup', 'dialog');
      opener.setAttribute('aria-controls', 'tour');
      opener.addEventListener('click', open);
      opener.addEventListener('keydown', (event) => {
        if (event.key === ' ') open(event);
      });
    });

    closeBtn.addEventListener('click', () => dialog.close());

    // Clicking the dimmed backdrop closes the dialog.
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });

    // Esc closes natively (cancel -> close); restore state and focus.
    dialog.addEventListener('close', () => {
      tourVideo.pause();
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    });

    // Keep Tab inside the dialog.
    dialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || !dialog.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !dialog.contains(current))) {
        event.preventDefault();
        first.focus();
      }
    });

    tourVideo.addEventListener('error', () => {
      if (foot && !foot.dataset.failed) {
        foot.dataset.failed = '1';
        foot.insertAdjacentText('afterbegin', 'The tour video could not be loaded here. ');
      }
    });
  }
})();
