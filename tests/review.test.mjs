// Review queue: only well-formed, new proposals that add no claims reach Nathan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { screen, dedupeKey, contextFor } from '../src/review.js';
import { applyProposal } from '../src/kb.js';
import { validate } from '../build/validate.mjs';

const cv = JSON.parse(readFileSync(new URL('../content/cv.json', import.meta.url), 'utf8'));
const card = cv.experience.roles[0].cards[0];
const skill = cv.skills.groups[0].items[0];
const base = { card_id: '', skill: '', wording: '', label: '', text: '', why: 'x' };
const summary = 'Senior product manager with 7+ years in regulated finance, now running client onboarding and risk at a federally chartered crypto bank, turning messy workflows into products.';

test('titles must be Senior Product Manager titles, and new', () => {
  const out = screen(cv, [
    { ...base, kind: 'add_title', text: 'Senior Product Manager, Onboarding & Risk' },
    { ...base, kind: 'add_title', text: 'Principal Product Manager' },
    { ...base, kind: 'add_title', text: 'Director of Product' },
    { ...base, kind: 'add_title', text: cv.resume.titles[0] },
  ], []);
  assert.deepEqual(out.map((p) => p.text), ['Senior Product Manager, Onboarding & Risk']);
});

test('skill wordings only extend skills that already exist', () => {
  const out = screen(cv, [
    { ...base, kind: 'add_skill_wording', skill: skill.forms[0], wording: 'A brand-new phrasing' },
    { ...base, kind: 'add_skill_wording', skill: 'Kubernetes', wording: 'K8s' },
    { ...base, kind: 'add_skill_wording', skill: skill.forms[0], wording: skill.forms[0] },
  ], []);
  assert.equal(out.length, 1);
  assert.equal(out[0].skill, skill.forms[0]);
});

test('bullet variants need a real card and new text', () => {
  const out = screen(cv, [
    { ...base, kind: 'add_bullet_variant', card_id: card.id, text: 'A shorter version of the same result.' },
    { ...base, kind: 'add_bullet_variant', card_id: 'nope-1', text: 'Something' },
    { ...base, kind: 'add_bullet_variant', card_id: card.id, text: card.detail },
  ], []);
  assert.deepEqual(out.map((p) => p.card_id), [card.id]);
});

test('summaries need a label and a sensible length', () => {
  const out = screen(cv, [
    { ...base, kind: 'add_summary_variant', label: 'Crypto', text: summary },
    { ...base, kind: 'add_summary_variant', label: '', text: summary },
    { ...base, kind: 'add_summary_variant', label: 'Short', text: 'Too short.' },
  ], []);
  assert.deepEqual(out.map((p) => p.label), ['Crypto']);
});

test('duplicates within a batch and against earlier decisions are dropped', () => {
  const p = { ...base, kind: 'add_title', text: 'Senior Product Manager, Payments' };
  assert.equal(screen(cv, [p, { ...p, text: 'senior product manager,  payments' }], []).length, 1);
  assert.equal(screen(cv, [p], [dedupeKey(p)]).length, 0);
});

test('approved titles land in the draft and still validate; context shows what exists now', () => {
  const { cv: next, summary: msg } = applyProposal(cv, { ...base, kind: 'add_title', text: 'Senior Product Manager, Payments' });
  validate(next);
  assert.ok(next.resume.titles.includes('Senior Product Manager, Payments'));
  assert.match(msg, /Added the title/);
  const ctx = contextFor(cv, { ...base, kind: 'add_bullet_variant', card_id: card.id, text: 'x' });
  assert.equal(ctx.now[0], card.detail);
});
