// Edit mode for /admin/edit/. Served only behind Cloudflare Access (never on public pages).
// Every change saves the whole draft to D1 (/api/admin/draft), then reloads the page from that draft.
// Publish commits the draft to content/cv.json on GitHub, which redeploys the site.
(function () {
  'use strict';
  var state = { content: null, baseSha: null, changes: 0 };
  var msgEl = document.querySelector('[data-admin-msg]');
  var draftLabel = document.querySelector('[data-draft-label]');
  var publishBtn = document.querySelector('[data-publish]');
  var discardBtn = document.querySelector('[data-discard]');

  function say(text, kind) {
    if (!msgEl) return;
    msgEl.hidden = !text;
    msgEl.className = 'admin-msg' + (kind ? ' admin-msg--' + kind : '');
    msgEl.textContent = text || '';
  }
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function setPath(obj, path, value) {
    var keys = path.split('.');
    var last = keys.pop();
    var target = keys.reduce(function (o, k) { return o[/^\d+$/.test(k) ? Number(k) : k]; }, obj);
    target[/^\d+$/.test(last) ? Number(last) : last] = value;
  }
  function findCard(content, id) {
    var roles = content.experience.roles;
    for (var r = 0; r < roles.length; r++) {
      for (var c = 0; c < roles[r].cards.length; c++) if (roles[r].cards[c].id === id) return { role: roles[r], index: c };
    }
    return null;
  }
  function roleByAnchor(content, anchor) {
    return content.experience.roles.filter(function (r) { return r.anchor === anchor; })[0];
  }

  // ---- load + save ----
  function api(method, url, body) {
    return fetch(url, {
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) { return { ok: r.ok, status: r.status, data: data }; });
    });
  }

  function save(mutate, keepOpen) {
    var next = clone(state.content);
    mutate(next);
    say('Saving draft…');
    return api('PUT', '/api/admin/draft', { content: next, baseSha: state.baseSha }).then(function (res) {
      if (!res.ok) { say(res.data.error || 'Could not save the draft.', 'error'); return false; }
      try {
        sessionStorage.setItem('np-scroll', String(window.scrollY));
        if (keepOpen) sessionStorage.setItem('np-open', keepOpen);
      } catch (e) {}
      location.reload();
      return true;
    });
  }

  function restoreAfterReload() {
    try {
      var y = sessionStorage.getItem('np-scroll');
      if (y !== null) { window.scrollTo(0, Number(y)); sessionStorage.removeItem('np-scroll'); }
      var open = sessionStorage.getItem('np-open');
      if (open) { sessionStorage.removeItem('np-open'); var b = document.querySelector('[data-skill="' + open + '"]'); if (b) openSkill(b); }
    } catch (e) {}
  }

  // ---- inline text (data-edit-path) ----
  function wireInlineText() {
    document.querySelectorAll('[data-edit-path]').forEach(function (node) {
      var original = node.textContent;
      node.addEventListener('focus', function () { original = node.textContent; });
      node.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); node.blur(); }
        if (e.key === 'Escape') { node.textContent = original; node.blur(); }
      });
      node.addEventListener('paste', function (e) {
        e.preventDefault();
        var t = (e.clipboardData || window.clipboardData).getData('text');
        document.execCommand('insertText', false, t.replace(/\s+/g, ' '));
      });
      node.addEventListener('blur', function () {
        var value = node.textContent.replace(/\s+/g, ' ').trim();
        if (value === original.replace(/\s+/g, ' ').trim()) return;
        if (!value) { node.textContent = original; say('That field can’t be empty.', 'error'); return; }
        var path = node.getAttribute('data-edit-path');
        save(function (c) { setPath(c, path, value); });
      });
    });
  }

  // ---- result cards ----
  function cardForm(values, onSave, onCancel, onRemove) {
    var tags = state.content.experience.tags;
    var metric = el('input', { type: 'text', value: values.metric || '', required: 'required' });
    var tag = el('select', {}, tags.map(function (t) { var o = el('option', { value: t, text: t }); if (t === values.tag) o.selected = true; return o; }));
    var headline = el('input', { type: 'text', value: values.headline || '', required: 'required' });
    var detail = el('textarea', { rows: '4', required: 'required' });
    detail.value = values.detail || '';
    var removeBtn = onRemove ? el('button', { type: 'button', class: 'btn-quiet btn-danger', text: 'Remove' }) : null;
    var form = el('form', { class: 'card-form' }, [
      el('span', { class: 'label', text: onRemove ? 'Editing card' : 'New card' }),
      el('div', { class: 'card-form__row' }, [
        el('label', {}, [document.createTextNode('Metric'), metric]),
        el('label', {}, [document.createTextNode('Theme'), tag]),
      ]),
      el('label', {}, [document.createTextNode('Headline (under 12 words)'), headline]),
      el('label', {}, [document.createTextNode('Detail (the full CV line)'), detail]),
      el('div', { class: 'card-form__actions' }, [
        removeBtn,
        el('span', { class: 'spacer' }),
        el('button', { type: 'button', class: 'btn-quiet', 'data-cancel': '', text: 'Cancel' }),
        el('button', { type: 'submit', class: 'btn-save', text: 'Save draft' }),
      ]),
    ]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = { metric: metric.value.trim(), tag: tag.value, headline: headline.value.trim(), detail: detail.value.replace(/\s+/g, ' ').trim() };
      if (!v.metric || !v.headline || !v.detail) { say('Metric, headline and detail are all needed.', 'error'); return; }
      onSave(v);
    });
    form.querySelector('[data-cancel]').addEventListener('click', onCancel);
    form.addEventListener('keydown', function (e) { if (e.key === 'Escape') onCancel(); });
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        if (removeBtn.getAttribute('data-armed')) { onRemove(); return; }
        removeBtn.setAttribute('data-armed', '1');
        removeBtn.textContent = 'Confirm remove';
      });
    }
    setTimeout(function () { metric.focus(); }, 0);
    return form;
  }

  function editCard(li) {
    var found = findCard(state.content, li.id);
    if (!found) return;
    var card = found.role.cards[found.index];
    var saved = Array.prototype.slice.call(li.childNodes);
    li.classList.add('is-editing');
    li.draggable = false;
    li.innerHTML = '';
    li.appendChild(cardForm(card, function (v) {
      save(function (c) {
        var f = findCard(c, li.id);
        var target = f.role.cards[f.index];
        if (target.headline !== v.headline) delete target.headlineSource;
        Object.assign(target, v);
      });
    }, function () {
      li.innerHTML = '';
      saved.forEach(function (n) { li.appendChild(n); });
      li.classList.remove('is-editing');
      li.draggable = true;
    }, function () {
      save(function (c) { var f = findCard(c, li.id); f.role.cards.splice(f.index, 1); });
    }));
  }

  function addCard(btn) {
    var anchor = btn.getAttribute('data-add-card');
    var tile = btn.parentNode;
    var saved = btn;
    tile.classList.add('is-editing');
    tile.innerHTML = '';
    tile.appendChild(cardForm({ tag: state.content.experience.tags[0] }, function (v) {
      save(function (c) {
        var role = roleByAnchor(c, anchor);
        var id = anchor.replace(/^exp-/, '') + '-' + role.nextCard;
        role.nextCard += 1;
        role.cards.push(Object.assign({ id: id }, v));
      });
    }, function () {
      tile.innerHTML = '';
      tile.appendChild(saved);
      tile.classList.remove('is-editing');
    }));
  }

  function moveCard(id, delta) {
    save(function (c) {
      var f = findCard(c, id);
      var to = f.index + delta;
      if (to < 0 || to >= f.role.cards.length) return;
      var moved = f.role.cards.splice(f.index, 1)[0];
      f.role.cards.splice(to, 0, moved);
    });
  }

  function wireCards() {
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-edit-card]');
      if (t) { editCard(t.closest('.card')); return; }
      t = e.target.closest('[data-move]');
      if (t) { moveCard(t.closest('.card').id, Number(t.getAttribute('data-move'))); return; }
      t = e.target.closest('[data-add-card]');
      if (t) addCard(t);
    });

    var dragged = null;
    document.querySelectorAll('.card[draggable="true"]').forEach(function (li) {
      li.addEventListener('dragstart', function (e) { dragged = li; li.classList.add('is-dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', li.id); });
      li.addEventListener('dragend', function () { li.classList.remove('is-dragging'); dragged = null; });
      li.addEventListener('dragover', function (e) {
        if (!dragged || dragged === li || dragged.parentNode !== li.parentNode) return;
        e.preventDefault();
      });
      li.addEventListener('drop', function (e) {
        e.preventDefault();
        if (!dragged || dragged === li) return;
        var fromId = dragged.id, toId = li.id;
        var rect = li.getBoundingClientRect();
        var after = (e.clientY - rect.top) > rect.height / 2 || (e.clientX - rect.left) > rect.width / 2;
        save(function (c) {
          var from = findCard(c, fromId);
          var moved = from.role.cards.splice(from.index, 1)[0];
          var to = findCard(c, toId);
          from.role.cards.splice(to.index + (after ? 1 : 0), 0, moved);
        });
      });
    });
  }

  // ---- About ----
  function wireAbout() {
    var btn = document.querySelector('[data-edit-about]');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var prose = document.querySelector('[data-about]');
      var area = el('textarea', { rows: '10', id: 'about-text' });
      area.value = state.content.about.join('\n\n');
      var box = el('div', { class: 'about-form' }, [
        el('label', { for: 'about-text', text: 'About text · a blank line starts a new paragraph' }),
        area,
        el('div', { class: 'card-form__actions' }, [
          el('span', { class: 'spacer' }),
          el('button', { type: 'button', class: 'btn-quiet', 'data-cancel': '', text: 'Cancel' }),
          el('button', { type: 'button', class: 'btn-save', 'data-save': '', text: 'Save draft' }),
        ]),
      ]);
      prose.hidden = true;
      btn.hidden = true;
      prose.parentNode.insertBefore(box, prose.nextSibling);
      area.focus();
      box.querySelector('[data-cancel]').addEventListener('click', function () { box.remove(); prose.hidden = false; btn.hidden = false; });
      box.querySelector('[data-save]').addEventListener('click', function () {
        var paras = area.value.split(/\n\s*\n/).map(function (p) { return p.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
        save(function (c) { c.about = paras; });
      });
    });
  }

  // ---- Skills and their wordings ----
  function closeSkillPanels() {
    document.querySelectorAll('.skill-panel').forEach(function (p) { p.remove(); });
    document.querySelectorAll('.skill--edit[aria-expanded="true"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
  }

  function openSkill(btn) {
    var key = btn.getAttribute('data-skill');
    var wasOpen = btn.getAttribute('aria-expanded') === 'true';
    closeSkillPanels();
    if (wasOpen) return;
    var parts = key.split('.').map(Number);
    var gi = parts[0], si = parts[1];
    var skill = state.content.skills.groups[gi].items[si];
    btn.setAttribute('aria-expanded', 'true');

    function mutateSkill(fn) {
      return save(function (c) { var s = c.skills.groups[gi].items[si]; delete s.synonymsAreExamples; fn(s, c); }, key);
    }

    var list = el('ul', { class: 'wordings' }, skill.forms.map(function (form, fi) {
      var shown = fi === skill.shown;
      var showBtn = shown ? el('span', { class: 'on-site', text: 'On the site' }) : el('button', { type: 'button', class: 'btn-pill', text: 'Show this on the site' });
      if (!shown) showBtn.addEventListener('click', function () { mutateSkill(function (s) { s.shown = fi; }); });
      var rm = skill.forms.length > 1 ? el('button', { type: 'button', class: 'btn-x', 'aria-label': 'Remove the wording ' + form, text: '×' }) : null;
      if (rm) rm.addEventListener('click', function () {
        mutateSkill(function (s) {
          s.forms.splice(fi, 1);
          if (s.shown === fi) s.shown = 0; else if (s.shown > fi) s.shown -= 1;
        });
      });
      return el('li', {}, [el('span', { class: 'wording', text: form }), showBtn, rm]);
    }));

    var synInput = el('input', { type: 'text', placeholder: 'Add a synonym', 'aria-label': 'Add a synonym' });
    var addSyn = el('button', { type: 'button', class: 'edit-btn', text: 'Add synonym' });
    function doAddSyn() {
      var v = synInput.value.replace(/\s+/g, ' ').trim();
      if (!v) return;
      if (skill.forms.some(function (f) { return f.toLowerCase() === v.toLowerCase(); })) { say('That wording is already there.', 'error'); return; }
      mutateSkill(function (s) { s.forms.push(v); });
    }
    addSyn.addEventListener('click', doAddSyn);
    synInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doAddSyn(); } });

    var removeSkill = el('button', { type: 'button', class: 'btn-quiet', text: 'Remove this skill' });
    removeSkill.addEventListener('click', function () {
      if (removeSkill.getAttribute('data-armed')) {
        save(function (c) { c.skills.groups[gi].items.splice(si, 1); });
        return;
      }
      removeSkill.setAttribute('data-armed', '1');
      removeSkill.textContent = 'Confirm remove';
    });
    var done = el('button', { type: 'button', class: 'btn-save', text: 'Done' });
    done.addEventListener('click', function () { closeSkillPanels(); btn.focus(); });

    var panel = el('div', { class: 'skill-panel', role: 'group', 'aria-label': 'Wordings for ' + skill.forms[skill.shown] }, [
      el('span', { class: 'label', text: 'Wordings for this skill' }),
      el('p', { class: 'muted small', text: 'The one marked “On the site” is what visitors see. The résumé generator picks whichever matches the posting best.' }),
      list,
      el('div', { class: 'inline-add' }, [synInput, addSyn]),
      el('div', { class: 'card-form__actions' }, [removeSkill, el('span', { class: 'spacer' }), done]),
    ]);
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeSkillPanels(); btn.focus(); } });
    btn.closest('.skill-edit').querySelector('.skill-panel-slot').appendChild(panel);
  }

  function wireSkills() {
    document.addEventListener('click', function (e) {
      var b = e.target.closest('.skill--edit');
      if (b) { openSkill(b); return; }
      var add = e.target.closest('[data-add-skill]');
      if (add) addSkill(add.getAttribute('data-add-skill'));
    });
    document.querySelectorAll('[data-add-skill-input]').forEach(function (input) {
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addSkill(input.getAttribute('data-add-skill-input')); } });
    });
  }

  function addSkill(gi) {
    var input = document.querySelector('[data-add-skill-input="' + gi + '"]');
    var v = input.value.replace(/\s+/g, ' ').trim();
    if (!v) return;
    save(function (c) { c.skills.groups[Number(gi)].items.push({ forms: [v], shown: 0 }); });
  }

  // ---- publish / discard ----
  function arm(button, label, action) {
    if (!button) return;
    var original = button.textContent;
    button.addEventListener('click', function () {
      if (!button.getAttribute('data-armed')) {
        button.setAttribute('data-armed', '1');
        button.textContent = label;
        setTimeout(function () { button.removeAttribute('data-armed'); button.textContent = original; }, 5000);
        return;
      }
      button.disabled = true;
      action().finally(function () { button.disabled = false; button.removeAttribute('data-armed'); button.textContent = original; });
    });
  }

  arm(publishBtn, 'Confirm publish', function () {
    say('Publishing…');
    return api('POST', '/api/admin/publish').then(function (res) {
      if (!res.ok) { say(res.data.message || res.data.error || 'Publishing failed.', 'error'); return; }
      state.changes = 0;
      if (draftLabel) draftLabel.textContent = 'Published · no unsaved changes';
      if (discardBtn) discardBtn.hidden = true;
      publishBtn.disabled = true;
      say('Published. The live site updates in about a minute.', 'ok');
      if (res.data.commitUrl) {
        var a = el('a', { href: res.data.commitUrl, text: 'See the commit' });
        msgEl.appendChild(document.createTextNode(' '));
        msgEl.appendChild(a);
      }
    });
  });

  arm(discardBtn, 'Confirm discard', function () {
    return api('DELETE', '/api/admin/draft').then(function (res) {
      if (!res.ok) { say(res.data.error || 'Could not discard.', 'error'); return; }
      location.reload();
    });
  });

  // ---- start ----
  api('GET', '/api/admin/draft').then(function (res) {
    if (!res.ok) { say(res.data.error || 'Could not load the draft.', 'error'); return; }
    state.content = res.data.content;
    state.baseSha = res.data.baseSha;
    state.changes = res.data.changes;
    document.documentElement.setAttribute('data-edit', 'on');
    wireInlineText();
    wireCards();
    wireAbout();
    wireSkills();
    restoreAfterReload();
  });
})();
