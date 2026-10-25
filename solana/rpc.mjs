// Minimal read-only Solana JSON-RPC client (fetch based, injectable for
// tests). Read-only by construction: it exposes no method that can submit
// a transaction. Signed mail transactions are submitted by the owner's
// wallet or facilitator, never by this library.
export class SolanaRpc {
  constructor(url, { fetchImpl = globalThis.fetch, commitment = 'confirmed' } = {}) {
    if (typeof url !== 'string' || !url.startsWith('http')) throw new Error('rpc url required');
    if (typeof fetchImpl !== 'function') throw new Error('no fetch implementation available');
    this.url = url;
    this.fetchImpl = fetchImpl;
    this.commitment = commitment;
    this.sequence = 0;
  }

  async call(method, params) {
    const response = await this.fetchImpl(this.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++this.sequence, method, params }),
    });
    if (!response.ok) throw new Error(`rpc ${method} failed: HTTP ${response.status}`);
    const body = await response.json();
    if (body.error) throw new Error(`rpc ${method} failed: ${body.error.message ?? JSON.stringify(body.error)}`);
    return body.result;
  }

  getLatestBlockhash() {
    return this.call('getLatestBlockhash', [{ commitment: this.commitment }]);
  }

  getSignaturesForAddress(address, { limit = 50, before, until } = {}) {
    const options = { limit, commitment: this.commitment };
    if (before) options.before = before;
    if (until) options.until = until;
    return this.call('getSignaturesForAddress', [address, options]);
  }

  // encoding "json" (not jsonParsed): memo instructions come back with
  // base58 data we decode ourselves, identical across RPC providers.
  getTransaction(signature) {
    return this.call('getTransaction', [signature, {
      encoding: 'json', commitment: this.commitment, maxSupportedTransactionVersion: 0,
    }]);
  }
}

export const DEVNET_RPC = 'https://api.devnet.solana.com';
export const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
