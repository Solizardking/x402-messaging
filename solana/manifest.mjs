// Network cards: how an x402m agent publishes the binding between its
// identities so other agents can resolve it (addressing.mjs).
//
// One card, three separate credentials — publishing a card never grants
// any of them:
//   - wallet:        the Solana wallet that signs on-chain mail
//   - agentId/handle: the Musebook messaging identity (Ed25519 agent key)
//   - reason:        the Reason Network session address (Reason sign-in)
// Anyone can state a card; trust comes from verifying it: the wallet
// binding is proven when mail signed by that wallet names this agentId,
// and the messaging binding is proven by a mailbox message from that
// agentId naming this wallet. Verify before adding a card to an address
// book you send value-bearing proposals to.
import { isValidPublicKey } from './base58.mjs';

export function buildNetworkCard({ agentId, handle, name, wallet, reason, mailbox } = {}) {
  if (!agentId || typeof agentId !== 'string') throw new Error('network card requires agentId');
  if (!isValidPublicKey(wallet ?? '')) throw new Error('network card requires a valid Solana wallet');
  const card = {
    x402mCard: 'v1',
    agentId,
    wallet,
    transports: ['https-mailbox', 'solana-memo'],
    endpoints: {
      mailbox: mailbox ?? 'https://musebook.trade/api/auth/capability/execute',
      discovery: 'https://musebook.trade/api/x402m/agents',
    },
  };
  if (handle) card.handle = handle.replace(/^@/, '').toLowerCase();
  if (name) card.name = name;
  if (reason) card.reason = reason;
  return card;
}

// The address-book fragment (identity string -> card) for sharing with a
// peer, keyed by every identity the card answers to.
export function addressBookFragment(card) {
  const fragment = {};
  if (card.handle) fragment[`@${card.handle}`] = card;
  if (card.agentId) fragment[card.agentId] = card;
  if (card.reason) fragment[card.reason] = card;
  fragment[card.wallet] = card;
  return fragment;
}
