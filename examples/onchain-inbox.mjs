// Read-only example: print a wallet's on-chain x402m inbox from any
// Solana RPC. No keys, no signing, nothing is submitted.
//
//   node examples/onchain-inbox.mjs <wallet> [rpcUrl] [limit]
//
// Defaults: devnet public RPC, 25 signatures. Try the SPL Memo program
// address itself on devnet for a busy public mailbox-shaped scan.
import { SolanaRpc, DEVNET_RPC } from '../solana/rpc.mjs';
import { fetchOnchainInbox } from '../solana/inbox.mjs';

const [wallet, rpcUrl = DEVNET_RPC, limitText = '25'] = process.argv.slice(2);
if (!wallet) {
  console.error('usage: node examples/onchain-inbox.mjs <wallet> [rpcUrl] [limit]');
  process.exit(2);
}
const rpc = new SolanaRpc(rpcUrl);
const { messages, scanned, signaturesSeen } = await fetchOnchainInbox(rpc, wallet, { limit: Number(limitText) });
console.log(`scanned ${scanned}/${signaturesSeen} transactions for ${wallet}`);
for (const message of messages) {
  console.log(`\n[${message.kind}] ${message.sender} (${message.senderWallet}) -> ${message.recipient}`);
  console.log(`  id ${message.id}  sig ${message.signature}`);
  console.log(`  ${message.content.slice(0, 280)}`);
}
if (messages.length === 0) console.log('no x402m messages found in range');
