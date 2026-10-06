// Applying approved knowledge-base proposals to the CV draft. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyProposal, ChatTurn } from '../src/kb.js';
import { validate } from '../build/validate.mjs';

const cv = JSON.parse(readFileSync(new URL('../content/cv.json', import.meta.url), 'utf8'));
const blank = { role_anchor: '', card_id: '', metric: '', tag: '', headline: '', detail: '', text: '', skill: '', wording: '', why: '' };

test('add_card gets the next permanent ID and the result validates', () => {
  const role = cv.experience.roles.find((r) => r.anchor === 'exp-anchorage');
  const { cv: out, summary } = applyProposal(cv, { ...blank, kind: 'add_card', role_anchor: 'exp-anchorage', metric: '3', tag: 'Scale', headline: 'Feature-flag experiments on onboarding steps', detail: 'Ran A/B tests with LaunchDarkly on onboarding steps.' });
  const added = out.experience.roles.find((r) => r.anchor === 'exp-anchorage');
  assert.equal(added.cards.at(-1).id, `anchorage-${role.nextCard}`);
  assert.equal(added.nextCard, role.nextCard + 1);
  assert.match(summary, /Added card/);
  validate(out);
  assert.equal(cv.experience.roles.find((r) => r.anchor === 'exp-anchorage').cards.length, role.cards.length, 'input is not mutated');
});

test('add_card with an unknown tag fails validation', () => {
  const { cv: out } = applyProposal(cv, { ...blank, kind: 'add_card', role_anchor: 'exp-jaris', metric: '1', tag: 'Made up', headline: 'h', detail: 'd' });
  assert.throws(() => validate(out), /unknown tag/);
});

test('edit_card only changes the fields provided', () => {
  const card = cv.experience.roles[0].cards[0];
  const { cv: out } = applyProposal(cv, { ...blank, kind: 'edit_card', card_id: card.id, headline: 'New headline' });
  const edited = out.experience.roles[0].cards[0];
  assert.equal(edited.headline, 'New headline');
  assert.equal(edited.detail, card.detail);
});

test('skill wordings attach to an existing skill (case-insensitive) or create a new one', () => {
  const sql = applyProposal(cv, { ...blank, kind: 'add_skill_wording', skill: 'sql', wording: 'Snowflake' }).cv;
  const item = sql.skills.groups.flatMap((g) => g.items).find((i) => i.forms[0] === 'SQL');
  assert.ok(item.forms.includes('Snowflake'));
  const fresh = applyProposal(cv, { ...blank, kind: 'add_skill_wording', skill: 'Pricing strategy', wording: 'Pricing' }).cv;
  assert.ok(fresh.skills.groups.flatMap((g) => g.items).some((i) => i.forms[0] === 'Pricing strategy'));
});

test('facts are deduplicated; private notes are refused here (they never touch the public CV)', () => {
  const once = applyProposal(cv, { ...blank, kind: 'add_fact', text: 'Fact A' }).cv;
  const twice = applyProposal(once, { ...blank, kind: 'add_fact', text: 'Fact A' }).cv;
  assert.equal(twice.facts.filter((f) => f === 'Fact A').length, 1);
  assert.throws(() => applyProposal(cv, { ...blank, kind: 'add_private_note', text: 'secret' }), /Not a public change/);
});

test('the chat output schema requires a reply and proposals', () => {
  assert.equal(ChatTurn.safeParse({ reply: 'hi', proposals: [] }).success, true);
  assert.equal(ChatTurn.safeParse({ reply: 'hi' }).success, false);
});
