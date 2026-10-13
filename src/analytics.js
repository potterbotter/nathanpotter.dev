// First-party, cookieless analytics: collection (public /api/collect) and dashboard queries.
// Privacy rules (DESIGN.md): never store IP addresses; group visits with a daily-rotating
// anonymous hash; keep raw events 13 months.

export const TYPES = new Set(['pageview', 'engage', 'section', 'detail', 'more', 'filter', 'contact', 'theme', 'print', 'outbound', 'notfound']);
const MAX_BATCH = 25;
const MAX_BODY = 16 * 1024;
const RETENTION_MS = 400 * 24 * 60 * 60 * 1000; // ~13 months
const BOT_UA = /bot|crawl|spider|slurp|preview|fetch|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|httpclient|axios|node-fetch|go-http|java\//i;

export const dayKey = (ms = Date.now()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));

const clip = (v, n) => (v == null ? null : String(v).slice(0, n));

export function parseUA(ua = '') {
  const device = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua) ? 'Tablet' : /Mobi|iPhone|Android/i.test(ua) ? 'Mobile' : 'Desktop';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Firefox\/|FxiOS/.test(ua) ? 'Firefox' : /Chrome\/|CriOS/.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Other';
  const os = /Windows/.test(ua) ? 'Windows' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android'
    : /CrOS/.test(ua) ? 'ChromeOS' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Other';
  return { device, browser, os };
}

// The day's salt, cached per Worker isolate so most beacons skip the two D1 queries. The database stays the source
// of truth, so every isolate agrees on the day's salt.
const saltCache = { day: '', salt: '' };
async function saltFor(env, day) {
  if (saltCache.day === day) return saltCache.salt;
  const fresh = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  await env.DB.prepare('INSERT OR IGNORE INTO salts (day, salt) VALUES (?1, ?2)').bind(day, fresh).run();
  const row = await env.DB.prepare('SELECT salt FROM salts WHERE day = ?1').bind(day).first();
  saltCache.day = day; saltCache.salt = row.salt;
  return row.salt;
}

async function visitorId(env, day, ip, ua) {
  const salt = await saltFor(env, day);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}|${ip}|${ua}`));
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

// POST /api/collect — body: { events: [{ type, path, label?, value?, ref?, referrer?, screen?, lang? }] }
export async function collect(request, env, url) {
  const ok = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  // Same-site beacons only. sendBeacon always sends Origin.
  const origin = request.headers.get('Origin');
  if (origin !== url.origin) return new Response('Forbidden', { status: 403 });
  const ua = request.headers.get('User-Agent') || '';
  if (!ua || BOT_UA.test(ua)) return ok();
  // The Origin check is easy to fake from a script, so cap beacons per IP (counted by Cloudflare, never stored).
  // Over the limit, the beacon is dropped quietly: analytics should never show a visitor an error.
  if (env.COLLECT_LIMIT) {
    const { success } = await env.COLLECT_LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') || '0.0.0.0' });
    if (!success) return ok();
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY) return new Response('Too large', { status: 413 });
  let body;
  try { body = JSON.parse(raw); } catch { return new Response('Bad request', { status: 400 }); }
  const events = Array.isArray(body?.events) ? body.events.slice(0, MAX_BATCH) : [];
  if (!events.length) return ok();

  const now = Date.now();
  const day = dayKey(now);
  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0'; // used for the hash only, never stored
  const visitor = await visitorId(env, day, ip, ua);
  const cf = request.cf || {};
  const { device, browser, os } = parseUA(ua);

  const stmt = env.DB.prepare(`INSERT INTO events
    (ts, day, visitor, type, path, label, value, ref, referrer, country, region, city, timezone, org, asn, device, browser, os, screen, lang)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)`);
  const rows = [];
  for (const e of events) {
    if (!e || !TYPES.has(e.type)) continue;
    const path = clip(e.path, 200);
    if (!path || !path.startsWith('/') || path.startsWith('/admin')) continue;
    const value = Number.isFinite(e.value) ? Math.max(0, Math.min(e.value, 86400)) : null;
    const referrer = clip(e.referrer, 120);
    rows.push(stmt.bind(
      now, day, visitor, e.type, path, clip(e.label, 120), value, clip(e.ref, 60),
      referrer && referrer !== url.hostname ? referrer : null,
      clip(cf.country, 8), clip(cf.region, 80), clip(cf.city, 80), clip(cf.timezone, 60),
      clip(cf.asOrganization, 120), Number.isInteger(cf.asn) ? cf.asn : null,
      device, browser, os, clip(e.screen, 20), clip(e.lang, 20),
    ));
  }
  if (rows.length) await env.DB.batch(rows);
  return ok();
}

// Daily cron: drop raw events past retention and salts older than yesterday.
export async function prune(env) {
  const yesterday = dayKey(Date.now() - 24 * 60 * 60 * 1000);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM events WHERE ts < ?1').bind(Date.now() - RETENTION_MS),
    env.DB.prepare('DELETE FROM salts WHERE day < ?1').bind(yesterday),
  ]);
}
