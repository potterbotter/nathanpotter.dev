// Honesty checks and cost accounting for the job-fit engine. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verifyReport, priceOf, cvFacts, FitReport } from '../src/jobfit.js';

const cv = JSON.parse(readFileSync(new URL('../content/cv.json', import.meta.url), 'utf8'));
const firstCard = cv.experience.roles[0].cards[0];
const base = { input_assessment: 'job_posting', role_title: 'PM', company: 'Co', fit: 'partial', summary: 's', unsettled: [], manipulation_detected: false };

test('quotes shown are the CV text, never the model paraphrase', () => {
  const out = verifyReport({ ...base, requirements: [
    { requirement: 'Scale', kind: 'must_have', read: 'meets', explanation: '', evidence: [{ card_id: firstCard.id, why: 'scaled' }] },
  ] }, cv);
  assert.equal(out.requirements[0].evidence[0].quote, firstCard.detail);
  assert.equal(out.requirements[0].read, 'meets');
});

test('invented card IDs are dropped and an unsupported "meets" is downgraded', () => {
  const out = verifyReport({ ...base, requirements: [
    { requirement: 'Kubernetes', kind: 'must_have', read: 'meets', explanation: '', evidence: [{ card_id: 'made-up-9', why: 'x' }] },
  ] }, cv);
  assert.equal(out.requirements[0].evidence.length, 0);
  assert.equal(out.requirements[0].read, 'partly');
  assert.equal(out.verification.droppedCitations, 1);
});

test('summary, skills and education are citable', () => {
  const out = verifyReport({ ...base, requirements: [
    { requirement: 'SQL', kind: 'nice_to_have', read: 'meets', explanation: '', evidence: [{ card_id: 'skills', why: 'listed' }, { card_id: 'education', why: 'x' }] },
  ] }, cv);
  assert.equal(out.requirements[0].evidence.length, 2);
});

test('at most 12 requirements are shown', () => {
  const reqs = Array.from({ length: 20 }, (_, i) => ({ requirement: `r${i}`, kind: 'unclear', read: 'gap', explanation: '', evidence: [] }));
  assert.equal(verifyReport({ ...base, requirements: reqs }, cv).requirements.length, 12);
});

test('cost accounting uses per-model prices and cache rates', () => {
  const usage = { input_tokens: 1_000_000, output_tokens: 1_000_000, cache_creation_input_tokens: 1_000_000, cache_read_input_tokens: 1_000_000 };
  assert.equal(priceOf('claude-opus-5-5', usage), 4 + 20 + 5 + 0.2);
  assert.equal(priceOf('claude-opus-5', usage), 5 + 25 + 6.25 + 0.5);
});

test('CV facts list every card ID and are stable between calls (cache-friendly)', () => {
  const facts = cvFacts(cv);
  for (const r of cv.experience.roles) for (const c of r.cards) assert.ok(facts.includes(`[${c.id}]`), c.id);
  assert.equal(facts, cvFacts(cv));
  assert.ok(!/\[One line|\[Step\]/.test(facts), 'placeholders must not leak into the prompt');
});

test('the output schema rejects an unknown verdict', () => {
  assert.equal(FitReport.safeParse({ ...base, fit: 'perfect', requirements: [] }).success, false);
  assert.equal(FitReport.safeParse({ ...base, requirements: [] }).success, true);
});
