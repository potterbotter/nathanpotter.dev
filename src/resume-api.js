// Admin endpoints for the résumé generator (behind Cloudflare Access and the Worker's token check).
//   POST /api/admin/resume/plan      Claude chooses blocks for a posting, code assembles and scores
//   POST /api/admin/resume/assemble  re-assemble after manual block changes (no AI call)
//   GET/PUT /api/admin/resume/settings  private contact details (phone)
import { planResume, fakePlan, assemble, baselineDoc, score, toText, refCode, RESUME_PROMPT_VERSION } from './resume.js';
import { monthSpend } from './jobfit-api.js';
import { dayKey } from './analytics.js';

const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

async function contact(env, cv, ref) {
  const row = await env.DB.prepare("SELECT value FROM meta WHERE key = 'resume_phone'").first();
  return {
    email: env.RESUME_EMAIL || 'jobs@nathanpotter.dev',
    phone: row ? row.value : '',
    location: cv.person.location,
    linkedin: cv.person.linkedin.replace(/^https?:\/\/(www\.)?/, ''),
    site: `nathanpotter.dev/?ref=${ref}`,
  };
}

function result(cv, plan, keywords, { length, contactInfo }) {
  const { doc, dropped, trimmed, lines, budget, plan: applied } = assemble(cv, plan, { length, contact: contactInfo });
  const base = baselineDoc(cv);
  return { plan: applied, doc, text: toText(doc), dropped, trimmed, lines, budget, score: score(doc, keywords, cv), baseline: score(base, keywords, cv) };
}

export async function handleResumePlan(request, env, url, cv) {
  let body;
  try { body = JSON.parse(await request.text()); } catch { return json({ error: 'Bad request.' }, 400); }
  const jd = String(body?.jd || '').trim();
  if (jd.length < 200) return json({ error: 'Paste or fetch the full posting first.' }, 400);
  const length = body.length === 'two' ? 'two' : 'one';
  const { spent, budget } = await monthSpend(env);
  if (spent + 0.25 > budget) return json({ error: `The monthly AI budget ($${budget}) is nearly used up. Raise JOBFIT_MONTHLY_BUDGET_USD to keep going.` }, 503);

  const host = url.hostname;
  const dev = env.DEV_FAKE_MODEL === 'true' && (host === 'localhost' || host === '127.0.0.1');
  let planned;
  try { planned = dev ? fakePlan(cv) : await planResume(env, cv, jd, { length }); } catch (err) { console.error('resume plan error', err); planned = { error: 'The planning call failed.', cost: 0 }; }
  await env.DB.prepare(`INSERT INTO jobfit_runs (ts, day, month, ipkey, admin, status, model, cost_usd, duration_ms) VALUES (?1, ?2, ?3, 'admin', 1, 'resume', ?4, ?5, ?6)`)
    .bind(Date.now(), dayKey(), dayKey().slice(0, 7), planned.model || null, planned.cost || 0, planned.durationMs || null).run();
  if (planned.error) return json({ error: planned.error }, 502);

  const company = String(body.company || '').trim();
  const ref = refCode(company || body.roleTitle);
  const contactInfo = await contact(env, cv, ref);
  const out = result(cv, planned.plan, planned.plan.keywords, { length, contactInfo });
  const row = await env.DB.prepare(`INSERT INTO resumes (ts, company, role_title, ref, length, jd_text, keywords_json, plan_json, resume_text, rate, baseline_rate)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11) RETURNING id`).bind(
    Date.now(), company || null, String(body.roleTitle || '').trim() || null, ref, length, jd,
    JSON.stringify(planned.plan.keywords), JSON.stringify(planned.plan), out.text, out.score.rate, out.baseline.rate,
  ).first();
  return json({ id: row.id, ref, aiPlan: planned.plan, ...out, meta: { model: planned.model, cost: planned.cost, durationMs: planned.durationMs, prompt: RESUME_PROMPT_VERSION } });
}

// Re-assemble with Nathan's manual changes (swap summary/title, add/remove bullets, change wordings).
export async function handleResumeAssemble(request, env, cv) {
  let body;
  try { body = JSON.parse(await request.text()); } catch { return json({ error: 'Bad request.' }, 400); }
  if (!body?.plan || !Array.isArray(body.keywords)) return json({ error: 'Missing plan or keywords.' }, 400);
  const length = body.length === 'two' ? 'two' : 'one';
  const ref = String(body.ref || refCode('role')).slice(0, 40);
  const contactInfo = await contact(env, cv, ref);
  const out = result(cv, body.plan, body.keywords, { length, contactInfo });
  if (Number.isInteger(body.id)) {
    await env.DB.prepare('UPDATE resumes SET plan_json = ?1, resume_text = ?2, rate = ?3, length = ?4, exported = MAX(exported, ?5) WHERE id = ?6')
      .bind(JSON.stringify(out.plan), out.text, out.score.rate, length, body.exported ? 1 : 0, body.id).run();
  }
  return json({ id: body.id, ref, ...out });
}

export async function handleResumeSettings(request, env) {
  if (request.method === 'PUT') {
    let body;
    try { body = JSON.parse(await request.text()); } catch { return json({ error: 'Bad request.' }, 400); }
    const phone = String(body?.phone || '').trim().slice(0, 40);
    if (phone && !/^[+()\d\s.-]{7,}$/.test(phone)) return json({ error: 'That doesn\'t look like a phone number.' }, 400);
    await env.DB.prepare("INSERT INTO meta (key, value) VALUES ('resume_phone', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1").bind(phone).run();
    return json({ ok: true });
  }
  const row = await env.DB.prepare("SELECT value FROM meta WHERE key = 'resume_phone'").first();
  return json({ phone: row ? row.value : '', email: env.RESUME_EMAIL || 'jobs@nathanpotter.dev' });
}
