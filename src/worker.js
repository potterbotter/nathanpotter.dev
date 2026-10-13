// nathanpotter.dev Worker. Public pages are static assets and never reach this code.
// It runs only for /admin/* and /api/* (see run_worker_first in wrangler.jsonc):
//   /api/job-fit, /api/job-fit/fetch  the public job-fit tool
//   /api/collect                      first-party, cookieless analytics
//   /admin/*, /api/admin/*            passed unchanged to the private admin Worker through a service binding
//
// The admin Worker lives in a separate, private repository. It is reachable only through this binding (it has no
// public route), sits behind Cloudflare Access, and verifies Access's signed token itself on every request, so
// private routes keep two locks (DESIGN.md, "Data and privacy").
import bundledCv from '../content/cv.json';
import { collect, prune } from './analytics.js';
import { handleJobFit, handleFetchPosting } from './jobfit-api.js';

const PRUNE_CRON = '17 10 * * *';

export default {
  // Daily: enforce analytics retention (13 months) and drop old visitor-hash salts. Every other schedule in
  // wrangler.jsonc belongs to the private admin Worker and is handed to it over the service binding (its own cron
  // triggers never fired). The admin Worker answers when its job is done, so the work isn't cut short.
  async scheduled(event, env, ctx) {
    if (event.cron === PRUNE_CRON) { ctx.waitUntil(prune(env)); return; }
    if (!env.ADMIN) return;
    ctx.waitUntil(env.ADMIN.fetch('https://admin.internal/__scheduled', {
      method: 'POST', headers: { 'X-Scheduled-Cron': event.cron, 'X-Scheduled-Time': String(event.scheduledTime) },
    }).then((r) => { if (!r.ok) console.error('admin schedule failed', event.cron, r.status); })
      .catch((err) => console.error('admin schedule error', event.cron, err)));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/admin/')) {
      if (!env.ADMIN) return json({ error: 'Admin is not available.' }, 503);
      return env.ADMIN.fetch(request);
    }
    if (path === '/api/job-fit') return handleJobFit(request, env, ctx, url, bundledCv);
    if (path === '/api/job-fit/fetch') return handleFetchPosting(request, env, url);
    if (path === '/api/collect') {
      try { return await collect(request, env, url); } catch (err) { console.error('collect error', err); return new Response(null, { status: 204 }); }
    }
    if (path.startsWith('/api/')) return json({ error: 'Not found' }, 404);
    return env.ASSETS.fetch(request);
  },
};

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});
