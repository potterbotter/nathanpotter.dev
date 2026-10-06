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

async function saltFor(env, day) {
  const fresh = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  await env.DB.prepare('INSERT OR IGNORE INTO salts (day, salt) VALUES (?1, ?2)').bind(day, fresh).run();
  const row = await env.DB.prepare('SELECT salt FROM salts WHERE day = ?1').bind(day).first();
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

// ---------- dashboard ----------
export const RANGES = { '24h': 1, '7d': 7, '30d': 30, '90d': 90, all: null };

export async function dashboardData(env, rangeKey) {
  const days = RANGES[rangeKey] === undefined ? 30 : RANGES[rangeKey];
  const since = days ? Date.now() - days * 24 * 60 * 60 * 1000 : 0;
  const q = (sql, ...args) => env.DB.prepare(sql).bind(since, ...args);
  const all = async (sql, ...args) => (await q(sql, ...args).all()).results;
  const one = async (sql, ...args) => q(sql, ...args).first();
  const top = (col, type = 'pageview', limit = 12) => all(
    `SELECT COALESCE(${col}, '(none)') AS k, COUNT(*) AS n, COUNT(DISTINCT day || visitor) AS v
     FROM events WHERE ts >= ?1 AND type = '${type}' GROUP BY 1 ORDER BY n DESC LIMIT ${limit}`);
  const labels = (type, limit = 15) => all(
    `SELECT label AS k, COUNT(*) AS n, COUNT(DISTINCT day || visitor) AS v
     FROM events WHERE ts >= ?1 AND type = '${type}' AND label IS NOT NULL GROUP BY 1 ORDER BY n DESC LIMIT ${limit}`);

  const [totals, engaged, series, pages, referrers, refs, countries, regions, cities, orgs, devices, browsers, oses, screens,
    sections, cvVisitors, details, mores, filters, contacts, outbound, themes, notfound, recent] = await Promise.all([
    one(`SELECT COUNT(*) AS views, COUNT(DISTINCT day || visitor) AS visitors FROM events WHERE ts >= ?1 AND type = 'pageview'`),
    one(`SELECT AVG(value) AS avg, COUNT(*) AS n FROM events WHERE ts >= ?1 AND type = 'engage' AND value > 0`),
    all(`SELECT day AS d, SUM(type = 'pageview') AS views, COUNT(DISTINCT CASE WHEN type = 'pageview' THEN visitor END) AS visitors
         FROM events WHERE ts >= ?1 GROUP BY day ORDER BY day`),
    top('path'), top('referrer'), top('ref'),
    top('country'), top("region || ', ' || country"), top("city || ', ' || COALESCE(region, country)"), top('org', 'pageview', 15),
    top('device'), top('browser'), top('os'), top('screen'),
    labels('section', 20),
    one(`SELECT COUNT(DISTINCT day || visitor) AS v FROM events WHERE ts >= ?1 AND type = 'pageview' AND path IN ('/', '/builder/', '/fintech/', '/crypto/', '/onboarding/', '/climate/')`),
    labels('detail', 20), labels('more'), labels('filter'), labels('contact'), labels('outbound'), labels('theme'), top('path', 'notfound'),
    all(`SELECT day, visitor, MIN(ts) AS first, MAX(ts) AS last, COUNT(*) AS n,
           MAX(org) AS org, MAX(city) AS city, MAX(region) AS region, MAX(country) AS country,
           MAX(device) AS device, MAX(browser) AS browser, MAX(referrer) AS referrer, MAX(ref) AS ref,
           SUM(type = 'print') AS prints, SUM(type = 'contact') AS contacts
         FROM events WHERE ts >= ?1 GROUP BY day, visitor ORDER BY last DESC LIMIT 25`),
  ]);

  // Timelines for the recent visitor-days, in one query.
  let timelines = {};
  if (recent.length) {
    const keys = recent.map((r) => r.day + r.visitor);
    const placeholders = keys.map((_, i) => `?${i + 2}`).join(',');
    const evs = await all(`SELECT day || visitor AS k, ts, type, path, label, value FROM events
      WHERE ts >= ?1 AND day || visitor IN (${placeholders}) ORDER BY ts`, ...keys);
    for (const e of evs) (timelines[e.k] ||= []).push(e);
  }

  const prints = await one(`SELECT COUNT(*) AS n FROM events WHERE ts >= ?1 AND type = 'print'`);
  const contactN = contacts.reduce((s, r) => s + r.n, 0);

  return {
    rangeKey: RANGES[rangeKey] === undefined ? '30d' : rangeKey,
    totals: { views: totals.views || 0, visitors: totals.visitors || 0, engaged: engaged.avg || 0, prints: prints.n || 0, contacts: contactN },
    series, pages, referrers, refs, countries, regions, cities, orgs, devices, browsers, oses, screens,
    sections, cvVisitors: cvVisitors.v || 0, details, mores, filters, contacts, outbound, themes, notfound,
    recent: recent.map((r) => ({ ...r, events: timelines[r.day + r.visitor] || [] })),
  };
}
