import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAccessJwt, authenticate, missingConfig, resetJwksCacheForTests } from '../../src/auth.js';

const TEAM = 'vbridgeit.cloudflareaccess.com';
const AUD = 'aud-tag-123';
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const { privateKey, publicKey } = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'k1' };
const other = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);

async function sign(payload, { key = privateKey, kid = 'k1' } = {}) {
  const head = b64url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}
let fetches = 0;
const fetchImpl = async (url) => {
  fetches++;
  assert.equal(url, `https://${TEAM}/cdn-cgi/access/certs`);
  return new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'content-type': 'application/json' } });
};
const now = Math.floor(Date.now() / 1000);
const good = { iss: `https://${TEAM}`, aud: [AUD], email: 'HR@VBridgeIT.com', exp: now + 600, iat: now, nbf: now };
const opts = { teamDomain: TEAM, aud: AUD, fetchImpl };

test('a valid Access token gives the lower-cased email', async () => {
  resetJwksCacheForTests();
  assert.equal(await verifyAccessJwt(await sign(good), opts), 'hr@vbridgeit.com');
  assert.equal(await verifyAccessJwt(await sign(good), { ...opts, teamDomain: `https://${TEAM}/` }), 'hr@vbridgeit.com');
  assert.equal(fetches, 1, 'signing keys are cached');
});

test('bad tokens are refused', async () => {
  await assert.rejects(verifyAccessJwt(await sign({ ...good, aud: ['other'] }), opts), /audience/);
  await assert.rejects(verifyAccessJwt(await sign({ ...good, iss: 'https://evil.cloudflareaccess.com' }), opts), /issuer/);
  await assert.rejects(verifyAccessJwt(await sign({ ...good, exp: now - 3600 }), opts), /expired/);
  await assert.rejects(verifyAccessJwt(await sign(good, { key: other.privateKey }), opts), /signature/);
  await assert.rejects(verifyAccessJwt(await sign(good, { kid: 'nope' }), opts), /Unknown signing key/);
  await assert.rejects(verifyAccessJwt('a.b', opts), /Malformed/);
  const t = await sign(good);
  const [h, , s] = t.split('.');
  const forged = `${h}.${b64url(JSON.stringify({ ...good, email: 'attacker@x.com' }))}.${s}`;
  await assert.rejects(verifyAccessJwt(forged, opts), /signature/);
  const none = `${b64url(JSON.stringify({ alg: 'none' }))}.${b64url(JSON.stringify(good))}.`;
  await assert.rejects(verifyAccessJwt(none, opts), /algorithm/);
});

const prodEnv = { DB: {}, ALLOWED_EMAILS: 'hr@vbridgeit.com, ravitej@vbridgeit.com', ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD };

test('authenticate: allow-list and missing token', async () => {
  const req = (headers = {}) => new Request('https://hirebridge.pages.dev/employees', { headers });
  assert.deepEqual(await authenticate(req({ 'Cf-Access-Jwt-Assertion': await sign(good) }), prodEnv, { fetchImpl }), { email: 'hr@vbridgeit.com' });
  const outsider = await authenticate(req({ 'Cf-Access-Jwt-Assertion': await sign({ ...good, email: 'someone@gmail.com' }) }), prodEnv, { fetchImpl });
  assert.equal(outsider.status, 403);
  assert.equal((await authenticate(req(), prodEnv, { fetchImpl })).status, 401);
});

test('the local sign-in shortcut only works on localhost', async () => {
  const env = { ...prodEnv, DEV_USER_EMAIL: 'hr@vbridgeit.com' };
  assert.deepEqual(await authenticate(new Request('http://localhost:8790/employees'), env, { fetchImpl }), { email: 'hr@vbridgeit.com' });
  const remote = await authenticate(new Request('https://hirebridge.pages.dev/employees'), env, { fetchImpl });
  assert.equal(remote.status, 401);
});

test('missing settings are reported, and an empty allow-list closes the app', () => {
  const url = new URL('https://hirebridge.pages.dev/');
  assert.deepEqual(missingConfig(prodEnv, url), []);
  assert.deepEqual(missingConfig({}, url), ['DB (D1 database binding)', 'HR_EMAILS (list of HR emails)']);
});

test('Worker-level Access identity (ctx.access) is used when present', async () => {
  const env = { DB: {}, ALLOWED_EMAILS: 'hr@vbridgeit.com' };
  const access = (email, aud = 'worker-aud') => ({ aud, getIdentity: async () => ({ email }) });
  const req = new Request('https://hirebridge.example.workers.dev/employees');
  assert.deepEqual(await authenticate(req, env, { access: access('HR@vbridgeit.com') }), { email: 'hr@vbridgeit.com' });
  assert.equal((await authenticate(req, env, { access: access('x@gmail.com') })).status, 403);
  assert.equal((await authenticate(req, { ...env, ACCESS_AUD: 'other' }, { access: access('hr@vbridgeit.com') })).status, 401);
  assert.equal((await authenticate(req, env, { access: { aud: 'a', getIdentity: async () => ({}) } })).status, 401);
  // No ctx.access, no token: refused. A token without Access settings: refused.
  assert.equal((await authenticate(req, env, {})).status, 401);
  const withToken = new Request(req.url, { headers: { 'Cf-Access-Jwt-Assertion': await sign(good) } });
  assert.equal((await authenticate(withToken, env, { fetchImpl })).status, 401);
});

test('HR_EMAILS from the config and ALLOWED_EMAILS secret are combined', async () => {
  const access = (email) => ({ aud: 'a', getIdentity: async () => ({ email }) });
  const req = new Request('https://hirebridge.example.workers.dev/');
  const env = { DB: {}, HR_EMAILS: 'hr@vbridgeit.com', ALLOWED_EMAILS: 'ravitej@vbridgeit.com' };
  assert.equal((await authenticate(req, env, { access: access('hr@vbridgeit.com') })).email, 'hr@vbridgeit.com');
  assert.equal((await authenticate(req, env, { access: access('ravitej@vbridgeit.com') })).email, 'ravitej@vbridgeit.com');
  assert.equal((await authenticate(req, env, { access: access('recruiter@vbridgeit.com') })).status, 403);
});
