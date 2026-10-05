// Static site build: content/cv.json + templates → dist/.
// No dependencies. Run: node build/build.mjs  (add --show-placeholders to render [bracketed] copy)
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from './templates.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

// Feature flags: things that exist in the design but aren't live yet stay out of public pages.
const FLAGS = {
  jobFitLive: false, // fit CTAs and the job-fit tile link to a working tool
  adminLive: false,  // footer Admin link (needs Cloudflare Access)
  pdfLive: false,    // "Download the CV as a PDF" in the contact menu
  showPlaceholders: process.argv.includes('--show-placeholders'),
};

const cv = JSON.parse(readFileSync(join(ROOT, 'content/cv.json'), 'utf8'));
validate(cv);

const ctx = {
  cv,
  flags: FLAGS,
  updated: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' }),
};

rmSync(DIST, { recursive: true, force: true });
cpSync(join(ROOT, 'public'), DIST, { recursive: true });

const pages = {
  'index.html': T.cvPage(ctx, 'all'),
  'builder/index.html': T.cvPage(ctx, 'builder'),
  'fintech/index.html': T.cvPage(ctx, 'fintech'),
  'climate/index.html': T.cvPage(ctx, 'climate'),
  'views/index.html': T.viewsPage(ctx),
  'builds/index.html': T.buildsPage(ctx),
  'tools/job-fit/index.html': T.placeholderPage(ctx, 'job-fit'),
  'tools/dpr/index.html': T.placeholderPage(ctx, 'dpr'),
  '404.html': T.notFoundPage(ctx),
};

for (const [path, html] of Object.entries(pages)) {
  const out = join(DIST, path);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
}
console.log(`Built ${Object.keys(pages).length} pages into dist/` + (FLAGS.showPlaceholders ? ' (placeholders shown)' : ''));

// Fail the build on content mistakes that would break links or the generator.
function validate(cv) {
  const ids = new Set();
  const tags = new Set(cv.experience.tags);
  for (const role of cv.experience.roles) {
    for (const card of role.cards) {
      if (ids.has(card.id)) throw new Error(`Duplicate card id: ${card.id}`);
      ids.add(card.id);
      if (!tags.has(card.tag)) throw new Error(`Card ${card.id} has unknown tag "${card.tag}"`);
    }
  }
  const details = new Map();
  for (const role of cv.experience.roles) for (const c of role.cards) {
    if (details.has(c.detail)) throw new Error(`Cards ${details.get(c.detail)} and ${c.id} share the same detail text`);
    details.set(c.detail, c.id);
  }
  const anchors = new Set(cv.experience.roles.map((r) => r.anchor));
  for (const [key, view] of Object.entries(cv.views)) {
    if (key.startsWith('_')) continue;
    for (const a of view.roleOrder) if (!anchors.has(a)) throw new Error(`View ${key} orders unknown role ${a}`);
    for (const t of view.upFrontTags || []) if (!tags.has(t)) throw new Error(`View ${key} uses unknown tag "${t}"`);
  }
}
