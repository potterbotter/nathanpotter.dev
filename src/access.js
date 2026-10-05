// Verifies a Cloudflare Access JWT (RS256) against the team's published signing keys.
// Returns the payload when valid, otherwise null. Never throws.
let jwksCache = { team: '', at: 0, keys: [] };

async function accessKeys(team, force, fetchImpl) {
  const fresh = jwksCache.team === team && Date.now() - jwksCache.at < 60 * 60 * 1000 && jwksCache.keys.length;
  if (fresh && !force) return jwksCache.keys;
  const res = await fetchImpl(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error('Could not load Access signing keys');
  const { keys } = await res.json();
  jwksCache = { team, at: Date.now(), keys: keys || [] };
  return jwksCache.keys;
}

export function resetKeyCache() { jwksCache = { team: '', at: 0, keys: [] }; }

export async function verifyAccessJwt(token, team, aud, fetchImpl = fetch) {
  try {
    const [h, p, s, extra] = String(token).split('.');
    if (!h || !p || !s || extra !== undefined) return null;
    const header = JSON.parse(b64urlText(h));
    if (header.alg !== 'RS256') return null;
    let jwk = (await accessKeys(team, false, fetchImpl)).find((k) => k.kid === header.kid);
    if (!jwk) jwk = (await accessKeys(team, true, fetchImpl)).find((k) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(s), new TextEncoder().encode(`${h}.${p}`));
    if (!valid) return null;
    const payload = JSON.parse(b64urlText(p));
    const now = Math.floor(Date.now() / 1000);
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!auds.includes(aud)) return null;
    if (payload.iss !== `https://${team}`) return null;
    if (!payload.exp || payload.exp < now) return null;
    if (payload.nbf && payload.nbf > now + 60) return null;
    return payload;
  } catch {
    return null;
  }
}

export function b64urlBytes(s) {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
export const b64urlText = (s) => new TextDecoder().decode(b64urlBytes(s));
