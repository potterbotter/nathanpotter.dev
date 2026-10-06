// Test bench chat (admin only). Talks to /api/admin/kb/chat, shows Claude's proposals as cards,
// and applies only the ones Nathan approves (/api/admin/kb/apply). All text is inserted with
// textContent or input values, never as HTML.
(function () {
  'use strict';
  var root = document.querySelector('[data-kb-chat]');
  if (!root) return;
  var log = root.querySelector('[data-kb-log]');
  var form = root.querySelector('[data-kb-form]');
  var input = form.querySelector('textarea');
  var send = root.querySelector('[data-kb-send]');
  var status = root.querySelector('[data-kb-status]');
  var notesBox = root.querySelector('[data-kb-notes]');
  var notesList = root.querySelector('[data-kb-notes-list]');
  var notesCount = root.querySelector('[data-kb-notes-count]');
  var draftLabel = document.querySelector('[data-draft-label]');
  var publishBtn = document.querySelector('[data-publish]');
  var reviewLink = document.querySelector('[data-review]');
  var barMsg = document.querySelector('[data-admin-msg]');

  // Approved public changes collect in the draft; Publish commits them to GitHub, which redeploys the site.
  function setDrafts(n) {
    if (draftLabel) draftLabel.textContent = n ? n + ' draft change' + (n === 1 ? '' : 's') + ' · not live until you publish' : 'Published · no unsaved changes';
    if (publishBtn) publishBtn.disabled = !n;
    if (reviewLink) reviewLink.hidden = !n;
  }
  function say(text, kind) {
    if (!barMsg) return;
    barMsg.hidden = !text;
    barMsg.className = 'admin-msg' + (kind ? ' admin-msg--' + kind : '');
    barMsg.textContent = text || '';
  }
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
      fetch('/api/admin/publish', { method: 'POST' })
        .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, d: d }; }); })
        .then(function (r) {
          if (!r.ok) { say(r.d.message || r.d.error || 'Publishing failed.', 'error'); publishBtn.disabled = false; return; }
          setDrafts(0);
          say('Published. The live site updates in about a minute.', 'ok');
          if (r.d.commitUrl) { var a = el('a', null, 'See the commit'); a.href = r.d.commitUrl; barMsg.appendChild(document.createTextNode(' ')); barMsg.appendChild(a); }
        })
        .finally(function () { publishBtn.removeAttribute('data-armed'); publishBtn.textContent = 'Publish'; });
    });
  }

  var history = []; // [{role, content}] sent to the server
  var context = { jd: '', read: null };

  var KIND = { add_card: 'New result card', edit_card: 'Edit a result card', add_fact: 'New fact', add_skill_wording: 'Skill wording', add_private_note: 'Private note' };
  var FIELDS = {
    add_card: [['role_anchor', 'Role'], ['metric', 'Metric'], ['tag', 'Theme'], ['headline', 'Headline'], ['detail', 'Detail', true]],
    edit_card: [['card_id', 'Card'], ['metric', 'Metric'], ['tag', 'Theme'], ['headline', 'Headline'], ['detail', 'Detail', true]],
    add_fact: [['text', 'Fact', true]],
    add_skill_wording: [['skill', 'Skill'], ['wording', 'Wording']],
    add_private_note: [['text', 'Note', true]],
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function scroll() { log.scrollTop = log.scrollHeight; }

  document.addEventListener('np-fit-read', function (e) {
    context = { jd: e.detail.jd, read: e.detail.report };
    log.appendChild(el('li', 'muted small', 'New read loaded: "' + (e.detail.report.summary || '').slice(0, 120) + '". Claude will see it.'));
    scroll();
  });
  document.addEventListener('np-fit-discuss', function (e) {
    var r = e.detail;
    var labels = { meets: 'Meets', partly: 'Partly', gap: 'Gap' };
    input.value = 'About "' + r.requirement + '" (' + (labels[r.read] || r.read) + ': ' + r.explanation + '): ';
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  });

  root.querySelector('[data-kb-clear]').addEventListener('click', function () {
    history = [];
    log.replaceChildren(el('li', 'muted small', 'Chat cleared. The current read stays loaded.'));
  });

  function proposalCard(p) {
    var card = el('li', 'kb-proposal' + (p.kind === 'add_private_note' ? ' kb-proposal--private' : ''));
    var head = el('div', 'kb-proposal__head');
    head.appendChild(el('strong', null, KIND[p.kind] || p.kind));
    head.appendChild(el('span', 'kb-scope', p.kind === 'add_private_note' ? '🔒 Private' : 'Public · goes to your draft'));
    card.appendChild(head);
    if (p.why) card.appendChild(el('p', 'muted small', p.why));
    var inputs = {};
    (FIELDS[p.kind] || []).forEach(function (f) {
      var label = el('label', 'kb-field');
      label.appendChild(el('span', null, f[1]));
      var ctl = f[2] ? el('textarea') : el('input');
      if (f[2]) ctl.rows = 3; else ctl.type = 'text';
      ctl.value = p[f[0]] || '';
      label.appendChild(ctl);
      card.appendChild(label);
      inputs[f[0]] = ctl;
    });
    var actions = el('div', 'kb-proposal__actions');
    var approve = el('button', 'btn-save', 'Approve');
    var dismiss = el('button', 'btn-quiet', 'Dismiss');
    approve.type = dismiss.type = 'button';
    actions.appendChild(approve);
    actions.appendChild(dismiss);
    card.appendChild(actions);

    dismiss.addEventListener('click', function () {
      history.push({ role: 'user', content: '(Dismissed proposal: ' + (KIND[p.kind] || p.kind) + ')' });
      card.classList.add('is-done');
      actions.replaceChildren(el('span', 'muted small', 'Dismissed'));
    });
    approve.addEventListener('click', function () {
      var edited = Object.assign({}, p);
      Object.keys(inputs).forEach(function (k) { edited[k] = inputs[k].value; });
      approve.disabled = dismiss.disabled = true;
      approve.textContent = 'Saving…';
      fetch('/api/admin/kb/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proposal: edited, source: context.read ? (context.read.role_title || '') + ' ' + (context.read.company || '') : '' }) })
        .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, d: d }; }); })
        .then(function (r) {
          if (!r.ok) { approve.disabled = dismiss.disabled = false; approve.textContent = 'Approve'; actions.appendChild(el('span', 'kb-error small', r.d.error || 'Could not save.')); return; }
          card.classList.add('is-done');
          actions.replaceChildren(el('span', 'kb-ok small', '✓ ' + r.d.summary + (r.d.private ? ' (private, saved now)' : ' (in your draft: Publish to make it live)')));
          history.push({ role: 'user', content: '(Approved and saved: ' + r.d.summary + ')' });
          if (r.d.changes) setDrafts(r.d.changes);
          if (r.d.private) loadNotes();
        });
    });
    return card;
  }

  function renderTurn(bubble, turn, done) {
    bubble.replaceChildren();
    bubble.appendChild(el('p', null, turn.reply || (done ? '' : '…')));
    var props = (turn.proposals || []).filter(function (p) { return p && p.kind; });
    if (done && props.length) {
      var ul = el('ul', 'kb-proposals');
      props.forEach(function (p) { ul.appendChild(proposalCard(p)); });
      bubble.appendChild(ul);
    }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || send.disabled) return;
    history.push({ role: 'user', content: text });
    log.appendChild(el('li', 'kb-msg kb-msg--me', text));
    var bubble = el('li', 'kb-msg kb-msg--claude');
    bubble.appendChild(el('p', 'muted', 'Thinking…'));
    log.appendChild(bubble);
    scroll();
    input.value = '';
    send.disabled = true;
    status.textContent = '';

    fetch('/api/admin/kb/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history, jd: context.jd, read: context.read }) })
      .then(function (res) {
        if (!res.ok || (res.headers.get('Content-Type') || '').indexOf('ndjson') === -1) {
          return res.json().catch(function () { return {}; }).then(function (d) { throw new Error(d.error || 'The chat failed.'); });
        }
        var reader = res.body.getReader(), decoder = new TextDecoder(), buf = '';
        function handle(line) {
          if (!line.trim()) return;
          var ev; try { ev = JSON.parse(line); } catch (x) { return; }
          if (ev.type === 'partial') renderTurn(bubble, ev.turn, false);
          else if (ev.type === 'final') {
            renderTurn(bubble, ev.turn, true);
            history.push({ role: 'assistant', content: JSON.stringify(ev.turn) });
            status.textContent = '$' + ev.meta.cost.toFixed(3) + ' · ' + (ev.meta.durationMs / 1000).toFixed(1) + 's';
          } else if (ev.type === 'error') { throw new Error(ev.message); }
          scroll();
        }
        function pump() {
          return reader.read().then(function (c) {
            if (c.done) { handle(buf); return; }
            buf += decoder.decode(c.value, { stream: true });
            var lines = buf.split('\n'); buf = lines.pop(); lines.forEach(handle);
            return pump();
          });
        }
        return pump();
      })
      .catch(function (err) {
        bubble.replaceChildren(el('p', 'kb-error', err.message || 'The chat failed.'));
        history.pop(); // let Nathan resend
        input.value = text;
      })
      .finally(function () { send.disabled = false; input.focus(); });
  });
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) form.requestSubmit(); });

  function loadNotes() {
    fetch('/api/admin/kb/notes').then(function (r) { return r.json(); }).then(function (d) {
      notesCount.textContent = d.notes.length;
      notesList.replaceChildren();
      if (!d.notes.length) notesList.appendChild(el('li', 'muted small', 'No private notes yet.'));
      d.notes.forEach(function (n) {
        var li = el('li', 'kb-note');
        li.appendChild(el('p', null, n.text));
        var meta = el('p', 'muted small', new Date(n.ts).toLocaleDateString() + (n.source ? ' · from ' + n.source : ''));
        var del = el('button', 'btn-x', '×');
        del.type = 'button';
        del.setAttribute('aria-label', 'Delete this note');
        del.addEventListener('click', function () {
          if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = 'Delete?'; return; }
          fetch('/api/admin/kb/notes?id=' + n.id, { method: 'DELETE' }).then(loadNotes);
        });
        meta.appendChild(del);
        li.appendChild(meta);
        notesList.appendChild(li);
      });
    });
  }
  notesBox.addEventListener('toggle', function () { if (notesBox.open) loadNotes(); });
})();
