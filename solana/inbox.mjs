// On-chain inbox: read x402m mail back off Solana.
//
// A mail transaction (see transaction.mjs) carries a 0-lamport transfer
// from sender to recipient, so every message to a wallet appears in that
// wallet's signature history. This module scans that history, extracts
// SPL Memo instruction payloads, reassembles chunked envelopes, and
// returns mailbox-shaped messages.
//
// Trust model (read docs/onchain-messaging.md before relying on it):
//   - The AUTHORITY is the transaction fee payer: envelope.from is an
//     agent-identity claim that is only meaningful when a published agent
//     card binds that identity to the sending wallet.
//   - On-chain messages are public and permanent, and anyone can write a
//     memo naming any recipient. Treat content as untrusted, exactly like
//     mailbox messages. `payment.request` content is a proposal, never
//     proof of payment; verify settlement independently on-chain.
import { base58Decode } from './base58.mjs';
import { MemoAssembler } from './envelope.mjs';
import { MEMO_PROGRAM, SYSTEM_PROGRAM } from './transaction.mjs';

export const MEMO_PROGRAM_LEGACY = 'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo';
const MEMO_PROGRAMS = new Set([MEMO_PROGRAM, MEMO_PROGRAM_LEGACY]);
const utf8 = new TextDecoder();

export function transactionAccounts(tx) {
  const message = tx?.transaction?.message;
  if (!message) return [];
  const loaded = tx.meta?.loadedAddresses ?? {};
  return [...(message.accountKeys ?? []), ...(loaded.writable ?? []), ...(loaded.readonly ?? [])];
}

// Extract { senderWallet, recipientWallet, memos } from one getTransaction
// (encoding "json") result, or null when it is not a plausible mail tx.
export function parseMailTransaction(tx) {
  const message = tx?.transaction?.message;
  if (!message) return null;
  const accounts = transactionAccounts(tx);
  const senderWallet = accounts[0];
  if (!senderWallet) return null;
  let recipientWallet = null;
  const memos = [];
  for (const ix of message.instructions ?? []) {
    const program = accounts[ix.programIdIndex];
    if (MEMO_PROGRAMS.has(program) && typeof ix.data === 'string') {
      try {
        memos.push(utf8.decode(base58Decode(ix.data)));
      } catch { /* not valid memo data; ignore */ }
    }
    if (program === SYSTEM_PROGRAM && Array.isArray(ix.accounts) && ix.accounts.length >= 2) {
      const to = accounts[ix.accounts[1]];
      if (to && to !== senderWallet) recipientWallet = to;
    }
  }
  if (memos.length === 0) return null;
  return { senderWallet, recipientWallet, memos };
}

function toMessage(tx, parsed, envelope) {
  return {
    id: envelope.id,
    sender: envelope.from,
    senderWallet: parsed.senderWallet,
    recipient: envelope.to,
    recipientWallet: parsed.recipientWallet,
    kind: envelope.kind,
    content: envelope.content,
    conversationId: envelope.conversationId ?? null,
    replyTo: envelope.replyTo ?? null,
    pay: envelope.pay ?? null,
    ts: envelope.ts,
    signature: tx.transaction.signatures[0],
    slot: tx.slot,
    blockTime: tx.blockTime ?? null,
    transport: 'solana-memo',
  };
}

async function scan(rpc, wallet, { limit = 50, before, keep }) {
  const signatures = await rpc.getSignaturesForAddress(wallet, { limit, before });
  const assemblers = new Map(); // senderWallet -> MemoAssembler
  const messages = [];
  let scanned = 0;
  for (const entry of signatures) {
    if (entry.err) continue;
    const tx = await rpc.getTransaction(entry.signature);
    if (!tx) continue;
    scanned += 1;
    const parsed = parseMailTransaction(tx);
    if (!parsed || !keep(parsed)) continue;
    let assembler = assemblers.get(parsed.senderWallet);
    if (!assembler) {
      assembler = new MemoAssembler();
      assemblers.set(parsed.senderWallet, assembler);
    }
    for (const memo of parsed.memos) {
      const envelope = assembler.feed(parsed.senderWallet, memo);
      if (envelope) messages.push(toMessage(tx, parsed, envelope));
    }
  }
  return { messages, scanned, signaturesSeen: signatures.length };
}

// Messages addressed TO this wallet (its on-chain inbox).
export function fetchOnchainInbox(rpc, wallet, options = {}) {
  return scan(rpc, wallet, { ...options, keep: (parsed) => parsed.recipientWallet === wallet });
}

// Messages sent FROM this wallet (its on-chain outbox / sent folder).
export function fetchOnchainOutbox(rpc, wallet, options = {}) {
  return scan(rpc, wallet, { ...options, keep: (parsed) => parsed.senderWallet === wallet });
}
