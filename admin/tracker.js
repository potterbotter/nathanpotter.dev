// Application tracker (admin only). Lists applications, adds them (from a link, by hand or from a generated
// résumé), checks for duplicates, and shows each one's timeline, résumé and site visits.
// All text is inserted with textContent or input values, never as HTML.
(function () {
  'use strict';
  var app = document.querySelector('[data-tracker]');
  if (!app) return;
  var $ = function (s, r) { return (r || app).querySelector(s); };
  var form = $('[data-t-form]'), list = $('[data-t-list]'), statusEl = $('[data-t-status]');
  var formStatus = $('[data-t-form-status]'), dupesBox = $('[data-t-dupes]');
  var S = { apps: [], statuses: [], today: '', filter: 'active', open: null, resumes: [] };

  // ---------- helpers ----------
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function api(method, url, body) {
    return fetch(url, { method: method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); });
  }
  function fmtDay(s) { return s ? new Date(s + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : ''; }
  function fmtTs(ms) { return new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }); }
  function daysBetween(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5); }
  function ago(day) {
    var d = daysBetween(day, S.today);
    return d === 0 ? 'today' : d === 1 ? 'yesterday' : d > 1 ? d + ' days ago' : 'in ' + (-d) + ' day' + (d === -1 ? '' : 's');
  }
  function isOpen(status) { var s = S.statuses.filter(function (x) { return x.id === status; })[0]; return !s || s.open; }
  function statusSelect(value, id) {
    var sel = el('select'); if (id) sel.id = id;
    S.statuses.forEach(function (s) { var o = el('option', null, s.label); o.value = s.id; if (s.id === value) o.selected = true; sel.appendChild(o); });
    return sel;
  }
  function field(labelText, input) { var w = el('div', 'tf-row'); var l = el('label', null, labelText); input.id = input.id || 'f' + Math.random().toString(36).slice(2, 8); l.htmlFor = input.id; w.appendChild(l); w.appendChild(input); return w; }
  function input(type, value) { var i = el('input'); i.type = type; i.value = value || ''; return i; }

  // ---------- list ----------
  function load(openId) {
    return api('GET', '/api/admin/applications').then(function (r) {
      if (!r.ok) { statusEl.textContent = r.d.error || 'Could not load applications.'; return; }
      S.apps = r.d.applications; S.statuses = r.d.statuses; S.today = r.d.today;
      fillStatusSelect();
      renderList();
      if (openId) openDetail(openId);
    });
  }

  function summary() {
    var active = S.apps.filter(function (a) { return isOpen(a.status); });
    var due = active.filter(function (a) { return a.nextOn && a.nextOn <= S.today; }).length;
    var interviewing = active.filter(function (a) { return a.status === 'screen' || a.status === 'interview'; }).length;
    var visited = active.filter(function (a) { return a.visits; }).length;
    if (!S.apps.length) return 'Nothing tracked yet. Add an application, or use "Track this application" after generating a résumé.';
    return [active.length + ' active', interviewing ? interviewing + ' in interviews' : '', due ? due + ' next step' + (due === 1 ? '' : 's') + ' due' : '', visited ? visited + ' with site visits' : ''].filter(Boolean).join(' · ');
  }

  function renderList() {
    $('[data-t-summary]').textContent = summary();
    var counts = { active: 0, closed: 0, all: S.apps.length };
    S.apps.forEach(function (a) { counts[isOpen(a.status) ? 'active' : 'closed']++; });
    Object.keys(counts).forEach(function (k) { $('[data-t-count="' + k + '"]').textContent = counts[k]; });
    var rows = S.apps.filter(function (a) { return S.filter === 'all' || (S.filter === 'active') === isOpen(a.status); });
    // Due next steps first (oldest due first), then most recently touched.
    rows.sort(function (a, b) {
      var ad = a.nextOn && a.nextOn <= S.today, bd = b.nextOn && b.nextOn <= S.today;
      if (ad !== bd) return ad ? -1 : 1;
      if (ad && bd) return a.nextOn < b.nextOn ? -1 : 1;
      return b.updated - a.updated;
    });
    list.textContent = '';
    if (!rows.length) { list.appendChild(el('li', 'muted', S.apps.length ? 'Nothing in this filter.' : '')); return; }
    rows.forEach(function (a) { list.appendChild(row(a)); });
  }

  function row(a) {
    var li = el('li', 'tr-row'); li.setAttribute('data-id', a.id);
    var head = el('button', 'tr-head'); head.type = 'button'; head.setAttribute('aria-expanded', String(S.open === a.id));
    var who = el('span', 'tr-who');
    who.appendChild(el('strong', null, a.company));
    who.appendChild(el('span', 'tr-role', a.title + (a.location ? ' · ' + a.location : '')));
    head.appendChild(who);
    var meta = el('span', 'tr-meta');
    meta.appendChild(el('span', 'tr-status tr-status--' + a.status, a.statusLabel));
    if (a.appliedOn) meta.appendChild(el('span', 'small', 'Applied ' + fmtDay(a.appliedOn) + ' (' + ago(a.appliedOn) + ')'));
    if (a.visits) meta.appendChild(el('span', 'tr-visits small', a.visits + ' site visit' + (a.visits === 1 ? '' : 's') + ', last ' + fmtTs(a.lastVisit)));
    if (a.nextStep || a.nextOn) {
      var due = a.nextOn && a.nextOn <= S.today;
      meta.appendChild(el('span', 'tr-next small' + (due ? ' tr-next--due' : ''), 'Next: ' + [a.nextStep, a.nextOn ? fmtDay(a.nextOn) + (due ? ' (due)' : '') : ''].filter(Boolean).join(' · ')));
    }
    head.appendChild(meta);
    head.addEventListener('click', function () { if (S.open === a.id) closeDetail(); else openDetail(a.id); });
    li.appendChild(head);
    return li;
  }

  // ---------- detail ----------
  function closeDetail() {
    S.open = null;
    list.querySelectorAll('.tr-detail').forEach(function (d) { d.remove(); });
    list.querySelectorAll('.tr-head').forEach(function (h) { h.setAttribute('aria-expanded', 'false'); });
  }

  function openDetail(id) {
    closeDetail();
    var li = list.querySelector('[data-id="' + id + '"]');
    if (!li) { S.filter = 'all'; setFilterButtons(); renderList(); li = list.querySelector('[data-id="' + id + '"]'); if (!li) return; }
    S.open = id;
    li.querySelector('.tr-head').setAttribute('aria-expanded', 'true');
    var box = el('div', 'tr-detail'); box.appendChild(el('p', 'muted small', 'Loading…'));
    li.appendChild(box);
    api('GET', '/api/admin/applications/' + id).then(function (r) {
      if (!r.ok) { box.textContent = r.d.error || 'Could not load.'; return; }
      renderDetail(box, r.d);
      li.scrollIntoView({ block: 'nearest' });
    });
  }

  function patch(id, body, box, msg) {
    return api('PATCH', '/api/admin/applications/' + id, body).then(function (r) {
      if (!r.ok) { statusEl.textContent = r.d.error || 'Could not save.'; return; }
      statusEl.textContent = msg || 'Saved.';
      var i = S.apps.findIndex(function (x) { return x.id === id; });
      if (i >= 0) S.apps[i] = Object.assign(S.apps[i], r.d.application);
      renderList();
      openDetail(id);
    });
  }

  function renderDetail(box, d) {
    var a = d.application;
    box.textContent = '';

    // Status, dates and next step: the things that change most.
    var controls = el('div', 'tr-controls');
    var st = statusSelect(a.status);
    st.addEventListener('change', function () { patch(a.id, { status: st.value }, box, 'Status updated.'); });
    controls.appendChild(field('Status', st));
    var applied = input('date', a.appliedOn);
    applied.addEventListener('change', function () { patch(a.id, { appliedOn: applied.value }, box); });
    controls.appendChild(field('Applied on', applied));
    var next = input('text', a.nextStep); next.placeholder = 'e.g. Follow up with the recruiter';
    var nextOn = input('date', a.nextOn);
    controls.appendChild(field('Next step', next));
    controls.appendChild(field('Date', nextOn));
    var saveNext = el('button', 'btn btn--secondary', 'Save next step'); saveNext.type = 'button';
    saveNext.addEventListener('click', function () { patch(a.id, { nextStep: next.value, nextOn: nextOn.value }, box, 'Next step saved.'); });
    controls.appendChild(saveNext);
    box.appendChild(controls);

    // Links: the posting, and this application's own site link to send.
    var links = el('div', 'tr-links');
    if (a.url) { var p = el('a', null, 'Open the posting'); p.href = a.url; p.target = '_blank'; p.rel = 'noopener noreferrer'; links.appendChild(p); }
    if (a.ref) {
      var site = 'https://nathanpotter.dev/?ref=' + a.ref;
      var copy = el('button', 'btn-quiet', 'Copy site link (' + a.ref + ')'); copy.type = 'button';
      copy.addEventListener('click', function () { navigator.clipboard.writeText(site).then(function () { copy.textContent = 'Copied ' + site; }); });
      links.appendChild(copy);
    }
    if (a.source) links.appendChild(el('span', 'muted small', 'Source: ' + a.source));
    box.appendChild(links);

    // Résumé sent.
    var rs = el('section', 'tr-section');
    rs.appendChild(el('h3', null, 'Résumé'));
    if (d.resume) {
      var r = d.resume;
      var line = el('p', null, 'Résumé #' + r.id + ' · ' + (r.length === 'two' ? 'two pages' : 'one page') + ' · generated ' + fmtTs(r.ts) +
        (r.rate != null ? ' · ' + Math.round(r.rate * 100) + '% keyword match (CV alone ' + Math.round((r.baseline || 0) * 100) + '%)' : '') + (r.exported ? '' : ' · not downloaded yet'));
      rs.appendChild(line);
      if (r.plan) {
        var dl = el('button', 'btn btn--secondary', 'Download .docx again'); dl.type = 'button';
        dl.addEventListener('click', function () { downloadDocx(r, a, dl); });
        rs.appendChild(dl);
      }
    } else {
      rs.appendChild(el('p', 'muted small', 'No résumé linked. Résumés generated in the test bench can be linked when you add an application.'));
    }
    box.appendChild(rs);

    // Site visits through this application's link.
    var vs = el('section', 'tr-section');
    vs.appendChild(el('h3', null, 'Site visits through its link (' + d.visits.length + ')'));
    if (!d.visits.length) vs.appendChild(el('p', 'muted small', a.ref ? 'None yet. Visits appear here when someone opens nathanpotter.dev/?ref=' + a.ref + ' (the link on the résumé).' : 'No ref code on this application.'));
    var vl = el('ul', 'tr-visit-list');
    d.visits.forEach(function (v) {
      var li = el('li');
      li.appendChild(el('strong', null, fmtTs(v.ts)));
      li.appendChild(el('span', null, [v.org ? v.org + ' network' : '', v.place, v.device].filter(Boolean).join(' · ')));
      var did = [v.pages.length ? 'viewed ' + v.pages.join(', ') : '', v.seconds ? Math.max(1, Math.round(v.seconds / 60)) + ' min engaged' : '',
        v.sections ? 'read ' + v.sections + ' section' + (v.sections === 1 ? '' : 's') : '', v.details ? 'opened ' + v.details + ' detail' + (v.details === 1 ? '' : 's') : '',
        v.contact.length ? 'contact: ' + v.contact.join(', ') : '', v.printed ? 'printed or saved the CV' : ''].filter(Boolean).join('; ');
      if (did) li.appendChild(el('span', 'muted small', did));
      vl.appendChild(li);
    });
    vs.appendChild(vl);
    if (d.visits.some(function (v) { return v.org; })) vs.appendChild(el('p', 'muted small', 'Network names are a hint (often an internet provider), not proof of who visited.'));
    box.appendChild(vs);

    // Timeline and notes.
    var tl = el('section', 'tr-section');
    tl.appendChild(el('h3', null, 'Timeline'));
    var note = el('textarea'); note.rows = 2; note.placeholder = 'Add a note (who you spoke to, what happened)';
    tl.appendChild(field('Note', note));
    var addNote = el('button', 'btn btn--secondary', 'Add note'); addNote.type = 'button';
    addNote.addEventListener('click', function () { if (note.value.trim()) patch(a.id, { note: note.value }, box, 'Note added.'); });
    tl.appendChild(addNote);
    var ev = el('ol', 'tr-timeline');
    d.events.forEach(function (e) {
      var li = el('li', 'tr-ev tr-ev--' + e.kind);
      li.appendChild(el('span', 'mono small muted', fmtTs(e.ts)));
      li.appendChild(el('span', null, e.detail || e.kind));
      ev.appendChild(li);
    });
    tl.appendChild(ev);
    box.appendChild(tl);

    // Job details: editable, with the posting text.
    var jd = el('details', 'tr-section');
    jd.appendChild(el('summary', null, 'Job details'));
    var jf = {};
    [['company', 'Company', a.company], ['title', 'Role title', a.title], ['location', 'Location', a.location], ['url', 'Link', a.url], ['source', 'Source', a.source], ['reqId', 'Requisition ID', a.reqId]].forEach(function (f) {
      jf[f[0]] = input('text', f[2]); jd.appendChild(field(f[1], jf[f[0]]));
    });
    var saveJob = el('button', 'btn btn--secondary', 'Save job details'); saveJob.type = 'button';
    saveJob.addEventListener('click', function () {
      var body = {}; Object.keys(jf).forEach(function (k) { body[k] = jf[k].value; });
      patch(a.id, body, box, 'Job details saved.');
    });
    jd.appendChild(saveJob);
    if (a.jdText) { var pre = el('div', 'tr-jd', a.jdText); jd.appendChild(el('h4', null, 'Posting text')); jd.appendChild(pre); }
    box.appendChild(jd);

    // Delete (click twice).
    var del = el('button', 'btn-quiet tr-delete', 'Delete this application'); del.type = 'button';
    del.addEventListener('click', function () {
      if (!del.getAttribute('data-armed')) { del.setAttribute('data-armed', '1'); del.textContent = 'Click again to delete for good'; setTimeout(function () { del.removeAttribute('data-armed'); del.textContent = 'Delete this application'; }, 5000); return; }
      api('DELETE', '/api/admin/applications/' + a.id).then(function (r) {
        if (!r.ok) { statusEl.textContent = r.d.error || 'Could not delete.'; return; }
        statusEl.textContent = 'Deleted ' + a.company + ' · ' + a.title + '.';
        S.open = null; load();
      });
    });
    box.appendChild(del);
  }

  function downloadDocx(r, a, btn) {
    btn.disabled = true;
    fetch('/api/admin/resume/docx', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, ref: r.ref, plan: r.plan, keywords: r.keywords, length: r.length, company: a.company }) })
      .then(function (res) {
        if (!res.ok) throw new Error('The Word file could not be built.');
        var name = (/filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '') || [])[1] || 'Resume.docx';
        return res.blob().then(function (blob) {
          var link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = name;
          document.body.appendChild(link); link.click(); link.remove();
          setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
        });
      })
      .catch(function (e) { statusEl.textContent = e.message; })
      .finally(function () { btn.disabled = false; });
  }

  // ---------- filters ----------
  function setFilterButtons() { app.querySelectorAll('[data-t-filter]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-t-filter') === S.filter)); }); }
  app.querySelectorAll('[data-t-filter]').forEach(function (b) {
    b.addEventListener('click', function () { S.filter = b.getAttribute('data-t-filter'); setFilterButtons(); S.open = null; renderList(); });
  });

  // ---------- add form ----------
  var F = function (name) { return form.elements[name]; };
  function fillStatusSelect() {
    var sel = $('[data-t-statuses]'); if (sel.options.length) return;
    S.statuses.forEach(function (s) { var o = el('option', null, s.label); o.value = s.id; if (s.id === 'applied') o.selected = true; sel.appendChild(o); });
  }
  function jdCount() { var n = F('jdText').value.trim().length; $('[data-t-jd-count]').textContent = n ? n.toLocaleString() + ' characters' : 'empty'; }
  F('jdText').addEventListener('input', jdCount);

  function openForm() {
    form.hidden = false; dupesBox.hidden = true; formStatus.textContent = '';
    if (!F('appliedOn').value) F('appliedOn').value = S.today;
    api('GET', '/api/admin/applications/resumes').then(function (r) {
      if (!r.ok) return;
      var sel = $('[data-t-resumes]'), keep = sel.value;
      while (sel.options.length > 1) sel.remove(1);
      r.d.resumes.forEach(function (x) {
        var o = el('option', null, '#' + x.id + ' · ' + (x.company || 'No company') + ' · ' + (x.title || 'role') + ' · ' + fmtTs(x.ts) + (x.tracked ? ' (tracked)' : ''));
        o.value = x.id; sel.appendChild(o);
      });
      sel.value = keep;
    });
    F('url').focus();
  }
  function closeForm() { form.reset(); form.hidden = true; dupesBox.hidden = true; jdCount(); }
  $('[data-t-add]').addEventListener('click', function () { if (form.hidden) openForm(); else closeForm(); });
  $('[data-t-cancel]').addEventListener('click', closeForm);

  // Picking a generated résumé fills in what it knows.
  $('[data-t-resumes]').addEventListener('change', function () {
    var id = Number(this.value); if (!id) return;
    prefillFromResume(id);
  });
  function prefillFromResume(id) {
    return api('GET', '/api/admin/applications/resumes?id=' + id).then(function (r) {
      if (!r.ok) return;
      var x = r.d.resume;
      if (!F('company').value) F('company').value = x.company;
      if (!F('title').value) F('title').value = x.title;
      if (!F('jdText').value) F('jdText').value = x.jdText;
      $('[data-t-resumes]').value = String(id);
      jdCount(); checkDupes();
    });
  }

  $('[data-t-fetch]').addEventListener('click', function () {
    var btn = this, link = F('url').value.trim();
    if (!link) { formStatus.textContent = 'Paste the link first.'; return; }
    btn.disabled = true; formStatus.textContent = 'Reading the posting…';
    api('POST', '/api/admin/applications/fetch', { url: link }).then(function (r) {
      if (!r.ok) { formStatus.textContent = r.d.error || 'Could not read that page.'; return; }
      ['company', 'title', 'location', 'jdText'].forEach(function (k) { if (r.d[k] && !F(k).value) F(k).value = r.d[k]; });
      if (r.d.source && !F('source').value) F('source').value = r.d.source;
      formStatus.textContent = r.d.company ? 'Filled in from the posting. Check it before saving.' : 'Filled in what the page had. Add the company name.';
      jdCount(); checkDupes();
    }).finally(function () { btn.disabled = false; });
  });

  function payload(force) {
    var body = { force: !!force };
    ['url', 'company', 'title', 'location', 'source', 'status', 'appliedOn', 'reqId', 'nextStep', 'nextOn', 'note', 'jdText'].forEach(function (k) { body[k] = F(k).value; });
    var rid = Number(F('resumeId').value); if (rid) body.resumeId = rid;
    return body;
  }

  function showDupes(dupes, blocking) {
    dupesBox.textContent = '';
    if (!dupes.length) { dupesBox.hidden = true; return; }
    dupesBox.hidden = false;
    dupesBox.appendChild(el('p', null, blocking ? 'This looks like a job you already track:' : 'Possibly already tracked:'));
    var ul = el('ul');
    dupes.forEach(function (x) {
      var li = el('li');
      li.appendChild(el('span', null, x.company + ' · ' + x.title + (x.location ? ' (' + x.location + ')' : '') + ' — ' + (x.statusLabel || 'tracked') + (x.appliedOn ? ', applied ' + fmtDay(x.appliedOn) : '') + '. ' + x.reason + '.'));
      if (x.appId) {
        var open = el('button', 'btn-quiet', 'Open it'); open.type = 'button';
        open.addEventListener('click', function () { closeForm(); openDetail(x.appId); });
        li.appendChild(open);
      }
      ul.appendChild(li);
    });
    dupesBox.appendChild(ul);
    if (blocking) {
      var anyway = el('button', 'btn btn--secondary', 'It\'s a different role, save anyway'); anyway.type = 'button';
      anyway.addEventListener('click', function () { save(true); });
      dupesBox.appendChild(anyway);
    }
  }

  var dupeTimer = 0;
  function checkDupes() {
    clearTimeout(dupeTimer);
    dupeTimer = setTimeout(function () {
      var body = payload(false);
      if (!body.company && !body.url) return;
      api('POST', '/api/admin/applications/check', body).then(function (r) { if (r.ok) showDupes(r.d.duplicates, false); });
    }, 300);
  }
  ['company', 'title', 'location', 'url', 'reqId'].forEach(function (k) { F(k).addEventListener('change', checkDupes); });

  function save(force) {
    var body = payload(force);
    if (!body.company.trim() || !body.title.trim()) { formStatus.textContent = 'Company and role title are required.'; return; }
    $('[data-t-save]').disabled = true; formStatus.textContent = 'Saving…';
    api('POST', '/api/admin/applications', body).then(function (r) {
      if (r.status === 409) { formStatus.textContent = ''; showDupes(r.d.duplicates, true); return; }
      if (!r.ok) { formStatus.textContent = r.d.error || 'Could not save.'; return; }
      closeForm();
      statusEl.textContent = 'Added ' + body.company + ' · ' + body.title + '.';
      S.filter = isOpen(body.status) ? 'active' : 'closed'; setFilterButtons();
      load(r.d.id);
    }).finally(function () { $('[data-t-save]').disabled = false; });
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); save(false); });

  // ---------- start ----------
  // ?resume=ID (from the Résumé tab's "Track this application") opens the form prefilled; ?open=ID opens one.
  var params = new URLSearchParams(location.search);
  load(Number(params.get('open')) || null).then(function () {
    var rid = Number(params.get('resume'));
    if (rid) { openForm(); prefillFromResume(rid); }
  });
})();
