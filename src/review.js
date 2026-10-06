// Review queue (admin only): Claude proposes résumé blocks in batches (titles, summary variants, bullet
// rewordings, skill wordings); Nathan approves, edits, rejects or skips them one at a time.
// Approved items go to the edit-mode draft through applyProposal, exactly like a chat approval.
// Rejected items are remembered and listed in the next prompt so they are not proposed again.
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { priceOf, MODELS } from './jobfit.js';
import { catalogue } from './resume.js';
import { applyProposal } from './kb.js';
import { validate } from '../build/validate.mjs';
import { monthSpend } from './jobfit-api.js';
import { dayKey } from './analytics.js';

export const REVIEW_PROMPT_VERSION = 'review-v1';
export const KINDS = ['add_title', 'add_summary_variant', 'add_bullet_variant', 'add_skill_wording'];
const BATCH = 20;
// Wordings Nathan has already ruled out (2026-10-05 skill review), on top of rejections stored in D1.
const RULED_OUT = ['People management', 'People leadership', 'React (unqualified)', 'W-8BEN', 'Any title above Senior (Staff, Principal, Lead, Group, Director)'];

const Item = z.object({
  kind: z.enum(KINDS),
  card_id: z.string().describe('add_bullet_variant: the card ID it rewords. Otherwise empty.'),
  skill: z.string().describe('add_skill_wording: the skill\'s first wording exactly as listed. Otherwise empty.'),
  wording: z.string().describe('add_skill_wording: the new wording. Otherwise empty.'),
  label: z.string().describe('add_summary_variant: 1–3 word name for the role family, e.g. "Crypto". Otherwise empty.'),
  text: z.string().describe('add_title, add_summary_variant or add_bullet_variant: the proposed text. Otherwise empty.'),
  why: z.string().describe('At most 20 words: which postings this helps and how.'),
});
const Batch = z.object({ items: z.array(Item) });

const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

export function dedupeKey(p) {
  return [p.kind, p.card_id || '', norm(p.skill), norm(p.kind === 'add_skill_wording' ? p.wording : p.text)].join('|');
}

const findCard = (cv, id) => { for (const r of cv.experience.roles) { const c = r.cards.find((x) => x.id === id); if (c) return { role: r, card: c }; } return null; };
const findSkill = (cv, name) => { const l = norm(name); for (const g of cv.skills.groups) for (const s of g.items) if (s.forms.some((f) => norm(f) === l)) return { group: g, item: s }; return null; };

// Keep only well-formed, new items that don't add claims: wordings of existing skills only, variants of
// existing cards only, Senior PM titles only. Returns the items to queue.
export function screen(cv, items, knownKeys) {
  const seen = new Set(knownKeys);
  const out = [];
  for (const raw of items || []) {
    const p = { kind: raw.kind, card_id: clean(raw.card_id), skill: clean(raw.skill), wording: clean(raw.wording), label: clean(raw.label), text: clean(raw.text), why: clean(raw.why) };
    if (!KINDS.includes(p.kind)) continue;
    if (p.kind === 'add_title') {
      if (!/^Senior Product Manager\b/.test(p.text) || p.text.length > 70) continue;
      if (cv.resume.titles.some((t) => norm(t) === norm(p.text))) continue;
    } else if (p.kind === 'add_summary_variant') {
      const words = p.text.split(' ').length;
      if (!p.label || words < 15 || words > 80) continue;
      if (cv.resume.summaries.some((s) => norm(s.text) === norm(p.text))) continue;
    } else if (p.kind === 'add_bullet_variant') {
      const hit = findCard(cv, p.card_id);
      if (!hit || !p.text || norm(hit.card.detail) === norm(p.text) || (hit.card.variants || []).some((v) => norm(v.text) === norm(p.text))) continue;
    } else if (p.kind === 'add_skill_wording') {
      const hit = findSkill(cv, p.skill);
      if (!hit || !p.wording || hit.item.forms.some((f) => norm(f) === norm(p.wording))) continue;
      p.skill = hit.item.forms[0];
    }
    const key = dedupeKey(p);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function system(cv, { rejected, pending, keywords }) {
  const views = Object.entries(cv.views).filter(([k]) => k !== 'all' && !k.startsWith('_')).map(([, v]) => `- ${v.label}: ${v.focus}`).join('\n');
  return `You propose new résumé building blocks for Nathan Potter. A résumé generator assembles tailored résumés only from blocks Nathan has approved, so a wider set of approved blocks means better-tailored résumés. Nathan reviews each proposal one at a time: approve, edit or reject.

Propose about ${BATCH} items, mixed across these kinds, favouring what is missing most:
- add_title: a résumé headline title. Always starts "Senior Product Manager", optionally with a focus that matches his actual work (e.g. ", Onboarding & Risk"). Never a higher level (Staff, Principal, Lead, Group, Director) and never a function he has not held.
- add_summary_variant: a 2–3 sentence summary (30–60 words) angled at one role family he targets. Match the voice of the existing summary. "7+ years" is his approved tenure phrasing. One per role family at most, and none for a family that already has one.
- add_bullet_variant: an alternative phrasing of an existing bullet (by card ID) — a shorter version (under 140 characters) or one using the vocabulary postings use for the same thing. Prefer the cards most postings would pick.
- add_skill_wording: another name postings use for a skill he already lists (by its first wording, exactly as listed). True synonyms and common posting phrasings only.

Honesty (non-negotiable)
- Every proposal states the same facts as the CV, never stronger. Never add a number, scope, tool, team size, domain or outcome the CV does not state. Keep his ownership words ("supported", "co-developed", "championship" stay as weak as they are).
- Skill wordings must not imply more than the skill shows (no bare "React" for limited React; no "people management").
- Nothing about time between jobs.
- If you cannot find good proposals of a kind, propose fewer. Quality over count.

Voice: résumé register. Confident, plain, specific. Strong verbs, numbers over adjectives, no hype words, no exclamation points, no first person in bullets.

why: at most 20 words naming the postings it helps.

Role families he targets (from his site's role views):
${views}

Already ruled out by Nathan, never propose: ${RULED_OUT.join('; ')}.
${rejected.length ? `Nathan rejected these earlier proposals; do not propose them or close variants:\n${rejected.map((r) => `- ${r}`).join('\n')}` : ''}
${pending.length ? `Already waiting in his queue; do not repeat:\n${pending.map((r) => `- ${r}`).join('\n')}` : ''}
${keywords.length ? `Keywords from postings he has tailored résumés for (count), useful for choosing wordings:\n${keywords.map(([k, n]) => `${k} (${n})`).join(', ')}` : ''}

His approved blocks:
${catalogue(cv)}`;
}

const describe = (row) => { const p = JSON.parse(row.payload_json); return `${p.kind}: ${p.card_id || p.skill || p.label || ''} ${p.kind === 'add_skill_wording' ? p.wording : p.text}`.trim(); };

async function postingKeywords(env) {
  const { results } = await env.DB.prepare('SELECT keywords_json FROM resumes ORDER BY ts DESC LIMIT 40').all();
  const counts = new Map();
  for (const r of results) { try { for (const k of JSON.parse(r.keywords_json || '[]')) { const t = clean(k.term); if (t) counts.set(t, (counts.get(t) || 0) + 1); } } catch {} }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60);
}

function fakeBatch(cv) {
  const card = cv.experience.roles[0].cards[0];
  const skill = cv.skills.groups[0].items[0];
  return [
    { kind: 'add_title', card_id: '', skill: '', wording: '', label: '', text: 'Senior Product Manager, Onboarding & Risk', why: 'Onboarding, KYC and risk-platform postings.' },
    { kind: 'add_summary_variant', card_id: '', skill: '', wording: '', label: 'Crypto', text: 'Senior product manager with 7+ years in regulated finance, now running client onboarding and risk at a federally chartered crypto bank. I turn messy, high-stakes workflows into products that scale.', why: 'Digital-asset and crypto postings.' },
    { kind: 'add_bullet_variant', card_id: card.id, skill: '', wording: '', label: '', text: 'Quadrupled client onboarding throughput (~265 → 1,000+ per quarter) in a year.', why: 'A shorter version for one-page résumés.' },
    { kind: 'add_skill_wording', card_id: '', skill: skill.forms[0], wording: `${skill.forms[0]} (sample wording)`, label: '', text: '', why: 'Sample item for local development.' },
  ];
}

// POST /api/admin/review/generate → { added, meta }
export async function handleReviewGenerate(request, env, url, cv) {
  const { spent, budget } = await monthSpend(env);
  if (spent + 0.4 > budget) return json({ error: `The monthly AI budget ($${budget}) is nearly used up. Raise JOBFIT_MONTHLY_BUDGET_USD to keep going.` }, 503);
  const all = (await env.DB.prepare('SELECT status, dedupe_key, payload_json FROM proposals ORDER BY id DESC LIMIT 2000').all()).results;
  const rejected = all.filter((r) => r.status === 'rejected').slice(0, 150).map(describe);
  const pending = all.filter((r) => r.status === 'pending' || r.status === 'skipped').map(describe);
  const keywords = await postingKeywords(env);

  const started = Date.now();
  const host = url.hostname;
  let items, model = MODELS.opus, cost = 0;
  if (env.DEV_FAKE_MODEL === 'true' && (host === 'localhost' || host === '127.0.0.1')) {
    items = fakeBatch(cv); model = 'dev-fake';
  } else {
    try {
      const format = zodOutputFormat(Batch);
      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
      const stream = client.beta.messages.stream({
        model,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: { type: format.type, schema: format.schema } },
        system: [{ type: 'text', text: system(cv, { rejected, pending, keywords }) }],
        messages: [{ role: 'user', content: `Propose the next batch of about ${BATCH} résumé blocks for review.` }],
      });
      const response = await stream.finalMessage();
      model = response.model || model;
      cost = priceOf(model, response.usage);
      if (response.stop_reason === 'refusal') throw new Error('The model declined.');
      items = format.parse(response.content.filter((b) => b.type === 'text').map((b) => b.text).join('')).items;
    } catch (err) {
      console.error('review generate error', err);
      await logRun(env, model, cost, started);
      return json({ error: 'Generating proposals failed. Try again.' }, 502);
    }
  }
  await logRun(env, model, cost, started);

  const queued = screen(cv, items, all.map((r) => r.dedupe_key));
  const batch = Date.now();
  if (queued.length) {
    await env.DB.batch(queued.map(({ why, ...p }) => env.DB.prepare('INSERT INTO proposals (ts, batch, kind, dedupe_key, payload_json, why) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
      .bind(Date.now(), batch, p.kind, dedupeKey(p), JSON.stringify(p), why || null)));
  }
  return json({ added: queued.length, proposed: (items || []).length, meta: { model, cost, durationMs: Date.now() - started, prompt: REVIEW_PROMPT_VERSION } });
}

async function logRun(env, model, cost, started) {
  try {
    await env.DB.prepare(`INSERT INTO jobfit_runs (ts, day, month, ipkey, admin, status, model, cost_usd, duration_ms) VALUES (?1, ?2, ?3, 'admin', 1, 'review', ?4, ?5, ?6)`)
      .bind(Date.now(), dayKey(), dayKey().slice(0, 7), model, cost, Date.now() - started).run();
  } catch (err) { console.error('review logging error', err); }
}

// What Nathan needs to judge an item: where it goes and what is there now.
export function contextFor(cv, p) {
  if (p.kind === 'add_title') return { kindLabel: 'Résumé title', target: 'Headline under your name', now: cv.resume.titles };
  if (p.kind === 'add_summary_variant') return { kindLabel: 'Summary variant', target: `For ${p.label} roles`, now: cv.resume.summaries.map((s) => `${s.label}: ${s.text}`) };
  if (p.kind === 'add_bullet_variant') {
    const hit = findCard(cv, p.card_id);
    return { kindLabel: 'Bullet rewording', target: hit ? `${hit.role.company} · ${hit.card.metric} · ${p.card_id}` : p.card_id, now: hit ? [hit.card.detail, ...(hit.card.variants || []).map((v) => `${v.id}: ${v.text}`)] : [] };
  }
  const hit = findSkill(cv, p.skill);
  return { kindLabel: 'Skill wording', target: hit ? hit.item.forms[hit.item.shown] : p.skill, now: hit ? hit.item.forms : [] };
}

async function queueState(env, cv) {
  const counts = Object.fromEntries((await env.DB.prepare('SELECT status, COUNT(*) AS n FROM proposals GROUP BY status').all()).results.map((r) => [r.status, r.n]));
  const row = await env.DB.prepare(`SELECT id, kind, payload_json, why, status FROM proposals WHERE status IN ('pending', 'skipped') ORDER BY status = 'skipped', CASE status WHEN 'skipped' THEN decided_ts ELSE id END LIMIT 1`).first();
  let item = null;
  if (row) { const p = JSON.parse(row.payload_json); item = { id: row.id, skipped: row.status === 'skipped', proposal: p, why: row.why, ...contextFor(cv, p) }; }
  return { item, counts: { pending: counts.pending || 0, skipped: counts.skipped || 0, approved: counts.approved || 0, rejected: counts.rejected || 0 } };
}

// GET /api/admin/review → { item, counts }
export async function handleReviewNext(env, cv) {
  return json(await queueState(env, cv));
}

// POST /api/admin/review/decide  body: { id, action: approve|reject|skip, edits: { text?, wording?, label? } }
export async function handleReviewDecide(request, env, { workingContent, saveDraft }) {
  let body;
  try { body = JSON.parse(await request.text()); } catch { return json({ error: 'Bad request.' }, 400); }
  const row = await env.DB.prepare('SELECT id, payload_json, status FROM proposals WHERE id = ?1').bind(Number(body?.id)).first();
  if (!row) return json({ error: 'That proposal no longer exists.' }, 404);
  if (row.status !== 'pending' && row.status !== 'skipped') return json({ error: 'That proposal was already decided.' }, 409);
  const action = body.action;
  let summary = '', changes;
  let working = await workingContent(env);

  if (action === 'approve') {
    const p = JSON.parse(row.payload_json);
    const edits = body.edits || {};
    for (const f of ['text', 'wording', 'label']) if (typeof edits[f] === 'string' && clean(edits[f])) p[f] = clean(edits[f]);
    const proposal = { role_anchor: '', card_id: '', label: '', metric: '', tag: '', headline: '', detail: '', text: '', skill: '', wording: '', ...p };
    let result;
    try { result = applyProposal(working.content, proposal); validate(result.cv); } catch (e) { return json({ error: e.message }, 422); }
    changes = await saveDraft(env, result.cv, working.baseSha);
    working = { ...working, content: result.cv, changes };
    summary = result.summary;
    const edited = Object.keys(edits).some((f) => clean(edits[f]) && clean(edits[f]) !== clean(JSON.parse(row.payload_json)[f]));
    await env.DB.prepare(`UPDATE proposals SET status = 'approved', decided_ts = ?1, final_json = ?2 WHERE id = ?3`).bind(Date.now(), JSON.stringify({ ...p, edited }), row.id).run();
  } else if (action === 'reject') {
    await env.DB.prepare(`UPDATE proposals SET status = 'rejected', decided_ts = ?1 WHERE id = ?2`).bind(Date.now(), row.id).run();
    summary = 'Rejected. It won\'t be proposed again.';
  } else if (action === 'skip') {
    // Skipped items go to the back of the queue.
    await env.DB.prepare(`UPDATE proposals SET status = 'skipped', decided_ts = ?1 WHERE id = ?2`).bind(Date.now(), row.id).run();
    summary = 'Skipped for now.';
  } else {
    return json({ error: 'Unknown action.' }, 400);
  }
  return json({ ok: true, summary, drafts: changes ?? working.changes, ...(await queueState(env, working.content)) });
}
