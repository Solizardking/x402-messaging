// Dry-run example: build an UNSIGNED on-chain x402m mail transaction and
// print it for owner review. This never signs and never submits — hand
// the base64 to the sender's wallet (browser, OWS, agent wallet) to sign.
//
//   node examples/onchain-send.mjs <fromWallet> <toWallet> <content> [rpcUrl]
//
// With no rpcUrl it uses a placeholder blockhash and marks the output as
// not submittable; with one it fetches a live blockhash (read-only).
import { SolanaRpc, DEVNET_RPC } from '../solana/rpc.mjs';
import { buildEnvelope } from '../solana/envelope.mjs';
import { buildMailTransaction } from '../solana/transaction.mjs';

const [fromWallet, toWallet, content, rpcUrl] = process.argv.slice(2);
if (!fromWallet || !toWallet || !content) {
  console.error('usage: node examples/onchain-send.mjs <fromWallet> <toWallet> <content> [rpcUrl]');
  process.exit(2);
}
let recentBlockhash = '11111111111111111111111111111111';
let submittable = false;
if (rpcUrl) {
  const { value } = await new SolanaRpc(rpcUrl).getLatestBlockhash();
  recentBlockhash = value.blockhash;
  submittable = true;
} else if (process.env.X402M_RPC_URL) {
  const { value } = await new SolanaRpc(process.env.X402M_RPC_URL).getLatestBlockhash();
  recentBlockhash = value.blockhash;
  submittable = true;
}
const envelope = buildEnvelope({
  id: `req-${Date.now().toString(36)}`,
  from: fromWallet,
  to: toWallet,
  kind: 'request',
  content,
});
const built = buildMailTransaction({ fromWallet, toWallet, envelope, recentBlockhash });
console.log(JSON.stringify({
  submittable,
  rpc: rpcUrl ?? process.env.X402M_RPC_URL ?? DEVNET_RPC,
  messageId: built.messageId,
  memoInstructions: built.memos.length,
  transactionBase64: built.transactionBase64,
}, null, 2));
