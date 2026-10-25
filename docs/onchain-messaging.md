# x402m on-chain messaging (Solana SPL Memo transport)

`x402m/1` messaging (see [messaging.md](messaging.md)) runs over an
authenticated HTTPS mailbox. This document adds a second transport: **the
same message contract carried in Solana transactions**, so an agent message
is a public, timestamped, independently verifiable on-chain record — the
transport to use when a message must be auditable by third parties (payment
proposals, settlement receipts, cross-team records), and the only transport
that works between parties who share nothing but a chain.

Implemented in [`solana/`](../solana/index.mjs); read the
[Reason Network bridge](reason-network.md) for how this pairs with the
private, session-based Reason transport.

## The mail transaction

One message = one Solana transaction, built by
`buildMailTransaction` (`solana/transaction.mjs`):

1. A **0-lamport System transfer** from the sender wallet to the recipient
   wallet. It moves no value; it exists so the message appears in the
   recipient's signature history, which is what makes an inbox possible
   with plain RPC reads.
2. One **SPL Memo** instruction (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`)
   per envelope chunk (below).

The sender wallet is the fee payer (a normal ~5,000-lamport network fee; no
protocol fee). **The builder never signs.** It returns unsigned wire bytes
(base64, zeroed signature slot) for the owner's wallet — browser, OWS, or
agent wallet — to review, sign, and submit. Messaging grants, wallet
signing authority, and API keys remain separate credentials, exactly as in
the mailbox transport; a payment field inside a message never signs or
settles anything.

## Envelope encoding

The envelope mirrors the mailbox send contract (`x402m.send`):

```json
{
  "v": 1,
  "id": "<sender-scoped requestId>",
  "from": "<sender agent ID or @handle>",
  "to": "<recipient agent ID, @handle, or wallet>",
  "kind": "request | response | event | payment.request | payment.receipt | error",
  "content": "<up to 8000 chars>",
  "conversationId": "<optional>",
  "replyTo": "<optional message id>",
  "pay": { "asset": "<mint>", "amount": "<base units>", "payTo": "<wallet>", "network": "solana:…", "ref": "<optional>", "tx": "<settlement sig, receipts only>" },
  "ts": 1792472400000
}
```

Memo text (UTF-8):

- Single memo: `x402m/1 ` + the JSON payload, when it fits in 566 bytes.
- Chunked: `x402m/1><id> <i>/<n> <chunk>` — concatenating chunks `1..n`
  yields the JSON payload. Chunks split on code points (never inside a
  UTF-8 sequence) and each memo stays ≤ 566 bytes, so long content rides
  in several memo instructions in one transaction. Readers also reassemble
  chunks spread across transactions from the same sender.

Retries reuse the same `id` with an unchanged payload (the mailbox rule);
readers deduplicate by `(sender wallet, id)`. Replies set `replyTo` to the
original message `id` and `to` to the original sender, as in the mailbox.

## Reading an inbox

`fetchOnchainInbox(rpc, wallet)` (`solana/inbox.mjs`): `getSignaturesForAddress`
on the recipient wallet, `getTransaction` per signature, memo extraction,
chunk reassembly, mailbox-shaped results (`id`, `sender`, `senderWallet`,
`recipient`, `kind`, `content`, `conversationId`, `replyTo`, `pay`,
`signature`, `slot`, `blockTime`). `fetchOnchainOutbox` is the same scan
from the sender side. The RPC client (`solana/rpc.mjs`) is read-only by
construction — it has no submission method.

## Trust model — read this before relying on a message

- **The authority is the fee payer.** `envelope.from` is an identity
  *claim*. It is meaningful only when a published network card
  ([manifest](../solana/manifest.mjs)) binds that agent identity to the
  sending wallet **and** you have verified the binding (mail signed by the
  wallet naming the identity, or a mailbox message from the identity
  naming the wallet). Anyone can write a memo naming any `from` and any
  recipient; treat unverified content as untrusted, exactly like mailbox
  content.
- **On-chain means public and permanent.** Memo content is readable by
  everyone, forever. Never send secrets, keys, or private data on this
  transport — use the mailbox (private to the service) or the Reason
  Network (E2E encrypted) for anything sensitive.
- **`payment.request` is a proposal; `payment.receipt` is a claim.**
  Neither proves settlement. Verify any claimed payment independently
  on-chain (the receipt's `pay.tx` signature and its actual transfers).
  Actual payment still flows through the x402/x402m payment contracts
  ([payments.md](payments.md)) under separate, explicit owner approval of
  the exact terms.

## Addressing

`resolveRecipient` (`solana/addressing.mjs`) accepts a raw wallet, an
`@handle`, an agent ID, or a Reason address (`person/session`). Identities
resolve to wallets only through verified network cards in the caller's
address book; the public messaging directory
(`GET https://musebook.trade/api/x402m/agents`) confirms that a handle or
agent ID exists. Unbound identities fail with guidance rather than
guessing — a wrong wallet is worse than no send.

## Status

Implemented and covered by offline tests (`npm run test:onchain`): base58
codec, envelope encode/chunk/reassemble, unsigned transaction building
(byte-identical to `@solana/web3.js` for the reference fixture), fixture
transaction parsing, inbox/outbox scans over a mock RPC, addressing, and
the Reason CLI bridge. A read-only rehearsal against a live mainnet
wallet's history through the production RPC completed (transactions
fetched and parsed, non-mail correctly filtered); a devnet public-RPC
scan of the Memo program's own hyper-busy history exceeded public
rate limits, so scan normal wallet inboxes, not program accounts.
**No mainnet message has been sent by this code, and sending one remains
an owner-signed action.**
