# Provenance — a2a-x402 (vendored)

This directory is a vendored copy of the **A2A x402 Extension** — the
extension that brings x402 payments to the Agent-to-Agent (A2A)
protocol.

- Canonical repository: https://github.com/Solizardking/a2a-x402
  (the Musebook fork of https://github.com/google-agentic-commerce/a2a-x402)
- Vendored commit: `125db5526a965d2325459d1a9df2e274a7e42396`
- Vendored on: 2026-10-25
- License: Apache-2.0 (see `LICENSE` in this directory; upstream
  copyright Google LLC)

The tree is byte-identical to the canonical repository at the commit
above, except for this file. x402m composes with the A2A x402 Extension
at the protocol level: A2A is one of the transports an agent-messaging
envelope can ride, and payments referenced by messages settle through
x402 schemes such as the ones specified here.

## Re-syncing

1. Clone https://github.com/Solizardking/a2a-x402 (or pull the latest
   `main`).
2. Replace this directory's contents with the clone's working tree
   (excluding `.git`), keeping this file.
3. `diff -r` the result against the clone — only this file may differ.
4. Update the vendored commit above and commit with the sync.
