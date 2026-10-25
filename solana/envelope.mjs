// x402m/1 on-chain envelope: the mailbox message contract (docs/messaging.md)
// encoded for transport in Solana SPL Memo instructions.
//
// Wire format (UTF-8 text inside each memo instruction):
//   single memo : "x402m/1 " + JSON.stringify(envelope)
//   chunked     : "x402m/1>" + id + " " + i + "/" + n + " " + chunk
//                 where concatenating the chunks of parts 1..n in order
//                 yields the same JSON payload. Chunking splits on code
//                 points so no multi-byte character is ever cut in half.
//
// An SPL Memo instruction comfortably carries 566 bytes inside a normal
// transaction; every memo produced here is <= MEMO_MAX_BYTES bytes.
// On-chain messages are PUBLIC and permanent. Never put secrets in them.
import { createHash } from 'node:crypto';

export const MEMO_PREFIX = 'x402m/1 ';
export const MEMO_PART_PREFIX = 'x402m/1>';
export const MEMO_MAX_BYTES = 566;
export const MAX_PARTS = 40;
export const KINDS = ['request', 'response', 'event', 'payment.request', 'payment.receipt', 'error'];
const utf8 = new TextEncoder();

export function utf8Length(text) {
  return utf8.encode(text).length;
}

function requireString(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new Error(`invalid envelope field: ${field}`);
  }
  return value;
}

// Build the canonical envelope object. Mirrors the mailbox send contract:
// `id` is the sender-scoped requestId (unique per sender, retries reuse it),
// `from`/`to` are agent identities (agent IDs or @handles); the wallet that
// signs the transaction is the authority (see inbox.mjs).
export function buildEnvelope({
  id, from, to, kind, content, conversationId, replyTo, pay, ts,
} = {}) {
  requireString(id, 'id', 128);
  requireString(from, 'from', 128);
  requireString(to, 'to', 128);
  if (!KINDS.includes(kind)) throw new Error(`invalid envelope field: kind (${kind})`);
  requireString(content, 'content', 8000);
  const envelope = { v: 1, id, from, to, kind, content, ts: ts ?? Date.now() };
  if (conversationId !== undefined) envelope.conversationId = requireString(conversationId, 'conversationId', 128);
  if (replyTo !== undefined) envelope.replyTo = requireString(replyTo, 'replyTo', 128);
  if (pay !== undefined) envelope.pay = validatePay(pay);
  return envelope;
}

// A payment field is a PROPOSAL (or, for payment.receipt, a reference). It
// never authorizes, signs or settles anything; see docs/onchain-messaging.md.
function validatePay(pay) {
  if (!pay || typeof pay !== 'object' || Array.isArray(pay)) throw new Error('invalid envelope field: pay');
  const out = {};
  for (const field of ['asset', 'amount', 'payTo', 'network', 'ref', 'tx']) {
    if (pay[field] !== undefined) out[field] = requireString(String(pay[field]), `pay.${field}`, 128);
  }
  if (!out.asset || !out.amount || !out.payTo) throw new Error('pay requires asset, amount and payTo');
  return out;
}

export function serializeEnvelope(envelope) {
  return JSON.stringify(envelope);
}

function chunkPayload(id, payload) {
  const parts = [];
  let rest = [...payload]; // code points, so UTF-8 sequences stay whole
  let index = 1;
  // Part count digits change the prefix length; reserve for two digits.
  while (rest.length > 0) {
    const prefix = `${MEMO_PART_PREFIX}${id} ${index}/${MAX_PARTS} `;
    const budget = MEMO_MAX_BYTES - utf8Length(prefix);
    if (budget <= 0) throw new Error('envelope id too long to chunk');
    let taken = 0;
    let bytes = 0;
    while (taken < rest.length) {
      const width = utf8Length(rest[taken]);
      if (bytes + width > budget) break;
      bytes += width;
      taken += 1;
    }
    if (taken === 0) throw new Error('single character exceeds memo budget');
    parts.push(rest.slice(0, taken).join(''));
    rest = rest.slice(taken);
    index += 1;
    if (parts.length > MAX_PARTS) throw new Error(`envelope too large: exceeds ${MAX_PARTS} memo parts`);
  }
  const total = parts.length;
  return parts.map((chunk, i) => `${MEMO_PART_PREFIX}${id} ${i + 1}/${total} ${chunk}`);
}

// Encode an envelope as the list of memo instruction strings for one
// transaction (one string for short messages, several for long ones).
export function encodeEnvelopeToMemos(envelope) {
  const payload = serializeEnvelope(envelope);
  const single = MEMO_PREFIX + payload;
  if (utf8Length(single) <= MEMO_MAX_BYTES) return [single];
  return chunkPayload(envelope.id, payload);
}

export function messageKey(senderWallet, id) {
  return createHash('sha256').update(`${senderWallet}:${id}`).digest('hex').slice(0, 32);
}

const PART_RE = /^x402m\/1>([A-Za-z0-9_-]{1,128}) (\d{1,2})\/(\d{1,2}) ([\s\S]*)$/;

// A stateful collector: feed it every memo string attributed to one sender
// wallet (in any order, across transactions) and it returns each envelope
// exactly once, when complete. Single memos complete immediately.
export class MemoAssembler {
  constructor() {
    this.pending = new Map(); // key -> { total, parts: Map(index -> chunk) }
    this.seen = new Set(); // messageKey of completed envelopes
  }

  // Returns a parsed envelope, or null when the memo is not x402m, is a
  // chunk that does not complete a message yet, or is a duplicate.
  feed(senderWallet, memo) {
    if (typeof memo !== 'string') return null;
    if (memo.startsWith(MEMO_PREFIX)) {
      const envelope = parsePayload(memo.slice(MEMO_PREFIX.length));
      if (!envelope) return null;
      return this.#complete(senderWallet, envelope);
    }
    const match = PART_RE.exec(memo);
    if (!match) return null;
    const [, id, indexText, totalText, chunk] = match;
    const index = Number(indexText);
    const total = Number(totalText);
    if (index < 1 || total < 1 || index > total || total > MAX_PARTS) return null;
    const key = messageKey(senderWallet, id);
    if (this.seen.has(key)) return null;
    let entry = this.pending.get(key);
    if (!entry) {
      entry = { total, parts: new Map() };
      this.pending.set(key, entry);
    }
    if (entry.total !== total) return null;
    entry.parts.set(index, chunk);
    if (entry.parts.size < total) return null;
    const payload = Array.from({ length: total }, (_, i) => entry.parts.get(i + 1)).join('');
    this.pending.delete(key);
    const envelope = parsePayload(payload);
    if (!envelope || envelope.id !== id) return null;
    return this.#complete(senderWallet, envelope);
  }

  #complete(senderWallet, envelope) {
    const key = messageKey(senderWallet, envelope.id);
    if (this.seen.has(key)) return null;
    this.seen.add(key);
    return envelope;
  }
}

function parsePayload(text) {
  try {
    const envelope = JSON.parse(text);
    if (!envelope || envelope.v !== 1 || typeof envelope.id !== 'string' ||
        typeof envelope.from !== 'string' || typeof envelope.to !== 'string' ||
        !KINDS.includes(envelope.kind) || typeof envelope.content !== 'string') return null;
    return envelope;
  } catch {
    return null;
  }
}
