import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { X402mClient } from './client.mjs';
import * as A from './auth.mjs';
const V = JSON.parse(readFileSync(new URL('../spec/v0.1/vectors/x402m-conformance.json', import.meta.url)));

test('conformance: CAIP-2/10/19', () => {
  for (const s of V.caip2.valid) assert.ok(A.isCaip2(s), s);
  for (const s of V.caip2.invalid) assert.ok(!A.isCaip2(s), s);
  for (const v of V.caip10.valid) assert.deepEqual(A.parseCaip10(v.id), { network: v.network, address: v.address });
  for (const s of V.caip10.invalid) assert.throws(() => A.parseCaip10(s));
  for (const v of V.caip19.valid) { const { id, ...rest } = v; assert.deepEqual(A.parseCaip19(id), rest); }
  for (const s of V.caip19.invalid) assert.throws(() => A.parseCaip19(s));
  assert.equal(A.keyFamilyForNetwork('eip155:1'), 'ES256K');
  assert.equal(A.keyFamilyForNetwork('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'), 'EdDSA');
});

test('conformance: messaging-only capabilities', () => {
  A.assertMessagingCapabilities(V.capabilities.messaging);
  for (const c of V.capabilities.rejected) assert.throws(() => A.assertMessagingCapabilities([c]));
});

test('conformance: auth profile selection', () => {
  for (const v of V.profileSelection) {
    if (v.expect === null) assert.throws(() => A.selectAuthProfile(v.descriptor, A.TOKEN_PROFILES, v.alg));
    else assert.equal(A.selectAuthProfile(v.descriptor, A.TOKEN_PROFILES, v.alg).id, v.expect);
  }
});

test('conformance: no messaging request authorizes a payment', () => {
  for (const v of V.paymentBoundary) {
    if (v.allowed) assert.ok(A.assertNotPaymentAuthorization(v.request));
    else assert.throws(() => A.assertNotPaymentAuthorization(v.request), /payment authorization/);
  }
});

test('conformance: agent-jwt EdDSA + ES256K tokens', () => {
  for (const v of V.agentJwt) {
    const opts = { publicJwk: v.publicJwk, pinnedAlg: v.pinnedAlg ?? v.alg, url: v.url, body: v.body, now: v.now };
    if (v.valid) assert.equal(A.verifyAgentJwt(v.token, opts).alg, v.alg, v.name);
    else assert.throws(() => A.verifyAgentJwt(v.token, opts), new RegExp(v.error), v.name);
  }
});

test('jti replay rejected', () => {
  const v = V.agentJwt.find((x) => x.valid);
  const seen = new Set();
  A.verifyAgentJwt(v.token, { publicJwk: v.publicJwk, url: v.url, body: v.body, now: v.now, seen });
  assert.throws(() => A.verifyAgentJwt(v.token, { publicJwk: v.publicJwk, url: v.url, body: v.body, now: v.now, seen }), /replay/);
});

for (const [alg, type, opts] of [['EdDSA', 'ed25519', {}], ['ES256K', 'ec', { namedCurve: 'secp256k1' }]]) {
  test(`client signs ${alg} tokens and refuses payment capabilities`, async () => {
    const { privateKey, publicKey } = generateKeyPairSync(type, opts);
    const publicJwk = publicKey.export({ format: 'jwk' });
    const seen = new Set();
    const client = new X402mClient({ agentId: 'a', privateKey, fetchImpl: async (url, init) => {
      const r = A.verifyAgentJwt(init.headers.authorization.slice(7), { publicJwk, pinnedAlg: alg, url, body: init.body, seen });
      assert.equal(r.alg, alg);
      return new Response(JSON.stringify({ data: { ok: true } }), { status: 200 });
    } });
    assert.deepEqual(await client.execute('x402m.inbox'), { ok: true });
    await client.execute('x402m.inbox');
    assert.equal(seen.size, 2);
    await assert.rejects(client.execute('x402.pay'), /cannot carry/);
    await assert.rejects(client.execute('x402m.send', { paymentPayload: {} }), /payment authorization/);
  });
}
