// Minimal base58 (Bitcoin/Solana alphabet) codec. Dependency-free so the
// on-chain transport can run anywhere Node runs, matching the root package's
// noble-only runtime footprint. Validated against known vectors in
// base58.test.mjs, including Solana public keys.
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const INDEX = new Map([...ALPHABET].map((ch, i) => [ch, BigInt(i)]));

export function base58Encode(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('base58Encode expects a Uint8Array');
  if (bytes.length === 0) return '';
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  let value = 0n;
  for (const byte of bytes) value = value * 256n + BigInt(byte);
  let encoded = '';
  while (value > 0n) {
    encoded = ALPHABET[Number(value % 58n)] + encoded;
    value /= 58n;
  }
  return '1'.repeat(zeros) + encoded;
}

export function base58Decode(text) {
  if (typeof text !== 'string' || text.length === 0) throw new Error('invalid base58: empty input');
  let zeros = 0;
  while (zeros < text.length && text[zeros] === '1') zeros += 1;
  let value = 0n;
  for (const ch of text) {
    const digit = INDEX.get(ch);
    if (digit === undefined) throw new Error(`invalid base58 character: ${ch}`);
    value = value * 58n + digit;
  }
  const body = [];
  while (value > 0n) {
    body.unshift(Number(value % 256n));
    value /= 256n;
  }
  const out = new Uint8Array(zeros + body.length);
  out.set(body, zeros);
  return out;
}

export function isValidPublicKey(text) {
  try {
    return base58Decode(text).length === 32;
  } catch {
    return false;
  }
}
