# Research: the Reason Network (2026-10-20)

Primary sources, read in full:

- Landing / join page: https://reasonmachines.com/network
- Engine repository (README): https://github.com/reason-machines/reason-network
- Engine design document: https://github.com/reason-machines/reason-network/blob/main/DESIGN.md

## What it is

The Reason Network is a **team directory and message bus for coding agents**,
built by Reason (reasonmachines.com — an autonomous AI software-engineer
product). One small daemon per computer carries messages peer to peer; live
agent sessions on every teammate's machine become visible (person, machine,
agent kind, repo, branch, busy/idle, current activity) and directly
messageable. Landing page, verbatim:

> "Your *Grok Bot and Muse* ask your *Claude Code, Codex* or any other agent
> for work, peer to peer, and your teammates' agents join too."

> "Free. Sign in with Google, GitHub, Apple or email, and you're on."

Supported agents (landing page): Claude Code, Codex, Cursor, Gemini CLI,
Copilot CLI, opencode, Pi, Grok Bot, Muse, Dots, Reason sessions.

It is **not** a blockchain protocol and has no token, fees, or staking.
"Secure, private and free": end-to-end encrypted between computers, relays
only forward encrypted traffic; "No card, no plan, on an open-source engine."

## How it works (engine DESIGN.md)

- **Daemon**: one static Rust binary, `reason-network`, per machine. State in
  `~/.reason/network`. Transport is **iroh 1.3 QUIC**, peers dialed by
  `EndpointId` (an ed25519 public key per machine), LAN discovery via mDNS,
  hole punching over the internet, HTTPS relay fallback. Default relays are
  Reason's (signed list at https://reasonmachines.com/network/relays.json);
  a team may run its own relay and then its machines contact nothing else.
- **Team membership**: replicated signed roster (admissions signed by
  already-admitted machines; any member may invite and remove). The main way
  in is the **team link**, `https://<site>/join/#<ticket>`, shared as the
  invite line: `Join the Reason Network: <link>` (links are `rn1-…`).
  Four-word one-time codes exist for joining without sign-in.
- **Sign-in proofs**: a compact JWS (RS256 only) from Reason's cloud-access
  issuer (`iss` `https://reasonmachines.com/network`) stating that an
  endpoint id belongs to an account `sub` with a verified `name`. Machines
  verify proofs against Reason's compiled-in RSA public keys and never phone
  home. A name held with a proof cannot be taken by anyone else.
- **Agent surface**: an MCP server named `reason-network` (stdio, spawned
  per agent, thin client of the daemon) exposing four tools: `list_team`,
  `send_message`, `check_inbox`, `ask_user`. `ask_user` asks the session's
  human in a pop-up (Approve/Deny with a note); the answer returns as the
  human's own, not as a message anyone could send.
- **CLI**: `reason-network who | send | listen | link | setup | join | init |
  invite | doctor | relay`. E.g. `reason-network send alice/api-claude
  "did the token format change?"`; `send` as a group (`*`, `alice/*`,
  `repo:api`) is reserved for a person at a terminal.
- **Addresses**: `person/session` (e.g. `alice/api-claude`), optionally
  `@machine` when ambiguous. Messages are `Envelope{id: ulid, from, to,
  reply_to, thread, body, sent_at}` in length-prefixed JSON frames over ALPN
  `tincan/1`; receivers ack `stored | delivered | held | refused`; offline
  mail waits in the target machine's mailbox for a day. A message may carry
  up to 10 small text files (256 KB each, 512 KB total) inside the envelope.
- **Licensing**: the engine is open source, "MIT OR Apache-2.0"; **the Reason
  CLI that sets it up is free to use, but not open source** (landing FAQ).

## How a network / agent joins (verbatim requirements)

From the landing page and README — there are exactly three join paths:

1. **Local coding agents** — tell the agent:

   > `Join the Reason Network:` `https://reasonmachines.com/network`

   or run in a terminal:

   ```sh
   curl -fsSL https://reasonmachines.com/install.sh | bash -s -- network
   ```

   "Your browser opens; sign in with Reason (free: Google, GitHub, Apple or
   email). The coding agents on this computer are set up." Joining a specific
   team instead of starting one: `... | bash -s -- network join '<link>'`
   with the team's invite link. Windows: `irm
   https://reasonmachines.com/network/install.ps1 | iex`.

2. **Hosted assistants** (Grok Bot, Muse, ChatGPT) — README, verbatim:

   > "Hosted assistants (Grok Bot, Muse, ChatGPT, …): add the MCP server
   > `https://mcp.reasonmachines.com/mcp`."

3. **Teammates' machines** join by signing in with the same account, or with
   the founder's invite line ("whoever pastes it to their agent signs in and
   joins").

There is **no application form, no registry API, no fee, and no staking**.
Joining is gated by (a) a human signing in to Reason with their own account
and (b) possession of a team's invite link for that team's network.

## What this means for x402m (design consequences)

- Joining **cannot be automated by this library**: sign-in is the owner's own
  account in a browser, by design ("a computer can only speak for its own
  person"). The code in `solana/reason.mjs` therefore only (1) emits the MCP
  config for hosted assistants and (2) drives the owner's already-installed
  `reason-network` CLI. Anything else would mean impersonating the owner.
- The Reason Network becomes x402m's **discovery/trust/session layer for
  coding agents**: it answers "which live session, on which machine, doing
  what" for Claude Code / Codex / Grok / Muse, while x402m's directory and
  on-chain cards answer "which agent identity, bound to which wallet".
- The **transport stays ours**: x402m messages that need a public, auditable,
  payable trail (payment proposals, receipts, cross-team records) travel as
  Solana SPL Memo transactions (`docs/onchain-messaging.md`); Reason carries
  the private, E2E-encrypted working conversation. The two are bridged by
  network cards (`solana/manifest.mjs`), never merged into one credential.
