// Tests for the second lock: Cloudflare Access token verification. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyAccessJwt, resetKeyCache } from '../src/access.js';

const TEAM = 'example.cloudflareaccess.com';
const AUD = 'aud-tag-123';

const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
async function keypair(kid) {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid, alg: 'RS256', use: 'sig' };
  return { privateKey, jwk };
}
async function sign(privateKey, header, payload) {
  const data = `${enc(header)}.${enc(payload)}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(data));
  return `${data}.${Buffer.from(sig).toString('base64url')}`;
}
const now = () => Math.floor(Date.now() / 1000);
const good = (extra = {}) => ({ aud: [AUD], iss: `https://${TEAM}`, email: 'nathan@example.com', exp: now() + 3600, iat: now(), ...extra });

const real = await keypair('k1');
const attacker = await keypair('k1'); // same kid, different key
const fakeFetch = (keys) => async (url) => {
  assert.equal(url, `https://${TEAM}/cdn-cgi/access/certs`);
  return { ok: true, json: async () => ({ keys }) };
};
const verify = (token) => { resetKeyCache(); return verifyAccessJwt(token, TEAM, AUD, fakeFetch([real.jwk])); };

test('accepts a valid token', async () => {
  const p = await verify(await sign(real.privateKey, { alg: 'RS256', kid: 'k1' }, good()));
  assert.equal(p.email, 'nathan@example.com');
});

test('rejects a token signed by a different key', async () => {
  assert.equal(await verify(await sign(attacker.privateKey, { alg: 'RS256', kid: 'k1' }, good())), null);
});

test('rejects a tampered payload', async () => {
  const t = await sign(real.privateKey, { alg: 'RS256', kid: 'k1' }, good());
  const [h, , s] = t.split('.');
  assert.equal(await verify(`${h}.${enc(good({ email: 'attacker@example.com' }))}.${s}`), null);
});

test('rejects the wrong audience (another Access app)', async () => {
  assert.equal(await verify(await sign(real.privateKey, { alg: 'RS256', kid: 'k1' }, good({ aud: ['other-app'] }))), null);
});

test('rejects the wrong issuer', async () => {
  assert.equal(await verify(await sign(real.privateKey, { alg: 'RS256', kid: 'k1' }, good({ iss: 'https://evil.cloudflareaccess.com' }))), null);
});

test('rejects an expired token', async () => {
  assert.equal(await verify(await sign(real.privateKey, { alg: 'RS256', kid: 'k1' }, good({ exp: now() - 10 }))), null);
});

test('rejects alg "none" and other algorithms', async () => {
  const unsigned = `${enc({ alg: 'none', kid: 'k1' })}.${enc(good())}.`;
  assert.equal(await verify(unsigned), null);
  assert.equal(await verify(await sign(real.privateKey, { alg: 'HS256', kid: 'k1' }, good())), null);
});

test('rejects an unknown key id and garbage input', async () => {
  assert.equal(await verify(await sign(real.privateKey, { alg: 'RS256', kid: 'nope' }, good())), null);
  assert.equal(await verify('not.a.jwt'), null);
  assert.equal(await verify(''), null);
});
