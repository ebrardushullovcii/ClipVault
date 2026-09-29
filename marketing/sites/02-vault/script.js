/* ClipVault · Concept 02 "The Vault" */
(function () {
  'use strict';
  window.__vault = true;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var animated = document.documentElement.classList.contains('anim') && !reduce.matches;
  var hasIO = 'IntersectionObserver' in window;

  /* ---------------- Hero: vault door ---------------- */

  var vault = document.querySelector('.vault');
  var door = vault && vault.querySelector('.door');
  var dial = vault && vault.querySelector('.dial-face');
  var spokes = vault && vault.querySelector('.spokes');
  var video = document.getElementById('heroVideo');
  var playBtn = document.getElementById('heroPlay');
  var replayBtn = document.getElementById('vaultReplay');

  var userPaused = !animated;   // reduced motion: the clip waits for the visitor
  var heroVisible = true;
  var busy = false;

  function setPlayLabel() {
    if (playBtn) playBtn.textContent = video.paused ? 'Play video' : 'Pause video';
  }

  function playHero() {
    if (!video || userPaused || !heroVisible) return;
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
  }

  if (video) {
    video.addEventListener('play', setPlayLabel);
    video.addEventListener('pause', setPlayLabel);
    setPlayLabel();
  }
  if (playBtn) {
    playBtn.addEventListener('click', function () {
      if (video.paused) {
        userPaused = false;
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
      } else {
        userPaused = true;
        video.pause();
      }
    });
  }

  function run(el, frames, opts) {
    opts.fill = 'forwards';
    return el.animate(frames, opts).finished;
  }
  // Hand each finished animation back to the CSS state so nothing stays composited.
  function settle(els) {
    (els || [door, dial, spokes]).forEach(function (el) {
      el.getAnimations().forEach(function (a) { a.cancel(); });
    });
  }

  function openVault() {
    if (busy || !vault) return Promise.resolve();
    busy = true;
    vault.setAttribute('data-state', 'dialing');
    // One timeline for the whole sequence: dial, then handle, then door.
    // Combination: spin right, back left, land the record mark (234deg on the dial face) under the HOTKEY index.
    var aDial = dial.animate([
      { transform: 'rotate(0deg)', easing: 'cubic-bezier(.35,0,.25,1)' },
      { transform: 'rotate(560deg)', offset: 0.5, easing: 'cubic-bezier(.4,0,.3,1)' },
      { transform: 'rotate(330deg)', offset: 0.78, easing: 'cubic-bezier(.45,0,.2,1)' },
      { transform: 'rotate(486deg)' }
    ], { duration: 1000, fill: 'forwards' });
    var aSpokes = spokes.animate([
      { transform: 'rotate(45deg)' },
      { transform: 'rotate(25deg)' }
    ], { duration: 300, delay: 1000, fill: 'both', easing: 'cubic-bezier(.5,0,.2,1)' });
    var aDoor = door.animate([
      { transform: 'rotateY(0deg) translateZ(0px)', easing: 'cubic-bezier(.3,0,.4,1)' },
      { transform: 'rotateY(2deg) translateZ(6px)', offset: 0.12, easing: 'cubic-bezier(.42,0,.18,1)' },
      { transform: 'rotateY(104deg) translateZ(0px)' }
    ], { duration: 950, delay: 1300, fill: 'both' });
    // Anchor to now rather than to the first rendered frame, so a slow first paint
    // shortens the visible sequence instead of delaying the open vault.
    var t0 = document.timeline && document.timeline.currentTime;
    if (t0 != null) [aDial, aSpokes, aDoor].forEach(function (a) { a.startTime = t0; });

    aDial.finished.then(function () {
      vault.setAttribute('data-state', 'unlocked');
      aDial.cancel();
    });
    aSpokes.finished.then(function () {
      vault.setAttribute('data-state', 'swinging');
      aSpokes.cancel();
      if (video) { try { video.currentTime = 0; } catch (e) {} }
      playHero();
    });
    return aDoor.finished.then(function () {
      vault.setAttribute('data-state', 'open');
      aDoor.cancel();
      busy = false;
      playHero();
    });
  }

  function closeVault() {
    if (busy || !vault) return Promise.resolve();
    busy = true;
    return run(door, [
      { transform: 'rotateY(104deg)' },
      { transform: 'rotateY(0deg)' }
    ], { duration: 900, easing: 'cubic-bezier(.5,0,.25,1)' }).then(function () {
      vault.setAttribute('data-state', 'closed');
      if (video) video.pause();
      return Promise.all([
        run(spokes, [{ transform: 'rotate(25deg)' }, { transform: 'rotate(45deg)' }], { duration: 300, easing: 'ease-in-out' }),
        run(dial, [{ transform: 'rotate(486deg)' }, { transform: 'rotate(0deg)' }], { duration: 650, easing: 'cubic-bezier(.4,0,.2,1)' })
      ]);
    }).then(function () {
      settle();
      busy = false;
    });
  }

  if (vault && animated && typeof door.animate === 'function') {
    var started = false;
    var start = function () {
      if (started) return;
      started = true;
      openVault();
    };
    if (hasIO) {
      var vio = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { start(); vio.disconnect(); }
      }, { threshold: 0.5 });
      vio.observe(vault);
    } else {
      start();
    }
    if (replayBtn) {
      replayBtn.addEventListener('click', function () {
        if (busy || vault.getAttribute('data-state') !== 'open') return;
        closeVault().then(function () { setTimeout(openVault, 250); });
      });
    }
  } else if (vault) {
    vault.setAttribute('data-state', 'open');
  }

  /* Pause videos that scroll out of view. */
  if (hasIO) {
    var vids = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (v === video) {
          heroVisible = e.isIntersecting;
          if (!heroVisible) video.pause();
          else if (/^(swinging|open)$/.test(vault.getAttribute('data-state'))) playHero();
        } else if (!e.isIntersecting && !v.paused) {
          v.pause();
        }
      });
    }, { threshold: 0.15 });
    document.querySelectorAll('video').forEach(function (v) { vids.observe(v); });
  }

  /* Below-the-fold images stay lazy for the first paint, then load while the page is idle,
     so the drawer screenshots are ready before a box is opened. */
  function warmImages() {
    document.querySelectorAll('img[loading="lazy"]').forEach(function (img) { img.loading = 'eager'; });
  }
  window.addEventListener('load', function () {
    if ('requestIdleCallback' in window) window.requestIdleCallback(warmImages, { timeout: 1500 });
    else setTimeout(warmImages, 1200);
  });

  /* Smooth scrolling for the section links only (a global scroll-behavior would also
     slow down every programmatic scroll). */
  document.querySelectorAll('a[href^="#"]:not(.skip)').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href').slice(1);
      var target = id ? document.getElementById(id) : null;
      if (!target || reduce.matches) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (history.pushState) history.pushState(null, '', '#' + id);
    });
  });

  /* ---------------- Safe-deposit boxes ---------------- */

  var wide = window.matchMedia('(min-width: 1000px)');
  var boxes = Array.prototype.slice.call(document.querySelectorAll('.box'));

  function drawerOf(box) { return document.getElementById(box.getAttribute('aria-controls')); }

  function openBox(target) {
    boxes.forEach(function (b) {
      var on = b === target;
      if ((b.getAttribute('aria-expanded') === 'true') === on) return;
      b.setAttribute('aria-expanded', on ? 'true' : 'false');
      drawerOf(b).hidden = !on;
    });
  }
  function closeBox(box) {
    box.setAttribute('aria-expanded', 'false');
    drawerOf(box).hidden = true;
  }

  var hoverTimer = 0;
  boxes.forEach(function (box) {
    box.addEventListener('click', function () {
      var isOpen = box.getAttribute('aria-expanded') === 'true';
      if (!wide.matches && isOpen) { closeBox(box); return; }
      openBox(box);
      if (!wide.matches) {
        var d = drawerOf(box);
        var r = d.getBoundingClientRect();
        if (r.bottom > window.innerHeight || r.top < 60) {
          d.scrollIntoView({ block: 'nearest', behavior: reduce.matches ? 'auto' : 'smooth' });
        }
      }
    });
    // Keyboard focus pulls the box out on the wide layout (the detail sits beside the wall).
    box.addEventListener('focus', function () {
      var kb = true;
      try { kb = box.matches(':focus-visible'); } catch (e) {}
      if (kb && wide.matches) openBox(box);
    });
    // Hover intent, so sweeping the pointer across the wall does not flip every box.
    box.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse' || !wide.matches) return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(function () { openBox(box); }, 170);
    });
    box.addEventListener('pointerleave', function () { clearTimeout(hoverTimer); });
  });

  function ensureOneOpen() {
    if (!wide.matches) return;
    var any = boxes.some(function (b) { return b.getAttribute('aria-expanded') === 'true'; });
    if (!any && boxes[0]) openBox(boxes[0]);
  }
  if (wide.addEventListener) wide.addEventListener('change', ensureOneOpen);
  else if (wide.addListener) wide.addListener(ensureOneOpen);
})();
