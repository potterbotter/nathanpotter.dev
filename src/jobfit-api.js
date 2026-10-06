// POST /api/job-fit — the public endpoint, with layered limits (DESIGN.md, "Job-fit tool"):
//   burst per IP (Cloudflare rate limiter) → 5/day per IP (hashed, never stored) → site-wide daily cap
//   → monthly budget (switches the tool off) → Anthropic Console spend limit (hard backstop).
// Nathan, signed in through Cloudflare Access, is exempt from the per-IP and daily limits.
import { assess, fakeAssess, PROMPT_VERSION, MODELS } from './jobfit.js';
import { verifyAccessJwt } from './access.js';
import { dayKey } from './analytics.js';
import { fetchPosting, FetchError } from './fetchjd.js';

const MIN_CHARS = 200;
const MAX_CHARS = 15000;
const ESTIMATED_RUN_USD = 0.25; // headroom required before starting a run

const monthKey = (ms = Date.now()) => dayKey(ms).slice(0, 7);
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const fail = (status, code, message) => json({ error: code, message }, status);

async function ipKey(env, day, ip) {
  await env.DB.prepare('INSERT OR IGNORE INTO salts (day, salt) VALUES (?1, ?2)').bind(day, crypto.randomUUID()).run();
  const { salt } = await env.DB.prepare('SELECT salt FROM salts WHERE day = ?1').bind(day).first();
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`jobfit|${salt}|${ip}`));
  return Array.from(new Uint8Array(d).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function isAdmin(request, env) {
  const host = new URL(request.url).hostname;
  if (env.DEV_BYPASS_ACCESS === 'true' && (host === 'localhost' || host === '127.0.0.1')) return true; // local development only
  const m = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  if (!m || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ADMIN_EMAIL) return false;
  const p = await verifyAccessJwt(m[1], env.ACCESS_TEAM_DOMAIN, env.ACCESS_AUD);
  return !!p && String(p.email || '').toLowerCase() === env.ADMIN_EMAIL.toLowerCase();
}

export async function monthSpend(env, month = monthKey()) {
  const row = await env.DB.prepare('SELECT COALESCE(SUM(cost_usd), 0) AS spent, COUNT(*) AS runs FROM jobfit_runs WHERE month = ?1').bind(month).first();
  return { spent: row.spent, runs: row.runs, budget: Number(env.JOBFIT_MONTHLY_BUDGET_USD || 10) };
}

async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true; // not configured yet
  if (!token) return false;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }),
  });
  return (await res.json()).success === true;
}

// Email Nathan once per month at 80% and at 100% of the budget.
async function budgetAlerts(env, ctx) {
  const { spent, budget } = await monthSpend(env);
  const month = monthKey();
  for (const level of [80, 100]) {
    if (spent < (budget * level) / 100) continue;
    const key = `jobfit_alert_${level}_${month}`;
    const claimed = await env.DB.prepare("INSERT OR IGNORE INTO meta (key, value) VALUES (?1, 'sent')").bind(key).run();
    if (!claimed.meta.changes) continue;
    ctx.waitUntil(sendAlert(env,
      level === 100 ? `Job-fit tool paused: $${budget} monthly budget reached` : `Job-fit tool at ${level}% of its $${budget} monthly budget`,
      `Spent so far in ${month}: $${spent.toFixed(2)} of $${budget}.\n\n${level === 100
        ? 'The tool is now switched off for visitors until next month. Raise JOBFIT_MONTHLY_BUDGET_USD in wrangler.jsonc to turn it back on sooner.'
        : 'It switches itself off at 100%.'}\n\nDetails: https://nathanpotter.dev/admin/dashboard/`));
  }
}

export async function sendAlert(env, subject, body) {
  const to = env.ALERT_EMAIL || env.ADMIN_EMAIL;
  if (!env.ALERTS || !to) return;
  try {
    const { EmailMessage } = await import('cloudflare:email');
    const from = 'alerts@nathanpotter.dev';
    const raw = [
      `From: nathanpotter.dev alerts <${from}>`, `To: <${to}>`, `Subject: ${subject}`,
      `Message-ID: <${crypto.randomUUID()}@nathanpotter.dev>`, `Date: ${new Date().toUTCString()}`,
      'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', '', body,
    ].join('\r\n');
    await env.ALERTS.send(new EmailMessage(from, to, raw));
  } catch (err) {
    console.error('alert email failed', err);
  }
}

// POST /api/job-fit/fetch — read a posting from a link into the text box for review. No AI call.
export async function handleFetchPosting(request, env, url) {
  if (request.method !== 'POST') return fail(405, 'method', 'Use POST.');
  if (request.headers.get('Origin') !== url.origin) return fail(403, 'origin', 'Cross-site request refused.');
  if (env.JOBFIT_ENABLED !== 'true') return fail(503, 'disabled', 'The job-fit tool is switched off right now.');
  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  if (env.JOBFIT_FETCH && !(await isAdmin(request, env))) {
    const { success } = await env.JOBFIT_FETCH.limit({ key: ip });
    if (!success) return fail(429, 'burst', 'Too many links at once. Wait a minute and try again.');
  }
  let body;
  try { body = JSON.parse(await request.text()); } catch { return fail(400, 'bad_request', 'Send the link as JSON.'); }
  try {
    const posting = await fetchPosting(body?.url);
    return json(posting);
  } catch (err) {
    if (err instanceof FetchError) return fail(422, 'unreadable', err.message);
    console.error('fetch posting error', err);
    return fail(502, 'failed', "Couldn't read that page. Paste the text instead.");
  }
}

// verifiedAdmin: set by the Worker for /api/admin/job-fit, which Cloudflare Access and the Worker have already authenticated.
export async function handleJobFit(request, env, ctx, url, cv, { verifiedAdmin = false, loadDraftCv = null } = {}) {
  if (request.method !== 'POST') return fail(405, 'method', 'Use POST.');
  if (request.headers.get('Origin') !== url.origin) return fail(403, 'origin', 'Cross-site request refused.');
  if (env.JOBFIT_ENABLED !== 'true') return fail(503, 'disabled', 'The job-fit tool is switched off right now.');

  let body;
  try { body = JSON.parse(await request.text()); } catch { return fail(400, 'bad_request', 'Send the job description as JSON.'); }
  const jd = String(body?.jd || '').replace(/\r\n/g, '\n').trim();
  if (!jd) return fail(400, 'empty', 'Paste a job description first.');
  if (jd.length < MIN_CHARS) return fail(400, 'too_short', 'That looks too short to assess. Paste the full job description, including responsibilities and requirements.');
  if (jd.length > MAX_CHARS) return fail(400, 'too_long', `That's longer than ${MAX_CHARS.toLocaleString()} characters. Trim it to the role description and requirements.`);

  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0'; // counted via hash and the rate limiter; never stored
  const now = Date.now();
  const day = dayKey(now);
  const month = monthKey(now);
  const admin = verifiedAdmin || (await isAdmin(request, env));
  const devHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  if (!admin) {
    if (!(await verifyTurnstile(env, body?.turnstile, ip))) return fail(403, 'bot_check', 'The human check did not pass. Reload the page and try again.');
    if (env.JOBFIT_BURST) {
      const { success } = await env.JOBFIT_BURST.limit({ key: ip });
      if (!success) return fail(429, 'burst', 'Too many requests at once. Wait a minute and try again.');
    }
  }
  const key = await ipKey(env, day, ip);
  if (!admin) {
    const perIp = Number(env.JOBFIT_PER_IP_DAILY || 5);
    const mine = await env.DB.prepare("SELECT COUNT(*) AS n FROM jobfit_runs WHERE day = ?1 AND ipkey = ?2 AND status IN ('ok', 'refused')").bind(day, key).first();
    if (mine.n >= perIp) return fail(429, 'daily_ip', `You've used today's ${perIp} assessments. Come back tomorrow, or email hello@nathanpotter.dev.`);
    const cap = Number(env.JOBFIT_DAILY_CAP || 100);
    const all = await env.DB.prepare("SELECT COUNT(*) AS n FROM jobfit_runs WHERE day = ?1 AND admin = 0 AND status IN ('ok', 'refused')").bind(day).first();
    if (all.n >= cap) return fail(429, 'daily_cap', 'The tool has hit its daily limit. Try again tomorrow.');
  }
  const { spent, budget } = await monthSpend(env, month);
  if (spent + ESTIMATED_RUN_USD > budget) return fail(503, 'budget', 'The tool is paused for the rest of the month. Email hello@nathanpotter.dev and Nathan will reply directly.');

  // Model choice is admin-only (the Opus vs Sonnet comparison); visitors always get the default.
  let modelKey = 'opus';
  if (body?.model !== undefined) {
    if (!admin) return fail(403, 'model', 'Model selection is not available.');
    if (!MODELS[body.model]) return fail(400, 'model', 'Unknown model.');
    if (body.model !== 'opus' && env.JOBFIT_COMPARE !== 'true') return fail(403, 'model', 'Model comparison is switched off (JOBFIT_COMPARE).');
    modelKey = body.model;
  }

  // Admin test bench can assess against the unpublished draft.
  if (admin && body?.useDraft && loadDraftCv) cv = await loadDraftCv();

  // Stream newline-delimited JSON events: {type:"partial"|"final"|"error", ...}.
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  const send = (event) => writer.write(enc.encode(JSON.stringify(event) + '\n')).catch(() => {});

  ctx.waitUntil((async () => {
    let result;
    try {
      await send({ type: 'started', model: MODELS[modelKey] });
      const run = devHost && env.DEV_FAKE_MODEL === 'true' ? fakeAssess : assess;
      result = await run(env, cv, jd, { model: modelKey, onPartial: (report) => send({ type: 'partial', report }) });
    } catch (err) {
      console.error('job-fit error', err);
      result = { status: 'error', error: 'The assessment service failed.', cost: 0 };
    }
    try {
      const r = result.report || {};
      const u = result.usage || {};
      await env.DB.prepare(`INSERT INTO jobfit_runs (ts, day, month, ipkey, admin, status, model, input_tokens, output_tokens, cache_read, cache_write, cost_usd, duration_ms, fit, role_title, company, jd_chars, jd_text, result_json, error)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)`).bind(
        now, day, month, key, admin ? 1 : 0, result.status, result.model || null, u.input_tokens ?? null, u.output_tokens ?? null,
        u.cache_read_input_tokens ?? null, u.cache_creation_input_tokens ?? null, result.cost || 0, result.durationMs ?? null,
        r.fit || null, r.role_title || null, r.company || null, jd.length, jd, result.report ? JSON.stringify(result.report) : null, result.error || null,
      ).run();
      await budgetAlerts(env, ctx);
    } catch (err) {
      console.error('job-fit logging error', err);
    }
    if (result.status === 'ok') {
      const meta = { model: result.model, prompt: PROMPT_VERSION, durationMs: result.durationMs, firstTextMs: result.firstTextMs };
      if (admin) meta.cost = result.cost;
      await send({ type: 'final', report: result.report, meta });
    } else if (result.status === 'refused') {
      await send({ type: 'error', message: "This posting couldn't be assessed. Try pasting only the role description and requirements." });
    } else {
      await send({ type: 'error', message: `${result.error || 'Something went wrong.'} That attempt didn't count toward your daily limit.` });
    }
    await writer.close().catch(() => {});
  })());

  return new Response(readable, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
