// Dashboard enhancements (admin only): chart tooltips and "Exclude this browser".
(function () {
  'use strict';

  // Tooltip for the daily chart: hover or keyboard focus on a bar.
  document.querySelectorAll('[data-chart]').forEach(function (chart) {
    var tip = chart.querySelector('.chart-tip');
    function show(g, x, y) {
      tip.textContent = g.getAttribute('data-tip'); // textContent: labels are data, never HTML
      tip.hidden = false;
      var box = chart.getBoundingClientRect();
      tip.style.left = Math.min(Math.max(0, x - box.left + 12), box.width - tip.offsetWidth) + 'px';
      tip.style.top = Math.max(0, y - box.top - 36) + 'px';
      chart.querySelectorAll('.bar-g.is-on').forEach(function (n) { n.classList.remove('is-on'); });
      g.classList.add('is-on');
    }
    function hide() { tip.hidden = true; chart.querySelectorAll('.bar-g.is-on').forEach(function (n) { n.classList.remove('is-on'); }); }
    chart.querySelectorAll('.bar-g').forEach(function (g) {
      g.addEventListener('pointermove', function (e) { show(g, e.clientX, e.clientY); });
      g.addEventListener('focus', function () { var r = g.getBoundingClientRect(); show(g, r.left + r.width / 2, r.top); });
      g.addEventListener('blur', hide);
    });
    chart.addEventListener('pointerleave', hide);
  });

  // Exclude this browser from analytics (stored only in this browser).
  var btn = document.querySelector('[data-exclude]');
  if (btn) {
    var get = function () { try { return localStorage.getItem('np-no-track') === '1'; } catch (e) { return false; } };
    var render = function () {
      btn.textContent = get() ? 'This browser is excluded · Include it again' : 'Exclude this browser';
      btn.setAttribute('aria-pressed', String(get()));
    };
    btn.hidden = false;
    render();
    btn.addEventListener('click', function () {
      try { if (get()) localStorage.removeItem('np-no-track'); else localStorage.setItem('np-no-track', '1'); } catch (e) {}
      render();
    });
  }
})();
