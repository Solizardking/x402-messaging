// Unsigned Solana transaction builder for on-chain x402m mail.
//
// A "mail transaction" is: one 0-lamport System transfer from the sender
// wallet to the recipient wallet (this is what makes the message findable
// in the RECIPIENT's signature history), followed by one SPL Memo
// instruction per envelope chunk. The fee payer is the sender.
//
// This module NEVER signs. It returns the unsigned wire bytes (base64, one
// zeroed signature slot) for an owner wallet — browser, OWS, or agent
// wallet — to review and sign. Wallets, not libraries, hold keys.
// Serialization is dependency-free and byte-identical to @solana/web3.js
// for this instruction shape (cross-checked; see transaction.test.mjs).
import { base58Decode, base58Encode } from './base58.mjs';
import { encodeEnvelopeToMemos } from './envelope.mjs';

export const SYSTEM_PROGRAM = '11111111111111111111111111111111';
export const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

function shortvec(value) {
  const out = [];
  let rest = value;
  for (;;) {
    const byte = rest & 0x7f;
    rest >>= 7;
    if (rest === 0) {
      out.push(byte);
      return Uint8Array.from(out);
    }
    out.push(byte | 0x80);
  }
}

function concat(...arrays) {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

function transferData(lamports) {
  const data = new Uint8Array(12);
  const view = new DataView(data.buffer);
  view.setUint32(0, 2, true); // SystemInstruction.Transfer
  view.setBigUint64(4, BigInt(lamports), true);
  return data;
}

// Compile account metas the way @solana/web3.js does: fee payer first,
// then signers before non-signers, writable before readonly, stable by
// first appearance; program ids join as readonly non-signers.
function compileAccounts(feePayer, instructions) {
  const metas = new Map();
  const add = (pubkey, isSigner, isWritable) => {
    const key = base58Encode(pubkey);
    const prior = metas.get(key);
    if (prior) {
      prior.isSigner ||= isSigner;
      prior.isWritable ||= isWritable;
    } else {
      metas.set(key, { pubkey, key, isSigner, isWritable, order: metas.size });
    }
  };
  add(feePayer, true, true);
  for (const ix of instructions) {
    for (const meta of ix.keys) add(meta.pubkey, meta.isSigner, meta.isWritable);
    add(ix.programId, false, false);
  }
  const sorted = [...metas.values()].sort((a, b) => {
    if (a.key === base58Encode(feePayer)) return -1;
    if (b.key === base58Encode(feePayer)) return 1;
    if (a.isSigner !== b.isSigner) return a.isSigner ? -1 : 1;
    if (a.isWritable !== b.isWritable) return a.isWritable ? -1 : 1;
    return a.order - b.order;
  });
  return sorted;
}

export function serializeMessage({ feePayer, recentBlockhash, instructions }) {
  const accounts = compileAccounts(feePayer, instructions);
  const indexOf = (pubkey) => accounts.findIndex((a) => a.key === base58Encode(pubkey));
  const header = {
    numRequiredSignatures: accounts.filter((a) => a.isSigner).length,
    numReadonlySignedAccounts: accounts.filter((a) => a.isSigner && !a.isWritable).length,
    numReadonlyUnsignedAccounts: accounts.filter((a) => !a.isSigner && !a.isWritable).length,
  };
  const compiled = instructions.map((ix) => {
    const data = ix.data;
    return concat(
      Uint8Array.from([indexOf(ix.programId)]),
      shortvec(ix.keys.length),
      Uint8Array.from(ix.keys.map((meta) => indexOf(meta.pubkey))),
      shortvec(data.length),
      data,
    );
  });
  return concat(
    Uint8Array.from([
      header.numRequiredSignatures,
      header.numReadonlySignedAccounts,
      header.numReadonlyUnsignedAccounts,
    ]),
    shortvec(accounts.length),
    ...accounts.map((a) => a.pubkey),
    base58Decode(recentBlockhash),
    shortvec(instructions.length),
    ...compiled,
  );
}

// Build the unsigned mail transaction for one envelope.
// Returns { transactionBase64, messageId, memos, lamports } — hand
// transactionBase64 to the owner's wallet to sign and submit.
export function buildMailTransaction({ fromWallet, toWallet, envelope, recentBlockhash }) {
  const from = base58Decode(fromWallet);
  const to = base58Decode(toWallet);
  if (from.length !== 32 || to.length !== 32) throw new Error('fromWallet and toWallet must be base58 Solana addresses');
  if (!recentBlockhash || base58Decode(recentBlockhash).length !== 32) throw new Error('recentBlockhash must be a base58 blockhash');
  const system = base58Decode(SYSTEM_PROGRAM);
  const memoProgram = base58Decode(MEMO_PROGRAM);
  const memos = encodeEnvelopeToMemos(envelope);
  const encoder = new TextEncoder();
  const instructions = [
    {
      programId: system,
      keys: [
        { pubkey: from, isSigner: true, isWritable: true },
        { pubkey: to, isSigner: false, isWritable: true },
      ],
      data: transferData(0),
    },
    ...memos.map((memo) => ({ programId: memoProgram, keys: [], data: encoder.encode(memo) })),
  ];
  const message = serializeMessage({ feePayer: from, recentBlockhash, instructions });
  const signatureCount = 1;
  const wire = concat(shortvec(signatureCount), new Uint8Array(64 * signatureCount), message);
  return {
    transactionBase64: Buffer.from(wire).toString('base64'),
    messageId: envelope.id,
    memos,
    lamports: 0,
  };
}
