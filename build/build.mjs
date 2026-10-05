// Static site build: content/cv.json + templates → dist/.
// No dependencies. Run: node build/build.mjs  (add --show-placeholders to render [bracketed] copy)
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from './templates.mjs';
import { validate } from './validate.mjs';
import { FLAGS } from './flags.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

const cv = JSON.parse(readFileSync(join(ROOT, 'content/cv.json'), 'utf8'));
validate(cv);

const ctx = {
  cv,
  flags: { ...FLAGS, showPlaceholders: process.argv.includes('--show-placeholders') },
  updated: T.formatDate(new Date()),
};

// Empty dist/ rather than deleting it: on Windows a running preview server holds the folder open.
mkdirSync(DIST, { recursive: true });
for (const entry of readdirSync(DIST)) rmSync(join(DIST, entry), { recursive: true, force: true, maxRetries: 3 });
cpSync(join(ROOT, 'public'), DIST, { recursive: true });
// Admin-only static files live under /admin/assets/ so the Worker serves them only after sign-in.
cpSync(join(ROOT, 'admin'), join(DIST, 'admin', 'assets'), { recursive: true });

const pages = {
  'index.html': T.cvPage(ctx, 'all'),
  'builder/index.html': T.cvPage(ctx, 'builder'),
  'fintech/index.html': T.cvPage(ctx, 'fintech'),
  'climate/index.html': T.cvPage(ctx, 'climate'),
  'views/index.html': T.viewsPage(ctx),
  'builds/index.html': T.buildsPage(ctx),
  'tools/job-fit/index.html': T.placeholderPage(ctx, 'job-fit'),
  'tools/dpr/index.html': T.placeholderPage(ctx, 'dpr'),
  'sign-in/index.html': T.signInPage(ctx),
  '404.html': T.notFoundPage(ctx),
};

for (const [path, html] of Object.entries(pages)) {
  const out = join(DIST, path);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
}
console.log(`Built ${Object.keys(pages).length} pages into dist/` + (ctx.flags.showPlaceholders ? ' (placeholders shown)' : ''));
