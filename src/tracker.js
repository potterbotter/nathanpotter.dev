// Application tracker (admin only): jobs, applications, a timeline per application, duplicate detection,
// and site visits tied to each application's ?ref= code. Nathan always submits applications himself;
// this records them (DESIGN.md, "Application tracker").
import { fetchPosting, FetchError } from './fetchjd.js';
import { refCode } from './resume.js';
import { dayKey } from './analytics.js';

export const STATUSES = [
  { id: 'saved', label: 'Saved', open: true },
  { id: 'applied', label: 'Applied', open: true },
  { id: 'screen', label: 'Recruiter screen', open: true },
  { id: 'interview', label: 'Interviewing', open: true },
  { id: 'offer', label: 'Offer', open: true },
  { id: 'rejected', label: 'Rejected', open: false },
  { id: 'withdrawn', label: 'Withdrawn', open: false },
  { id: 'ghosted', label: 'No response', open: false },
];
const STATUS_IDS = new Set(STATUSES.map((s) => s.id));
const labelOf = (id) => (STATUSES.find((s) => s.id === id) || { label: id }).label;

const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const fmtDay = (s) => new Date(`${s}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

// ---------- duplicate detection (pure, tested) ----------
const words = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
export function normCompany(s) {
  return words(s).replace(/\b(inc|llc|ltd|corp|corporation|co|company|plc|gmbh|na|n a)\b/g, ' ').replace(/\s+/g, ' ').trim();
}
export function normTitle(s) {
  return words(String(s || '').replace(/\bsr\.?(?=\s)/gi, 'senior').replace(/\bmgr\b/gi, 'manager'))
    .replace(/\bpm\b/g, 'product manager').replace(/\s+/g, ' ').trim();
}
export function normLocation(s) {
  const w = words(s);
  if (!w) return '';
  if (/\bremote\b/.test(w) && !/\bhybrid\b/.test(w)) return 'remote';
  return w.replace(/\bsf\b/g, 'san francisco').replace(/\bnyc\b/g, 'new york');
}
export const fingerprint = (j) => [normCompany(j.company), normTitle(j.title), normLocation(j.location)].join('|');

// The link without tracking parameters: host + path, plus the parameters that identify a posting.
export function urlKey(raw) {
  try {
    const u = new URL(String(raw || '').trim());
    const keep = ['gh_jid', 'jobid', 'job_id', 'jid', 'id', 'currentjobid'];
    const params = [...u.searchParams.entries()].filter(([k]) => keep.includes(k.toLowerCase())).map(([k, v]) => `${k.toLowerCase()}=${v}`).sort();
    return `${u.hostname.replace(/^www\./, '').toLowerCase()}${u.pathname.replace(/\/+$/, '').toLowerCase()}${params.length ? `?${params.join('&')}` : ''}`;
  } catch { return ''; }
}

// Share of overlapping 5-word phrases between two postings (0–1).
export function similarity(a, b) {
  const sh = (t) => { const w = words(t).split(' ').slice(0, 4000); const s = new Set(); for (let i = 0; i + 5 <= w.length; i++) s.add(w.slice(i, i + 5).join(' ')); return s; };
  const x = sh(a), y = sh(b);
  if (x.size < 20 || y.size < 20) return 0;
  let both = 0;
  for (const s of x) if (y.has(s)) both++;
  return both / (x.size + y.size - both);
}

// Why `job` might be the same posting as `cand` (strongest reason first), or null.
export function duplicateReason(job, cand) {
  const k = urlKey(job.url);
  if (k && k === cand.url_key) return { reason: 'Same link', strong: true };
  if (job.req_id && cand.req_id && clip(job.req_id, 60).toLowerCase() === String(cand.req_id).toLowerCase() && normCompany(job.company) === normCompany(cand.company)) return { reason: 'Same requisition ID', strong: true };
  if (fingerprint(job) === cand.fp) return { reason: 'Same company, title and location', strong: true };
  if (normCompany(job.company) !== normCompany(cand.company)) return null;
  const sim = job.jd_text && cand.jd_text ? similarity(job.jd_text, cand.jd_text) : 0;
  if (sim >= 0.6) return { reason: `Posting text ${Math.round(sim * 100)}% the same`, strong: true };
  if (normTitle(job.title) === normTitle(cand.title)) return { reason: 'Same title at this company (different location)', strong: false };
  return null;
}

async function findDuplicates(env, job, excludeJobId = 0) {
  const company = normCompany(job.company);
  const { results } = await env.DB.prepare(`SELECT j.id AS job_id, j.company, j.title, j.location, j.url_key, j.req_id, j.fp, j.jd_text, a.id AS app_id, a.status, a.applied_on
    FROM jobs j LEFT JOIN applications a ON a.job_id = j.id
    WHERE j.id != ?1 AND (j.fp LIKE ?2 OR (?3 != '' AND j.url_key = ?3) OR (?4 != '' AND j.req_id = ?4)) LIMIT 100`)
    .bind(excludeJobId, `${company}|%`, urlKey(job.url), clip(job.req_id, 60)).all();
  const out = [];
  for (const c of results) {
    const r = duplicateReason(job, c);
    if (r) out.push({ appId: c.app_id, company: c.company, title: c.title, location: c.location, status: c.status, statusLabel: labelOf(c.status), appliedOn: c.applied_on, ...r });
  }
  if (job.resume_id) {
    const t = await env.DB.prepare('SELECT a.id, a.status, j.company, j.title FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.resume_id = ?1 AND a.job_id != ?2').bind(job.resume_id, excludeJobId).first();
    if (t && !out.some((d) => d.appId === t.id)) out.push({ appId: t.id, company: t.company, title: t.title, status: t.status, statusLabel: labelOf(t.status), reason: 'This résumé is already tracked', strong: true });
  }
  return out.sort((a, b) => b.strong - a.strong);
}

// ---------- site visits through each application's ref code ----------
async function visitCounts(env, refs) {
  const out = {};
  const list = [...new Set(refs.filter(Boolean))];
  for (let i = 0; i < list.length; i += 50) {
    const chunk = list.slice(i, i + 50);
    const { results } = await env.DB.prepare(`SELECT ref, COUNT(DISTINCT day || ':' || visitor) AS v, MAX(ts) AS last FROM events WHERE ref IN (${chunk.map((_, n) => `?${n + 1}`).join(',')}) GROUP BY ref`).bind(...chunk).all();
    for (const r of results) out[r.ref] = { visits: r.v, last: r.last };
  }
  return out;
}

// Each visit (one visitor on one day who arrived with the ref) with what they did that day.
async function visitDetail(env, ref) {
  if (!ref) return [];
  const { results: pairs } = await env.DB.prepare('SELECT day, visitor, MIN(ts) AS first FROM events WHERE ref = ?1 GROUP BY day, visitor ORDER BY first DESC LIMIT 20').bind(ref).all();
  const visits = [];
  for (const p of pairs) {
    const { results: ev } = await env.DB.prepare('SELECT ts, type, path, label, value, org, city, region, country, device, browser FROM events WHERE day = ?1 AND visitor = ?2 ORDER BY ts').bind(p.day, p.visitor).all();
    const first = ev.find((e) => e.org || e.city) || ev[0] || {};
    const pages = [...new Set(ev.filter((e) => e.type === 'pageview').map((e) => e.path))];
    const seconds = Math.round(ev.filter((e) => e.type === 'engage').reduce((n, e) => n + (e.value || 0), 0));
    visits.push({
      ts: p.first, org: first.org || null, place: [first.city, first.region || first.country].filter(Boolean).join(', ') || null, device: [first.device, first.browser].filter(Boolean).join(' · '),
      pages, seconds,
      sections: new Set(ev.filter((e) => e.type === 'section').map((e) => e.label)).size,
      details: ev.filter((e) => e.type === 'detail' || e.type === 'more').length,
      contact: ev.filter((e) => e.type === 'contact').map((e) => e.label),
      printed: ev.some((e) => e.type === 'print'),
    });
  }
  return visits;
}

// ---------- handlers ----------
const LIST_SQL = `SELECT a.id, a.status, a.ref, a.resume_id, a.applied_on, a.next_step, a.next_on, a.created_ts, a.updated_ts,
  j.id AS job_id, j.company, j.title, j.location, j.url, j.source FROM applications a JOIN jobs j ON j.id = a.job_id`;
const shape = (r, visits = {}) => ({
  id: r.id, status: r.status, statusLabel: labelOf(r.status), ref: r.ref, resumeId: r.resume_id, appliedOn: r.applied_on, nextStep: r.next_step, nextOn: r.next_on,
  created: r.created_ts, updated: r.updated_ts, jobId: r.job_id, company: r.company, title: r.title, location: r.location, url: r.url, source: r.source,
  visits: visits[r.ref]?.visits || 0, lastVisit: visits[r.ref]?.last || null,
});

// GET /api/admin/applications → { applications, statuses }
export async function handleList(env) {
  const { results } = await env.DB.prepare(`${LIST_SQL} ORDER BY a.updated_ts DESC LIMIT 500`).all();
  const visits = await visitCounts(env, results.map((r) => r.ref));
  return json({ applications: results.map((r) => shape(r, visits)), statuses: STATUSES, today: dayKey() });
}

// GET /api/admin/applications/:id → one application with its job, timeline, résumé and visits
export async function handleDetail(env, id) {
  const row = await env.DB.prepare(`${LIST_SQL} WHERE a.id = ?1`).bind(id).first();
  if (!row) return json({ error: 'Not found.' }, 404);
  const job = await env.DB.prepare('SELECT req_id, jd_text FROM jobs WHERE id = ?1').bind(row.job_id).first();
  const { results: events } = await env.DB.prepare('SELECT ts, kind, detail FROM app_events WHERE application_id = ?1 ORDER BY ts DESC').bind(id).all();
  const resume = row.resume_id ? await env.DB.prepare('SELECT id, ts, length, rate, baseline_rate, plan_json, keywords_json, ref, exported FROM resumes WHERE id = ?1').bind(row.resume_id).first() : null;
  const visits = await visitDetail(env, row.ref);
  return json({
    application: { ...shape(row, { [row.ref]: { visits: visits.length, last: visits[0]?.ts } }), reqId: job?.req_id || '', jdText: job?.jd_text || '' },
    events,
    resume: resume && { id: resume.id, ts: resume.ts, length: resume.length, rate: resume.rate, baseline: resume.baseline_rate, ref: resume.ref, exported: !!resume.exported, plan: JSON.parse(resume.plan_json || 'null'), keywords: JSON.parse(resume.keywords_json || '[]') },
    visits,
  });
}

function jobFrom(body) {
  return {
    company: clip(body.company, 120), title: clip(body.title, 160), location: clip(body.location, 120), url: clip(body.url, 600),
    source: clip(body.source, 40), req_id: clip(body.reqId, 60), jd_text: String(body.jdText || '').slice(0, 60000),
    resume_id: Number.isInteger(body.resumeId) ? body.resumeId : null,
  };
}

// POST /api/admin/applications/check → { duplicates }
export async function handleCheck(request, env) {
  const body = await request.json().catch(() => ({}));
  return json({ duplicates: await findDuplicates(env, jobFrom(body)) });
}

// POST /api/admin/applications  body: job fields + { status, appliedOn, nextStep, nextOn, note, resumeId, force }
export async function handleCreate(request, env) {
  const body = await request.json().catch(() => ({}));
  const job = jobFrom(body);
  let ref = '';
  if (job.resume_id) {
    const r = await env.DB.prepare('SELECT company, role_title, jd_text, ref FROM resumes WHERE id = ?1').bind(job.resume_id).first();
    if (!r) return json({ error: 'That résumé no longer exists.' }, 404);
    job.company ||= clip(r.company, 120); job.title ||= clip(r.role_title, 160); job.jd_text ||= r.jd_text || ''; ref = r.ref || '';
  }
  if (!job.company || !job.title) return json({ error: 'Company and role title are required.' }, 400);
  const status = STATUS_IDS.has(body.status) ? body.status : 'applied';
  if (!body.force) {
    const duplicates = await findDuplicates(env, job);
    if (duplicates.some((d) => d.strong)) return json({ error: 'This looks like a job you already track.', duplicates }, 409);
  }
  const now = Date.now();
  const appliedOn = isDate(body.appliedOn) ? body.appliedOn : (status === 'saved' ? null : dayKey());
  const jobRow = await env.DB.prepare('INSERT INTO jobs (ts, company, title, location, url, url_key, source, req_id, jd_text, fp) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) RETURNING id')
    .bind(now, job.company, job.title, job.location || null, job.url || null, urlKey(job.url) || null, job.source || null, job.req_id || null, job.jd_text || null, fingerprint(job)).first();
  const app = await env.DB.prepare(`INSERT INTO applications (job_id, status, ref, resume_id, applied_on, next_step, next_on, created_ts, updated_ts) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8) RETURNING id`)
    .bind(jobRow.id, status, ref || refCode(job.company), job.resume_id, appliedOn, clip(body.nextStep, 200) || null, isDate(body.nextOn) ? body.nextOn : null, now).first();
  const events = [env.DB.prepare('INSERT INTO app_events (application_id, ts, kind, detail) VALUES (?1, ?2, ?3, ?4)').bind(app.id, now, 'created', `Added as ${labelOf(status)}${job.resume_id ? ` with résumé #${job.resume_id}` : ''}`)];
  if (clip(body.note, 4000)) events.push(env.DB.prepare('INSERT INTO app_events (application_id, ts, kind, detail) VALUES (?1, ?2, ?3, ?4)').bind(app.id, now + 1, 'note', clip(body.note, 4000)));
  await env.DB.batch(events);
  return json({ ok: true, id: app.id });
}

// PATCH /api/admin/applications/:id  body: any of { status, appliedOn, nextStep, nextOn, note, company, title, location, url, source, reqId, resumeId }
export async function handleUpdate(request, env, id) {
  const body = await request.json().catch(() => ({}));
  const row = await env.DB.prepare(`${LIST_SQL} WHERE a.id = ?1`).bind(id).first();
  if (!row) return json({ error: 'Not found.' }, 404);
  const now = Date.now();
  const stmts = [], log = (kind, detail) => stmts.push(env.DB.prepare('INSERT INTO app_events (application_id, ts, kind, detail) VALUES (?1, ?2, ?3, ?4)').bind(id, now + stmts.length, kind, detail));
  const app = {};
  if (body.status !== undefined && body.status !== row.status) {
    if (!STATUS_IDS.has(body.status)) return json({ error: 'Unknown status.' }, 400);
    app.status = body.status;
    log('status', `${labelOf(row.status)} → ${labelOf(body.status)}`);
    if (body.status !== 'saved' && !row.applied_on && body.appliedOn === undefined) app.applied_on = dayKey();
  }
  if (body.appliedOn !== undefined) app.applied_on = isDate(body.appliedOn) ? body.appliedOn : null;
  if (body.nextStep !== undefined) app.next_step = clip(body.nextStep, 200) || null;
  if (body.nextOn !== undefined) app.next_on = isDate(body.nextOn) ? body.nextOn : null;
  if (body.resumeId !== undefined) app.resume_id = Number.isInteger(body.resumeId) ? body.resumeId : null;
  if (body.nextStep !== undefined || body.nextOn !== undefined) {
    const step = app.next_step !== undefined ? app.next_step : row.next_step, on = app.next_on !== undefined ? app.next_on : row.next_on;
    log('edit', step || on ? `Next step: ${[step, on && fmtDay(on)].filter(Boolean).join(' · ')}` : 'Next step cleared');
  }
  const note = clip(body.note, 4000);
  if (note) log('note', note);

  const job = {};
  for (const [k, col, n] of [['company', 'company', 120], ['title', 'title', 160], ['location', 'location', 120], ['url', 'url', 600], ['source', 'source', 40], ['reqId', 'req_id', 60]]) {
    if (body[k] !== undefined && clip(body[k], n) !== (row[col] || '')) job[col] = clip(body[k], n) || null;
  }
  if ((job.company === null || job.title === null)) return json({ error: 'Company and role title can\'t be empty.' }, 400);
  if (Object.keys(job).length) {
    const merged = { company: row.company, title: row.title, location: row.location, ...job };
    job.fp = fingerprint(merged);
    if ('url' in job) job.url_key = urlKey(job.url) || null;
    log('edit', `Edited ${Object.keys(job).filter((k) => !['fp', 'url_key'].includes(k)).join(', ').replace('req_id', 'requisition ID')}`);
    stmts.push(env.DB.prepare(`UPDATE jobs SET ${Object.keys(job).map((k, i) => `${k} = ?${i + 1}`).join(', ')} WHERE id = ?${Object.keys(job).length + 1}`).bind(...Object.values(job), row.job_id));
  }
  app.updated_ts = now;
  stmts.push(env.DB.prepare(`UPDATE applications SET ${Object.keys(app).map((k, i) => `${k} = ?${i + 1}`).join(', ')} WHERE id = ?${Object.keys(app).length + 1}`).bind(...Object.values(app), id));
  await env.DB.batch(stmts);
  return handleDetail(env, id);
}

// DELETE /api/admin/applications/:id (the job and timeline go with it; site visits stay in analytics)
export async function handleDelete(env, id) {
  const row = await env.DB.prepare('SELECT job_id FROM applications WHERE id = ?1').bind(id).first();
  if (!row) return json({ error: 'Not found.' }, 404);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM app_events WHERE application_id = ?1').bind(id),
    env.DB.prepare('DELETE FROM applications WHERE id = ?1').bind(id),
    env.DB.prepare('DELETE FROM jobs WHERE id = ?1').bind(row.job_id),
  ]);
  return json({ ok: true });
}

// POST /api/admin/applications/fetch  body: { url } → posting fields to prefill the form
export async function handleFetch(request) {
  const body = await request.json().catch(() => ({}));
  try {
    const p = await fetchPosting(body.url);
    const location = (/^Location:\s*(.+)$/m.exec(p.text) || [])[1] || '';
    const ats = /greenhouse/i.test(p.source) ? 'Greenhouse' : /lever/i.test(p.source) ? 'Lever' : /ashby/i.test(p.source) ? 'Ashby' : '';
    return json({ company: p.company, title: p.title, location: location.trim(), jdText: p.text, source: ats || 'Company site' });
  } catch (err) {
    if (err instanceof FetchError) return json({ error: err.message }, 422);
    console.error('tracker fetch error', err);
    return json({ error: "Couldn't read that page. Fill in the details by hand." }, 502);
  }
}

// GET /api/admin/applications/resumes → recent generated résumés, marked if already tracked
export async function handleResumes(env, url) {
  const one = Number(url.searchParams.get('id'));
  if (Number.isInteger(one) && one > 0) {
    const r = await env.DB.prepare('SELECT id, company, role_title, jd_text, ref FROM resumes WHERE id = ?1').bind(one).first();
    return r ? json({ resume: { id: r.id, company: r.company || '', title: r.role_title || '', jdText: r.jd_text || '', ref: r.ref } }) : json({ error: 'Not found.' }, 404);
  }
  const { results } = await env.DB.prepare(`SELECT r.id, r.ts, r.company, r.role_title, r.rate, r.exported, a.id AS app_id FROM resumes r LEFT JOIN applications a ON a.resume_id = r.id ORDER BY r.ts DESC LIMIT 30`).all();
  return json({ resumes: results.map((r) => ({ id: r.id, ts: r.ts, company: r.company, title: r.role_title, rate: r.rate, exported: !!r.exported, tracked: r.app_id })) });
}
