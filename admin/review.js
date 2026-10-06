// Review queue (admin only). Shows one proposal at a time from /api/admin/review and sends Nathan's decision
// to /api/admin/review/decide. Keys: A approve, E edit, R reject, S skip (Esc cancels an edit).
// All text is inserted with textContent or input values, never as HTML.
(function () {
  'use strict';
  var app = document.querySelector('[data-review-app]');
  if (!app) return;
  var $ = function (s) { return app.querySelector(s); };
  var card = $('[data-rv-card]'), empty = $('[data-rv-empty]'), statusEl = $('[data-rv-status]');
  var textEl = $('[data-rv-text]'), editBox = $('[data-rv-edit]');
  var actions = $('[data-rv-actions]'), editActions = $('[data-rv-edit-actions]');
  var draftLabel = document.querySelector('[data-draft-label]');
  var publishBtn = document.querySelector('[data-publish]');
  var reviewLink = document.querySelector('[data-review]');
  var barMsg = document.querySelector('[data-admin-msg]');
  var item = null, busy = false, editing = false;

  // Which proposal fields Nathan can edit, per kind.
  var FIELDS = {
    add_title: [['text', 'Title']],
    add_summary_variant: [['label', 'Label'], ['text', 'Summary', true]],
    add_bullet_variant: [['text', 'Bullet', true]],
    add_skill_wording: [['wording', 'Wording']],
  };

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function api(method, url, body) {
    return fetch(url, { method: method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); });
  }
  function say(t) { statusEl.textContent = t || ''; }
  function setDrafts(n) {
    if (draftLabel) draftLabel.textContent = n ? n + ' draft change' + (n === 1 ? '' : 's') + ' · not live until you publish' : 'Published · no unsaved changes';
    if (publishBtn) publishBtn.disabled = !n;
    if (reviewLink) reviewLink.hidden = !n;
  }
  function barSay(text, kind) {
    if (!barMsg) return;
    barMsg.hidden = !text;
    barMsg.className = 'admin-msg' + (kind ? ' admin-msg--' + kind : '');
    barMsg.textContent = text || '';
  }

  // Publish (same flow as the test bench): click twice to confirm.
  if (publishBtn) {
    var initial = draftLabel && /^(\d+)/.exec(draftLabel.textContent);
    setDrafts(initial ? Number(initial[1]) : 0);
    publishBtn.addEventListener('click', function () {
      if (!publishBtn.getAttribute('data-armed')) {
        publishBtn.setAttribute('data-armed', '1');
        publishBtn.textContent = 'Confirm publish';
        setTimeout(function () { publishBtn.removeAttribute('data-armed'); publishBtn.textContent = 'Publish'; }, 5000);
        return;
      }
      publishBtn.disabled = true;
      publishBtn.textContent = 'Publishing…';
      api('POST', '/api/admin/publish').then(function (r) {
        if (!r.ok) { barSay(r.d.message || r.d.error || 'Publishing failed.', 'error'); publishBtn.disabled = false; return; }
        setDrafts(0);
        barSay('Published. The live site updates in about a minute.', 'ok');
      }).finally(function () { publishBtn.removeAttribute('data-armed'); publishBtn.textContent = 'Publish'; });
    });
  }

  function render(state) {
    item = state.item;
    var c = state.counts;
    var decided = c.approved + c.rejected, left = c.pending + c.skipped;
    $('[data-rv-progress]').textContent = left
      ? left + ' to review · ' + c.approved + ' approved · ' + c.rejected + ' rejected'
      : c.approved + ' approved · ' + c.rejected + ' rejected';
    $('[data-rv-bar]').style.width = (decided + left ? Math.round(100 * decided / (decided + left)) : 0) + '%';
    stopEditing();
    card.hidden = !item;
    empty.hidden = !!item;
    if (!item) return;
    var p = item.proposal;
    $('[data-rv-kind]').textContent = item.kindLabel;
    $('[data-rv-target]').textContent = item.target;
    $('[data-rv-skipped]').hidden = !item.skipped;
    textEl.textContent = p.kind === 'add_skill_wording' ? p.wording : p.text;
    $('[data-rv-why]').textContent = item.why || '';
    var now = $('[data-rv-now]');
    now.textContent = '';
    (item.now || []).forEach(function (t) { now.appendChild(el('li', null, t)); });
    $('[data-rv-now-count]').textContent = (item.now || []).length;
  }

  function load() {
    api('GET', '/api/admin/review').then(function (r) {
      if (!r.ok) { say(r.d.error || 'Could not load the queue.'); return; }
      render(r.d);
    });
  }

  function startEditing() {
    if (!item || editing) return;
    editing = true;
    editBox.textContent = '';
    (FIELDS[item.proposal.kind] || []).forEach(function (f) {
      var id = 'rv-' + f[0];
      var lab = el('label', 'small', f[1]); lab.htmlFor = id;
      var input = f[2] ? el('textarea') : el('input');
      input.id = id; input.name = f[0]; input.value = item.proposal[f[0]] || '';
      if (f[2]) input.rows = 4;
      editBox.appendChild(lab); editBox.appendChild(input);
    });
    textEl.hidden = true; editBox.hidden = false;
    actions.hidden = true; editActions.hidden = false;
    var first = editBox.querySelector('textarea, input'); if (first) { first.focus(); first.setSelectionRange(first.value.length, first.value.length); }
  }
  function stopEditing() {
    editing = false;
    textEl.hidden = false; editBox.hidden = true;
    actions.hidden = false; editActions.hidden = true;
  }

  function decide(action) {
    if (!item || busy) return;
    var edits = {};
    if (action === 'save') {
      editBox.querySelectorAll('input, textarea').forEach(function (i) { edits[i.name] = i.value; });
      action = 'approve';
    }
    busy = true;
    app.setAttribute('aria-busy', 'true');
    api('POST', '/api/admin/review/decide', { id: item.id, action: action, edits: edits }).then(function (r) {
      if (!r.ok) { say(r.d.error || 'That didn\'t work.'); if (r.status === 409) load(); return; }
      say(r.d.summary);
      if (action === 'approve') setDrafts(r.d.drafts);
      render(r.d);
    }).finally(function () { busy = false; app.removeAttribute('aria-busy'); });
  }

  app.addEventListener('click', function (e) {
    var b = e.target.closest('[data-rv]');
    if (!b) return;
    var a = b.getAttribute('data-rv');
    if (a === 'edit') startEditing();
    else if (a === 'cancel') stopEditing();
    else decide(a);
  });
  document.addEventListener('keydown', function (e) {
    if (!item) return;
    if (editing) {
      if (e.key === 'Escape') { e.preventDefault(); stopEditing(); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); decide('save'); }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    var map = { a: 'approve', e: 'edit', r: 'reject', s: 'skip' };
    var a = map[e.key.toLowerCase()];
    if (!a) return;
    e.preventDefault();
    if (a === 'edit') startEditing(); else decide(a);
  });

  $('[data-rv-generate]').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true;
    say('Claude is drafting proposals. This takes about a minute…');
    var t0 = Date.now();
    api('POST', '/api/admin/review/generate').then(function (r) {
      if (!r.ok) { say(r.d.error || 'Generating failed.'); return; }
      say(r.d.added + ' new proposal' + (r.d.added === 1 ? '' : 's') + ' in ' + Math.round((Date.now() - t0) / 1000) + 's · $' + (r.d.meta.cost || 0).toFixed(3) +
        (r.d.proposed > r.d.added ? ' · ' + (r.d.proposed - r.d.added) + ' dropped as duplicates or out of bounds' : ''));
      load();
    }).finally(function () { btn.disabled = false; });
  });

  load();
})();
