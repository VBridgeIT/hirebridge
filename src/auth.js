// Sign-in check. Cloudflare Access sits in front of the app and asks each HR user for a one-time
// email code; it then passes a signed token (JWT) on every request. We verify that token ourselves
// as well, so the app stays closed even if Access were ever switched off by mistake.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const JWKS_TTL_MS = 10 * 60 * 1000;
const CLOCK_SKEW_S = 60;
let jwksCache = { url: null, keys: null, at: 0 };

export function resetJwksCacheForTests() { jwksCache = { url: null, keys: null, at: 0 }; }

function b64urlBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64urlJson(s) {
  return JSON.parse(new TextDecoder().decode(b64urlBytes(s)));
}

export function teamOrigin(teamDomain) {
  const host = String(teamDomain).trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return `https://${host}`;
}

async function getKeys(certsUrl, fetchImpl, force) {
  const fresh = jwksCache.url === certsUrl && Date.now() - jwksCache.at < JWKS_TTL_MS;
  if (fresh && !force) return jwksCache.keys;
  const res = await fetchImpl(certsUrl);
  if (!res.ok) throw new Error(`Could not load Access signing keys (${res.status})`);
  const body = await res.json();
  jwksCache = { url: certsUrl, keys: body.keys || [], at: Date.now() };
  return jwksCache.keys;
}

// Returns the signed-in email, or throws with a reason.
export async function verifyAccessJwt(token, { teamDomain, aud, fetchImpl = fetch, nowMs = Date.now() }) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const header = b64urlJson(parts[0]);
  const payload = b64urlJson(parts[1]);
  if (header.alg !== 'RS256') throw new Error('Unexpected token algorithm');

  const origin = teamOrigin(teamDomain);
  const certsUrl = `${origin}/cdn-cgi/access/certs`;
  let keys = await getKeys(certsUrl, fetchImpl, false);
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    keys = await getKeys(certsUrl, fetchImpl, true); // keys rotate; refetch once
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) throw new Error('Unknown signing key');

  const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!ok) throw new Error('Bad signature');

  const now = Math.floor(nowMs / 1000);
  if (payload.iss !== origin) throw new Error('Wrong issuer');
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud)) throw new Error('Wrong audience');
  if (typeof payload.exp !== 'number' || payload.exp < now - CLOCK_SKEW_S) throw new Error('Token expired');
  if (typeof payload.nbf === 'number' && payload.nbf > now + CLOCK_SKEW_S) throw new Error('Token not yet valid');
  if (!payload.email) throw new Error('Token has no email');
  return String(payload.email).toLowerCase();
}

export function allowedEmails(env) {
  return new Set(String(env.ALLOWED_EMAILS || '').split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean));
}

export function missingConfig(env, url) {
  const missing = [];
  if (!env.DB) missing.push('DB (D1 database binding)');
  if (!allowedEmails(env).size) missing.push('ALLOWED_EMAILS');
  if (!isLocalDev(env, url)) {
    if (!env.ACCESS_TEAM_DOMAIN) missing.push('ACCESS_TEAM_DOMAIN');
    if (!env.ACCESS_AUD) missing.push('ACCESS_AUD');
  }
  return missing;
}

// Local development only: a fixed user on localhost when DEV_USER_EMAIL is set. Never applies on a real hostname.
export function isLocalDev(env, url) {
  return Boolean(env.DEV_USER_EMAIL) && LOCAL_HOSTS.has(url.hostname);
}

// Returns { email } for an allowed user, or { status, reason } when access is refused.
export async function authenticate(request, env, { fetchImpl = fetch } = {}) {
  const url = new URL(request.url);
  let email;
  if (isLocalDev(env, url)) {
    email = String(env.DEV_USER_EMAIL).toLowerCase();
  } else {
    const token = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!token) return { status: 401, reason: 'no-token' };
    try {
      email = await verifyAccessJwt(token, { teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD, fetchImpl });
    } catch (err) {
      return { status: 401, reason: 'bad-token', detail: err.message };
    }
  }
  if (!allowedEmails(env).has(email)) return { status: 403, reason: 'not-allowed', email };
  return { email };
}
