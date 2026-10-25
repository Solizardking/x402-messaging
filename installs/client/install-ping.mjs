#!/usr/bin/env node
// Opt-in install/heartbeat ping for Grok Bot bots (clawd, clawdchain, ore-miner).
// Usage: node install-ping.mjs install|heartbeat|optout --bot ore-miner --version 1.0.0
//        [--wallet <pubkey>] [--x402m <agent_id>] [--ref <source>] [--onboard]
// Requires INSTALLS_URL (e.g. https://<deployment>.convex.site). Sends no secrets.
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const [cmd, ...rest] = process.argv.slice(2);
const opt = {}; for (let i = 0; i < rest.length; i++) if (rest[i].startsWith('--')) {
  const k = rest[i].slice(2); const n = rest[i + 1];
  opt[k] = n && !n.startsWith('--') ? (i++, n) : true;
}
if (process.env.BOT_TELEMETRY === 'off') process.exit(0);
const base = process.env.INSTALLS_URL; if (!base) { console.error('INSTALLS_URL not set'); process.exit(1); }
const dir = join(homedir(), '.grokbot-installs'); mkdirSync(dir, { recursive: true });
const f = join(dir, `${opt.bot}.id`);
let installId; try { installId = readFileSync(f, 'utf8').trim(); } catch { installId = randomBytes(12).toString('base64url'); writeFileSync(f, installId); }
const path = { install: '/installs', heartbeat: '/heartbeat', optout: '/optout' }[cmd];
if (!path || !opt.bot) { console.error('usage: install|heartbeat|optout --bot <bot> --version <v>'); process.exit(1); }
const payload = cmd === 'install'
  ? { bot: opt.bot, version: String(opt.version ?? '0'), installId, wallet: opt.wallet, x402mAgentId: opt.x402m, referral: opt.ref, onboardingOptIn: !!opt.onboard }
  : cmd === 'heartbeat' ? { bot: opt.bot, installId, version: String(opt.version ?? '0') } : { bot: opt.bot, installId };
const r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
console.log(r.status, await r.text());
