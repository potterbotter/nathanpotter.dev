// Job-fit tool page: posts the job description to /api/job-fit and renders the read.
// Everything from the server is inserted with textContent (never as HTML).
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

  var READ = { meets: ['Meets', '✓'], partly: ['Partly', '◐'], gap: ['Gap', '✕'] };
  var FIT = { strong: 'Strong fit', partial: 'Partial fit', weak: 'Weak fit', not_assessed: 'Not assessed' };
  var KIND = { must_have: 'Must-have', nice_to_have: 'Nice-to-have', unclear: 'Unclear' };

  function evidenceHref(id) {
    return /^(summary|skills|education)$/.test(id) ? '/#' + id : '/#' + encodeURIComponent(id);
  }

  function render(report, meta) {
    var frag = document.createDocumentFragment();
    if (report.input_assessment !== 'job_posting') {
      frag.appendChild(el('p', 'fit-summary', report.input_assessment === 'not_a_job_posting'
        ? "That doesn't look like a job posting, so there's nothing to assess. Paste the role description and requirements."
        : 'There isn\'t enough in that posting to assess. Paste the full description, including requirements.'));
      out.replaceChildren(frag);
      return;
    }

    var head = el('div', 'fit-head');
    head.appendChild(el('span', 'fit-badge fit-badge--' + report.fit, FIT[report.fit] || report.fit));
    var role = [report.role_title, report.company].filter(Boolean).join(' · ');
    if (role) head.appendChild(el('span', 'muted', role));
    frag.appendChild(head);
    frag.appendChild(el('p', 'fit-summary', report.summary));

    if (report.manipulation_detected) {
      frag.appendChild(el('p', 'fit-callout', 'The posting contained instructions aimed at this tool. They were ignored; only the job content was assessed.'));
    }

    if (report.requirements.length) {
      var wrap = el('div', 'fit-table-wrap');
      var table = el('table', 'fit-table');
      var thead = el('thead');
      var hr = el('tr');
      ['Posting asks for', 'Evidence on the CV', 'Read'].forEach(function (h) { var th = el('th', null, h); th.scope = 'col'; hr.appendChild(th); });
      thead.appendChild(hr);
      table.appendChild(thead);
      var tbody = el('tbody');
      report.requirements.forEach(function (r) {
        var tr = el('tr');
        var ask = el('td');
        ask.appendChild(el('strong', null, r.requirement));
        ask.appendChild(el('span', 'fit-kind', KIND[r.kind] || ''));
        tr.appendChild(ask);

        var ev = el('td');
        if (r.evidence.length) {
          r.evidence.forEach(function (e) {
            var item = el('div', 'fit-ev');
            var a = el('a', null, e.source);
            a.href = evidenceHref(e.card_id);
            item.appendChild(a);
            item.appendChild(el('q', null, e.quote));
            if (e.why) item.appendChild(el('span', 'muted small', e.why));
            ev.appendChild(item);
          });
        } else {
          ev.appendChild(el('span', 'muted', 'Nothing on the CV shows this.'));
        }
        if (r.explanation) ev.appendChild(el('p', 'fit-expl', r.explanation));
        if (r.note) ev.appendChild(el('p', 'fit-expl muted small', r.note));
        tr.appendChild(ev);

        var read = READ[r.read] || [r.read, ''];
        var rd = el('td');
        rd.appendChild(el('span', 'fit-read-chip fit-read-chip--' + r.read, read[1] + ' ' + read[0]));
        tr.appendChild(rd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      frag.appendChild(wrap);
    }

    if (report.unsettled && report.unsettled.length) {
      frag.appendChild(el('h3', null, "What the posting doesn't settle"));
      var ul = el('ul', 'fit-list');
      report.unsettled.forEach(function (u) { ul.appendChild(el('li', null, u)); });
      frag.appendChild(ul);
    }

    var how = el('details', 'fit-how');
    how.appendChild(el('summary', null, 'How this read was produced'));
    how.appendChild(el('p', null, cfg.method || ''));
    var bits = ['Model: ' + (meta.model || 'unknown'), 'Prompt: ' + (meta.prompt || '')];
    if (report.verification && report.verification.droppedCitations) bits.push(report.verification.droppedCitations + ' unverifiable citation(s) removed');
    how.appendChild(el('p', 'muted small mono', bits.join(' · ')));
    frag.appendChild(how);

    var corr = el('p', 'small');
    corr.appendChild(document.createTextNode('Think the read is wrong? '));
    var mail = el('a', null, 'Send a correction');
    mail.href = 'mailto:' + (cfg.email || '') + '?subject=' + encodeURIComponent('Job-fit read correction' + (role ? ': ' + role : ''));
    corr.appendChild(mail);
    corr.appendChild(document.createTextNode('.'));
    frag.appendChild(corr);

    out.replaceChildren(frag);
  }

  var busy = false;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy) return;
    var jd = area.value.trim();
    if (jd.length < MIN) {
      out.replaceChildren(el('p', 'fit-error', jd ? 'That looks too short to assess. Paste the full job description, including requirements.' : 'Paste a job description first.'));
      area.focus();
      return;
    }
    busy = true;
    submit.disabled = true;
    submit.textContent = 'Reading…';
    var started = Date.now();
    var status = el('p', 'fit-loading', 'Reading the posting against the CV. This usually takes 20 to 60 seconds.');
    out.replaceChildren(status);
    var tick = setInterval(function () { status.textContent = 'Reading the posting against the CV… ' + Math.round((Date.now() - started) / 1000) + 's'; }, 1000);

    fetch('/api/job-fit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jd: jd }) })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (!r.ok) { out.replaceChildren(el('p', 'fit-error', r.data.message || 'Something went wrong. Please try again.')); return; }
        render(r.data.report, r.data.meta || {});
        out.closest('.fit-read').scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
      .catch(function () { out.replaceChildren(el('p', 'fit-error', "Couldn't reach the server. Check your connection and try again.")); })
      .finally(function () { clearInterval(tick); busy = false; submit.disabled = false; submit.textContent = 'Assess'; });
  });
})();
