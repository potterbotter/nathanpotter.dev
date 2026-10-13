// The Content-Security-Policy in public/_headers allows exactly one inline script, by hash: the theme setter in the
// page layout. If that script changes, this test fails until the hash in _headers is updated.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as T from '../build/templates.mjs';
import { FLAGS } from '../build/flags.mjs';

const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
const csp = (headers.match(/Content-Security-Policy: (.+)/) || [])[1] || '';
const cv = JSON.parse(readFileSync(new URL('../content/cv.json', import.meta.url), 'utf8'));
const ctx = { cv, flags: FLAGS, updated: 'today' };

test('every inline executable script on public pages is allowed by its hash; no unsafe-inline scripts', () => {
  assert.ok(csp, 'CSP header present');
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
  const pages = [T.cvPage(ctx, 'all'), T.viewsPage(ctx), T.jobFitPage(ctx), T.buildsPage(ctx), T.notFoundPage(ctx)];
  for (const html of pages) {
    for (const m of html.matchAll(/<script(?![^>]*\b(src|type)=)[^>]*>([\s\S]*?)<\/script>/g)) {
      const hash = `'sha256-${createHash('sha256').update(m[2], 'utf8').digest('base64')}'`;
      assert.ok(csp.includes(hash), `inline script not in the CSP: ${m[2].slice(0, 60)}… (add ${hash})`);
    }
  }
});
