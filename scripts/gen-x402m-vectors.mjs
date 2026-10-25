// Regenerates spec/v0.1/vectors/x402m-conformance.json with EPHEMERAL keys.
// Only public JWKs are written; private keys are discarded.
import { generateKeyPairSync, createPrivateKey } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { signAgentJwt } from '../x402m-bot/auth.mjs';
const url = 'https://musebook.trade/api/auth/capability/execute';
const body = JSON.stringify({ capability: 'x402m.send', arguments: { to: '@peer', requestId: 'r1', kind: 'request', content: 'hi' } });
const now = 1790000000;
const tokens = [];
for (const [alg, type, opts] of [['EdDSA', 'ed25519', {}], ['ES256K', 'ec', { namedCurve: 'secp256k1' }]]) {
  const { privateKey, publicKey } = generateKeyPairSync(type, opts);
  const token = signAgentJwt({ privateKey, agentId: `agent-${alg}`, url, body, capability: 'x402m.send', now, jti: `vec-${alg}` });
  const publicJwk = publicKey.export({ format: 'jwk' });
  const [h, c, s] = token.split('.');
  tokens.push({ name: `${alg} valid`, alg, publicJwk, token, url, body, now: now + 1, valid: true });
  tokens.push({ name: `${alg} tampered body`, alg, publicJwk, token, url, body: body.replace('hi', 'yo'), now: now + 1, valid: false, error: 'body hash mismatch' });
  tokens.push({ name: `${alg} expired`, alg, publicJwk, token, url, body, now: now + 61, valid: false, error: 'expired' });
  tokens.push({ name: `${alg} wrong audience`, alg, publicJwk, token, url: url.replace('musebook.trade', 'evil.example'), body, now: now + 1, valid: false, error: 'audience' });
  tokens.push({ name: `${alg} pinned to other algorithm`, alg, pinnedAlg: alg === 'EdDSA' ? 'ES256K' : 'EdDSA', publicJwk, token, url, body, now: now + 1, valid: false, error: 'pinned' });
  tokens.push({ name: `${alg} bad signature`, alg, publicJwk, token: `${h}.${c}.${s.slice(0, -4)}AAAA`, url, body, now: now + 1, valid: false, error: 'signature' });
}
const vectors = {
  version: 'x402m/1', generated: 'scripts/gen-x402m-vectors.mjs', note: 'Public keys only. Tokens are signed by discarded ephemeral keys.',
  caip2: { valid: ['eip155:1', 'eip155:8453', 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', 'bip122:000000000019d6689c085ae165831e93'], invalid: ['eip155', 'EIP155:1', 'ab:1', 'eip155:', 'solana:' + 'x'.repeat(33)] },
  caip10: { valid: [{ id: 'eip155:8453:0xab16a96D359eC26a11e2C2b3d8f8B8942d5Bfcdb', network: 'eip155:8453', address: '0xab16a96D359eC26a11e2C2b3d8f8B8942d5Bfcdb' }, { id: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:7S3P4HxJpyyigGzodYwHtCxZyUQe9JiBMHyRWXArAaKv', network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', address: '7S3P4HxJpyyigGzodYwHtCxZyUQe9JiBMHyRWXArAaKv' }], invalid: ['eip155:1', '0xab16a96D359eC26a11e2C2b3d8f8B8942d5Bfcdb', 'eip155:1:'] },
  caip19: { valid: [{ id: 'eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', network: 'eip155:8453', assetNamespace: 'erc20', assetReference: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' }, { id: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/token:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', assetNamespace: 'token', assetReference: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' }], invalid: ['eip155:8453', 'eip155:8453/erc20', 'eip155:8453:erc20:0x1'] },
  capabilities: { messaging: ['x402m.register', 'x402m.send', 'x402m.inbox', 'x402m.ack', 'x402m.link'], rejected: ['x402.pay', 'payment.settle', 'facilitator.settle', 'x402m.send;x402.pay', ''] },
  profileSelection: [
    { descriptor: { authProfiles: [{ id: 'reason-network', status: 'experimental' }, { id: 'agent-jwt', algorithms: ['EdDSA', 'ES256K'] }] }, alg: 'ES256K', expect: 'agent-jwt' },
    { descriptor: { authProfiles: [{ id: 'better-auth-agent-auth', configuration: 'https://musebook.trade/api/auth/agent-configuration' }, { id: 'agent-jwt', algorithms: ['EdDSA', 'ES256K'] }] }, alg: 'EdDSA', expect: 'better-auth-agent-auth' },
    { descriptor: { authProfiles: [{ id: 'better-auth-agent-auth', configuration: 'https://musebook.trade/api/auth/agent-configuration' }, { id: 'agent-jwt', algorithms: ['EdDSA', 'ES256K'] }] }, alg: 'ES256K', expect: 'agent-jwt' },
    { descriptor: { authProfiles: [{ id: 'reason-network', status: 'experimental' }] }, alg: 'EdDSA', expect: null },
  ],
  paymentBoundary: [
    { request: { headers: { 'X-PAYMENT': 'x' }, body: { arguments: {} } }, allowed: false },
    { request: { headers: { 'PAYMENT-SIGNATURE': 'x' }, body: { arguments: {} } }, allowed: false },
    { request: { headers: {}, body: { arguments: { paymentPayload: {} } } }, allowed: false },
    { request: { headers: {}, body: { arguments: { kind: 'payment.request', content: 'quote', to: '@peer' } } }, allowed: true },
  ],
  agentJwt: tokens,
};
writeFileSync(new URL('../spec/v0.1/vectors/x402m-conformance.json', import.meta.url), JSON.stringify(vectors, null, 2) + '\n');
