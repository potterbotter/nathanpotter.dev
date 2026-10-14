// DPR calculator page (/tools/dpr/app/): the fighter form, live results, the chart, CSV export and shared presets.
// Everything a visitor or the server supplies is inserted with textContent or as an attribute value, never as HTML.
import * as E from './dpr-engine.js';
import { placeLabels, labelWidth } from './dpr-labels.js';

const cfg = (() => { try { return JSON.parse(document.getElementById('np-dpr-config').textContent); } catch { return {}; } })();
const $ = (sel, root = document) => root.querySelector(sel);
const MAX_FIGHTERS = 4;
const STORE = 'dpr-state-v1';
const SERIES = [
  { color: 'var(--ink)', dash: '' },
  { color: 'var(--chalk)', dash: '7 5' },
  { color: 'var(--series-3)', dash: '2 5' },
  { color: 'var(--series-4)', dash: '12 4 2 4' },
];
const CRIT_OPTIONS = [20, 19, 18, 17, 16, 15];
const MIN_OPTIONS = [0, 2, 3, 4, 5, 6];

// ---------- tiny DOM helpers ----------
function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'text') n.textContent = v;
    else if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null) n.append(kid);
  return n;
}
const SVGNS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}, text) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
}
const fmt1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const pct = (x) => `${fmt1(x * 100)}%`;

// ---------- state ----------
// The form keeps damage as typed text ("2d6 + 4"); the engine gets parsed numbers.
function toForm(f) {
  return {
    name: f.name,
    attacks: f.attacks.map((a) => ({
      name: a.name, count: a.count, attackBonus: a.attackBonus, rollMode: a.rollMode, critThreshold: a.critThreshold,
      damage: E.formatDice(a.dice.count, a.dice.sides, a.flat),
      crit: a.critDice.count || a.critFlat ? E.formatDice(a.critDice.count, a.critDice.sides, a.critFlat) : '',
      rerollBelow: a.rerollBelow, minimumResult: a.minimumResult,
    })),
  };
}
const blankAttack = () => ({ name: 'Attack', count: 1, attackBonus: 5, rollMode: 'normal', critThreshold: 20, damage: '1d8 + 3', crit: '1d8', rerollBelow: 0, minimumResult: 0 });
const blankFighter = (n) => ({ name: `Fighter ${n}`, attacks: [blankAttack()] });

let state = load() || {
  terms: { acMin: 10, acMax: 25, focus: 16, nat1: false, nat20: false },
  fighters: [toForm(E.EXAMPLES[0]), toForm(E.EXAMPLES[4])],
};
let shared = [];
let savingEnabled = false;

function load() {
  try {
    const st = JSON.parse(localStorage.getItem(STORE));
    if (st && st.terms && Array.isArray(st.fighters) && st.fighters.length) return st;
  } catch { /* storage blocked or corrupt: start fresh */ }
  return null;
}
function persist() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* fine without it */ } }

// Form → engine. Returns { fighter } or { error, field }.
function toFighter(f) {
  try {
    const attacks = f.attacks.map((a, i) => {
      const label = a.name || `Attack ${i + 1}`;
      const dmg = E.parseDice(a.damage);
      if (!dmg || !dmg.count) throw Object.assign(new E.PresetError(`${label}: write damage like 2d6 + 4 (d4 to d12).`), { field: [i, 'damage'] });
      const crit = E.parseDice(a.crit);
      if (!crit) throw Object.assign(new E.PresetError(`${label}: write crit damage like 2d6, or leave it empty.`), { field: [i, 'crit'] });
      return {
        name: a.name, count: a.count, attackBonus: a.attackBonus, rollMode: a.rollMode, critThreshold: a.critThreshold,
        dice: { count: dmg.count, sides: dmg.sides }, flat: dmg.flat,
        critDice: { count: crit.count, sides: crit.count ? crit.sides : dmg.sides }, critFlat: crit.flat,
        rerollBelow: a.rerollBelow, minimumResult: a.minimumResult,
      };
    });
    return { fighter: E.normalizeFighter({ name: f.name, attacks }) };
  } catch (err) {
    if (err instanceof E.PresetError) return { error: err.message, field: err.field };
    throw err;
  }
}

function readTerms() {
  const t = state.terms;
  const ok = (n) => Number.isInteger(n) && n >= 1 && n <= 40;
  if (!ok(t.acMin) || !ok(t.acMax)) return { error: 'Armour class must be a whole number from 1 to 40.' };
  if (t.acMin > t.acMax) return { error: 'The lowest AC must not be above the highest.' };
  if (!ok(t.focus) || t.focus < t.acMin || t.focus > t.acMax) return { error: `Pick an AC to look at between ${t.acMin} and ${t.acMax}.` };
  return { terms: t };
}

// ---------- fighter form ----------
const fightersEl = $('#fighters');

function field(label, input) { return h('label', {}, label, input); }
function num(f, a, key, value, min, max, extra = {}) {
  return h('input', { type: 'number', inputmode: 'numeric', min, max, step: 1, value, 'data-f': f, 'data-a': a, 'data-k': key, ...extra });
}
function select(f, a, key, value, options) {
  const sel = h('select', { 'data-f': f, 'data-a': a, 'data-k': key });
  for (const [v, label] of options) sel.append(h('option', { value: v, text: label, selected: String(v) === String(value) }));
  return sel;
}
function swatch(i) {
  const st = SERIES[i % SERIES.length];
  const svg = s('svg', { class: 'swatch', viewBox: '0 0 34 14', 'aria-hidden': 'true' });
  svg.append(s('path', { d: 'M2 8 C 10 5, 22 10, 32 6', style: `stroke: ${st.color}; stroke-dasharray: ${st.dash || 'none'}` }));
  return svg;
}

function renderFighters() {
  fightersEl.replaceChildren(...state.fighters.map((f, fi) => {
    const card = h('article', { class: 'fighter', 'aria-labelledby': `fn-${fi}` });
    card.append(h('div', { class: 'fighter__head' },
      h('label', { id: `fn-${fi}` }, 'Name', h('input', { type: 'text', class: 'fighter__name', maxlength: E.LIMITS.name, value: f.name, 'data-f': fi, 'data-k': 'name', autocomplete: 'off' })),
      swatch(fi)));
    f.attacks.forEach((a, ai) => {
      card.append(h('div', { class: 'attack', role: 'group', 'aria-label': `${f.name || 'Fighter'}: ${a.name || 'attack'}` },
        h('div', { class: 'attack__top' },
          field('Attack', h('input', { type: 'text', maxlength: E.LIMITS.name, value: a.name, 'data-f': fi, 'data-a': ai, 'data-k': 'name', autocomplete: 'off' })),
          field('Per round', num(fi, ai, 'count', a.count, 1, E.LIMITS.count))),
        h('div', { class: 'attack__grid' },
          field('To hit', num(fi, ai, 'attackBonus', a.attackBonus, E.LIMITS.bonus[0], E.LIMITS.bonus[1])),
          field('Damage', h('input', { type: 'text', value: a.damage, 'data-f': fi, 'data-a': ai, 'data-k': 'damage', autocomplete: 'off', spellcheck: 'false' })),
          field('Crit on', select(fi, ai, 'critThreshold', a.critThreshold, CRIT_OPTIONS.map((c) => [c, c === 20 ? '20' : `${c}–20`]))),
          field('Crit adds', h('input', { type: 'text', value: a.crit, 'data-f': fi, 'data-a': ai, 'data-k': 'crit', autocomplete: 'off', spellcheck: 'false' }))),
        h('div', { class: 'attack__more' },
          field('Attack roll', select(fi, ai, 'rollMode', a.rollMode, [['normal', 'Normal'], ['advantage', 'Advantage'], ['disadvantage', 'Disadvantage']])),
          field('Reroll damage', select(fi, ai, 'rerollBelow', a.rerollBelow, [[0, 'No'], [1, '1s, once'], [2, '1s and 2s, once']])),
          field('Lowest die counts as', select(fi, ai, 'minimumResult', a.minimumResult, MIN_OPTIONS.map((m) => [m, m ? String(m) : 'No minimum'])))),
        f.attacks.length > 1 ? h('div', { class: 'attack__foot' }, h('button', { type: 'button', class: 'linkbtn', 'data-act': 'remove-attack', 'data-f': fi, 'data-a': ai, text: `Remove ${a.name || 'this attack'}` })) : null,
      ));
    });
    card.append(h('p', { class: 'error', id: `fe-${fi}`, role: 'alert' }));
    card.append(h('div', { class: 'fighter__foot' },
      f.attacks.length < E.LIMITS.attacks ? h('button', { type: 'button', class: 'linkbtn', 'data-act': 'add-attack', 'data-f': fi, text: '+ another attack' }) : null,
      savingEnabled ? h('button', { type: 'button', class: 'linkbtn', 'data-act': 'save', 'data-f': fi, text: 'Save for everyone' }) : null,
      state.fighters.length > 1 ? h('button', { type: 'button', class: 'linkbtn', 'data-act': 'remove-fighter', 'data-f': fi, text: 'Remove fighter' }) : null));
    return card;
  }));
  $('#add-fighter').disabled = state.fighters.length >= MAX_FIGHTERS;
}

fightersEl.addEventListener('input', (e) => {
  const t = e.target;
  if (!t.dataset.k) return;
  const f = state.fighters[+t.dataset.f];
  const target = t.dataset.a != null ? f.attacks[+t.dataset.a] : f;
  const k = t.dataset.k;
  target[k] = t.type === 'number' || ['critThreshold', 'rerollBelow', 'minimumResult'].includes(k) ? (t.value === '' ? NaN : Number(t.value)) : t.value;
  schedule();
});
fightersEl.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const fi = +b.dataset.f;
  const f = state.fighters[fi];
  if (b.dataset.act === 'add-attack') { f.attacks.push(blankAttack()); renderFighters(); focusLast(fi); }
  if (b.dataset.act === 'remove-attack') { f.attacks.splice(+b.dataset.a, 1); renderFighters(); }
  if (b.dataset.act === 'remove-fighter') { state.fighters.splice(fi, 1); renderFighters(); $('#add-fighter').focus(); }
  if (b.dataset.act === 'save') { openSave(fi); return; }
  schedule();
});
function focusLast(fi) {
  const inputs = fightersEl.children[fi].querySelectorAll('.attack input[data-k="name"]');
  inputs[inputs.length - 1]?.focus();
}

// ---------- presets ----------
const pick = $('#preset-pick');
function renderPicker() {
  const ex = h('optgroup', { label: 'Examples (level 5)' }, E.EXAMPLES.map((f, i) => h('option', { value: `e:${i}`, text: `${f.name}: ${f.note}` })));
  const sh = h('optgroup', { label: shared.length ? 'Saved by visitors' : 'Saved by visitors (none yet)' }, shared.map((p) => h('option', { value: `s:${p.id}`, text: `${p.name}, saved ${p.saved}` })));
  pick.replaceChildren(h('option', { value: '', text: 'A blank fighter' }), ex, sh);
}
$('#add-fighter').addEventListener('click', () => {
  if (state.fighters.length >= MAX_FIGHTERS) return;
  const v = pick.value;
  let f = blankFighter(state.fighters.length + 1);
  if (v.startsWith('e:')) f = toForm(E.EXAMPLES[+v.slice(2)]);
  if (v.startsWith('s:')) { const p = shared.find((x) => String(x.id) === v.slice(2)); if (p) f = toForm(p); }
  state.fighters.push(f);
  renderFighters();
  fightersEl.lastElementChild?.querySelector('input')?.focus();
  schedule();
});

async function loadShared() {
  const status = $('#preset-status');
  try {
    const res = await fetch('/api/dpr/presets', { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    shared = (data.presets || []).flatMap((p) => { try { return [{ ...E.normalizeFighter(p), id: p.id, saved: String(p.saved || '').slice(0, 10) }]; } catch { return []; } });
    savingEnabled = data.saving === true;
  } catch {
    status.textContent = "Couldn't load the presets other visitors saved. The examples still work.";
  }
  renderPicker();
  if (savingEnabled) renderFighters(); // adds the Save buttons
}

// ---------- saving (public) ----------
const dialog = $('#save-dialog');
let saveIndex = -1, saveFighter = null, tsToken = '', tsWidget = null, tsLoading = null;

function loadTurnstile() {
  if (!cfg.turnstileSiteKey) return Promise.resolve(false);
  if (typeof window.turnstile?.render === 'function') return Promise.resolve(true);
  tsLoading ||= new Promise((resolve) => {
    const sc = h('script', { src: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', async: true });
    sc.onload = () => resolve(true);
    sc.onerror = () => resolve(false);
    document.head.append(sc);
  });
  return tsLoading;
}

async function openSave(fi) {
  const r = toFighter(state.fighters[fi]);
  if (r.error) { showFighterError(fi, r.error); return; }
  saveIndex = fi; saveFighter = r.fighter; tsToken = '';
  $('#save-name').textContent = r.fighter.name;
  $('#save-error').textContent = '';
  $('#save-confirm').disabled = false;
  dialog.showModal();
  if (await loadTurnstile()) {
    if (tsWidget != null) window.turnstile.reset(tsWidget);
    else tsWidget = window.turnstile.render('#dpr-turnstile', { sitekey: cfg.turnstileSiteKey, appearance: 'interaction-only', callback: (t) => { tsToken = t; } });
  }
}

$('#save-confirm').addEventListener('click', async () => {
  const btn = $('#save-confirm');
  const err = $('#save-error');
  btn.disabled = true;
  err.textContent = '';
  try {
    const res = await fetch('/api/dpr/presets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fighter: saveFighter, turnstile: tsToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Couldn't save that preset. Try again.");
    const p = { ...E.normalizeFighter(data.preset), id: data.preset.id, saved: String(data.preset.saved || '').slice(0, 10) };
    if (!shared.some((x) => x.id === p.id)) shared.unshift(p);
    renderPicker();
    dialog.close();
    $('#preset-status').textContent = data.duplicate
      ? `${p.name} was already on the shared list.`
      : `Saved. ${p.name} is now on the shared list for everyone.`;
  } catch (e) {
    err.textContent = e.message;
    btn.disabled = false;
    if (window.turnstile && tsWidget != null) { tsToken = ''; window.turnstile.reset(tsWidget); }
  }
});
dialog.addEventListener('close', () => { if (saveIndex >= 0) fightersEl.children[saveIndex]?.querySelector('[data-act="save"]')?.focus(); saveIndex = -1; });

// ---------- terms ----------
for (const [id, key] of [['ac-min', 'acMin'], ['ac-max', 'acMax'], ['ac-focus', 'focus']]) {
  const input = $(`#${id}`);
  input.value = state.terms[key];
  input.addEventListener('input', () => { state.terms[key] = input.value === '' ? NaN : Number(input.value); schedule(); });
}
for (const [id, key] of [['nat1', 'nat1'], ['nat20', 'nat20']]) {
  const box = $(`#${id}`);
  box.checked = !!state.terms[key];
  box.addEventListener('change', () => { state.terms[key] = box.checked; schedule(); });
}

// ---------- results ----------
const resultsEl = $('#results');
let timer = 0, last = null;
function schedule() { clearTimeout(timer); timer = setTimeout(update, 120); }

function showFighterError(fi, msg, fieldRef) {
  const card = fightersEl.children[fi];
  if (!card) return;
  card.querySelector('.error').textContent = msg || '';
  card.querySelectorAll('[aria-invalid]').forEach((n) => n.removeAttribute('aria-invalid'));
  if (fieldRef) card.querySelector(`[data-a="${fieldRef[0]}"][data-k="${fieldRef[1]}"]`)?.setAttribute('aria-invalid', 'true');
}

function update() {
  persist();
  const t = readTerms();
  $('#terms-error').textContent = t.error || '';
  const valid = [];
  state.fighters.forEach((f, i) => {
    const r = toFighter(f);
    showFighterError(i, r.error, r.field);
    if (r.fighter) valid.push({ fighter: r.fighter, series: i });
  });
  if (t.error || !valid.length) { resultsEl.replaceChildren(h('p', { class: 'note', text: 'Fix the note in red above to see the sums.' })); last = null; return; }

  const { acMin, acMax, focus, nat1, nat20 } = t.terms;
  const rules = { acMin, acMax, nat1Misses: nat1, nat20Hits: nat20 };
  const results = E.analyze(valid.map((v) => v.fighter), rules).map((r, i) => ({ ...r, series: valid[i].series }));
  last = { results, terms: t.terms };
  const at = (r) => r.rows.find((x) => x.ac === focus);

  const tiles = h('div', { class: 'tiles' }, results.map((r) => h('div', { class: `tile tile--s${r.series % SERIES.length}`, style: `color: ${SERIES[r.series].color}` },
    h('span', { class: 'tile__name', text: r.name }),
    h('span', { class: 'tile__num', text: fmt1(at(r).dpr) }),
    h('span', { class: 'tile__sub', text: `damage a round at AC ${focus}` }))));

  const legend = h('div', { class: 'legend', 'aria-hidden': 'true' }, results.map((r) => h('span', {}, swatch(r.series), r.name)));
  const figure = h('figure', { class: 'section', style: 'margin: 0; gap: 8px' },
    h('figcaption', { text: `Average damage a round, from AC ${acMin} to AC ${acMax}` }), legend, chart(results, t.terms));

  const table = h('table', {},
    h('thead', {}, h('tr', {}, ['Fighter', 'Average', 'Typical', 'Big round*', 'Hit', 'Crit', 'Nothing'].map((c) => h('th', { scope: 'col', text: c })))),
    h('tbody', {}, results.map((r) => { const x = at(r); return h('tr', {},
      h('th', { scope: 'row', text: r.name, style: `color: ${SERIES[r.series].color}` }),
      h('td', { text: fmt1(x.dpr) }), h('td', { text: String(x.median) }), h('td', { text: String(x.p90) }),
      h('td', { text: pct(x.hit) }), h('td', { text: pct(x.crit) }), h('td', { text: pct(x.zero) })); })));
  const tally = h('div', { class: 'section', style: 'gap: 10px' },
    h('h3', { class: 'h3', text: `At AC ${focus}` }),
    h('div', { class: 'scroll' }, table),
    h('p', { class: 'note', text: 'Typical is the median round. A big round is one the fighter matches or beats one time in ten. Hit and crit are per attack; nothing is the chance a whole round deals no damage.' }));

  resultsEl.replaceChildren(tiles, figure, h('div', { class: 'split' }, tally, versus(results, focus, at)));
}

function versus(results, focus, at) {
  const box = h('div', { class: 'section', style: 'gap: 12px' }, h('h3', { class: 'h3', text: 'Who wins a round?' }));
  if (results.length !== 2) {
    box.append(h('p', { class: 'note', text: results.length < 2 ? 'Add a second fighter to see who out-damages whom, round by round.' : 'This compares two fighters at a time. Remove one to see it.' }));
    return box;
  }
  const [A, B] = results;
  const v = E.headToHead(at(A).dist, at(B).dist);
  box.append(
    h('div', { class: 'bar', role: 'img', 'aria-label': `At AC ${focus}, ${A.name} deals more in ${pct(v.a)} of rounds, ${B.name} in ${pct(v.b)}, and they tie in ${pct(v.tie)}.` },
      h('div', { class: 'bar__a', style: `width: ${v.a * 100}%` }), h('div', { class: 'bar__tie', style: `width: ${v.tie * 100}%` }), h('div', { class: 'bar__b', style: `width: ${v.b * 100}%` })),
    h('div', { class: 'bar-labels' }, h('span', { text: `${pct(v.a)} ${A.name}` }), h('span', { class: 'note', text: `${pct(v.tie)} tie` }), h('span', { class: 'chalk', text: `${pct(v.b)} ${B.name}` })));
  const [win, lose, share] = v.a >= v.b ? [A, B, v.a] : [B, A, v.b];
  box.append(h('p', { class: 'verdict', text: Math.abs(v.a - v.b) < 0.02
    ? `At AC ${focus} it's a coin flip: neither fighter reliably out-damages the other.`
    : `At AC ${focus}, ${win.name} out-damages ${lose.name} in ${pct(share)} of rounds.` }));
  return box;
}

// Hand-drawn line chart. Narrow screens get their own geometry so labels stay readable.
function chart(results, { acMin, acMax, focus }) {
  const narrow = resultsEl.clientWidth < 520;
  const W = narrow ? 340 : 680, H = narrow ? 230 : 290, L = narrow ? 34 : 48, R = W - 10, T = 12, B = H - 34;
  const max = Math.max(10, ...results.flatMap((r) => r.rows.map((x) => x.dpr)));
  const step = max > 60 ? 20 : max > 30 ? 10 : 5;
  const top = Math.ceil((max * 1.05) / step) * step;
  const span = Math.max(1, acMax - acMin);
  const X = (ac) => L + ((ac - acMin) / span) * (R - L);
  const Y = (v) => B - (v / top) * (B - T);
  const svg = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img',
    'aria-label': `Line chart of average damage a round from AC ${acMin} to ${acMax}. ` + results.map((r) => `${r.name}: ${fmt1(r.rows[0].dpr)} at AC ${acMin}, ${fmt1(r.rows.at(-1).dpr)} at AC ${acMax}.`).join(' ') });
  const g = s('g');
  for (let v = step; v <= top; v += step) g.append(s('path', { class: 'gridline', d: `M${L} ${Y(v)} H${R}` }));
  if (focus >= acMin && focus <= acMax) g.append(s('path', { class: 'focus', d: `M${X(focus)} ${T} V${B}` }));
  g.append(s('path', { class: 'axis', d: `M${L} ${T} L${L} ${B + 1} L${R + 2} ${B}` }));
  const segments = [];
  const labels = [];
  const fs = narrow ? 16 : 15;
  if (focus >= acMin && focus <= acMax) segments.push([X(focus), T, X(focus), B]);
  for (const r of results) {
    const st = SERIES[r.series];
    const pts = r.rows.map((x) => [X(x.ac), Y(x.dpr)]);
    for (let i = 1; i < pts.length; i++) segments.push([...pts[i - 1], ...pts[i]]);
    g.append(s('polyline', { class: 'series', points: pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '), style: `stroke: ${st.color}; stroke-dasharray: ${st.dash || 'none'}` }));
    const f = r.rows.find((x) => x.ac === focus);
    if (f) {
      g.append(s('circle', { class: 'dot', cx: X(focus), cy: Y(f.dpr), r: 5, style: `stroke: ${st.color}` }));
      const text = fmt1(f.dpr);
      labels.push({ x: X(focus), y: Y(f.dpr), w: labelWidth(text, fs), h: fs * 1.1, text, color: st.color });
    }
  }
  svg.append(g);
  // Value labels at the focus AC sit in empty space: clear of every line, each other and the edges.
  placeLabels({ labels, segments, bounds: { l: L + 4, t: 0, r: W, b: B - 2 }, pad: 4 }).forEach((p, i) => {
    const l = labels[i];
    if (p.leader) {
      const tx = Math.max(p.x, Math.min(l.x, p.x + p.w)), ty = Math.max(p.y, Math.min(l.y, p.y + p.h));
      const len = Math.hypot(tx - l.x, ty - l.y);
      if (len > 8) svg.append(s('path', { class: 'leader', d: `M${l.x + ((tx - l.x) / len) * 7} ${l.y + ((ty - l.y) / len) * 7} L${tx} ${ty}`, style: `stroke: ${l.color}` }));
    }
    svg.append(s('text', { class: 'value', x: p.x + 2, y: p.y + fs * 0.88, style: `fill: ${l.color}` }, l.text));
  });
  for (let v = 0; v <= top; v += step) svg.append(s('text', { x: L - 8, y: Y(v) + 5, 'text-anchor': 'end' }, String(v)));
  const every = Math.max(1, Math.ceil((span + 1) / (narrow ? 5 : 9)));
  for (let ac = acMin; ac <= acMax; ac += every) svg.append(s('text', { x: X(ac), y: B + 22, 'text-anchor': 'middle' }, ac === acMin ? `AC ${ac}` : String(ac)));
  return svg;
}

let lastWidth = 0;
new ResizeObserver(([e]) => {
  const w = Math.round(e.contentRect.width);
  if ((w < 520) !== (lastWidth < 520) && last) update();
  lastWidth = w;
}).observe(resultsEl);

// ---------- CSV ----------
$('#csv').addEventListener('click', () => {
  if (!last) return;
  // Names are visitor-typed: quote them, and defuse anything a spreadsheet would read as a formula.
  const cell = (v) => { let t = String(v); if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const rows = [['Fighter', 'AC', 'Average damage', 'Median', '90th percentile', 'Miss %', 'Hit %', 'Crit %', 'No damage %']];
  for (const r of last.results) for (const x of r.rows) rows.push([r.name, x.ac, x.dpr.toFixed(3), x.median, x.p90, (x.miss * 100).toFixed(2), (x.hit * 100).toFixed(2), (x.crit * 100).toFixed(2), (x.zero * 100).toFixed(2)]);
  const url = URL.createObjectURL(new Blob([rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'], { type: 'text/csv' }));
  const a = h('a', { href: url, download: 'dpr-comparison.csv' });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// ---------- start ----------
renderPicker();
renderFighters();
update();
loadShared();
