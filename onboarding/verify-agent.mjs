#!/usr/bin/env node
// Read-only: check an asset's Agent Identity registration and print its Asset Signer PDA.
import { NETWORKS, DEFAULT_NETWORK, assertBase58Wallet } from './metaplex-agent.mjs';

async function loadSdk() {
  const reg = await import('@metaplex-foundation/mpl-agent-registry');
  const core = await import('@metaplex-foundation/mpl-core');
  const umiLib = await import('@metaplex-foundation/umi');
  const { createUmi } = await import('@metaplex-foundation/umi-bundle-defaults');
  return { createUmi, publicKey: umiLib.publicKey, mplAgentIdentity: reg.mplAgentIdentity, mplCore: core.mplCore,
    safeFetchAgentIdentityV1: reg.safeFetchAgentIdentityV1, findAgentIdentityV1Pda: reg.findAgentIdentityV1Pda,
    fetchAsset: core.fetchAsset, findAssetSignerPda: core.findAssetSignerPda };
}

export async function verifyAgent({ asset, network = DEFAULT_NETWORK }, sdk) {
  assertBase58Wallet(asset);
  if (!NETWORKS[network]) throw new Error('unsupported network');
  sdk ??= await loadSdk();
  let umi = sdk.createUmi(NETWORKS[network]);
  for (const p of [sdk.mplAgentIdentity, sdk.mplCore]) if (p) umi = umi.use(p());
  const pk = sdk.publicKey ? sdk.publicKey(asset) : asset;
  const pda = sdk.findAgentIdentityV1Pda ? sdk.findAgentIdentityV1Pda(umi, { asset: pk }) : pk;
  const identity = await sdk.safeFetchAgentIdentityV1(umi, pda);
  const a = await sdk.fetchAsset(umi, pk);
  const signer = sdk.findAssetSignerPda(umi, { asset: pk });
  return { asset, network, registered: Boolean(identity), agentIdentities: a?.agentIdentities ?? null,
    owner: a?.owner ? String(a.owner) : null, assetSignerPda: String(Array.isArray(signer) ? signer[0] : signer) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2); const get = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  try { console.log(JSON.stringify(await verifyAgent({ asset: get('--asset'), network: get('--network') ?? DEFAULT_NETWORK }), null, 2)); }
  catch (e) { console.error(e.message); process.exit(1); }
}
