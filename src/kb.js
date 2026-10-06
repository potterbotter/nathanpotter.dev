// Test bench knowledge chat (admin only). Nathan answers the job-fit read's feedback; Claude asks for
// specifics and proposes changes. Nothing is written until Nathan approves a proposal:
//   public proposals → the edit-mode draft (published later, like any edit)
//   private notes    → the D1 knowledge table (never shown publicly, never read by the public tool)
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { cvFacts, priceOf, MODELS } from './jobfit.js';
import { parsePartialJson } from './partialjson.js';
import { validate } from '../build/validate.mjs';
import { dayKey } from './analytics.js';

const MAX_MESSAGES = 40;
const MAX_CHARS = 80_000;

const Proposal = z.object({
  kind: z.enum(['add_card', 'edit_card', 'add_fact', 'add_skill_wording', 'add_private_note']),
  role_anchor: z.string().describe('add_card only: exp-anchorage, exp-jaris or exp-mosaic. Otherwise empty.'),
  card_id: z.string().describe('edit_card only: the existing card ID. Otherwise empty.'),
  metric: z.string().describe('Cards: short metric, at most 10 characters (e.g. "4×", "+25%", "62"). Otherwise empty.'),
  tag: z.string().describe('Cards: one of the experience tags. Otherwise empty.'),
  headline: z.string().describe('Cards: at most 12 words, self-contained. Otherwise empty.'),
  detail: z.string().describe('Cards: the full CV bullet. Otherwise empty.'),
  text: z.string().describe('add_fact or add_private_note: the fact or note. Otherwise empty.'),
  skill: z.string().describe('add_skill_wording: the skill as shown on the site, or a new skill name. Otherwise empty.'),
  wording: z.string().describe('add_skill_wording: the wording to add. Otherwise empty.'),
  why: z.string().describe('One sentence: what this changes for recruiters or the tools.'),
});
export const ChatTurn = z.object({
  reply: z.string().describe('At most 80 words. Questions or a short explanation of the proposals.'),
  proposals: z.array(Proposal).describe('At most 3. Empty while you still need answers.'),
});

function system(cv) {
  return `You help Nathan Potter build the knowledge base behind his CV site. It powers a public job-fit tool (recruiters paste a posting and get an honest read) and a résumé generator that tailors his CV to postings. Nathan has just run a read on a real posting and is responding to its feedback.

Your job
- Understand what Nathan tells you about his experience. Ask short follow-up questions for the specifics a skeptical recruiter would believe: numbers, timeframe, scope, his exact role, the outcome. One or two questions at a time.
- When you have enough, propose concrete changes for him to approve.

Honesty (non-negotiable)
- Only propose what Nathan has actually told you. Never invent or round up numbers, scope, team sizes or ownership. If a detail is missing, ask instead of proposing.
- Keep his ownership words: "supported" stays "supported", "limited" stays limited.
- Never propose content about time between jobs unless he explicitly asks for it.

Public vs private
- Public proposals appear on his public CV and in the public tool. add_card for a result with an outcome; edit_card to strengthen an existing card; add_fact for a stable fact (level, scope, domains); add_skill_wording for a true synonym or new skill.
- add_private_note for anything useful but not for the public page: the story behind a number, caveats, sensitive details, interview context.

Voice for public text
- Résumé register: confident, plain, specific. Facts flat; numbers over adjectives; no exclamation points; no hype words.
- Card headline: 12 words or fewer, self-contained (it is shown alone as evidence). Metric: 10 characters or fewer. Detail: the full bullet, starting with a strong verb.
- Valid card tags: ${cv.experience.tags.join(', ')}. Valid role anchors: ${cv.experience.roles.map((r) => `${r.anchor} (${r.company})`).join(', ')}.

Keep replies to 80 words or fewer and propose at most 3 changes per turn.

CV facts (current published or draft version):

${cvFacts(cv)}`;
}

const enc = new TextEncoder();
const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// POST /api/admin/kb/chat  body: { messages: [{role, content}], jd, read }
export async function handleKbChat(request, env, ctx, cv) {
  let body;
  try { body = JSON.parse(await request.text()); } catch { return json({ error: 'Bad request.' }, 400); }
  const history = Array.isArray(body?.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
  if (!history.length || history[history.length - 1].role !== 'user') return json({ error: 'Send a message first.' }, 400);
  const total = JSON.stringify(body).length;
  if (total > MAX_CHARS) return json({ error: 'This conversation is too long. Clear it and start fresh.' }, 413);

  // First user turn carries the posting and the read as context; the rest is the conversation.
  const context = [
    body.jd ? `The posting Nathan assessed:\n<posting>\n${String(body.jd).slice(0, 15000)}\n</posting>` : 'No posting has been assessed yet.',
    body.read ? `The read it produced:\n${JSON.stringify(body.read).slice(0, 8000)}` : '',
  ].filter(Boolean).join('\n\n');
  const messages = history.map((m, i) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: i === 0 ? `${context}\n\nNathan: ${String(m.content)}` : String(m.content),
  }));

  const format = zodOutputFormat(ChatTurn);
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const send = (e) => writer.write(enc.encode(JSON.stringify(e) + '\n')).catch(() => {});

  ctx.waitUntil((async () => {
    const started = Date.now();
    let cost = 0;
    let model = MODELS.opus;
    const host = new URL(request.url).hostname;
    if (env.DEV_FAKE_MODEL === 'true' && (host === 'localhost' || host === '127.0.0.1')) {
      // Local development without an API key: a canned turn with one proposal of each scope.
      const turn = { reply: 'Got it. How many experiments did you run, and what changed as a result?', proposals: [
        { kind: 'add_skill_wording', role_anchor: '', card_id: '', metric: '', tag: '', headline: '', detail: '', text: '', skill: 'A/B testing with feature flags', wording: 'LaunchDarkly experiments', why: 'Matches postings that name the tool.' },
        { kind: 'add_private_note', role_anchor: '', card_id: '', metric: '', tag: '', headline: '', detail: '', text: 'A/B tests were small-scale; be ready to describe one.', skill: '', wording: '', why: 'Interview context.' },
      ] };
      await send({ type: 'partial', turn: { reply: turn.reply.slice(0, 20) } });
      await send({ type: 'final', turn, meta: { model: 'dev-fake', cost: 0, durationMs: 50 } });
      await writer.close().catch(() => {});
      return;
    }
    try {
      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
      const stream = client.beta.messages.stream({
        model,
        max_tokens: 8000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: { type: format.type, schema: format.schema } },
        system: [{ type: 'text', text: system(cv), cache_control: { type: 'ephemeral' } }],
        messages,
      });
      let text = '';
      let last = 0;
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          text += event.delta.text;
          if (Date.now() - last > 200) { last = Date.now(); const p = parsePartialJson(text); if (p) await send({ type: 'partial', turn: p }); }
        }
      }
      const response = await stream.finalMessage();
      model = response.model || model;
      cost = priceOf(model, response.usage);
      if (response.stop_reason === 'refusal') throw new Error('The model declined this message.');
      const out = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      const turn = format.parse(out);
      turn.proposals = turn.proposals.slice(0, 3);
      await send({ type: 'final', turn, meta: { model, cost, durationMs: Date.now() - started } });
    } catch (err) {
      console.error('kb chat error', err);
      await send({ type: 'error', message: err?.message?.startsWith('The model') ? err.message : 'The chat failed. Try again.' });
    }
    try {
      // Chat turns spend from the same monthly budget as the job-fit tool.
      await env.DB.prepare(`INSERT INTO jobfit_runs (ts, day, month, ipkey, admin, status, model, cost_usd, duration_ms) VALUES (?1, ?2, ?3, 'admin', 1, 'chat', ?4, ?5, ?6)`)
        .bind(Date.now(), dayKey(), dayKey().slice(0, 7), model, cost, Date.now() - started).run();
    } catch (err) { console.error('kb chat logging error', err); }
    await writer.close().catch(() => {});
  })());

  return new Response(readable, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } });
}

// Apply one approved proposal. Public kinds edit the draft; private notes go to the knowledge table.
export function applyProposal(content, p) {
  const cv = JSON.parse(JSON.stringify(content));
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  switch (p.kind) {
    case 'add_card': {
      const role = cv.experience.roles.find((r) => r.anchor === p.role_anchor);
      if (!role) throw new Error(`Unknown role: ${p.role_anchor}`);
      const card = { id: `${role.anchor.replace(/^exp-/, '')}-${role.nextCard}`, metric: clean(p.metric), tag: clean(p.tag), headline: clean(p.headline), detail: clean(p.detail) };
      role.nextCard += 1;
      role.cards.push(card);
      return { cv, summary: `Added card ${card.id} to ${role.company}` };
    }
    case 'edit_card': {
      for (const r of cv.experience.roles) {
        const c = r.cards.find((x) => x.id === p.card_id);
        if (!c) continue;
        for (const f of ['metric', 'tag', 'headline', 'detail']) if (clean(p[f])) c[f] = clean(p[f]);
        if (clean(p.headline)) delete c.headlineSource;
        return { cv, summary: `Updated card ${c.id}` };
      }
      throw new Error(`Unknown card: ${p.card_id}`);
    }
    case 'add_fact': {
      const t = clean(p.text);
      if (!t) throw new Error('The fact is empty.');
      cv.facts = [...(cv.facts || []).filter((f) => f !== t), t];
      return { cv, summary: 'Added a fact' };
    }
    case 'add_skill_wording': {
      const skill = clean(p.skill), wording = clean(p.wording) || skill;
      if (!skill) throw new Error('The skill is empty.');
      const lower = skill.toLowerCase();
      for (const g of cv.skills.groups) {
        const item = g.items.find((i) => i.forms.some((f) => f.toLowerCase() === lower));
        if (item) {
          if (!item.forms.some((f) => f.toLowerCase() === wording.toLowerCase())) item.forms.push(wording);
          return { cv, summary: `Added the wording "${wording}" to ${item.forms[item.shown]}` };
        }
      }
      const group = cv.skills.groups.find((g) => g.name === 'Product practice') || cv.skills.groups[cv.skills.groups.length - 1];
      group.items.push({ forms: [...new Set([skill, wording])], shown: 0 });
      return { cv, summary: `Added the skill "${skill}" to ${group.name}` };
    }
    default:
      throw new Error(`Not a public change: ${p.kind}`);
  }
}

// POST /api/admin/kb/apply  body: { proposal, source }
export async function handleKbApply(request, env, { workingContent, saveDraft }) {
  let body;
  try { body = JSON.parse(await request.text()); } catch { return json({ error: 'Bad request.' }, 400); }
  const p = body?.proposal;
  if (!p || !p.kind) return json({ error: 'No proposal.' }, 400);
  if (p.kind === 'add_private_note') {
    const t = String(p.text || '').trim();
    if (!t) return json({ error: 'The note is empty.' }, 400);
    await env.DB.prepare('INSERT INTO knowledge (ts, text, source) VALUES (?1, ?2, ?3)').bind(Date.now(), t.slice(0, 4000), String(body.source || '').slice(0, 300) || null).run();
    return json({ ok: true, summary: 'Saved a private note', private: true });
  }
  const working = await workingContent(env);
  let result;
  try { result = applyProposal(working.content, p); validate(result.cv); } catch (e) { return json({ error: e.message }, 422); }
  const changes = await saveDraft(env, result.cv, working.baseSha);
  return json({ ok: true, summary: result.summary, changes });
}

// GET /api/admin/kb/notes → { notes }; DELETE /api/admin/kb/notes?id=N
export async function handleKbNotes(request, env, url) {
  if (request.method === 'DELETE') {
    const id = Number(url.searchParams.get('id'));
    if (!Number.isInteger(id)) return json({ error: 'Bad id.' }, 400);
    await env.DB.prepare('DELETE FROM knowledge WHERE id = ?1').bind(id).run();
    return json({ ok: true });
  }
  const { results } = await env.DB.prepare('SELECT id, ts, text, source FROM knowledge ORDER BY ts DESC LIMIT 200').all();
  return json({ notes: results });
}
