// Résumé generator: assembly only uses approved blocks, fits the page, and scores honestly. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assemble, baselineDoc, score, toText, estimateLines, BUDGETS, fakePlan, catalogue, refCode } from '../src/resume.js';
import { validate } from '../build/validate.mjs';

const cv = JSON.parse(readFileSync(new URL('../content/cv.json', import.meta.url), 'utf8'));
validate(cv);
const approvedTexts = () => {
  const s = new Set([...cv.resume.titles, ...cv.resume.summaries.map((x) => x.text)]);
  for (const r of cv.experience.roles) for (const c of r.cards) { s.add(c.detail); for (const v of c.variants || []) s.add(v.text); }
  for (const g of cv.skills.groups) for (const i of g.items) for (const f of i.forms) s.add(f);
  return s;
};

test('every sentence in the assembled résumé is an approved block, even when the plan tries to invent', () => {
  const plan = {
    title_index: 7, summary_id: 'made-up',
    roles: [{ anchor: 'exp-anchorage', bullets: [{ card_id: 'anchorage-0', variant_id: 'nope' }, { card_id: 'mosaic-0', variant_id: '' }, { card_id: 'fake-1', variant_id: '' }] }],
    skills: [{ skill: 'Kubernetes', form: 0 }, { skill: 'SQL', form: 99 }],
  };
  const { doc, dropped } = assemble(cv, plan);
  const ok = approvedTexts();
  assert.ok(ok.has(doc.title));
  assert.ok(ok.has(doc.summary.text));
  for (const r of doc.roles) for (const b of r.bullets) assert.ok(ok.has(b.text), b.text);
  for (const s of doc.skills) assert.ok(ok.has(s.text), s.text);
  assert.ok(dropped.length >= 5, `dropped: ${dropped.join('; ')}`);
});

test('roles, companies and dates are never changed, and every role keeps at least one bullet', () => {
  const { doc } = assemble(cv, { title_index: 0, summary_id: 'general', roles: [], skills: [] });
  assert.deepEqual(doc.roles.map((r) => [r.company, r.title, r.dates]), cv.experience.roles.map((r) => [r.company, r.title, r.dates]));
  for (const r of doc.roles) assert.ok(r.bullets.length >= 1);
});

test('one page fits the line and bullet budget; two pages allows more', () => {
  const all = { title_index: 0, summary_id: 'general', roles: cv.experience.roles.map((r) => ({ anchor: r.anchor, bullets: r.cards.map((c) => ({ card_id: c.id, variant_id: '' })) })), skills: [] };
  const one = assemble(cv, all, { length: 'one' });
  const two = assemble(cv, all, { length: 'two' });
  assert.ok(one.lines <= BUDGETS.one.lines || one.doc.roles.every((r) => r.bullets.length === 1));
  assert.ok(one.doc.roles.reduce((n, r) => n + r.bullets.length, 0) <= BUDGETS.one.maxBullets);
  assert.ok(two.doc.roles.reduce((n, r) => n + r.bullets.length, 0) >= one.doc.roles.reduce((n, r) => n + r.bullets.length, 0));
  assert.equal(estimateLines(one.doc), one.lines);
});

test('trimming removes the least relevant bullets first (the end of each role)', () => {
  const r = cv.experience.roles[0];
  const order = [...r.cards].reverse().map((c) => ({ card_id: c.id, variant_id: '' }));
  const { doc } = assemble(cv, { title_index: 0, summary_id: 'general', roles: [{ anchor: r.anchor, bullets: order }], skills: [] }, { length: 'one' });
  const kept = doc.roles[0].bullets.map((b) => b.card_id);
  assert.deepEqual(kept, order.slice(0, kept.length).map((b) => b.card_id));
});

test('the applied plan matches the page, so trimmed bullets do not come back on the next edit', () => {
  const all = { keywords: [{ term: 'SQL', importance: 'must' }], title_index: 0, summary_id: 'general', roles: cv.experience.roles.map((r) => ({ anchor: r.anchor, bullets: r.cards.map((c) => ({ card_id: c.id, variant_id: '' })) })), skills: [] };
  const first = assemble(cv, all, { length: 'one' });
  assert.ok(first.trimmed.length > 0);
  assert.deepEqual(first.plan.keywords, all.keywords);
  const onPage = (doc) => doc.roles.flatMap((r) => r.bullets.map((b) => b.card_id));
  assert.deepEqual(first.plan.roles.flatMap((r) => r.bullets.map((b) => b.card_id)), onPage(first.doc));
  // Remove one bullet: the page shrinks by one instead of a trimmed bullet reappearing.
  const role = first.plan.roles.find((r) => r.bullets.length > 1);
  const gone = role.bullets.pop().card_id;
  const second = assemble(cv, first.plan, { length: 'one' });
  assert.equal(onPage(second.doc).length, onPage(first.doc).length - 1);
  assert.ok(!onPage(second.doc).includes(gone));
  assert.deepEqual(second.trimmed, []);
});

test('approved skill wordings are used, and synonym matches are reported', () => {
  const { doc } = assemble(cv, { title_index: 0, summary_id: 'general', roles: [], skills: [{ skill: 'SQL', form: 3 }] });
  assert.equal(doc.skills[0].text, 'MySQL');
  const s = score(doc, [{ term: 'MySQL', importance: 'must' }, { term: 'Rust', importance: 'nice' }], cv);
  assert.equal(s.mustCovered, 1);
  assert.deepEqual(s.missing.map((k) => k.term), ['Rust']);
  assert.equal(s.viaSynonyms[0].onSite, 'SQL');
});

test('the baseline is the untailored CV, and the fake plan assembles cleanly', () => {
  const base = baselineDoc(cv);
  assert.equal(base.roles.reduce((n, r) => n + r.bullets.length, 0) > 0, true);
  const { doc } = assemble(cv, fakePlan(cv).plan);
  assert.match(toText(doc), /EXPERIENCE/);
  assert.match(catalogue(cv), /\[anchorage-0\]/);
  assert.match(refCode('Stripe, Inc.'), /^stripe-inc-[a-z0-9]{1,4}$/);
});
