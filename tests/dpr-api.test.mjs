// Shared DPR presets API: what gets refused, what gets stored, and that limits hold. Run: npm test
// Uses a small in-memory stand-in for D1 that understands only the queries src/dpr-api.js makes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleDprPresets } from '../src/dpr-api.js';
import { EXAMPLES } from '../public/assets/js/dpr-engine.js';

function fakeDb() {
  const presets = [];
  const salts = new Map();
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    async first() {
      if (sql.startsWith('SELECT salt')) return { salt: salts.get(args[0]) };
      if (sql.includes('WHERE hash')) return presets.find((p) => p.hash === args[0]) || null;
      if (sql.includes('WHERE day = ?1 AND ipkey')) return { n: presets.filter((p) => p.day === args[0] && p.ipkey === args[1]).length };
      if (sql.includes('WHERE day = ?1')) return { n: presets.filter((p) => p.day === args[0]).length };
      if (sql.startsWith('SELECT COUNT(*) AS n FROM dpr_presets')) return { n: presets.length };
      throw new Error(`unexpected first(): ${sql}`);
    },
    async all() {
      if (sql.includes('FROM dpr_presets WHERE hidden = 0')) return { results: presets.filter((p) => !p.hidden).sort((a, b) => b.ts - a.ts).slice(0, args[0]) };
      throw new Error(`unexpected all(): ${sql}`);
    },
    async run() {
      if (sql.startsWith('INSERT OR IGNORE INTO salts')) { if (!salts.has(args[0])) salts.set(args[0], args[1]); return { meta: { changes: 1 } }; }
      if (sql.startsWith('INSERT OR IGNORE INTO dpr_presets')) {
        const [ts, day, ipkey, name, fighter_json, hash] = args;
        if (presets.some((p) => p.hash === hash)) return { meta: { changes: 0 } };
        const id = presets.length + 1;
        presets.push({ id, ts, day, ipkey, name, fighter_json, hash, hidden: 0 });
        return { meta: { changes: 1, last_row_id: id } };
      }
      throw new Error(`unexpected run(): ${sql}`);
    },
  });
  return { prepare: (sql) => stmt(sql), presets };
}

const ORIGIN = 'https://nathanpotter.dev';
const URL_ = new URL(`${ORIGIN}/api/dpr/presets`);
const env = (extra = {}) => ({ DB: fakeDb(), DPR_SAVING_ENABLED: 'true', ...extra });
const post = (body, { origin = ORIGIN, ip = '203.0.113.7' } = {}) => new Request(URL_, {
  method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
  headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
});
const fighter = (name = 'Test greatsword') => ({ ...EXAMPLES[0], name });

test('saves a valid fighter, lists it, and stores only the normalized shape', async () => {
  const e = env();
  const res = await handleDprPresets(post({ fighter: { ...fighter(), note: 'dropped', extra: { evil: true } } }), e, URL_);
  assert.equal(res.status, 201);
  const { preset } = await res.json();
  assert.equal(preset.name, 'Test greatsword');
  assert.deepEqual(Object.keys(JSON.parse(e.DB.presets[0].fighter_json)), ['name', 'attacks']);
  assert.equal(e.DB.presets[0].ipkey.length, 16); // hashed, never the IP
  assert.ok(!e.DB.presets[0].fighter_json.includes('203.0.113.7'));

  const list = await (await handleDprPresets(new Request(URL_), e, URL_)).json();
  assert.equal(list.presets.length, 1);
  assert.equal(list.saving, true);
});

test('refuses cross-site posts, bad JSON, invalid fighters and oversized bodies', async () => {
  const e = env();
  assert.equal((await handleDprPresets(post({ fighter: fighter() }, { origin: 'https://evil.example' }), e, URL_)).status, 403);
  assert.equal((await handleDprPresets(post('{nope'), e, URL_)).status, 400);
  const bad = await handleDprPresets(post({ fighter: { name: 'x', attacks: [] } }), e, URL_);
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).message, /at least one attack/);
  assert.equal((await handleDprPresets(post('x'.repeat(9000)), e, URL_)).status, 413);
  assert.equal(e.DB.presets.length, 0);
});

test('saving can be switched off, and hidden presets stay hidden', async () => {
  assert.equal((await handleDprPresets(post({ fighter: fighter() }), env({ DPR_SAVING_ENABLED: 'false' }), URL_)).status, 503);
  const e = env();
  await handleDprPresets(post({ fighter: fighter() }), e, URL_);
  e.DB.presets[0].hidden = 1;
  assert.equal((await (await handleDprPresets(new Request(URL_), e, URL_)).json()).presets.length, 0);
  assert.equal((await handleDprPresets(post({ fighter: fighter() }), e, URL_)).status, 409); // can't resurrect it
});

test('an identical preset returns the existing one instead of a copy', async () => {
  const e = env();
  await handleDprPresets(post({ fighter: fighter() }), e, URL_);
  const again = await handleDprPresets(post({ fighter: fighter() }, { ip: '198.51.100.1' }), e, URL_);
  assert.equal(again.status, 200);
  assert.equal((await again.json()).duplicate, true);
  assert.equal(e.DB.presets.length, 1);
});

test('per-visitor and site-wide daily limits', async () => {
  const e = env({ DPR_PER_IP_DAILY: '2', DPR_DAILY_CAP: '3' });
  for (const n of [1, 2]) assert.equal((await handleDprPresets(post({ fighter: fighter(`Mine ${'i'.repeat(n)}`) }), e, URL_)).status, 201);
  assert.equal((await handleDprPresets(post({ fighter: fighter('Mine iii') }), e, URL_)).status, 429);
  assert.equal((await handleDprPresets(post({ fighter: fighter('Theirs') }, { ip: '198.51.100.2' }), e, URL_)).status, 201);
  const capped = await handleDprPresets(post({ fighter: fighter('Late') }, { ip: '198.51.100.3' }), e, URL_);
  assert.equal(capped.status, 429);
  assert.equal((await capped.json()).error, 'daily_cap');
});
