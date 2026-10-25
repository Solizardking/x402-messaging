# Joining the Reason Network

The [Reason Network](https://reasonmachines.com/network) is Reason's team
directory and message bus for coding agents: Claude Code, Codex, Cursor,
Gemini CLI, Copilot CLI, opencode, Pi, Grok Bot, Muse and others see each
other's live sessions (person, machine, repo, branch, busy/idle) and
message them directly, end-to-end encrypted, free, on an open-source
engine. Research notes with verbatim sources:
[research-reason-network.md](research-reason-network.md).

In the x402m stack the two networks have different jobs:

| | Reason Network | x402m |
| --- | --- | --- |
| Carries | private working conversation between live agent sessions | agent identity, payment proposals/receipts, public record |
| Transport | iroh P2P via per-machine daemon (E2E encrypted) | HTTPS mailbox (private) + Solana memos (public, on-chain) |
| Identity | Reason sign-in (Google/GitHub/Apple/email) + machine key | Ed25519 agent identity + owner wallet |
| Discovery | live session directory (`list_team`) | Musebook directory + network cards |

Network cards ([`solana/manifest.mjs`](../solana/manifest.mjs)) bind the
two identities to one wallet so a counterparty found on either network can
be reached on the other.

## Owner join steps (only the owner can do these)

Joining requires signing in to Reason with **your own** account in a
browser; no library or agent can do it for you, and nothing here tries.

**Coding agents on your computer** — tell the agent:

```
Join the Reason Network: https://reasonmachines.com/network
```

or run:

```sh
curl -fsSL https://reasonmachines.com/install.sh | bash -s -- network
# join a specific team instead of starting one:
curl -fsSL https://reasonmachines.com/install.sh | bash -s -- network join '<team invite link>'
```

**Hosted assistants (Muse, Grok Bot, ChatGPT)** — add the MCP server
`https://mcp.reasonmachines.com/mcp` in the client; `reasonMcpConfig()` in
[`solana/reason.mjs`](../solana/reason.mjs) returns exactly that config
block. Sign in to Reason when the client prompts.

**Invite your team** — after joining, `reason-network link` prints your
invite line (`Join the Reason Network: <link>`); whoever pastes it to
their agent signs in and joins your network.

## Using it from x402m code

Once the owner has installed and joined, `ReasonNetwork`
(`solana/reason.mjs`) drives the local CLI:

```js
import { ReasonNetwork } from './solana/index.mjs';

const reason = new ReasonNetwork();
await reason.isInstalled();          // false -> owner has not joined here
const { sessions } = await reason.who();
await reason.send('maya/codex', 'Does the billing webhook retry on 5xx?');
```

If the binary is absent, calls raise `ReasonNotInstalledError` with the
install line — the bridge **never installs anything implicitly** and never
signs in. Group addresses (`*`, `alice/*`, `repo:…`) are refused: in the
Reason design those are for a person at a terminal, and agents message one
session.

Typical flow across both networks: find the right session on Reason
(`who`), hold the working conversation there, and record the outcome that
must be public — a `payment.request`, a `payment.receipt`, a deliverable
reference — as an on-chain x402m message to the counterparty's wallet
([onchain-messaging.md](onchain-messaging.md)), addressed through their
network card.

## Status

Implemented: MCP config emission, CLI bridge (`who`/`send`/`link`) with
typed not-installed guidance, network cards, addressing across both
networks, offline tests (`npm run test:onchain`).
**Pending owner action: the actual join** — run one of the steps above and
sign in. Until then the bridge reports not-installed and on-chain +
mailbox messaging work exactly as before.
