// /api/dpr/presets — fighter presets for the DPR calculator, shared with everyone who uses it.
//   GET   the visible presets, newest first
//   POST  save one. Saved presets are public; the page says so before the visitor saves.
// Limits, cheapest first: same-origin only → bot check (Turnstile) → burst per IP (Cloudflare rate limiter) → per-IP
// daily cap (hashed, never stored) → site-wide daily cap → total stored cap. Every preset passes the same
// normalizeFighter() the browser uses, so nothing but a known shape of numbers and short names is ever stored.
import { normalizeFighter, PresetError } from '../public/assets/js/dpr-engine.js';
import { dayKey } from './analytics.js';
import { ipKey, verifyTurnstile } from './jobfit-api.js';

const LIST_LIMIT = 300;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});
const fail = (status, code, message) => json({ error: code, message }, status);

const toPreset = (row) => ({ id: row.id, ...JSON.parse(row.fighter_json), saved: new Date(row.ts).toISOString().slice(0, 10) });

async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function handleDprPresets(request, env, url) {
  if (request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT id, ts, fighter_json FROM dpr_presets WHERE hidden = 0 ORDER BY ts DESC LIMIT ?1').bind(LIST_LIMIT).all();
    return json({ presets: results.map(toPreset), saving: env.DPR_SAVING_ENABLED === 'true' });
  }
  if (request.method !== 'POST') return fail(405, 'method', 'Use GET or POST.');
  if (request.headers.get('Origin') !== url.origin) return fail(403, 'origin', 'Cross-site request refused.');
  if (env.DPR_SAVING_ENABLED !== 'true') return fail(503, 'disabled', 'Saving presets is switched off right now. Your fighters still work on this page.');

  const raw = await request.text();
  if (raw.length > 8000) return fail(413, 'too_big', 'That preset is too large to save.');
  let body;
  try { body = JSON.parse(raw); } catch { return fail(400, 'bad_request', 'Send the preset as JSON.'); }

  let fighter;
  try { fighter = normalizeFighter(body?.fighter); } catch (err) {
    if (err instanceof PresetError) return fail(400, 'invalid', err.message);
    throw err;
  }

  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  if (!(await verifyTurnstile(env, body?.turnstile, ip))) return fail(403, 'bot_check', 'The human check did not pass. Reload the page and try again.');
  if (env.DPR_SAVE_BURST) {
    const { success } = await env.DPR_SAVE_BURST.limit({ key: ip });
    if (!success) return fail(429, 'burst', 'Too many saves at once. Wait a minute and try again.');
  }

  const fighterJson = JSON.stringify(fighter);
  const hash = await sha256(fighterJson);
  const existing = await env.DB.prepare('SELECT id, ts, fighter_json, hidden FROM dpr_presets WHERE hash = ?1').bind(hash).first();
  if (existing && !existing.hidden) return json({ preset: toPreset(existing), duplicate: true });
  if (existing) return fail(409, 'hidden', "That preset can't be saved. Try a different name.");

  const now = Date.now();
  const day = dayKey(now);
  const key = await ipKey(env, day, ip, 'dpr');
  const perIp = Number(env.DPR_PER_IP_DAILY || 10);
  const mine = await env.DB.prepare('SELECT COUNT(*) AS n FROM dpr_presets WHERE day = ?1 AND ipkey = ?2').bind(day, key).first();
  if (mine.n >= perIp) return fail(429, 'daily_ip', `You've saved ${perIp} presets today. Come back tomorrow to save more.`);
  const cap = Number(env.DPR_DAILY_CAP || 100);
  const today = await env.DB.prepare('SELECT COUNT(*) AS n FROM dpr_presets WHERE day = ?1').bind(day).first();
  if (today.n >= cap) return fail(429, 'daily_cap', 'Saving has hit its daily limit. Try again tomorrow.');
  const max = Number(env.DPR_MAX_STORED || 2000);
  const stored = await env.DB.prepare('SELECT COUNT(*) AS n FROM dpr_presets').first();
  if (stored.n >= max) return fail(507, 'full', 'The shared preset shelf is full for now.');

  const res = await env.DB.prepare('INSERT OR IGNORE INTO dpr_presets (ts, day, ipkey, name, fighter_json, hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(now, day, key, fighter.name, fighterJson, hash).run();
  if (!res.meta.changes) { // saved by someone else a moment ago
    const row = await env.DB.prepare('SELECT id, ts, fighter_json FROM dpr_presets WHERE hash = ?1').bind(hash).first();
    return json({ preset: toPreset(row), duplicate: true });
  }
  return json({ preset: { id: res.meta.last_row_id, ...fighter, saved: new Date(now).toISOString().slice(0, 10) } }, 201);
}
