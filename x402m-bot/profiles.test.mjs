import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { isProfile, parseProfile, checkContentProfile, checkOfferQuote, advertisedProfiles, UnsupportedProfileError } from './profiles.mjs';
import { validateX402mInput } from './schema.mjs';
import { X402mClient } from './client.mjs';
import { descriptor, dispatchX402m } from '../cloudflare/x402m.mjs';
const V = JSON.parse(readFileSync(new URL('../spec/v0.1/vectors/x402m-conformance.json', import.meta.url))).contentProfiles;
test('profile format vectors', () => {
  for (const p of V.format.valid) assert.ok(isProfile(p), p);
  for (const p of V.format.invalid) assert.ok(!isProfile(p), p);
  assert.deepEqual(parseProfile('x402m.offer/v1'), { name: 'x402m.offer', major: 1 });
});
test('negotiation vectors (unsupported version)', () => {
  for (const v of V.negotiation) assert.deepEqual(checkContentProfile(v.profile, v.supported), v.expect, v.name);
});
test('offer quote vectors (expired quote, unit mismatch)', () => {
  for (const v of V.offerQuote) assert.deepEqual(checkOfferQuote(v.quote, { now: v.now, unit: v.unit }), v.expect, v.name);
});
test('send schema accepts optional contentProfile', () => {
  validateX402mInput('x402m.send', { to: 'a', requestId: 'r', kind: 'request', content: 'x', contentProfile: 'x402m.offer/v1' });
  assert.throws(() => validateX402mInput('x402m.send', { to: 'a', requestId: 'r', kind: 'request', content: 'x', contentProfile: 'offer' }), /contentProfile/);
});
test('musebook descriptor advertises contentProfiles and server rejects unsupported', async () => {
  assert.deepEqual(descriptor().contentProfiles, []);
  const env = { DB: { prepare: () => ({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }), first: async () => null }) }) } };
  const claims = btoa(JSON.stringify({ sub: 'a1', jti: 'j', exp: 2e9 }));
  const endpointCtx = { headers: new Headers({ authorization: `Bearer h.${claims}.s` }) };
  await assert.rejects(dispatchX402m(env, { capability: 'x402m.send', args: { to: '@b', requestId: 'r', kind: 'request', content: 'x', contentProfile: 'x402m.offer/v1' }, agentSession: { agent: { id: 'a1' } }, endpointCtx }),
    (e) => e.code === 'unsupported_profile' && Array.isArray(e.supported));
});
function fakeFetch(disc, posts) {
  return async (url, init = {}) => {
    if (init.method === 'POST') { posts.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ data: { ok: true } }) }; }
    return { ok: true, json: async () => disc };
  };
}
const { privateKey } = generateKeyPairSync('ed25519');
const send = { to: '@peer', requestId: 'r1', kind: 'request', content: 'hi', contentProfile: 'x402m.offer/v1' };
test('client never sends contentProfile to musebook.trade unless advertised', async () => {
  const posts = [];
  const c = new X402mClient({ agentId: 'a', privateKey, fetchImpl: fakeFetch(descriptor(), posts) });
  await assert.rejects(c.execute('x402m.send', send), (e) => e instanceof UnsupportedProfileError && e.code === 'unsupported_profile' && e.supported.length === 0);
  assert.equal(posts.length, 0);
  const legacy = []; // live descriptor without the field at all
  await assert.rejects(new X402mClient({ agentId: 'a', privateKey, fetchImpl: fakeFetch({ protocol: 'x402m/1' }, legacy) }).execute('x402m.send', send), /unsupported_profile/);
  assert.equal(legacy.length, 0);
});
test('client sends contentProfile when the service advertises it', async () => {
  const posts = [];
  const c = new X402mClient({ agentId: 'a', privateKey, fetchImpl: fakeFetch({ contentProfiles: ['x402m.offer/v1'] }, posts) });
  await c.execute('x402m.send', send);
  assert.equal(posts[0].arguments.contentProfile, 'x402m.offer/v1');
  assert.deepEqual(advertisedProfiles({ contentProfiles: ['ok/v1', 'bad'] }), ['ok/v1']);
});
