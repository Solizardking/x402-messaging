import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEnvelope, encodeEnvelopeToMemos, MemoAssembler, utf8Length, MEMO_MAX_BYTES,
} from './envelope.mjs';

const WALLET = 'GmaDrppBC7P5ARKV8g3djiwP89vz1jLK23V2GBjuAEGB';

test('buildEnvelope validates like the mailbox contract', () => {
  assert.throws(() => buildEnvelope({ id: 'x', from: 'a', to: 'b', kind: 'nope', content: 'hi' }), /kind/);
  assert.throws(() => buildEnvelope({ id: 'x', from: 'a', to: 'b', kind: 'request', content: '' }), /content/);
  assert.throws(() => buildEnvelope({ id: 'x', from: 'a', to: 'b', kind: 'request', content: 'x'.repeat(8001) }), /content/);
  const env = buildEnvelope({ id: 'r1', from: 'a', to: 'b', kind: 'payment.request', content: 'pay?', pay: { asset: 'USDC', amount: '250000', payTo: WALLET } });
  assert.equal(env.pay.amount, '250000');
  assert.throws(() => buildEnvelope({ id: 'r1', from: 'a', to: 'b', kind: 'payment.request', content: 'pay?', pay: { asset: 'USDC' } }), /pay requires/);
});

test('short envelopes fit one memo and round-trip', () => {
  const env = buildEnvelope({ id: 'req-1', from: 'alice', to: 'bob', kind: 'request', content: 'hello', ts: 1 });
  const memos = encodeEnvelopeToMemos(env);
  assert.equal(memos.length, 1);
  assert.ok(memos[0].startsWith('x402m/1 '));
  const assembler = new MemoAssembler();
  assert.deepEqual(assembler.feed(WALLET, memos[0]), env);
  assert.equal(assembler.feed(WALLET, memos[0]), null, 'duplicate delivery is suppressed');
});

test('long content chunks under the memo limit and reassembles out of order', () => {
  const content = 'déjà vu — '.repeat(400) + 'end'; // multi-byte chars, > 4 KB
  const env = buildEnvelope({ id: 'big-1', from: 'alice', to: 'bob', kind: 'event', content, ts: 2 });
  const memos = encodeEnvelopeToMemos(env);
  assert.ok(memos.length > 4);
  for (const memo of memos) assert.ok(utf8Length(memo) <= MEMO_MAX_BYTES, `memo too long: ${utf8Length(memo)}`);
  const assembler = new MemoAssembler();
  let result = null;
  for (const memo of [...memos].reverse()) {
    const out = assembler.feed(WALLET, memo);
    if (out) result = out;
  }
  assert.deepEqual(result, env);
});

test('non-x402m and malformed memos are ignored', () => {
  const assembler = new MemoAssembler();
  assert.equal(assembler.feed(WALLET, 'a random memo'), null);
  assert.equal(assembler.feed(WALLET, 'x402m/1 {not json'), null);
  assert.equal(assembler.feed(WALLET, 'x402m/1 {"v":2,"id":"x","from":"a","to":"b","kind":"request","content":"hi"}'), null);
  assert.equal(assembler.feed(WALLET, 42), null);
});
