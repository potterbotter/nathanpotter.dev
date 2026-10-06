// Résumé tab in the test bench (admin only). Generate asks Claude for a block plan; every manual change
// (title, summary, bullets, variants, skills) re-assembles on the server without an AI call.
// All text is inserted with textContent; the print window escapes everything it writes.
(function () {
  'use strict';
  var panel = document.querySelector('[data-resume]');
  if (!panel) return;
  var out = panel.querySelector('[data-r-output]');
  var status = panel.querySelector('[data-r-status]');
  var genBtn = panel.querySelector('[data-r-generate]');
  var companyIn = panel.querySelector('[data-r-company]');
  var roleIn = panel.querySelector('[data-r-role]');
  var lengthIn = panel.querySelector('[data-r-length]');
  var phoneIn = panel.querySelector('[data-r-phone]');
  var jdBox = document.getElementById('jd');

  var state = null; // { id, ref, plan, keywords, length, doc, score, baseline, text, lines, budget, dropped }
  var cv = null;    // working content (draft or published), for the block pickers

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function api(method, url, body) {
    return fetch(url, { method: method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); });
  }
  function loadCv() { return api('GET', '/api/admin/draft').then(function (r) { if (r.ok) cv = r.d.content; }); }

  // Tabs (Chat | Résumé)
  document.querySelectorAll('[data-tab]').forEach(function (tab) {
    tab.addEventListener('click', function () { showTab(tab.getAttribute('data-tab')); });
  });
  if (location.hash === '#resume') setTimeout(function () { showTab('resume'); }, 0);
  function showTab(name) {
    document.querySelectorAll('[data-tab]').forEach(function (t) { t.setAttribute('aria-selected', String(t.getAttribute('data-tab') === name)); });
    document.getElementById('panel-chat').hidden = name !== 'chat';
    panel.hidden = name !== 'resume';
  }

  document.addEventListener('np-fit-read', function (e) {
    var r = e.detail.report || {};
    if (r.company && !companyIn.value) companyIn.value = r.company;
    if (r.role_title && !roleIn.value) roleIn.value = r.role_title;
  });

  // Private phone setting
  api('GET', '/api/admin/resume/settings').then(function (r) { if (r.ok) { phoneIn.value = r.d.phone || ''; panel.querySelector('[data-r-email]').textContent = r.d.email; } });
  panel.querySelector('[data-r-phone-save]').addEventListener('click', function () {
    api('PUT', '/api/admin/resume/settings', { phone: phoneIn.value }).then(function (r) { status.textContent = r.ok ? 'Phone saved (private).' : (r.d.error || 'Could not save.'); });
  });

  genBtn.addEventListener('click', function () {
    var jd = (jdBox.value || '').trim();
    if (jd.length < 200) { status.textContent = 'Paste or fetch the full posting in the box on the left first.'; return; }
    genBtn.disabled = true;
    status.textContent = 'Choosing blocks for this posting…';
    var t0 = Date.now();
    Promise.all([api('POST', '/api/admin/resume/plan', { jd: jd, company: companyIn.value, roleTitle: roleIn.value, length: lengthIn.value }), loadCv()])
      .then(function (res) {
        var r = res[0];
        if (!r.ok) { status.textContent = r.d.error || 'Generation failed.'; return; }
        state = Object.assign({ keywords: r.d.plan.keywords, length: lengthIn.value }, r.d);
        status.textContent = 'Done in ' + ((Date.now() - t0) / 1000).toFixed(0) + 's · $' + (r.d.meta.cost || 0).toFixed(3) + ' · ' + (r.d.plan.rationale || '');
        render();
      })
      .finally(function () { genBtn.disabled = false; });
  });

  // Re-assemble after a manual change (no AI call).
  function reassemble(exported) {
    return api('POST', '/api/admin/resume/assemble', { id: state.id, ref: state.ref, plan: state.plan, keywords: state.keywords, length: lengthIn.value, exported: !!exported })
      .then(function (r) { if (r.ok) { Object.assign(state, r.d); render(); } else status.textContent = r.d.error || 'Could not update.'; return r; });
  }
  // A length change starts again from Claude's full pick, so bullets trimmed for one page can come back on two.
  lengthIn.addEventListener('change', function () { if (state) { state.plan = JSON.parse(JSON.stringify(state.aiPlan)); reassemble(); } });

  // ---------- rendering ----------
  function tile(label, value, lines) {
    var t = el('div', 'stat');
    t.appendChild(el('span', 'label', label));
    t.appendChild(el('strong', null, value));
    (lines || []).forEach(function (l) { if (l) t.appendChild(typeof l === 'string' ? el('span', 'muted small', l) : l); });
    return t;
  }
  function pct(x) { return Math.round((x || 0) * 100) + '%'; }

  function render() {
    var s = state.score, b = state.baseline;
    var frag = document.createDocumentFragment();

    var bar = el('div', 'r-bar');
    var fill = el('span', 'r-bar__fill'); fill.style.width = pct(s.rate);
    var tick = el('span', 'r-bar__tick'); tick.style.left = pct(b.rate); tick.title = 'Untailored CV: ' + pct(b.rate);
    bar.appendChild(fill); bar.appendChild(tick);
    var uncovered = state.keywords.filter(function (k) { return k.importance === 'must' && s.missing.some(function (m) { return m.term === k.term; }); });
    var bullets = state.doc.roles.reduce(function (n, r) { return n + r.bullets.length; }, 0);
    var stats = el('div', 'stats r-stats');
    stats.appendChild(tile('Keyword match', pct(s.rate), [s.matched.length + ' of ' + state.keywords.length + ' posting keywords', bar, 'Untailored CV: ' + pct(b.rate), s.viaSynonyms.length ? s.viaSynonyms.length + ' matched through your approved wordings' : '']));
    stats.appendChild(tile('Must-haves covered', s.mustCovered + ' of ' + s.mustTotal, [uncovered.length ? 'Missing: ' + uncovered.map(function (k) { return k.term; }).join(', ') : 'All covered']));
    stats.appendChild(tile('Length', state.lines <= state.budget.lines ? (lengthIn.value === 'two' ? 'Two pages' : 'One page') : 'May run over', [bullets + ' bullets · about ' + state.lines + ' of ' + state.budget.lines + ' lines']));
    frag.appendChild(stats);

    if (s.missing.length) {
      var miss = el('div', 'r-keywords');
      miss.appendChild(el('p', 'small', 'Missing keywords: these stay out unless an approved block backs them. Click one to ask Claude whether you have that experience.'));
      s.missing.forEach(function (k) {
        var c = el('button', 'r-chip r-chip--missing', k.term + (k.importance === 'must' ? ' · must' : ''));
        c.type = 'button';
        c.addEventListener('click', function () {
          document.dispatchEvent(new CustomEvent('np-chat-prefill', { detail: { text: 'The résumé generator found no approved block for "' + k.term + '" (' + (k.importance === 'must' ? 'a must-have' : 'nice to have') + ') in the ' + (roleIn.value || 'current') + ' posting. Do I have experience with this? If so, help me add a fact, a bullet variant or a skill wording.' } }));
        });
        miss.appendChild(c);
      });
      frag.appendChild(miss);
    }
    if (s.viaSynonyms.length) {
      var syn = el('details', 'r-syn');
      syn.appendChild(el('summary', null, 'Approved wordings used for this posting (' + s.viaSynonyms.length + ')'));
      var ul = el('ul');
      s.viaSynonyms.forEach(function (v) { ul.appendChild(el('li', 'small', v.onSite + ' → ' + v.inResume + ' (posting says "' + v.keyword + '")')); });
      syn.appendChild(ul);
      frag.appendChild(syn);
    }
    if (state.trimmed && state.trimmed.length) frag.appendChild(el('p', 'muted small', 'Trimmed to fit the page: ' + state.trimmed.join(', ') + '. Remove another bullet to make room, or switch length (this resets manual changes).'));
    if (state.dropped && state.dropped.length) frag.appendChild(el('p', 'muted small', 'Ignored invalid references from the plan: ' + state.dropped.join('; ')));

    var actions = el('div', 'row-links r-actions');
    var pdf = el('button', 'btn btn--primary', 'Download PDF');
    var docx = el('button', 'btn btn--secondary', 'Download .docx');
    var copy = el('button', 'btn btn--secondary', 'Copy as text');
    pdf.type = docx.type = copy.type = 'button';
    pdf.addEventListener('click', function () { reassemble(true).then(function () { printResume(); }); });
    // The server builds the Word file from the plan; the browser just saves it.
    docx.addEventListener('click', function () {
      docx.disabled = true;
      fetch('/api/admin/resume/docx', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: state.id, ref: state.ref, plan: state.plan, keywords: state.keywords, length: lengthIn.value, company: companyIn.value }) })
        .then(function (r) {
          if (!r.ok) return r.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || 'The Word file could not be built.'); });
          var name = (/filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '') || [])[1] || 'Resume.docx';
          return r.blob().then(function (blob) {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob); a.download = name;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
            status.textContent = 'Saved ' + name + '.';
          });
        })
        .catch(function (e) { status.textContent = e.message; })
        .finally(function () { docx.disabled = false; });
    });
    copy.addEventListener('click', function () {
      reassemble(true).then(function () { navigator.clipboard.writeText(state.text).then(function () { copy.textContent = 'Copied'; setTimeout(function () { copy.textContent = 'Copy as text'; }, 2000); }); });
    });
    actions.appendChild(pdf); actions.appendChild(docx); actions.appendChild(copy);
    actions.appendChild(el('span', 'muted small', 'Site link on this résumé: ' + (state.doc.contact.site || '')));
    frag.appendChild(actions);
    frag.appendChild(paper());
    out.replaceChildren(frag);
  }

  // The editable preview: every block can be swapped or removed; nothing can be typed in.
  function paper() {
    var d = state.doc, p = el('article', 'r-paper');
    p.appendChild(el('h3', 'r-name', d.name));
    var titleSel = el('select', 'r-pick');
    (cv ? cv.resume.titles : [d.title]).forEach(function (t, i) { var o = el('option', null, t); o.value = i; if (t === d.title) o.selected = true; titleSel.appendChild(o); });
    titleSel.setAttribute('aria-label', 'Title');
    titleSel.addEventListener('change', function () { state.plan.title_index = Number(titleSel.value); reassemble(); });
    p.appendChild(titleSel);
    var c = d.contact || {};
    p.appendChild(el('p', 'r-contact', [c.email, c.phone || '(add your phone under Contact details)', c.location, c.linkedin, c.site].filter(Boolean).join(' | ')));

    p.appendChild(el('h4', null, 'Summary'));
    var sumSel = el('select', 'r-pick');
    (cv ? cv.resume.summaries : [d.summary]).forEach(function (s) { var o = el('option', null, (s.label || s.id) + ' summary'); o.value = s.id; if (s.id === d.summary.id) o.selected = true; sumSel.appendChild(o); });
    sumSel.setAttribute('aria-label', 'Summary variant');
    sumSel.addEventListener('change', function () { state.plan.summary_id = sumSel.value; reassemble(); });
    p.appendChild(sumSel);
    p.appendChild(el('p', null, d.summary.text));

    p.appendChild(el('h4', null, 'Experience'));
    d.roles.forEach(function (r) {
      var head = el('p', 'r-role');
      head.appendChild(el('strong', null, r.company));
      head.appendChild(document.createTextNode(' | ' + r.title + ' | ' + r.dates));
      p.appendChild(head);
      var ul = el('ul', 'r-bullets');
      var planRole = state.plan.roles.find(function (x) { return x.anchor === r.anchor; });
      if (!planRole) { planRole = { anchor: r.anchor, bullets: r.bullets.map(function (b) { return { card_id: b.card_id, variant_id: b.variant_id }; }) }; state.plan.roles.push(planRole); }
      r.bullets.forEach(function (b) {
        var li = el('li');
        li.appendChild(el('span', null, b.text));
        var meta = el('span', 'r-src');
        meta.appendChild(document.createTextNode(b.card_id + (b.variant_id ? ' · ' + b.variant_id : '')));
        var card = cv && cv.experience.roles.flatMap(function (x) { return x.cards; }).find(function (x) { return x.id === b.card_id; });
        if (card && card.variants && card.variants.length) {
          var vs = el('select', 'r-pick r-pick--small');
          [{ id: '', text: 'Original wording' }].concat(card.variants).forEach(function (v) { var o = el('option', null, v.id ? v.id + ': ' + v.text.slice(0, 40) + '…' : v.text); o.value = v.id; if (v.id === b.variant_id) o.selected = true; vs.appendChild(o); });
          vs.addEventListener('change', function () { var pb = planRole.bullets.find(function (x) { return x.card_id === b.card_id; }); if (pb) pb.variant_id = vs.value; reassemble(); });
          meta.appendChild(vs);
        }
        var rm = el('button', 'btn-x', '×');
        rm.type = 'button';
        rm.setAttribute('aria-label', 'Remove this bullet');
        rm.addEventListener('click', function () { planRole.bullets = planRole.bullets.filter(function (x) { return x.card_id !== b.card_id; }); reassemble(); });
        if (r.bullets.length > 1) meta.appendChild(rm);
        li.appendChild(meta);
        ul.appendChild(li);
      });
      p.appendChild(ul);
      var cvRole = cv && cv.experience.roles.find(function (x) { return x.anchor === r.anchor; });
      var unused = cvRole ? cvRole.cards.filter(function (cc) { return !r.bullets.some(function (bb) { return bb.card_id === cc.id; }); }) : [];
      if (unused.length) {
        var add = el('select', 'r-pick r-pick--add');
        var o0 = el('option', null, '+ Add a bullet from ' + r.company); o0.value = ''; add.appendChild(o0);
        unused.forEach(function (cc) { var o = el('option', null, cc.id + ': ' + cc.headline); o.value = cc.id; add.appendChild(o); });
        add.addEventListener('change', function () { if (add.value) { planRole.bullets.push({ card_id: add.value, variant_id: '' }); reassemble(); } });
        p.appendChild(add);
      }
    });

    p.appendChild(el('h4', null, 'Skills'));
    var chips = el('div', 'r-skills');
    d.skills.forEach(function (s) {
      var chip = el('span', 'r-chip', s.text);
      var x = el('button', 'btn-x', '×');
      x.type = 'button';
      x.setAttribute('aria-label', 'Remove ' + s.text);
      x.addEventListener('click', function () { state.plan.skills = state.plan.skills.filter(function (k) { return k.skill.toLowerCase() !== s.skill.toLowerCase(); }); reassemble(); });
      chip.appendChild(x);
      chips.appendChild(chip);
    });
    p.appendChild(chips);

    p.appendChild(el('h4', null, 'Education'));
    d.education.forEach(function (e) { p.appendChild(el('p', null, e.school + ': ' + e.detail)); });
    return p;
  }

  // ---------- PDF: a clean, single-column, text-based page in a new window ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }
  function printResume() {
    var d = state.doc, c = d.contact || {};
    var html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' + esc(d.name + ' - Resume' + (companyIn.value ? ' - ' + companyIn.value : '')) + '</title><style>' +
      '@page{size:letter;margin:0.55in 0.6in}body{font:10.5pt/1.22 Arial,"Helvetica Neue",sans-serif;color:#111;margin:0}' +
      'h1{font-size:20pt;margin:0;color:#0F6E73}.title{font-size:11.5pt;margin:2px 0 4px;font-weight:600}.rule{height:3px;width:72px;background:#7A0E1B;margin:4px 0 6px}' +
      '.contact{font-size:9.5pt;color:#333;margin:0 0 8px}h2{font-size:10.5pt;letter-spacing:.06em;text-transform:uppercase;border-bottom:1px solid #999;margin:9px 0 4px;padding-bottom:2px}' +
      'p{margin:0 0 3px}.role{margin:5px 0 2px}.role b{font-weight:700}ul{margin:0 0 3px;padding-left:16px}li{margin:0 0 1px}</style></head><body>' +
      '<h1>' + esc(d.name) + '</h1><p class="title">' + esc(d.title) + '</p><div class="rule"></div>' +
      '<p class="contact">' + [c.email, c.phone, c.location, c.linkedin, c.site].filter(Boolean).map(esc).join(' | ') + '</p>' +
      '<h2>Summary</h2><p>' + esc(d.summary.text) + '</p><h2>Experience</h2>' +
      d.roles.map(function (r) { return '<p class="role"><b>' + esc(r.company) + '</b> | ' + esc(r.title) + ' | ' + esc(r.dates) + '</p><ul>' + r.bullets.map(function (b) { return '<li>' + esc(b.text) + '</li>'; }).join('') + '</ul>'; }).join('') +
      '<h2>Skills</h2><p>' + d.skills.map(function (s) { return esc(s.text); }).join(' · ') + '</p>' +
      '<h2>Education</h2>' + d.education.map(function (e) { return '<p>' + esc(e.school) + ': ' + esc(e.detail) + '</p>'; }).join('') +
      '</body></html>';
    var w = window.open('', '_blank');
    if (!w) { status.textContent = 'Allow pop-ups for this site to download the PDF.'; return; }
    w.document.open(); w.document.write(html); w.document.close();
    w.focus();
    setTimeout(function () { w.print(); }, 250);
  }
})();
