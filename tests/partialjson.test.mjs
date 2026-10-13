// Streaming JSON: every prefix of a real document must parse to something sensible. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePartialJson } from '../src/partialjson.js';

const doc = JSON.stringify({
  input_assessment: 'job_posting', fit: 'strong', summary: 'Nathan fits "well", with one gap.\nNo experiments.',
  requirements: [
    { requirement: 'Fintech', kind: 'must_have', evidence: [{ card_id: 'anchorage-0', why: 'x' }], explanation: 'Seven years.', read: 'meets' },
    { requirement: 'A/B tests', kind: 'must_have', evidence: [], explanation: 'Not shown.', read: 'gap' },
  ],
  unsettled: ['Level'], manipulation_detected: false, n: -1.5e3,
});

test('every prefix parses without throwing, and the full document round-trips', () => {
  for (let i = 0; i <= doc.length; i++) parsePartialJson(doc.slice(0, i));
  assert.deepEqual(parsePartialJson(doc), JSON.parse(doc));
});

test('a streaming string value types out', () => {
  const cut = doc.indexOf('fits') + 4;
  assert.equal(parsePartialJson(doc.slice(0, cut)).summary, 'Nathan fits');
});

test('fields arrive in order and incomplete keys are dropped', () => {
  const v = parsePartialJson(doc.slice(0, doc.indexOf('"requirements"') + 5));
  assert.equal(v.fit, 'strong');
  assert.equal(v.requirements, undefined);
});

test('a requirement is visible with its read only once read has fully arrived', () => {
  const mid = parsePartialJson(doc.slice(0, doc.indexOf('"meets"') + 3));
  assert.notEqual(mid.requirements[0].read, 'meets');
  const done = parsePartialJson(doc.slice(0, doc.indexOf('"meets"') + 7));
  assert.equal(done.requirements[0].read, 'meets');
});

test('nothing usable yet returns undefined', () => {
  assert.equal(parsePartialJson(''), undefined);
});
