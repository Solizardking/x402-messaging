import { test } from 'node:test';
import assert from 'node:assert/strict';
import { base58Encode, base58Decode, isValidPublicKey } from './base58.mjs';

test('known vectors', () => {
  assert.equal(base58Encode(new TextEncoder().encode('hello world')), 'StV1DL6CwTryKyV');
  assert.equal(base58Encode(new Uint8Array(32)), '11111111111111111111111111111111');
  assert.deepEqual([...base58Decode('StV1DL6CwTryKyV')], [...new TextEncoder().encode('hello world')]);
  assert.equal(base58Encode(new Uint8Array(0)), '');
});

test('round-trips arbitrary bytes including leading zeros', () => {
  const bytes = new Uint8Array([0, 0, 1, 2, 3, 250, 251, 0, 99]);
  assert.deepEqual([...base58Decode(base58Encode(bytes))], [...bytes]);
});

test('validates Solana public keys', () => {
  assert.ok(isValidPublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'));
  assert.ok(isValidPublicKey('11111111111111111111111111111111'));
  assert.ok(!isValidPublicKey('not-a-key'));
  assert.ok(!isValidPublicKey('StV1DL6CwTryKyV')); // 11 bytes, not 32
  assert.throws(() => base58Decode('0OIl'), /invalid base58/);
});
