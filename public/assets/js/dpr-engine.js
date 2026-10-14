// DPR calculator engine. Works out the exact probability of every possible damage total for a round of attacks, so
// every number is exact and repeatable, not a simulation estimate. It runs in the browser on /tools/dpr/app/, in the
// Worker (preset validation) and in the Node tests. No DOM access.
//
// A distribution is { offset, p }, where p[i] is the chance the total equals offset + i.
// Ported from Nathan's Python/Streamlit comparator (combat_engine.py), which simulated damage by Monte Carlo. Its
// homebrew options (exploding dice, bigger dice against Large targets) are left out; what remains is standard 5e.

export const DIE_SIZES = [4, 6, 8, 10, 12];
export const ROLL_MODES = ['normal', 'advantage', 'disadvantage'];

// ---------- distributions ----------
const point = (v) => ({ offset: v, p: [1] });

function trim(d) {
  let lo = 0, hi = d.p.length - 1;
  while (lo < hi && d.p[lo] < 1e-15) lo++;
  while (hi > lo && d.p[hi] < 1e-15) hi--;
  return { offset: d.offset + lo, p: d.p.slice(lo, hi + 1) };
}

export function convolve(a, b) {
  const p = new Array(a.p.length + b.p.length - 1).fill(0);
  for (let i = 0; i < a.p.length; i++) {
    const ai = a.p[i];
    if (!ai) continue;
    for (let j = 0; j < b.p.length; j++) p[i + j] += ai * b.p[j];
  }
  return trim({ offset: a.offset + b.offset, p });
}

function power(d, n) {
  let out = point(0), base = d;
  while (n > 0) {
    if (n & 1) out = convolve(out, base);
    n >>= 1;
    if (n) base = convolve(base, base);
  }
  return out;
}

const shift = (d, k) => ({ offset: d.offset + k, p: d.p });

// Weighted sum of distributions: [[weight, dist], ...].
function mix(parts) {
  parts = parts.filter(([w]) => w > 0);
  if (!parts.length) return point(0);
  const lo = Math.min(...parts.map(([, d]) => d.offset));
  const hi = Math.max(...parts.map(([, d]) => d.offset + d.p.length - 1));
  const p = new Array(hi - lo + 1).fill(0);
  for (const [w, d] of parts) for (let i = 0; i < d.p.length; i++) p[d.offset - lo + i] += w * d.p[i];
  return { offset: lo, p };
}

// Damage can't go below zero for a single attack (the Python engine clamps the same way).
function clampZero(d) {
  if (d.offset >= 0) return d;
  const below = d.p.slice(0, Math.min(d.p.length, -d.offset)).reduce((s, x) => s + x, 0);
  const rest = d.p.slice(-d.offset);
  return { offset: 0, p: [below + (rest[0] || 0), ...rest.slice(1)] };
}

// ---------- one damage die ----------
// rule: { sides, rerollBelow, minimumResult }
// rerollBelow: reroll a face at or below this once and keep the second roll (1 = reroll 1s; 2 = 1s and 2s, as the
// 2014 Great Weapon Fighting style). minimumResult: faces below it count as it (3 = the 2024 Great Weapon Fighting style).
export function dieDistribution({ sides, rerollBelow = 0, minimumResult = 0 }) {
  const p = new Array(sides + 1).fill(0);
  const u = 1 / sides;
  for (let f = 1; f <= sides; f++) p[f] = (f > rerollBelow ? u : 0) + rerollBelow * u * u;
  for (let f = 1; f < Math.min(minimumResult, sides); f++) { p[minimumResult] += p[f]; p[f] = 0; }
  return trim({ offset: 0, p });
}

function diceDistribution({ count, ...rule }) {
  return count > 0 ? power(dieDistribution(rule), count) : point(0);
}

// ---------- attack rolls ----------
// Exact (miss, normal hit, crit) chances for one attack roll.
// A crit must also hit: with a high AC, a 19 can be in the crit range and still miss.
export function attackOutcomes({ attackBonus, rollMode = 'normal', critThreshold = 20 }, ac, { nat1Misses = false, nat20Hits = false } = {}) {
  let miss = 0, hit = 0, crit = 0;
  for (let n = 1; n <= 20; n++) {
    // Chance the kept d20 shows exactly n.
    const pr = rollMode === 'advantage' ? (2 * n - 1) / 400 : rollMode === 'disadvantage' ? (41 - 2 * n) / 400 : 1 / 20;
    let hits = n + attackBonus >= ac;
    if (nat20Hits && n === 20) hits = true;
    if (nat1Misses && n === 1) hits = false;
    if (!hits) miss += pr;
    else if (n >= critThreshold) crit += pr;
    else hit += pr;
  }
  return { miss, hit, crit };
}

// ---------- fighters ----------
// fighter: { name, attacks: [attack] }
// attack:  { name, count, attackBonus, rollMode, critThreshold, dice: { count, sides }, flat,
//            critDice: { count, sides }, critFlat, rerollBelow, minimumResult }
// rules:   { nat1Misses, nat20Hits }

// The damage of one attack, before the attack roll: { onHit, onCrit } distributions. Independent of AC, so it's
// computed once per attack and reused across the AC sweep.
export function attackDamage(attack) {
  const die = { rerollBelow: attack.rerollBelow || 0, minimumResult: attack.minimumResult || 0 };
  const normal = shift(diceDistribution({ ...die, ...attack.dice }), attack.flat || 0);
  const extra = attack.critDice?.count ? shift(diceDistribution({ ...die, ...attack.critDice }), attack.critFlat || 0) : point(attack.critFlat || 0);
  return { onHit: clampZero(normal), onCrit: clampZero(convolve(normal, extra)) };
}

export function attackDistribution(attack, ac, rules = {}, damage = attackDamage(attack)) {
  const o = attackOutcomes(attack, ac, rules);
  return { outcomes: o, dist: mix([[o.miss, point(0)], [o.hit, damage.onHit], [o.crit, damage.onCrit]]) };
}

export function roundDistribution(fighter, ac, rules = {}, damages = fighter.attacks.map((a) => attackDamage(a))) {
  let total = point(0);
  fighter.attacks.forEach((a, i) => {
    if (a.count > 0) total = convolve(total, power(attackDistribution(a, ac, rules, damages[i]).dist, a.count));
  });
  return total;
}

// ---------- statistics ----------
export function mean(d) { return d.p.reduce((s, x, i) => s + x * (d.offset + i), 0); }

export function stdDev(d) {
  const m = mean(d);
  return Math.sqrt(d.p.reduce((s, x, i) => s + x * (d.offset + i - m) ** 2, 0));
}

// Smallest total whose cumulative chance reaches q.
export function quantile(d, q) {
  let c = 0;
  for (let i = 0; i < d.p.length; i++) { c += d.p[i]; if (c >= q - 1e-12) return d.offset + i; }
  return d.offset + d.p.length - 1;
}

export const chanceOf = (d, v) => d.p[v - d.offset] || 0;

// Chance A's round beats B's, B's beats A's, or they tie, with the two rounds independent.
export function headToHead(a, b) {
  const cdfB = []; let c = 0;
  for (const x of b.p) cdfB.push((c += x));
  const cdfAt = (v) => { const i = v - b.offset; return i < 0 ? 0 : i >= cdfB.length ? 1 : cdfB[i]; };
  let win = 0, tie = 0;
  a.p.forEach((x, i) => { const v = a.offset + i; win += x * cdfAt(v - 1); tie += x * chanceOf(b, v); });
  return { a: win, b: 1 - win - tie, tie };
}

// One row per fighter per AC: the numbers the page shows.
export function analyze(fighters, { acMin = 10, acMax = 25, ...rules } = {}) {
  return fighters.map((f) => {
    const damages = f.attacks.map((a) => attackDamage(a));
    const swings = f.attacks.reduce((s, a) => s + a.count, 0);
    const rows = [];
    for (let ac = acMin; ac <= acMax; ac++) {
      const dist = roundDistribution(f, ac, rules, damages);
      // Accuracy is averaged over every swing in the round, weighted by how many of each attack there are.
      const acc = { miss: 0, hit: 0, crit: 0 };
      for (const a of f.attacks) {
        const o = attackOutcomes(a, ac, rules);
        for (const k in acc) acc[k] += (o[k] * a.count) / (swings || 1);
      }
      rows.push({
        ac, dist, dpr: mean(dist), sd: stdDev(dist), median: quantile(dist, 0.5), p90: quantile(dist, 0.9),
        zero: chanceOf(dist, 0), miss: acc.miss, hit: acc.hit + acc.crit, normalHit: acc.hit, crit: acc.crit,
      });
    }
    return { name: f.name, rows };
  });
}

// ---------- dice notation ----------
// "2d6 + 4", "1d8", "d12-1", "+3" or "" → { count, sides, flat }. Returns null when it can't be read.
export function parseDice(text) {
  const s = String(text ?? '').replace(/\s+/g, '').replace(/[−–]/g, '-').toLowerCase();
  if (!s) return { count: 0, sides: 6, flat: 0 };
  const m = s.match(/^(?:(\d{0,2})d(\d{1,2}))?([+-]\d{1,3})?$/);
  if (!m || (!m[2] && !m[3])) return /^\d{1,3}$/.test(s) ? { count: 0, sides: 6, flat: Number(s) } : null;
  const sides = m[2] ? Number(m[2]) : 6;
  if (!DIE_SIZES.includes(sides)) return null;
  return { count: m[2] ? Number(m[1] || 1) : 0, sides, flat: m[3] ? Number(m[3]) : 0 };
}

export function formatDice(count, sides, flat) {
  const dice = count ? `${count}d${sides}` : '';
  if (!flat) return dice || '0';
  return dice ? `${dice} ${flat < 0 ? '−' : '+'} ${Math.abs(flat)}` : String(flat);
}

// ---------- presets ----------
// Every fighter that reaches the engine from outside (the form, a saved preset, the API) goes through here, so the
// browser and the Worker accept exactly the same shapes. Throws PresetError with a message fit to show a visitor.
export class PresetError extends Error {}
export const LIMITS = { name: 40, attacks: 6, count: 10, bonus: [-5, 25], flat: [-10, 50], diceCount: 12, crit: [15, 20] };

const cleanText = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const int = (v, lo, hi, label) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < lo || n > hi) throw new PresetError(`${label} must be a whole number from ${lo} to ${hi}.`);
  return n;
};
const dice = (d, label) => {
  const count = int(d?.count ?? 0, 0, LIMITS.diceCount, `${label} dice`);
  const sides = Number(d?.sides ?? 6);
  if (!DIE_SIZES.includes(sides)) throw new PresetError(`${label} dice must be d4, d6, d8, d10 or d12.`);
  return { count, sides };
};

export function normalizeFighter(f) {
  const name = cleanText(f?.name, LIMITS.name);
  if (!name) throw new PresetError('Give the fighter a name.');
  const attacks = Array.isArray(f?.attacks) ? f.attacks : [];
  if (!attacks.length) throw new PresetError('Add at least one attack.');
  if (attacks.length > LIMITS.attacks) throw new PresetError(`A fighter can have at most ${LIMITS.attacks} attacks.`);
  return {
    name,
    attacks: attacks.map((a, i) => {
      const label = cleanText(a?.name, LIMITS.name) || `Attack ${i + 1}`;
      const d = dice(a?.dice, label);
      const minimumResult = int(a?.minimumResult ?? 0, 0, d.sides, `${label}: minimum die result`);
      return {
        name: label,
        count: int(a?.count ?? 1, 1, LIMITS.count, `${label}: attacks per round`),
        attackBonus: int(a?.attackBonus ?? 0, ...LIMITS.bonus, `${label}: to hit`),
        rollMode: ROLL_MODES.includes(a?.rollMode) ? a.rollMode : 'normal',
        critThreshold: int(a?.critThreshold ?? 20, ...LIMITS.crit, `${label}: crit range`),
        dice: d,
        flat: int(a?.flat ?? 0, ...LIMITS.flat, `${label}: damage bonus`),
        critDice: dice(a?.critDice ?? { count: 0, sides: d.sides }, `${label}: crit`),
        critFlat: int(a?.critFlat ?? 0, 0, LIMITS.flat[1], `${label}: crit bonus`),
        rerollBelow: int(a?.rerollBelow ?? 0, 0, 2, `${label}: reroll`),
        minimumResult: minimumResult === 1 ? 0 : minimumResult,
      };
    }),
  };
}

// ---------- built-in examples ----------
// Level 5 builds using standard rules: +3 proficiency and a +4 ability modifier unless noted. Crits add the weapon's
// dice again. "Great Weapon Fighting" is the 2024 style: a 1 or 2 on a damage die counts as 3.
const atk = (name, count, attackBonus, dice, flat, extra = {}) => ({
  name, count, attackBonus, rollMode: 'normal', critThreshold: 20, dice, flat, critDice: { ...dice }, critFlat: 0, rerollBelow: 0, minimumResult: 0, ...extra,
});
export const EXAMPLES = [
  { name: 'Greatsword fighter', note: 'Two greatsword attacks with the Great Weapon Fighting style.',
    attacks: [atk('Greatsword', 2, 7, { count: 2, sides: 6 }, 4, { minimumResult: 3 })] },
  { name: 'Greatsword champion', note: 'The same fighter with a 19–20 crit range.',
    attacks: [atk('Greatsword', 2, 7, { count: 2, sides: 6 }, 4, { minimumResult: 3, critThreshold: 19 })] },
  { name: 'Sword and shield', note: 'Two longsword attacks with the Dueling style (+2 damage).',
    attacks: [atk('Longsword', 2, 7, { count: 1, sides: 8 }, 6)] },
  { name: 'Two-weapon fighter', note: 'Two shortsword attacks plus an off-hand attack, with the Two-Weapon Fighting style.',
    attacks: [atk('Shortsword', 2, 7, { count: 1, sides: 6 }, 4), atk('Off-hand shortsword', 1, 7, { count: 1, sides: 6 }, 4)] },
  { name: 'Archer', note: 'Two longbow attacks with the Archery style (+2 to hit).',
    attacks: [atk('Longbow', 2, 9, { count: 1, sides: 8 }, 4)] },
  { name: 'Reckless raging barbarian', note: 'Two greataxe attacks with advantage, plus +2 rage damage.',
    attacks: [atk('Greataxe', 2, 7, { count: 1, sides: 12 }, 6, { rollMode: 'advantage' })] },
].map((f) => ({ ...normalizeFighter(f), note: f.note }));
