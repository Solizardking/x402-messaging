import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseMailTransaction, fetchOnchainInbox, fetchOnchainOutbox } from './inbox.mjs';
import { buildEnvelope, encodeEnvelopeToMemos } from './envelope.mjs';
import { base58Encode } from './base58.mjs';
import { SYSTEM_PROGRAM, MEMO_PROGRAM } from './transaction.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/mail.json', import.meta.url), 'utf8'));

function fakeRpc(txsBySignature, signatures) {
  return {
    async getSignaturesForAddress() { return signatures; },
    async getTransaction(sig) { return txsBySignature[sig] ?? null; },
  };
}

test('parses the web3.js-built fixture transaction', () => {
  const parsed = parseMailTransaction(fixture.rpcTx);
  assert.equal(parsed.senderWallet, fixture.from);
  assert.equal(parsed.recipientWallet, fixture.to);
  assert.equal(parsed.memos.length, 1);
  assert.ok(parsed.memos[0].startsWith('x402m/1 '));
});

test('inbox returns mailbox-shaped messages for the recipient', async () => {
  const rpc = fakeRpc({ [fixture.signature]: fixture.rpcTx }, [{ signature: fixture.signature, err: null }]);
  const { messages, scanned } = await fetchOnchainInbox(rpc, fixture.to);
  assert.equal(scanned, 1);
  assert.equal(messages.length, 1);
  const [msg] = messages;
  assert.equal(msg.id, 'req-0001');
  assert.equal(msg.sender, 'agent-alice');
  assert.equal(msg.senderWallet, fixture.from);
  assert.equal(msg.recipientWallet, fixture.to);
  assert.equal(msg.kind, 'request');
  assert.equal(msg.content, 'Does the billing webhook retry on 5xx?');
  assert.equal(msg.transport, 'solana-memo');
  assert.equal(msg.signature, fixture.signature);
});

test('inbox is empty for a third party; outbox finds the sent message', async () => {
  const rpc = fakeRpc({ [fixture.signature]: fixture.rpcTx }, [{ signature: fixture.signature, err: null }]);
  assert.equal((await fetchOnchainInbox(rpc, fixture.from)).messages.length, 0);
  assert.equal((await fetchOnchainOutbox(rpc, fixture.from)).messages.length, 1);
});

function rpcTxFor(memos, signature) {
  const transferData = new Uint8Array(12);
  new DataView(transferData.buffer).setUint32(0, 2, true);
  return {
    slot: 1, blockTime: 1,
    meta: { loadedAddresses: { writable: [], readonly: [] } },
    transaction: {
      signatures: [signature],
      message: {
        accountKeys: [fixture.from, fixture.to, SYSTEM_PROGRAM, MEMO_PROGRAM],
        header: { numRequiredSignatures: 1, numReadonlySignedAccounts: 0, numReadonlyUnsignedAccounts: 2 },
        recentBlockhash: fixture.blockhash,
        instructions: [
          { programIdIndex: 2, accounts: [0, 1], data: base58Encode(transferData) },
          ...memos.map((memo) => ({ programIdIndex: 3, accounts: [], data: base58Encode(new TextEncoder().encode(memo)) })),
        ],
      },
    },
    version: 'legacy',
  };
}

test('a chunked message split across two transactions reassembles', async () => {
  const env = buildEnvelope({ id: 'split-1', from: 'alice', to: 'bob', kind: 'event', content: 'z'.repeat(1200), ts: 7 });
  const memos = encodeEnvelopeToMemos(env);
  assert.ok(memos.length >= 3);
  const half = Math.ceil(memos.length / 2);
  const txA = rpcTxFor(memos.slice(0, half), 'sigA');
  const txB = rpcTxFor(memos.slice(half), 'sigB');
  const rpc = fakeRpc({ sigA: txA, sigB: txB }, [{ signature: 'sigB', err: null }, { signature: 'sigA', err: null }]);
  const { messages } = await fetchOnchainInbox(rpc, fixture.to);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].content, env.content);
});
