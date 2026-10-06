// Progressive enhancements only; every page works without this file.
// Budget (design/handoff/README.md): theme toggle, filter chips, copy email,
// closing menus, opening details before print, the role-view carousel.
(function () {
  var root = document.documentElement;

  // Theme toggle: follow the system until the visitor picks, then remember.
  function isDark() {
    var t = root.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function syncThemeLabel() {
    document.querySelectorAll('.theme-toggle').forEach(function (b) {
      var label = isDark() ? 'Switch to light theme' : 'Switch to dark theme';
      b.setAttribute('aria-label', label);
      b.title = label;
    });
  }
  document.querySelectorAll('.theme-toggle').forEach(function (b) {
    b.hidden = false;
    b.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      syncThemeLabel();
    });
  });
  syncThemeLabel();

  // Copy email.
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.hidden = false;
    b.addEventListener('click', function () {
      var text = b.getAttribute('data-copy');
      var done = function () {
        b.textContent = 'Copied';
        setTimeout(function () { b.textContent = 'Copy'; }, 2000);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {});
    });
  });

  // Close open menus on outside click or Esc.
  var menus = document.querySelectorAll('details.menu');
  document.addEventListener('click', function (e) {
    menus.forEach(function (m) { if (m.open && !m.contains(e.target)) m.open = false; });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    menus.forEach(function (m) {
      if (m.open) { m.open = false; m.querySelector('summary').focus(); }
    });
  });

  // Experience filter chips: dim non-matching cards; cards never leave the DOM.
  var chipGroup = document.querySelector('.filters');
  if (chipGroup) {
    chipGroup.hidden = false;
    var status = chipGroup.querySelector('.status-line');
    var defaultStatus = status.textContent;
    var cards = document.querySelectorAll('#experience .card');
    chipGroup.querySelectorAll('.chip-btn').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var on = chip.getAttribute('aria-pressed') !== 'true';
        chipGroup.querySelectorAll('.chip-btn').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
        var tag = on ? chip.getAttribute('data-tag') : null;
        if (on) chip.setAttribute('aria-pressed', 'true');
        var n = 0;
        cards.forEach(function (card) {
          var match = !tag || card.getAttribute('data-tag') === tag;
          card.classList.toggle('is-dim', !match);
          if (match) n++;
        });
        status.textContent = tag ? 'Highlighting ' + n + ' of ' + cards.length + ': ' + tag : defaultStatus;
      });
    });
  }

  // Sticky "On this page" rail: highlight the section being read.
  var railLinks = document.querySelectorAll('.rail ol a[href^="#"]');
  if (railLinks.length && 'IntersectionObserver' in window) {
    var byId = {};
    railLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var visibleIds = new Set();
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) visibleIds.add(e.target.id); else visibleIds.delete(e.target.id); });
      var current = null;
      railLinks.forEach(function (a) { var id = a.getAttribute('href').slice(1); if (!current && visibleIds.has(id)) current = id; });
      if (!current) return;
      railLinks.forEach(function (a) { a.removeAttribute('aria-current'); });
      byId[current].setAttribute('aria-current', 'true');
    }, { rootMargin: '-20% 0px -60% 0px' });
    Object.keys(byId).forEach(function (id) { var s = document.getElementById(id); if (s) observer.observe(s); });
  }

  // Role-view carousel (/views/): one card in focus, neighbours scaled back, looping in both directions.
  // Swipe, arrows, keys or name pills. A copy of the cards sits on each side of the real ones; when scrolling
  // settles on a copy, the track jumps to the matching real card. The copies are identical, so the jump is invisible.
  var carousel = document.querySelector('.carousel');
  if (carousel) {
    var track = carousel.querySelector('.carousel__track');
    var real = Array.prototype.slice.call(track.children);
    var n = real.length;
    var pills = carousel.querySelectorAll('[data-go]');
    var prevBtn = carousel.querySelector('.carousel__btn--prev');
    var nextBtn = carousel.querySelector('.carousel__btn--next');
    var statusEl = carousel.querySelector('[data-carousel-status]');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var copy = function (s) {
      var c = s.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      c.querySelectorAll('a, button').forEach(function (a) { a.setAttribute('tabindex', '-1'); });
      return c;
    };
    real.slice().reverse().forEach(function (s) { track.insertBefore(copy(s), track.firstChild); });
    real.forEach(function (s) { track.appendChild(copy(s)); });
    var slides = Array.prototype.slice.call(track.children); // copies, real (n … 2n-1), copies
    var current = -1, shown = -1, frame = 0, settleTimer = 0, refocus = false;

    carousel.classList.add('carousel--on');
    carousel.querySelector('.carousel__nav').hidden = false;
    prevBtn.hidden = false;
    nextBtn.hidden = false;

    var leftFor = function (k) { var s = slides[k]; return s.offsetLeft - (track.clientWidth - s.offsetWidth) / 2; };
    var goTo = function (k, instant) {
      k = Math.max(0, Math.min(slides.length - 1, k));
      track.scrollTo({ left: leftFor(k), behavior: instant || reduceMotion.matches ? 'instant' : 'smooth' });
    };
    var setCurrent = function (k) {
      if (k === current) return;
      current = k;
      slides.forEach(function (s, j) { s.classList.toggle('is-current', j === k); });
      var i = k % n;
      if (i === shown) return;
      shown = i;
      pills.forEach(function (p, j) { if (j === i) p.setAttribute('aria-current', 'true'); else p.removeAttribute('aria-current'); });
      statusEl.textContent = real[i].getAttribute('aria-label');
    };
    // Scale and fade each card by its distance from the centre, so the effect follows the finger while swiping.
    var update = function () {
      frame = 0;
      var mid = track.scrollLeft + track.clientWidth / 2;
      var best = 0, bestP = 2;
      slides.forEach(function (s, k) {
        var p = Math.min(Math.abs(s.offsetLeft + s.offsetWidth / 2 - mid) / s.offsetWidth, 1);
        s.style.setProperty('--p', p.toFixed(3));
        if (p < bestP) { bestP = p; best = k; }
      });
      setCurrent(best);
    };
    // Once scrolling stops, move from a copy back to the real card, then restore keyboard focus if it was moving.
    var settle = function () {
      clearTimeout(settleTimer);
      update();
      if (current < n || current >= 2 * n) {
        track.scrollTo({ left: track.scrollLeft + leftFor(n + (current % n)) - leftFor(current), behavior: 'instant' });
        update();
      }
      if (refocus) { refocus = false; slides[current].querySelector('a').focus({ preventScroll: true }); }
    };

    track.addEventListener('scroll', function () {
      if (!frame) frame = requestAnimationFrame(update);
      clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, 150);
    }, { passive: true });
    track.addEventListener('scrollend', settle);
    window.addEventListener('resize', function () { goTo(current, true); update(); });
    prevBtn.addEventListener('click', function () { goTo(current - 1); });
    nextBtn.addEventListener('click', function () { goTo(current + 1); });
    // A pill goes the short way round to its card.
    pills.forEach(function (p) {
      p.addEventListener('click', function () {
        var i = Number(p.getAttribute('data-go'));
        var best = [i, i + n, i + 2 * n].sort(function (a, b) { return Math.abs(a - current) - Math.abs(b - current); })[0];
        goTo(best);
      });
    });
    // A side card's first click brings it into focus; clicking the focused card opens the view.
    slides.forEach(function (s, k) {
      s.querySelector('a').addEventListener('click', function (e) { if (k !== current) { e.preventDefault(); goTo(k); } });
    });
    // Keyboard: tabbing to a card centres it; left and right arrows move round the loop.
    track.addEventListener('focusin', function (e) {
      var k = slides.indexOf(e.target.closest('.carousel__slide'));
      if (k >= 0 && k !== current && e.target.matches(':focus-visible')) goTo(k);
    });
    carousel.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      refocus = track.contains(document.activeElement);
      goTo(current + (e.key === 'ArrowRight' ? 1 : -1));
    });
    goTo(n, true);
    update();
  }

  // Print: open every disclosure so collapsed content prints.
  window.addEventListener('beforeprint', function () {
    root.setAttribute('data-printing', '1'); // so analytics doesn't count these as expands
    document.querySelectorAll('details').forEach(function (d) { d.open = true; });
  });
  window.addEventListener('afterprint', function () {
    setTimeout(function () { root.removeAttribute('data-printing'); }, 1000);
  });
})();

// First-party, cookieless analytics (DESIGN.md, "Analytics"). No cookies, no storage of
// identifiers, no third parties: events go to /api/collect on this site. Admin pages and
// browsers that opted out in admin ("Exclude this browser") send nothing.
(function () {
  var root = document.documentElement;
  var path = location.pathname;
  try { if (localStorage.getItem('np-no-track') === '1') return; } catch (e) {}
  if (/^\/(admin|sign-in)(\/|$)/.test(path) || !navigator.sendBeacon) return;

  var queue = [];
  function send(useBeacon) {
    if (!queue.length) return;
    var body = JSON.stringify({ events: queue.splice(0, 25) });
    if (useBeacon) navigator.sendBeacon('/api/collect', new Blob([body], { type: 'text/plain' }));
    else fetch('/api/collect', { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(function () {});
  }
  function track(type, label, value) {
    queue.push({ type: type, path: path, label: label == null ? undefined : String(label), value: value });
    if (queue.length >= 20) send(false);
  }

  // Page view (or not-found), with where the visitor came from.
  var params = new URLSearchParams(location.search);
  var referrer = '';
  try { referrer = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {}
  queue.push({
    type: root.getAttribute('data-page') === '404' ? 'notfound' : 'pageview',
    path: path,
    ref: params.get('ref') || undefined,
    referrer: referrer || undefined,
    screen: screen.width + 'x' + screen.height,
    lang: navigator.language,
  });
  send(false);

  // Engaged time (tab visible) and deepest scroll, sent when the visitor leaves or hides the tab.
  var visibleSince = document.visibilityState === 'visible' ? Date.now() : null;
  var engagedMs = 0;
  var maxScroll = 0;
  window.addEventListener('scroll', function () {
    var h = document.documentElement.scrollHeight - innerHeight;
    if (h > 0) maxScroll = Math.max(maxScroll, Math.min(100, Math.round((scrollY / h) * 100)));
  }, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      if (visibleSince) { engagedMs += Date.now() - visibleSince; visibleSince = null; }
      if (engagedMs > 500) { track('engage', 'scroll ' + maxScroll + '%', Math.round(engagedMs / 1000)); engagedMs = 0; }
      send(true);
    } else {
      visibleSince = Date.now();
    }
  });

  // Which sections were actually on screen.
  if ('IntersectionObserver' in window) {
    var seen = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && !seen[e.target.id]) { seen[e.target.id] = 1; track('section', e.target.id); io.unobserve(e.target); }
      });
    }, { threshold: 0.25 });
    document.querySelectorAll('main section[id], footer[id]').forEach(function (s) { io.observe(s); });
  }

  // Card "Detail" expands and "Show N more" folds (toggle doesn't bubble, so capture).
  document.addEventListener('toggle', function (e) {
    var d = e.target;
    if (!d.open || root.getAttribute('data-printing')) return;
    var card = d.closest && d.closest('.card');
    if (card && d.parentNode === card) { track('detail', card.id); return; }
    if (d.classList.contains('more')) { var role = d.closest('.role'); track('more', role ? role.id : ''); }
  }, true);

  // Clicks: filter chips, contact actions, theme, outbound links.
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('a, button');
    if (!t) return;
    if (t.classList.contains('chip-btn')) return track('filter', t.getAttribute('data-tag'));
    if (t.hasAttribute('data-copy')) return track('contact', 'copy email');
    if (t.classList.contains('theme-toggle')) return track('theme', root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    var href = t.getAttribute('href') || '';
    if (href.indexOf('mailto:') === 0) return track('contact', 'email');
    if (/linkedin\.com/.test(href)) return track('contact', 'linkedin');
    if (/^https?:/.test(href) && t.hostname !== location.hostname) return track('outbound', t.hostname);
  }, true);

  // Printing or saving the CV as PDF.
  window.addEventListener('beforeprint', function () { track('print', path); send(false); });
})();
