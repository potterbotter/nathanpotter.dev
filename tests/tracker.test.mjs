// Application tracker: duplicate detection must catch the same job seen through different sources,
// without flagging genuinely different roles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normCompany, normTitle, normLocation, fingerprint, urlKey, similarity, duplicateReason, STATUSES } from '../src/tracker.js';

const posting = 'We are hiring a Senior Product Manager to own client onboarding and KYC for institutional customers. You will partner with compliance, operations and engineering to automate document collection, reduce handle time and scale onboarding volume. Requirements: five years of product management in regulated financial services, experience with AML and sanctions screening, strong written communication, and comfort with SQL.';
const stored = (j) => ({ ...j, fp: fingerprint(j), url_key: urlKey(j.url) });

test('names normalize the way postings vary', () => {
  assert.equal(normCompany('Acme, Inc.'), normCompany('ACME'));
  assert.equal(normTitle('Sr. PM, Onboarding'), normTitle('Senior Product Manager - Onboarding'));
  assert.notEqual(normTitle('Senior Product Manager'), normTitle('Product Manager'), 'seniority is a different role');
  assert.equal(normLocation('Remote (US)'), 'remote');
  assert.equal(normLocation('SF, CA'), normLocation('San Francisco, CA'));
});

test('links match without tracking parameters, and keep the ones that identify a posting', () => {
  assert.equal(urlKey('https://www.boards.greenhouse.io/acme/jobs/123?utm_source=linkedin'), urlKey('https://boards.greenhouse.io/acme/jobs/123/'));
  assert.notEqual(urlKey('https://acme.com/careers?gh_jid=1'), urlKey('https://acme.com/careers?gh_jid=2'));
  assert.equal(urlKey('not a url'), '');
});

test('the same job is caught by link, requisition ID, fingerprint or posting text', () => {
  const a = stored({ company: 'Acme Inc', title: 'Senior Product Manager, Onboarding', location: 'Remote', url: 'https://jobs.lever.co/acme/abc', req_id: 'R-77', jd_text: posting });
  assert.equal(duplicateReason({ company: 'Other name', title: 'x', url: 'https://jobs.lever.co/acme/abc?lever-source=LinkedIn' }, a).reason, 'Same link');
  assert.equal(duplicateReason({ company: 'ACME', title: 'Different title', req_id: 'r-77' }, a).reason, 'Same requisition ID');
  assert.equal(duplicateReason({ company: 'Acme', title: 'Sr. PM, Onboarding', location: 'Remote - US' }, a).reason, 'Same company, title and location');
  const reposted = duplicateReason({ company: 'Acme', title: 'Product Lead, Client Onboarding', location: 'New York', jd_text: posting + ' Apply today.' }, a);
  assert.match(reposted.reason, /Posting text \d+% the same/);
  assert.equal(reposted.strong, true);
});

test('different roles are not duplicates; same title elsewhere is only a weak hint', () => {
  const a = stored({ company: 'Acme', title: 'Senior Product Manager', location: 'Remote', jd_text: posting });
  assert.equal(duplicateReason({ company: 'Globex', title: 'Senior Product Manager', location: 'Remote' }, a), null);
  assert.equal(duplicateReason({ company: 'Acme', title: 'Product Designer', location: 'Remote' }, a), null);
  const weak = duplicateReason({ company: 'Acme', title: 'Senior Product Manager', location: 'Austin' }, a);
  assert.equal(weak.strong, false);
});

test('similarity is 1 for identical text and near 0 for unrelated text', () => {
  assert.equal(similarity(posting, posting), 1);
  assert.ok(similarity(posting, 'Line cook wanted for a busy kitchen. Must handle prep, plating and closing duties on weekends and some holidays, with food safety certification required and a positive attitude.') < 0.05);
});

test('statuses: five open stages, three closed', () => {
  assert.deepEqual(STATUSES.filter((s) => s.open).map((s) => s.id), ['saved', 'applied', 'screen', 'interview', 'offer']);
  assert.equal(STATUSES.filter((s) => !s.open).length, 3);
});
