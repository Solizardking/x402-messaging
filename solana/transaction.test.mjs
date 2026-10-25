import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildMailTransaction } from './transaction.mjs';
import { buildEnvelope } from './envelope.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/mail.json', import.meta.url), 'utf8'));

test('builder output is byte-identical to @solana/web3.js for the fixture', () => {
  const envelope = buildEnvelope({ ...fixture.envelope });
  const built = buildMailTransaction({
    fromWallet: fixture.from,
    toWallet: fixture.to,
    envelope,
    recentBlockhash: fixture.blockhash,
  });
  assert.equal(built.transactionBase64, fixture.singleTxBase64);
  assert.equal(built.messageId, fixture.envelope.id);
  assert.equal(built.lamports, 0);
});

test('builder rejects malformed inputs', () => {
  const envelope = buildEnvelope({ id: 'x', from: 'a', to: 'b', kind: 'request', content: 'hi' });
  assert.throws(() => buildMailTransaction({ fromWallet: 'nope', toWallet: fixture.to, envelope, recentBlockhash: fixture.blockhash }), /base58/);
  assert.throws(() => buildMailTransaction({ fromWallet: fixture.from, toWallet: fixture.to, envelope, recentBlockhash: 'nope' }), /blockhash/);
});
