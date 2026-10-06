// nathanpotter.dev Worker. Public pages are static assets and never reach this code.
// It runs only for /admin/* and /api/* (see run_worker_first in wrangler.jsonc).
//
// Two locks on every private route (DESIGN.md, "Data and privacy"):
//   1. Cloudflare Access (GitHub login) in front of /admin/* and /api/admin/*.
//   2. This Worker verifies Access's signed token and the allowed email on every request,
//      and fails closed if anything is missing or misconfigured.
import * as T from '../build/templates.mjs';
import { validate } from '../build/validate.mjs';
import { FLAGS } from '../build/flags.mjs';
import bundledCv from '../content/cv.json';
import { verifyAccessJwt } from './access.js';
import { collect, prune, dashboardData } from './analytics.js';
import { handleJobFit, handleFetchPosting, monthSpend } from './jobfit-api.js';
import { handleKbChat, handleKbApply, handleKbNotes } from './kb.js';

const CV_PATH = 'content/cv.json';
const MAX_BODY = 512 * 1024;

export default {
  // Daily: enforce analytics retention (13 months) and drop old visitor-hash salts.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(prune(env));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const isAdmin = path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/admin/');
    if (!isAdmin) {
      if (path === '/api/job-fit') return handleJobFit(request, env, ctx, url, bundledCv);
      if (path === '/api/job-fit/fetch') return handleFetchPosting(request, env, url);
      if (path === '/api/collect') {
        try { return await collect(request, env, url); } catch (err) { console.error('collect error', err); return new Response(null, { status: 204 }); }
      }
      if (path.startsWith('/api/')) return json({ error: 'Not found' }, 404);
      return env.ASSETS.fetch(request);
    }

    const auth = await authorize(request, env, url);
    if (!auth.ok) return deny(auth, path);

    try {
      return await routeAdmin(request, env, url, ctx);
    } catch (err) {
      console.error('admin error', err && err.stack || err);
      return path.startsWith('/api/') ? json({ error: 'Something went wrong on the server.' }, 500) : text('Something went wrong on the server.', 500);
    }
  },
};

// ---------- auth ----------
async function authorize(request, env, url) {
  // Local development only: both an explicit flag and a localhost hostname are required.
  if (env.DEV_BYPASS_ACCESS === 'true' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
    return { ok: true, email: 'dev@localhost' };
  }
  const team = env.ACCESS_TEAM_DOMAIN;
  const aud = env.ACCESS_AUD;
  const allowed = env.ADMIN_EMAIL;
  if (!team || !aud || !allowed) return { ok: false, status: 503, reason: 'Admin is not configured yet.' };

  const token = request.headers.get('Cf-Access-Jwt-Assertion') || cookie(request, 'CF_Authorization');
  if (!token) return { ok: false, status: 401, reason: 'Not signed in.' };

  const payload = await verifyAccessJwt(token, team, aud);
  if (!payload) return { ok: false, status: 403, reason: 'Sign-in could not be verified.' };
  if (String(payload.email || '').toLowerCase() !== allowed.toLowerCase()) return { ok: false, status: 403, reason: 'This account is not allowed.' };
  return { ok: true, email: payload.email };
}

function deny(auth, path) {
  if (path.startsWith('/api/')) return json({ error: auth.reason }, auth.status);
  return text(auth.reason, auth.status);
}

// ---------- routes ----------
async function routeAdmin(request, env, url, ctx) {
  const { pathname: path } = url;
  const method = request.method;

  if (path === '/admin') return Response.redirect(url.origin + '/admin/', 301);
  if (path.startsWith('/admin/assets/')) return env.ASSETS.fetch(request);

  // Writes must come from this site's own pages (blocks cross-site request forgery).
  if (method !== 'GET' && method !== 'HEAD') {
    const origin = request.headers.get('Origin');
    if (origin !== url.origin) return json({ error: 'Cross-site request refused.' }, 403);
  }

  if (path === '/admin/dashboard/' && method === 'GET') {
    const data = await dashboardData(env, url.searchParams.get('range') || '30d');
    const spend = await monthSpend(env);
    const runs = (await env.DB.prepare('SELECT ts, status, model, fit, role_title, company, cost_usd, duration_ms, admin FROM jobfit_runs ORDER BY ts DESC LIMIT 15').all()).results;
    data.jobfit = { ...spend, recent: runs };
    return html(T.dashboardPage(pageCtx(bundledCv), data));
  }

  if (path === '/admin/' && method === 'GET') {
    const draft = await getDraft(env);
    const lastPublished = await getMeta(env, 'last_published');
    return html(T.adminHomePage(pageCtx(bundledCv), { drafts: draft ? draft.changes : 0, lastPublished }));
  }

  if (path === '/admin/edit/' && method === 'GET') {
    const working = await workingContent(env);
    const preview = url.searchParams.get('preview') === '1';
    const ctx = pageCtx(working.content, { showPlaceholders: !preview });
    if (!preview) ctx.edit = true;
    ctx.adminBar = T.adminBar(ctx, { mode: preview ? 'preview' : 'edit', drafts: working.changes });
    return html(T.cvPage(ctx, 'all'));
  }

  if (path === '/api/admin/draft') {
    if (method === 'GET') {
      const working = await workingContent(env);
      return json({ content: working.content, baseSha: working.baseSha, changes: working.changes, hasDraft: working.hasDraft });
    }
    if (method === 'PUT') {
      const body = await readJson(request);
      if (!body || typeof body.content !== 'object') return json({ error: 'Expected { content, baseSha }.' }, 400);
      try { validate(body.content); } catch (e) { return json({ error: e.message }, 422); }
      if (!(await getDraft(env)) && !body.baseSha) return json({ error: 'Missing baseSha for a new draft.' }, 400);
      const changes = await saveDraft(env, body.content, body.baseSha);
      return json({ ok: true, changes });
    }
    if (method === 'DELETE') {
      await env.DB.prepare(`DELETE FROM drafts WHERE id = 'cv'`).run();
      return json({ ok: true, changes: 0 });
    }
  }

  // Test bench: the job-fit read (optionally against the draft, optionally Opus vs Sonnet) and the knowledge chat.
  if (path === '/admin/job-fit/' && method === 'GET') {
    const draft = await getDraft(env);
    const notes = await env.DB.prepare('SELECT COUNT(*) AS n FROM knowledge').first();
    return html(T.testBenchPage(pageCtx(bundledCv), { drafts: draft ? draft.changes : 0, notes: notes.n, compare: env.JOBFIT_COMPARE === 'true' }));
  }
  if (path === '/api/admin/job-fit') {
    return handleJobFit(request, env, ctx, url, bundledCv, { verifiedAdmin: true, loadDraftCv: async () => (await workingContent(env)).content });
  }
  if (path === '/api/admin/kb/chat' && method === 'POST') {
    const cv = (await workingContent(env)).content;
    return handleKbChat(request, env, ctx, cv);
  }
  if (path === '/api/admin/kb/apply' && method === 'POST') return handleKbApply(request, env, { workingContent, saveDraft });
  if (path === '/api/admin/kb/notes') return handleKbNotes(request, env, url);

  if (path === '/api/admin/publish' && method === 'POST') {
    const draft = await getDraft(env);
    if (!draft) return json({ error: 'There is no draft to publish.' }, 400);
    if (!env.GITHUB_TOKEN) return json({ error: 'Publishing is not configured (GITHUB_TOKEN missing).' }, 503);
    const current = await githubGet(env);
    if (current.sha !== draft.base_sha) {
      return json({ error: 'conflict', message: 'cv.json changed on GitHub since this draft started. Discard the draft and redo the edits, or ask Claude to merge them.' }, 409);
    }
    const content = JSON.parse(draft.content);
    validate(content);
    const n = draft.changes;
    const commit = await githubPut(env, content, current.sha, `Edit CV via admin (${n} change${n === 1 ? '' : 's'})`);
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM drafts WHERE id = 'cv'`),
      env.DB.prepare(`INSERT INTO meta (key, value) VALUES ('last_published', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1`).bind(T.formatDate(new Date())),
    ]);
    return json({ ok: true, commitUrl: commit.html_url });
  }

  return path.startsWith('/api/') ? json({ error: 'Not found' }, 404) : text('Not found', 404);
}

function pageCtx(cv, extraFlags = {}) {
  return { cv, flags: { ...FLAGS, ...extraFlags }, updated: T.formatDate(new Date()) };
}

// Save the whole draft; returns the running change count. The first save records the base commit SHA.
async function saveDraft(env, content, baseSha) {
  const existing = await getDraft(env);
  const base = existing ? existing.base_sha : baseSha;
  const changes = (existing ? existing.changes : 0) + 1;
  await env.DB.prepare(
    `INSERT INTO drafts (id, content, base_sha, changes, updated_at) VALUES ('cv', ?1, ?2, ?3, ?4)
     ON CONFLICT(id) DO UPDATE SET content = ?1, changes = ?3, updated_at = ?4`,
  ).bind(JSON.stringify(content), base, changes, new Date().toISOString()).run();
  return changes;
}

// Draft if there is one; otherwise the latest cv.json on GitHub (so the base is never stale).
async function workingContent(env) {
  const draft = await getDraft(env);
  if (draft) return { content: JSON.parse(draft.content), baseSha: draft.base_sha, changes: draft.changes, hasDraft: true };
  const current = await githubGet(env);
  return { content: current.content, baseSha: current.sha, changes: 0, hasDraft: false };
}

async function getDraft(env) {
  return env.DB.prepare(`SELECT content, base_sha, changes, updated_at FROM drafts WHERE id = 'cv'`).first();
}

async function getMeta(env, key) {
  const row = await env.DB.prepare(`SELECT value FROM meta WHERE key = ?1`).bind(key).first();
  return row ? row.value : null;
}

// ---------- GitHub ----------
function githubHeaders(env) {
  const h = { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'nathanpotter-dev-admin' };
  if (env.GITHUB_TOKEN) h.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  return h;
}

async function githubGet(env) {
  // Local development (.dev.vars) reads the working copy bundled into the Worker instead of GitHub.
  if (env.DEV_USE_BUNDLED_CV === 'true') return { sha: 'local-dev', content: structuredClone(bundledCv) };
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${CV_PATH}?ref=main`, { headers: githubHeaders(env) });
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`);
  const data = await res.json();
  return { sha: data.sha, content: JSON.parse(base64ToText(data.content)) };
}

async function githubPut(env, content, sha, message) {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${CV_PATH}`, {
    method: 'PUT',
    headers: { ...githubHeaders(env), 'Content-Type': 'application/json' },
    // Commit as the GitHub noreply identity so the public history never shows a personal email.
    body: JSON.stringify({
      message, content: textToBase64(JSON.stringify(content, null, 2) + '\n'), sha, branch: 'main',
      author: { name: env.COMMIT_NAME, email: env.COMMIT_EMAIL },
      committer: { name: env.COMMIT_NAME, email: env.COMMIT_EMAIL },
    }),
  });
  if (res.status === 409 || res.status === 422) throw new Error('GitHub rejected the commit (the file changed). Reload and try again.');
  if (!res.ok) throw new Error(`GitHub write failed: ${res.status}`);
  return (await res.json()).commit;
}

// ---------- utils ----------
function cookie(request, name) {
  const m = (request.headers.get('Cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}
function base64ToText(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
function textToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
async function readJson(request) {
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > MAX_BODY) return null;
  const raw = await request.text();
  if (raw.length > MAX_BODY) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
const securityHeaders = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' };
const html = (body, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...securityHeaders } });
const text = (body, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...securityHeaders } });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...securityHeaders } });
