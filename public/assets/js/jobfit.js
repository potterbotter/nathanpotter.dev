// Job-fit tool page: fetch-from-link, then stream the read from /api/job-fit and render it
// compactly (a recruiter reads it in about ten seconds). ?compare=1 (Nathan only, enforced
// server-side) runs Opus and Sonnet side by side with time and cost.
// Everything from the server is inserted with textContent, never as HTML.
(function () {
  'use strict';
  var form = document.querySelector('[data-fit-form]');
  if (!form) return;
  var area = form.querySelector('textarea');
  var count = form.querySelector('[data-fit-count]');
  var submit = form.querySelector('[data-fit-submit]');
  var out = document.querySelector('[data-fit-read]');
  var cfg = window.NP_FIT || {};
  var MIN = 200, MAX = 15000;
  var compare = new URLSearchParams(location.search).get('compare') === '1';

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function updateCount() {
    var n = area.value.trim().length;
    count.textContent = n ? n.toLocaleString() + ' / ' + MAX.toLocaleString() + ' characters' + (n < MIN ? ' (paste the full posting)' : '') : '';
  }
  area.addEventListener('input', updateCount);

  form.querySelector('[data-fit-clear]').addEventListener('click', function () {
    area.value = '';
    updateCount();
    out.replaceChildren(el('p', 'muted', 'Cleared. Paste another posting to get a new read.'));
    area.focus();
  });

  // ---------- fetch from a link ----------
  var linkBox = form.querySelector('[data-fit-link]');
  if (linkBox) {
    var urlInput = form.querySelector('#jd-url');
    var fetchBtn = form.querySelector('[data-fit-fetch]');
    var fetchStatus = form.querySelector('[data-fit-fetch-status]');
    linkBox.hidden = false;
    var fetching = false;
    var doFetch = function () {
      var link = urlInput.value.trim();
      if (!link || fetching) { if (!link) urlInput.focus(); return; }
      fetching = true;
      fetchBtn.disabled = true;
      fetchBtn.textContent = 'Fetching…';
      fetchStatus.textContent = 'Reading the posting…';
      fetch('/api/job-fit/fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: link }) })
        .then(function (res) { return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (r) {
          if (!r.ok) { fetchStatus.textContent = r.data.message || "Couldn't read that page. Paste the text instead."; return; }
          area.value = r.data.text;
          updateCount();
          fetchStatus.textContent = 'Fetched from ' + r.data.source + (r.data.truncated ? ' (trimmed to fit)' : '') + '. Check the text below, then Assess.';
          area.focus();
          area.setSelectionRange(0, 0);
          area.scrollTop = 0;
        })
        .catch(function () { fetchStatus.textContent = "Couldn't reach the server. Paste the text instead."; })
        .finally(function () { fetching = false; fetchBtn.disabled = false; fetchBtn.textContent = 'Fetch'; });
    };
    fetchBtn.addEventListener('click', doFetch);
    urlInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doFetch(); } });
  }

  // ---------- rendering ----------
  var READ = { meets: ['Meets', '✓'], partly: ['Partly', '◐'], gap: ['Gap', '✕'] };
  var FIT = { strong: 'Strong fit', partial: 'Partial fit', weak: 'Weak fit', not_assessed: 'Not assessed' };
  var MODEL_NAMES = { 'claude-opus-5-5': 'Claude Opus 5.5', 'claude-sonnet-5-5': 'Claude Sonnet 5.5' };

  function evidenceHref(id) {
    return /^(summary|skills|education)$/.test(id) ? '/#' + id : id === 'facts' ? '/#experience' : '/#' + encodeURIComponent(id);
  }

  // Renders a full or partial report into `box`. Partial renders skip the footer.
  function render(box, report, meta, partial) {
    var frag = document.createDocumentFragment();
    if (!partial && report.input_assessment && report.input_assessment !== 'job_posting') {
      frag.appendChild(el('p', 'fit-summary', report.input_assessment === 'not_a_job_posting'
        ? "That doesn't look like a job posting, so there's nothing to assess. Paste the role description and requirements."
        : "There isn't enough in that posting to assess. Paste the full description, including requirements."));
      box.replaceChildren(frag);
      return;
    }
    if (report.fit) {
      var head = el('div', 'fit-head');
      head.appendChild(el('span', 'fit-badge fit-badge--' + report.fit, FIT[report.fit] || report.fit));
      var role = [report.role_title, report.company].filter(Boolean).join(' · ');
      if (role) head.appendChild(el('span', 'muted small', role));
      frag.appendChild(head);
    }
    if (report.summary) frag.appendChild(el('p', 'fit-summary', report.summary));
    if (report.manipulation_detected) frag.appendChild(el('p', 'fit-callout', 'The posting contained instructions aimed at this tool. They were ignored.'));

    var reqs = report.requirements || [];
    if (reqs.length) {
      var ul = el('ul', 'fit-rows');
      reqs.forEach(function (r) {
        var li = el('li', 'fit-row fit-row--' + r.read);
        var read = READ[r.read] || [r.read, ''];
        li.appendChild(el('span', 'fit-read-chip fit-read-chip--' + r.read, read[1] + ' ' + read[0]));
        var body = el('div', 'fit-row__body');
        var line = el('p', 'fit-row__line');
        line.appendChild(el('strong', null, r.requirement));
        if (r.evidence && r.evidence.length) {
          line.appendChild(document.createTextNode(' — '));
          r.evidence.forEach(function (e, i) {
            if (i) line.appendChild(document.createTextNode('; '));
            var a = el('a', null, e.label || e.source);
            a.href = evidenceHref(e.card_id);
            a.title = e.source + ': ' + e.quote; // the CV's own words on hover
            line.appendChild(a);
          });
        }
        body.appendChild(line);
        if (r.explanation) body.appendChild(el('p', 'fit-row__why', r.explanation + (r.note ? ' ' + r.note : '')));
        li.appendChild(body);
        ul.appendChild(li);
      });
      frag.appendChild(ul);
    }
    if (partial) {
      frag.appendChild(el('p', 'fit-loading', 'Writing the read…'));
      box.replaceChildren(frag);
      return;
    }
    if (report.unsettled && report.unsettled.length) {
      var open = el('p', 'fit-open small');
      open.appendChild(el('strong', null, 'Open questions: '));
      open.appendChild(document.createTextNode(report.unsettled.join(' · ')));
      frag.appendChild(open);
    }
    var how = el('details', 'fit-how');
    how.appendChild(el('summary', null, 'How this read was produced'));
    how.appendChild(el('p', 'small', cfg.method || ''));
    var bits = [MODEL_NAMES[meta.model] || meta.model || 'unknown model', 'prompt ' + (meta.prompt || '')];
    if (report.verification && report.verification.droppedCitations) bits.push(report.verification.droppedCitations + ' unverifiable citation(s) removed');
    how.appendChild(el('p', 'muted small mono', bits.join(' · ')));
    var corr = el('p', 'small');
    var mail = el('a', null, 'Send a correction');
    mail.href = 'mailto:' + (cfg.email || '') + '?subject=' + encodeURIComponent('Job-fit read correction' + (role ? ': ' + role : ''));
    corr.appendChild(document.createTextNode('Think the read is wrong? '));
    corr.appendChild(mail);
    how.appendChild(corr);
    frag.appendChild(how);
    box.replaceChildren(frag);
  }

  // Streams one assessment into `box`. Resolves with { ok, meta } when done.
  function runOne(box, jd, model, onTick) {
    var started = Date.now();
    var status = el('p', 'fit-loading', 'Reading the posting against the CV…');
    box.replaceChildren(status);
    var gotPartial = false;
    var tick = setInterval(function () {
      var s = Math.round((Date.now() - started) / 1000);
      if (!gotPartial) status.textContent = 'Reading the posting against the CV… ' + s + 's';
      if (onTick) onTick(s);
    }, 1000);
    var payload = { jd: jd };
    if (model) payload.model = model;
    // Model selection goes through the Access-protected admin endpoint.
    return fetch(model ? '/api/admin/job-fit' : '/api/job-fit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (res) {
        var type = res.headers.get('Content-Type') || '';
        if (!res.ok || type.indexOf('ndjson') === -1) {
          return res.json().catch(function () { return {}; }).then(function (d) { box.replaceChildren(el('p', 'fit-error', d.message || 'Something went wrong. Please try again.')); return { ok: false }; });
        }
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buf = '';
        var result = { ok: false };
        function handle(line) {
          if (!line.trim()) return;
          var ev;
          try { ev = JSON.parse(line); } catch (e) { return; }
          if (ev.type === 'partial' && ev.report) { gotPartial = true; render(box, ev.report, {}, true); }
          else if (ev.type === 'final') { render(box, ev.report, ev.meta || {}, false); result = { ok: true, meta: ev.meta || {} }; }
          else if (ev.type === 'error') { box.replaceChildren(el('p', 'fit-error', ev.message)); result = { ok: false }; }
        }
        function pump() {
          return reader.read().then(function (chunk) {
            if (chunk.done) { handle(buf); return result; }
            buf += decoder.decode(chunk.value, { stream: true });
            var lines = buf.split('\n');
            buf = lines.pop();
            lines.forEach(handle);
            return pump();
          });
        }
        return pump();
      })
      .catch(function () { box.replaceChildren(el('p', 'fit-error', "Couldn't reach the server. Check your connection and try again.")); return { ok: false }; })
      .finally(function () { clearInterval(tick); });
  }

  // ---------- compare mode (Nathan only) ----------
  var columns = null;
  if (compare) {
    var note = el('p', 'fit-compare-note small', 'Compare mode: each Assess runs Claude Opus 5.5 and Claude Sonnet 5.5 side by side. Only works while signed in as admin; both runs count toward the monthly budget.');
    form.insertBefore(note, form.firstChild);
    var grid = el('div', 'fit-compare');
    columns = [['opus', 'Claude Opus 5.5'], ['sonnet', 'Claude Sonnet 5.5']].map(function (m) {
      var col = el('section', 'fit-compare__col');
      col.appendChild(el('h3', null, m[1]));
      var stats = el('p', 'muted small mono', '');
      var box = el('div', 'fit-compare__box');
      col.appendChild(stats);
      col.appendChild(box);
      grid.appendChild(col);
      return { key: m[0], stats: stats, box: box };
    });
    out.replaceChildren(grid);
  }

  // ---------- submit ----------
  var busy = false;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy) return;
    var jd = area.value.trim();
    if (jd.length < MIN) {
      var msg = jd ? 'That looks too short to assess. Paste the full job description, including requirements.' : 'Paste a job description first.';
      if (columns) columns[0].box.replaceChildren(el('p', 'fit-error', msg)); else out.replaceChildren(el('p', 'fit-error', msg));
      area.focus();
      return;
    }
    busy = true;
    submit.disabled = true;
    submit.textContent = 'Reading…';
    var done = function () { busy = false; submit.disabled = false; submit.textContent = 'Assess'; };

    if (columns) {
      Promise.all(columns.map(function (c) {
        c.stats.textContent = '0s';
        return runOne(c.box, jd, c.key, function (s) { c.stats.textContent = s + 's'; }).then(function (r) {
          if (r.ok) {
            var m = r.meta;
            c.stats.textContent = (m.durationMs / 1000).toFixed(1) + 's total · first words at ' + (m.firstTextMs / 1000).toFixed(1) + 's' + (m.cost != null ? ' · $' + m.cost.toFixed(3) : '');
          }
        });
      })).finally(done);
      return;
    }
    out.closest('.fit-read').scrollIntoView({ behavior: 'smooth', block: 'start' });
    runOne(out, jd, null).finally(done);
  });
})();
