// Progressive enhancements only; every page works without this file.
// Budget (design/handoff/README.md): theme toggle, filter chips, copy email,
// closing menus, opening details before print.
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

  // Print: open every disclosure so collapsed content prints.
  window.addEventListener('beforeprint', function () {
    document.querySelectorAll('details').forEach(function (d) { d.open = true; });
  });
})();
