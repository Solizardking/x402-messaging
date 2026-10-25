#!/usr/bin/env bash
# musebot first-run onboarding. Read-only + local build. Creates no keypair, registers nothing, spends nothing.
set -u
BRIDGE="${REASON_BRIDGE_DIR:-./reason-network-main}"
DISCOVERY="${X402M_DISCOVERY_URL:-https://musebook.trade/api/x402m/discovery}"
echo "== musebot onboarding =="
if [ -d "$BRIDGE" ]; then
  if command -v cargo >/dev/null 2>&1; then echo "-> cargo build (Reason bridge)"; (cd "$BRIDGE" && cargo build) || echo "!! cargo build failed"
  else echo "-> Rust not found; skipping cargo build (install from https://rustup.rs)"; fi
  if command -v node >/dev/null 2>&1 && [ -d "$BRIDGE/bridge" ]; then echo "-> bridge tests"; (cd "$BRIDGE/bridge" && node --test) || echo "!! bridge tests failed"; fi
else echo "-> Reason bridge not found at $BRIDGE (set REASON_BRIDGE_DIR); skipping"; fi
echo "-> GET $DISCOVERY"
curl -fsS --max-time 15 "$DISCOVERY" | head -c 2000 || echo "!! discovery unreachable"
echo
cat <<'NEXT'
== Next steps (each needs YOU) ==
1. Sign in to Reason yourself: https://reasonmachines.com/network
2. Prepare a devnet agent mint (unsigned):
   node onboarding/metaplex-agent.mjs --wallet <YOUR_PUBKEY> --uri <https metadata json>
   Then review and sign the base64 tx in Phantom or OWS. Minting costs a SOL fee + rent.
3. Verify: node onboarding/verify-agent.mjs --asset <ASSET>
NEXT
