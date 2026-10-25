# Bot install tracking (x402m + Convex)

Opt-in install and active-user tracking for the Grok Bot bots in `convex/registry.ts` (clawd, musebot, pumpfun, clawdchain, phantom, ore-miner).

## Flow
1. **Identity.** On first run, the bot asks the user if it may count the install. If yes, it uses its x402m `agent_id` (from `x402m_register`, the musebook A2A relay) or a random anonymous id stored in `~/.grokbot-installs/<bot>.id`. A Solana pubkey is optional and only sent if the user offers it.
2. **Install ping.** `POST /installs` `{bot, version, installId, wallet?, x402mAgentId?, referral?, onboardingOptIn}`.
3. **Heartbeat.** `POST /heartbeat` at most daily, to count DAU/WAU.
4. **Onboarding (opt-in).** `onboardingQueue` lists x402m agent ids that opted in. An operator bot sends one welcome via `x402m_send` (`kind: "event"`). No bulk or unsolicited messages.
5. **Opt out.** `POST /optout` deletes the row. `BOT_TELEMETRY=off` disables the client.
6. **Stats.** `GET /stats` (JSON aggregates, no ids or wallets) and `GET /dashboard` (HTML).

x402 (Solana) is for optional paid features only. Nothing here pays or signs.

Referral codes: use `--ref` values like `x`, `share-page`, `musebook`, `reason-network`, `bot:<handle>`.

## Deploy
Copy `convex/` into a Convex project and run `npx convex dev` against a **dev** deployment. Do not deploy to prod without owner approval.

## Bot snippet
```
INSTALLS_URL=https://<deployment>.convex.site node installs/client/install-ping.mjs install --bot ore-miner --version 1.0.0 --ref share-page --onboard
```

## Spam guard (v2)
- POST /installs, /heartbeat, /optout: `bot` must exist in the `bots` table; installId, version, wallet, x402mAgentId and referral are format-checked; 400 on bad input.
- Rate limits (1h fixed window, `rateLimits` table): 60 writes per client IP, 12 per bot+installId; 429 when exceeded.
- register/heartbeat/optOut/seedBots are internal mutations, reachable only through the guarded HTTP routes.
- /stats and /dashboard exclude installs with `referral: "test"`.
- Self-contained client: `client/installs.cjs`; paste-ready skills for all six bots: `skills/INSTALL_SKILLS.md`.
