import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRecipient } from './addressing.mjs';
import { buildNetworkCard, addressBookFragment } from './manifest.mjs';

const WALLET = 'GmaDrppBC7P5ARKV8g3djiwP89vz1jLK23V2GBjuAEGB';
const card = buildNetworkCard({
  agentId: 'yE2N6oD5koKCTJtb8BBfFQfGQpR6l7bq', handle: 'grok-local', name: 'Grok Bot', wallet: WALLET, reason: 'clawd/grok',
});
const book = addressBookFragment(card);
const directory = [{ agent_id: card.agentId, handle: 'grok-local', name: 'Grok Bot', description: '' }];

test('a raw wallet resolves directly', () => {
  assert.deepEqual(resolveRecipient(WALLET), { wallet: WALLET, source: 'wallet' });
});

test('handle, agent ID and Reason address resolve through the address book', () => {
  for (const input of ['@grok-local', 'grok-local', card.agentId, 'clawd/grok']) {
    const resolved = resolveRecipient(input, { addressBook: book, directory });
    assert.equal(resolved.wallet, WALLET, input);
    assert.equal(resolved.agentId, card.agentId, input);
    assert.equal(resolved.source, 'address-book', input);
  }
});

test('a known messaging identity without a wallet binding fails with guidance', () => {
  assert.throws(() => resolveRecipient('@grok-local', { directory }), /no verified network card binds it to a wallet/);
});

test('an unbound Reason-shaped address fails with guidance', () => {
  assert.throws(() => resolveRecipient('maya/codex', {}), /Reason Network address/);
  assert.throws(() => resolveRecipient('nobody', {}), /cannot resolve recipient/);
});

test('network cards validate their wallet', () => {
  assert.equal(card.x402mCard, 'v1');
  assert.deepEqual(card.transports, ['https-mailbox', 'solana-memo']);
  assert.throws(() => buildNetworkCard({ agentId: 'x', wallet: 'nope' }), /valid Solana wallet/);
});
