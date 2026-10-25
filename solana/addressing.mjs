// Recipient resolution across the networks an x402m agent lives on.
//
// A sender may name a recipient as:
//   - a Solana wallet (base58)                -> sent on-chain directly
//   - an @handle or agent ID                  -> Musebook messaging directory
//   - a Reason Network address (person/session, e.g. "alice/api-claude")
//                                             -> Reason bridge (reason.mjs)
//
// On-chain delivery needs a wallet. Directory identities bind to wallets
// through published network cards (manifest.mjs): an agent's card states
// its wallet, its Musebook agent ID/handle and its Reason address, and an
// operator's local address book records the cards it trusts. Resolution
// never guesses a wallet for an identity it cannot bind — it fails with
// guidance instead. Messaging identity, wallet authority and Reason
// sign-in remain three separate credentials; none implies the others.
import { isValidPublicKey } from './base58.mjs';

export const MUSEBOOK_AGENTS_URL = 'https://musebook.trade/api/x402m/agents';
const REASON_ADDRESS_RE = /^[a-z0-9][a-z0-9_-]*\/[a-z0-9][a-z0-9_-]*(@[a-z0-9][a-z0-9_-]*)?$/i;

// Fetch the public messaging directory: [{ agent_id, handle, name, ... }].
export async function fetchMessagingDirectory({ fetchImpl = globalThis.fetch, url = MUSEBOOK_AGENTS_URL } = {}) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`messaging directory failed: HTTP ${response.status}`);
  const body = await response.json();
  return body.agents ?? [];
}

// Address book: a plain object (or Map) from any identity string —
// handle (with or without @), agent ID, or Reason address — to a network
// card { wallet, agentId?, handle?, reason? }. Operators build it from
// cards they have verified; manifest.mjs produces card JSON to share.
export function normalizeAddressBook(book = {}) {
  const map = new Map();
  const entries = book instanceof Map ? book.entries() : Object.entries(book);
  for (const [key, card] of entries) {
    if (!card || !isValidPublicKey(card.wallet ?? '')) continue;
    map.set(key.replace(/^@/, '').toLowerCase(), card);
    if (card.agentId) map.set(card.agentId, card);
    if (card.handle) map.set(card.handle.replace(/^@/, '').toLowerCase(), card);
    if (card.reason) map.set(card.reason.toLowerCase(), card);
  }
  return map;
}

// Resolve a recipient string to { wallet, agentId, handle, reason, source }
// or throw with an actionable message. `directory` is an optional pre-fetched
// messaging directory (fetchMessagingDirectory) used to confirm that a
// handle/agent ID exists even when its wallet comes from the address book.
export function resolveRecipient(input, { addressBook = {}, directory = [] } = {}) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('recipient required');
  const book = normalizeAddressBook(addressBook);
  if (isValidPublicKey(input)) return { wallet: input, source: 'wallet' };
  const key = input.replace(/^@/, '').toLowerCase();
  const card = book.get(key) ?? book.get(input);
  if (card) {
    const inDirectory = directory.find(
      (agent) => agent.agent_id === card.agentId || agent.handle?.toLowerCase() === key,
    );
    return {
      wallet: card.wallet,
      agentId: card.agentId ?? inDirectory?.agent_id,
      handle: card.handle ?? inDirectory?.handle,
      reason: card.reason,
      source: 'address-book',
    };
  }
  const known = directory.find(
    (agent) => agent.agent_id === input || agent.handle?.toLowerCase() === key,
  );
  if (known) {
    throw new Error(
      `${input} is a registered messaging identity (${known.agent_id}) but no verified ` +
      'network card binds it to a wallet. Ask the agent to publish its card (manifest.mjs) ' +
      'or add its wallet to your address book.',
    );
  }
  if (REASON_ADDRESS_RE.test(input)) {
    throw new Error(
      `${input} looks like a Reason Network address but no verified network card binds it ` +
      'to a wallet. Add its card to your address book for on-chain delivery, or send via ' +
      'the Reason bridge (reason.mjs) instead.',
    );
  }
  throw new Error(`cannot resolve recipient: ${input}`);
}
