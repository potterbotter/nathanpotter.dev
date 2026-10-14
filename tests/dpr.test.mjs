// DPR calculator engine: exact results checked by hand and against the original Python simulation. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  attackOutcomes, dieDistribution, roundDistribution, analyze, headToHead, mean,
  parseDice, formatDice, normalizeFighter, PresetError, EXAMPLES,
} from '../public/assets/js/dpr-engine.js';

const close = (a, b, tol = 1e-9, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b}`);
const total = (d) => d.p.reduce((s, x) => s + x, 0);

test('attack rolls: a crit must also hit, and advantage/disadvantage are exact', () => {
  const o = attackOutcomes({ attackBonus: 10, critThreshold: 19 }, 24);
  close(o.hit + o.crit, 0.35); close(o.crit, 0.10); // hits on 14–20; 19 and 20 crit
  close(attackOutcomes({ attackBonus: 0, critThreshold: 19 }, 21).crit, 0); // 19 and 20 miss AC 21 without the natural-20 rule...
  close(attackOutcomes({ attackBonus: 0, critThreshold: 19 }, 21, { nat20Hits: true }).crit, 0.05); // ...and 20 hits with it
  close(attackOutcomes({ attackBonus: 0, rollMode: 'advantage' }, 11).miss, 0.25); // need 11+: (10/20)^2 miss
  close(attackOutcomes({ attackBonus: 0, rollMode: 'disadvantage' }, 11).miss, 0.75);
  close(attackOutcomes({ attackBonus: 30 }, 10, { nat1Misses: true }).miss, 0.05);
});

test('dice: rerolls and minimum results', () => {
  close(mean(dieDistribution({ sides: 6, minimumResult: 3 })), 4); // (3 + 3 + 3 + 4 + 5 + 6) / 6
  close(mean(dieDistribution({ sides: 6, rerollBelow: 1 })), 3.5 + (1 / 6) * (3.5 - 1)); // a 1 becomes a fresh d6
  close(mean(dieDistribution({ sides: 6, rerollBelow: 2 })), (4 * 4.5 + 2 * 3.5) / 6); // 3–6 stay; 1–2 reroll to 3.5
  close(total(dieDistribution({ sides: 12, rerollBelow: 2, minimumResult: 3 })), 1);
});

test('Greatsword fighter by hand: 2 × (0.60 × 12 + 0.05 × 20) = 16.4 at AC 15', () => {
  // +7 hits AC 15 on 8–19 (60%) and crits on 20 (5%). 2d6 with 1s and 2s as 3 averages 8, +4; a crit adds 2d6 (8).
  const gwf = EXAMPLES.find((f) => f.name === 'Greatsword fighter');
  close(mean(roundDistribution(gwf, 15)), 16.4);
});

test("matches the original Python simulation (sample CSV, 100,000 rounds per AC) within 4 standard errors", () => {
  // Character B from the anonymized export: 3 × 2d10 + 6, dice below 6 count as 6, crits add 2d10 + 20.
  // [AC, simulated DPR, standard error] from sample_results/dpr_comparison_sample_2.csv
  const B = { name: 'B', attacks: [{ count: 3, attackBonus: 10, critThreshold: 20, dice: { count: 2, sides: 10 }, flat: 6, critDice: { count: 2, sides: 10 }, critFlat: 20, minimumResult: 6 }] };
  const sim = [[10, 65.10996, 0.0423], [14, 56.08526, 0.0601], [18, 44.00466, 0.0717], [22, 32.20321, 0.0762], [25, 23.07921, 0.0748]];
  const [res] = analyze([B], { acMin: 10, acMax: 25 });
  for (const [ac, dpr, se] of sim) {
    const row = res.rows.find((r) => r.ac === ac);
    assert.ok(Math.abs(row.dpr - dpr) < 4 * se, `AC ${ac}: exact ${row.dpr} vs simulated ${dpr}`);
    close(total(row.dist), 1, 1e-9);
  }
  close(res.rows.find((r) => r.ac === 18).dpr, 44.1); // 3 × (0.65 × 20 + 0.05 × 34), by hand
});

test('head-to-head chances add up to 1', () => {
  const [a, b] = EXAMPLES;
  const h = headToHead(roundDistribution(a, 16), roundDistribution(b, 16));
  close(h.a + h.b + h.tie, 1);
});

test('dice notation round-trips', () => {
  assert.deepEqual(parseDice('2d6 + 4'), { count: 2, sides: 6, flat: 4 });
  assert.deepEqual(parseDice('d12-1'), { count: 1, sides: 12, flat: -1 });
  assert.deepEqual(parseDice('+3'), { count: 0, sides: 6, flat: 3 });
  assert.deepEqual(parseDice(''), { count: 0, sides: 6, flat: 0 });
  assert.deepEqual(parseDice(formatDice(1, 8, -2)), { count: 1, sides: 8, flat: -2 });
  for (const bad of ['2d7', '1d20', '2x6', 'd', '3d6+', 'abc']) assert.equal(parseDice(bad), null, bad);
});

test('presets: every example is valid, and bad input is refused with a readable message', () => {
  for (const f of EXAMPLES) assert.deepEqual(normalizeFighter(f), { name: f.name, attacks: f.attacks });
  const ok = EXAMPLES[0];
  const bad = [
    { ...ok, name: '   ' },
    { ...ok, attacks: [] },
    { ...ok, attacks: Array(7).fill(ok.attacks[0]) },
    { ...ok, attacks: [{ ...ok.attacks[0], count: 50 }] },
    { ...ok, attacks: [{ ...ok.attacks[0], dice: { count: 2, sides: 7 } }] },
    { ...ok, attacks: [{ ...ok.attacks[0], attackBonus: '7; DROP TABLE' }] },
  ];
  for (const f of bad) assert.throws(() => normalizeFighter(f), PresetError);
  // Names are trimmed, capped and stripped of control and direction-override characters.
  const n = normalizeFighter({ ...ok, name: '  Sir‮  Stab\u0000a lot ' + 'x'.repeat(80) });
  assert.match(n.name, /^Sir Staba lot x+$/);
  assert.equal(n.name.length, 40);
  // Unknown fields are dropped.
  assert.equal('note' in normalizeFighter({ ...ok, note: 'x', evil: 1 }), false);
});
