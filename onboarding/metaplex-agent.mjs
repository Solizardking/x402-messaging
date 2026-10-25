#!/usr/bin/env node
// Prepare (never sign, never send) a Metaplex agent mint for a musebot install.
// Calls mintAgent only: returns an UNSIGNED transaction the owner signs in their own wallet.
import { writeFile } from 'node:fs/promises';

export const NETWORKS = { 'solana-devnet': 'https://api.devnet.solana.com', 'solana-mainnet': 'https://api.mainnet-beta.solana.com' };
export const DEFAULT_NETWORK = 'solana-devnet';
export const AGENT_REGISTRY = '1DREGFgysWYxLnRnKQnwrxnJQeSMk2HmGaC6whw2B2p';
export const MPL_CORE = 'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d';
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function assertBase58Wallet(w) {
  if (typeof w !== 'string' || !B58.test(w)) throw new Error(`wallet must be a base58 Solana address, got: ${w}`);
  return w;
}

export function parseArgs(argv) {
  const o = { network: DEFAULT_NETWORK, out: 'musebot-agent-mint.tx.b64' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = argv[i + 1];
    if (k === '--network') { o.network = v; i++; }
    else if (k === '--wallet') { o.wallet = v; i++; }
    else if (k === '--name') { o.name = v; i++; }
    else if (k === '--uri') { o.uri = v; i++; }
    else if (k === '--out') { o.out = v; i++; }
  }
  if (!NETWORKS[o.network]) throw new Error(`network must be solana-devnet or solana-mainnet (explicit --network solana-mainnet)`);
  return o;
}

export function buildRegistration({ name = 'musebot', description = 'A musebot agent install', image, agentId } = {}) {
  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name, description, ...(image ? { image } : {}),
    services: [
      { name: 'web', endpoint: 'https://musebook.trade/x402m' },
      { name: 'A2A', endpoint: 'https://musebook.trade/x402m/.well-known/agent-card.json', version: '0.3.0' },
      { name: 'MCP', endpoint: 'https://mcp.reasonmachines.com/mcp' },
      { name: 'x402m-discovery', endpoint: 'https://musebook.trade/api/x402m/discovery' },
    ],
    active: true,
    registrations: agentId ? [{ agentId, agentRegistry: 'solana:101:metaplex' }] : [],
    supportedTrust: ['reputation'],
  };
}

async function loadSdk() {
  const reg = await import('@metaplex-foundation/mpl-agent-registry');
  const { createUmi } = await import('@metaplex-foundation/umi-bundle-defaults');
  return { mintAgent: reg.mintAgent, mplAgentIdentity: reg.mplAgentIdentity, createUmi };
}

// sdk is injectable for tests. Only mintAgent is ever used.
export async function prepareMint(opts, sdk) {
  const { network, wallet, name = 'musebot', uri } = opts;
  if (!NETWORKS[network]) throw new Error('unsupported network');
  assertBase58Wallet(wallet);
  if (!uri || !/^https:\/\//.test(uri)) throw new Error('--uri must be a public https URL to the Core asset metadata JSON');
  sdk ??= await loadSdk();
  let umi = sdk.createUmi(NETWORKS[network]);
  if (sdk.mplAgentIdentity) umi = umi.use(sdk.mplAgentIdentity());
  const agentMetadata = buildRegistration({ name });
  const res = await sdk.mintAgent(umi, {}, { wallet, network, name, uri, agentMetadata });
  const tx = res.transaction;
  const bytes = tx instanceof Uint8Array ? tx : umi.transactions?.serialize ? umi.transactions.serialize(tx) : tx;
  return { network, assetAddress: String(res.assetAddress), transactionBase64: Buffer.from(bytes).toString('base64'), agentMetadata, signed: false };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const o = parseArgs(process.argv.slice(2));
    const r = await prepareMint(o);
    await writeFile(o.out, r.transactionBase64 + '\n');
    console.log(JSON.stringify({ network: r.network, assetAddress: r.assetAddress, unsignedTransaction: o.out, signed: false }, null, 2));
    console.log(`\nUNSIGNED. Review, then sign and send it yourself in Phantom or OWS. Cost: SOL network fee + rent for the Core asset and Agent Identity PDA.`);
    if (r.network === 'solana-mainnet') console.log('WARNING: mainnet — real SOL will be spent when you sign.');
  } catch (e) { console.error(e.message); process.exit(1); }
}
