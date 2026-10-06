// Email reading: what counts as job mail, how it matches applications, what it may change, and that
// forwarding to Nathan happens before (and regardless of) reading.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ruleMatch, ruleCategory, isJobRelated, nextStatus, readMail, isAtsDomain, handleEmail } from '../src/mail.js';

const apps = [
  { id: 1, company: 'Acme Inc', title: 'Senior Product Manager', status: 'applied', ref: 'acme-x1y2', url: 'https://boards.greenhouse.io/acme/jobs/1', updated_ts: Date.now() },
  { id: 2, company: 'Globex', title: 'Senior PM, Payments', status: 'screen', ref: 'globex-a1b2', url: 'https://jobs.globex.com/123', updated_ts: Date.now() },
];
const mail = (o) => ({ from: 'someone@example.com', fromName: '', subject: '', text: '', ...o });

test('job mail is recognised by hiring system, company domain or ref code; personal mail is not', () => {
  assert.ok(isAtsDomain('us.greenhouse-mail.io') && isAtsDomain('hire.lever.co') && !isAtsDomain('gmail.com'));
  const ats = mail({ from: 'no-reply@us.greenhouse-mail.io', subject: 'Thank you for applying to Acme' });
  assert.ok(isJobRelated(ats, ruleMatch(ats, apps)));
  const company = mail({ from: 'jane@globex.com', subject: 'Quick chat?' });
  assert.ok(isJobRelated(company, ruleMatch(company, apps)));
  const ref = mail({ from: 'x@unknown.org', subject: 'Hi', text: 'Saw nathanpotter.dev/?ref=acme-x1y2' });
  assert.equal(ruleMatch(ref, apps)[0].app.id, 1);
  const personal = mail({ from: 'mom@gmail.com', subject: 'Dinner Sunday?', text: 'Are you free for dinner?' });
  assert.equal(isJobRelated(personal, ruleMatch(personal, apps)), false);
  const ours = mail({ from: 'alerts@nathanpotter.dev', subject: 'Needs your attention: Acme interview' });
  assert.equal(isJobRelated(ours, ruleMatch(ours, apps)), false, 'never reads its own alerts');
});

test('rules classify the common wordings', () => {
  assert.equal(ruleCategory(mail({ subject: 'Your application to Acme', text: 'Unfortunately, we have decided to move forward with other candidates.' })), 'rejection');
  assert.equal(ruleCategory(mail({ subject: 'Next steps', text: 'Please share your availability for a phone screen.' })), 'next_step');
  assert.equal(ruleCategory(mail({ subject: 'Thank you for applying', text: 'We have received your application.' })), 'confirmation');
  assert.equal(ruleCategory(mail({ subject: 'Offer', text: 'We are pleased to extend an offer.' })), 'offer');
  assert.equal(ruleCategory(mail({ subject: 'Role at Initech', text: 'I came across your profile and wanted to reach out.' })), 'outreach');
});

test('status only moves forward, rejections close open applications, closed ones stay closed', () => {
  assert.equal(nextStatus('saved', 'confirmation'), 'applied');
  assert.equal(nextStatus('screen', 'confirmation'), 'screen');
  assert.equal(nextStatus('applied', 'next_step', null), 'screen');
  assert.equal(nextStatus('screen', 'next_step', null), 'interview');
  assert.equal(nextStatus('interview', 'next_step', 'screen'), 'interview', 'never backwards');
  assert.equal(nextStatus('applied', 'offer'), 'offer');
  assert.equal(nextStatus('interview', 'rejection'), 'rejected');
  assert.equal(nextStatus('withdrawn', 'next_step', 'interview'), 'withdrawn');
});

test('without Claude, a confident domain match is high confidence and a tie is low', async () => {
  const plan = await readMail({}, mail({ from: 'talent@globex.com', subject: 'Interview next steps', text: 'Can you share availability?' }), apps, { useClaude: false });
  assert.equal(plan.app.id, 2);
  assert.equal(plan.confidence, 'high');
  assert.equal(plan.category, 'next_step');
  const twoAcmes = [...apps, { id: 3, company: 'Acme', title: 'Product Lead', status: 'applied', ref: 'acme-zzzz', updated_ts: Date.now() }];
  const tied = await readMail({}, mail({ from: 'jobs@acme.com', subject: 'Your application', text: 'We received your application.' }), twoAcmes, { useClaude: false });
  assert.equal(tied.confidence, 'low', 'two Acme applications: ask instead of guessing');
});

test('mail is forwarded before it is read, and bounced (not dropped) if forwarding fails', async () => {
  const calls = [];
  const raw = new TextEncoder().encode('From: a@b.com\r\nSubject: hi\r\n\r\nhello');
  const message = (fail) => ({
    raw: new Response(raw).body,
    forward: async (to) => { calls.push(['forward', to]); if (fail) throw new Error('unverified'); },
    setReject: (why) => calls.push(['reject', why]),
  });
  const waited = [];
  await handleEmail(message(false), { EMAIL_FORWARD_TO: 'me@example.com' }, { waitUntil: (p) => waited.push(p.catch(() => {})) });
  assert.deepEqual(calls[0], ['forward', 'me@example.com']);
  assert.equal(waited.length, 1, 'reading happens after, in the background');
  calls.length = 0;
  await handleEmail(message(true), { EMAIL_FORWARD_TO: 'me@example.com' }, { waitUntil: () => {} });
  assert.equal(calls[1][0], 'reject');
});

test('a hiring-system email naming a tracked company in the subject is a confident match', async () => {
  const plan = await readMail({}, mail({ from: 'no-reply@us.greenhouse-mail.io', fromName: 'Recruiting', subject: 'Acme - next steps', text: 'We would love to schedule a panel interview.' }), apps, { useClaude: false });
  assert.equal(plan.app.id, 1);
  assert.equal(plan.confidence, 'high');
});
