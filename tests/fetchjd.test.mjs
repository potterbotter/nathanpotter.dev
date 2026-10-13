// Link fetching: URL safety checks and text extraction. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkUrl, atsSource, htmlToText, jsonLdPosting, decodeEntities } from '../src/fetchjd.js';

test('only ordinary public https links are accepted', () => {
  for (const bad of ['http://example.com/job', 'https://localhost/x', 'https://127.0.0.1/x', 'https://[::1]/x', 'https://user:pw@example.com/', 'https://example.com:8443/', 'https://intranet/x', 'https://box.internal/x', 'ftp://example.com', 'not a url'])
    assert.throws(() => checkUrl(bad), bad);
  assert.equal(checkUrl('https://jobs.lever.co/acme/123').hostname, 'jobs.lever.co');
});

test('LinkedIn and Indeed are refused with a paste-instead message', () => {
  assert.throws(() => checkUrl('https://www.linkedin.com/jobs/view/123'), /paste/i);
  assert.throws(() => checkUrl('https://www.indeed.com/viewjob?jk=1'), /paste/i);
});

test('applicant-tracking links map to their public APIs', () => {
  assert.equal(atsSource(new URL('https://boards.greenhouse.io/acme/jobs/4012345')).api, 'https://boards-api.greenhouse.io/v1/boards/acme/jobs/4012345');
  assert.equal(atsSource(new URL('https://job-boards.greenhouse.io/acme/jobs/77')).api, 'https://boards-api.greenhouse.io/v1/boards/acme/jobs/77');
  assert.equal(atsSource(new URL('https://jobs.lever.co/acme/abc-123')).api, 'https://api.lever.co/v0/postings/acme/abc-123');
  const ashby = atsSource(new URL('https://jobs.ashbyhq.com/acme/9f8e-7d'));
  assert.equal(ashby.api, 'https://api.ashbyhq.com/posting-api/job-board/acme');
  assert.equal(ashby.id, '9f8e-7d');
  assert.equal(atsSource(new URL('https://careers.example.com/jobs/1')), null);
});

test('HTML becomes readable text: scripts dropped, lists kept, entities decoded', () => {
  const t = htmlToText('<h2>About</h2><p>We&rsquo;re hiring &amp; growing.</p><script>evil()</script><ul><li>SQL</li><li>Fintech</li></ul>');
  assert.ok(t.includes('We’re hiring & growing.'));
  assert.ok(t.includes('• SQL') && t.includes('• Fintech'));
  assert.ok(!t.includes('evil'));
  assert.equal(decodeEntities('&#8212;&#x2014;&nbsp;'), '—— '.replace(' ', ' '));
});

test('schema.org JobPosting data is preferred when present', () => {
  const html = `<html><script type="application/ld+json">{"@context":"https://schema.org","@type":"JobPosting","title":"Senior PM","hiringOrganization":{"name":"Acme"},"description":"&lt;p&gt;Own onboarding.&lt;/p&gt;"}</script><body>noise</body></html>`;
  const p = jsonLdPosting(html);
  assert.equal(p.title, 'Senior PM');
  assert.equal(p.company, 'Acme');
  assert.equal(p.text, 'Own onboarding.');
});
