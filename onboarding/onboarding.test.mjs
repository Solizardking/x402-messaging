import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { parseArgs, prepareMint, buildRegistration, DEFAULT_NETWORK } from './metaplex-agent.mjs';
import { verifyAgent } from './verify-agent.mjs';

const W = 'MECHjj31U1hBapoVeJtZo5U5WGRd2293JEwRErvPTuF';
const umi = { use() { return this; } };
function mockSdk(calls = []) {
  return { createUmi: (u) => (calls.push(['rpc', u]), umi), mplAgentIdentity: () => ({}),
    mintAgent: async (_u, _c, input) => (calls.push(['mintAgent', input]), { transaction: new Uint8Array([1, 2, 3]), assetAddress: W }),
    mintAndSubmitAgent: () => { throw new Error('must not be called'); },
    signAndSend: () => { throw new Error('must not be called'); } };
}

test('devnet is the default; mainnet needs explicit flag', () => {
  assert.equal(DEFAULT_NETWORK, 'solana-devnet');
  assert.equal(parseArgs([]).network, 'solana-devnet');
  assert.equal(parseArgs(['--network', 'solana-mainnet']).network, 'solana-mainnet');
  assert.throws(() => parseArgs(['--network', 'mainnet']));
});

test('prepareMint uses mintAgent only and returns unsigned base64', async () => {
  const calls = [];
  const r = await prepareMint({ network: 'solana-devnet', wallet: W, uri: 'https://x.test/m.json' }, mockSdk(calls));
  assert.equal(r.signed, false);
  assert.equal(r.transactionBase64, 'AQID');
  assert.equal(calls[0][1], 'https://api.devnet.solana.com');
  assert.equal(calls[1][1].network, 'solana-devnet');
});

test('rejects non-base58 wallet', async () => {
  await assert.rejects(prepareMint({ network: 'solana-devnet', wallet: '0xabc0OIl', uri: 'https://x' }, mockSdk()), /base58/);
});

test('no signing path in source', async () => {
  for (const f of ['metaplex-agent.mjs', 'verify-agent.mjs']) {
    const s = (await readFile(new URL(f, import.meta.url), 'utf8')).replace(/^\s*\/\/.*$/gm, '');
    for (const bad of ['mintAndSubmitAgent', 'signAndSend', 'keypairIdentity', 'createSignerFromKeypair', 'secretKey', 'sendTransaction'])
      assert.ok(!s.includes(bad), `${f} contains ${bad}`);
  }
});

test('registration doc is ERC-8004 with required services', () => {
  const d = buildRegistration({ agentId: W });
  assert.equal(d.type, 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1');
  const eps = d.services.map((s) => s.endpoint);
  for (const e of ['https://musebook.trade/x402m', 'https://mcp.reasonmachines.com/mcp', 'https://musebook.trade/api/x402m/discovery']) assert.ok(eps.includes(e));
  assert.ok(d.services.some((s) => s.name === 'A2A'));
  assert.equal(d.registrations[0].agentRegistry, 'solana:101:metaplex');
});

test('verifyAgent is read-only and prints signer PDA', async () => {
  const r = await verifyAgent({ asset: W }, { createUmi: () => umi,
    safeFetchAgentIdentityV1: async () => ({ asset: W }), fetchAsset: async () => ({ owner: W, agentIdentities: [{}] }),
    findAssetSignerPda: () => ['SignerPda111111111111111111111111111111111', 255] });
  assert.equal(r.registered, true);
  assert.equal(r.assetSignerPda, 'SignerPda111111111111111111111111111111111');
  await assert.rejects(verifyAgent({ asset: 'not-base58!' }, {}), /base58/);
});

test('install.sh is safe and works with mocked network', async () => {
  const s = await readFile(new URL('install.sh', import.meta.url), 'utf8');
  for (const bad of ['solana-keygen', 'reasonmachines.com/install', '| sh', '| bash', 'register', 'POST']) {
    const code = s.split('\n').filter((l) => !/^\s*(#|echo|[0-9]\.|   )/.test(l) && !l.includes('NEXT')).join('\n');
    assert.ok(!code.includes(bad), `install.sh contains ${bad}`);
  }
  const out = execFileSync('bash', [new URL('install.sh', import.meta.url).pathname], { env: { ...process.env,
    REASON_BRIDGE_DIR: '/nonexistent', X402M_DISCOVERY_URL: 'file:///dev/null' }, encoding: 'utf8' });
  assert.match(out, /reasonmachines\.com\/network/);
});
