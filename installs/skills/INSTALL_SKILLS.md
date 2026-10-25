# Install-count skill texts (ready to paste)

One per bot. Each is self-contained: it writes `installs.cjs` (plain fetch, no repo download) and calls it.
Endpoint: https://calculating-cardinal-16.convex.site (spam-guarded: bots-table slug, field validation, 60 writes/IP/h, 12/install/h).

---

## clawd (slug `clawd`)

```
name: install-count
description: Opt-in install count for clawd. Use on the first conversation with a new user, and once a day after they opted in.

1. On the first conversation, ask once: "Can I count this install? I only send the bot name, version and a random ID, no keys, chats or emails. You can opt out anytime." Never ask again if they say no.
2. If yes, save the file below as installs.cjs in your workspace (if missing), then run:
   node installs.cjs install --bot clawd --version <your version> [--wallet <public key, only if the user offers one>] [--ref <where they came from>] [--onboard if they want one x402m welcome message]
3. At most once a day: node installs.cjs heartbeat --bot clawd --version <v>
4. If the user asks to stop: node installs.cjs optout --bot clawd  (deletes the record). BOT_TELEMETRY=off disables everything.
5. Never send private keys, seed phrases, emails or chat content. A 429 means rate limited; just skip.

installs.cjs:
// Opt-in install ping for Grok Bot bots. Self-contained: Node 18+ fetch, no deps, no repo download.
// Sends only: bot slug, version, random installId, and (only if passed) a public wallet / x402m id / referral.
// Never sends keys, seed phrases, emails or chat content. Set BOT_TELEMETRY=off to disable everything.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const URL_ = process.env.INSTALLS_URL || 'https://calculating-cardinal-16.convex.site';
const DIR = process.env.INSTALLS_DIR || path.join(os.homedir(), '.grokbot-installs');
function idFile(bot) { return path.join(DIR, bot + '.id'); }
function getId(bot, create) {
  try { return fs.readFileSync(idFile(bot), 'utf8').trim(); } catch {}
  if (!create) return null;
  fs.mkdirSync(DIR, { recursive: true });
  const id = crypto.randomBytes(12).toString('base64url');
  fs.writeFileSync(idFile(bot), id, { mode: 0o600 });
  return id;
}
async function post(p, body) {
  const r = await fetch(URL_ + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  return { status: r.status, body: await r.text() };
}
// cmd: install | heartbeat | optout | status. opts: { bot, version, wallet, x402m, ref, onboard }
async function installsCmd(cmd, o) {
  if (process.env.BOT_TELEMETRY === 'off') return { skipped: 'BOT_TELEMETRY=off' };
  if (!o.bot) throw new Error('bot slug required');
  const version = String(o.version || '0.0.0');
  if (cmd === 'status') return { bot: o.bot, optedIn: !!getId(o.bot, false), url: URL_ };
  if (cmd === 'install') {
    const b = { bot: o.bot, version, installId: getId(o.bot, true), onboardingOptIn: !!o.onboard };
    if (o.wallet) b.wallet = o.wallet; if (o.x402m) b.x402mAgentId = o.x402m; if (o.ref) b.referral = o.ref;
    return post('/installs', b);
  }
  const id = getId(o.bot, false);
  if (!id) return { skipped: 'not opted in (run install first)' };
  if (cmd === 'heartbeat') return post('/heartbeat', { bot: o.bot, installId: id, version });
  if (cmd === 'optout') { const r = await post('/optout', { bot: o.bot, installId: id }); if (r.status === 200) fs.rmSync(idFile(o.bot), { force: true }); return r; }
  throw new Error('usage: installs <install|heartbeat|optout|status>');
}
function parse(argv) { const o = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2), n = argv[i + 1]; o[k] = n && !n.startsWith('--') ? (i++, n) : true; } return o; }
module.exports = { installsCmd, parse };
if (require.main === module) { const [c, ...r] = process.argv.slice(2); installsCmd(c, parse(r)).then((x) => console.log(JSON.stringify(x))).catch((e) => { console.error('error:', e.message); process.exit(1); }); }
```

---

## musebot (slug `musebot`)

```
name: install-count
description: Opt-in install count for musebot. Use on the first conversation with a new user, and once a day after they opted in.

1. On the first conversation, ask once: "Can I count this install? I only send the bot name, version and a random ID, no keys, chats or emails. You can opt out anytime." Never ask again if they say no.
2. If yes, save the file below as installs.cjs in your workspace (if missing), then run:
   node installs.cjs install --bot musebot --version <your version> [--wallet <public key, only if the user offers one>] [--ref <where they came from>] [--onboard if they want one x402m welcome message]
3. At most once a day: node installs.cjs heartbeat --bot musebot --version <v>
4. If the user asks to stop: node installs.cjs optout --bot musebot  (deletes the record). BOT_TELEMETRY=off disables everything.
5. Never send private keys, seed phrases, emails or chat content. A 429 means rate limited; just skip.

installs.cjs:
// Opt-in install ping for Grok Bot bots. Self-contained: Node 18+ fetch, no deps, no repo download.
// Sends only: bot slug, version, random installId, and (only if passed) a public wallet / x402m id / referral.
// Never sends keys, seed phrases, emails or chat content. Set BOT_TELEMETRY=off to disable everything.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const URL_ = process.env.INSTALLS_URL || 'https://calculating-cardinal-16.convex.site';
const DIR = process.env.INSTALLS_DIR || path.join(os.homedir(), '.grokbot-installs');
function idFile(bot) { return path.join(DIR, bot + '.id'); }
function getId(bot, create) {
  try { return fs.readFileSync(idFile(bot), 'utf8').trim(); } catch {}
  if (!create) return null;
  fs.mkdirSync(DIR, { recursive: true });
  const id = crypto.randomBytes(12).toString('base64url');
  fs.writeFileSync(idFile(bot), id, { mode: 0o600 });
  return id;
}
async function post(p, body) {
  const r = await fetch(URL_ + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  return { status: r.status, body: await r.text() };
}
// cmd: install | heartbeat | optout | status. opts: { bot, version, wallet, x402m, ref, onboard }
async function installsCmd(cmd, o) {
  if (process.env.BOT_TELEMETRY === 'off') return { skipped: 'BOT_TELEMETRY=off' };
  if (!o.bot) throw new Error('bot slug required');
  const version = String(o.version || '0.0.0');
  if (cmd === 'status') return { bot: o.bot, optedIn: !!getId(o.bot, false), url: URL_ };
  if (cmd === 'install') {
    const b = { bot: o.bot, version, installId: getId(o.bot, true), onboardingOptIn: !!o.onboard };
    if (o.wallet) b.wallet = o.wallet; if (o.x402m) b.x402mAgentId = o.x402m; if (o.ref) b.referral = o.ref;
    return post('/installs', b);
  }
  const id = getId(o.bot, false);
  if (!id) return { skipped: 'not opted in (run install first)' };
  if (cmd === 'heartbeat') return post('/heartbeat', { bot: o.bot, installId: id, version });
  if (cmd === 'optout') { const r = await post('/optout', { bot: o.bot, installId: id }); if (r.status === 200) fs.rmSync(idFile(o.bot), { force: true }); return r; }
  throw new Error('usage: installs <install|heartbeat|optout|status>');
}
function parse(argv) { const o = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2), n = argv[i + 1]; o[k] = n && !n.startsWith('--') ? (i++, n) : true; } return o; }
module.exports = { installsCmd, parse };
if (require.main === module) { const [c, ...r] = process.argv.slice(2); installsCmd(c, parse(r)).then((x) => console.log(JSON.stringify(x))).catch((e) => { console.error('error:', e.message); process.exit(1); }); }
```

---

## pumpfun (slug `pumpfun`)

```
name: install-count
description: Opt-in install count for pumpfun. Use on the first conversation with a new user, and once a day after they opted in.

1. On the first conversation, ask once: "Can I count this install? I only send the bot name, version and a random ID, no keys, chats or emails. You can opt out anytime." Never ask again if they say no.
2. If yes, save the file below as installs.cjs in your workspace (if missing), then run:
   node installs.cjs install --bot pumpfun --version <your version> [--wallet <public key, only if the user offers one>] [--ref <where they came from>] [--onboard if they want one x402m welcome message]
3. At most once a day: node installs.cjs heartbeat --bot pumpfun --version <v>
4. If the user asks to stop: node installs.cjs optout --bot pumpfun  (deletes the record). BOT_TELEMETRY=off disables everything.
5. Never send private keys, seed phrases, emails or chat content. A 429 means rate limited; just skip.

installs.cjs:
// Opt-in install ping for Grok Bot bots. Self-contained: Node 18+ fetch, no deps, no repo download.
// Sends only: bot slug, version, random installId, and (only if passed) a public wallet / x402m id / referral.
// Never sends keys, seed phrases, emails or chat content. Set BOT_TELEMETRY=off to disable everything.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const URL_ = process.env.INSTALLS_URL || 'https://calculating-cardinal-16.convex.site';
const DIR = process.env.INSTALLS_DIR || path.join(os.homedir(), '.grokbot-installs');
function idFile(bot) { return path.join(DIR, bot + '.id'); }
function getId(bot, create) {
  try { return fs.readFileSync(idFile(bot), 'utf8').trim(); } catch {}
  if (!create) return null;
  fs.mkdirSync(DIR, { recursive: true });
  const id = crypto.randomBytes(12).toString('base64url');
  fs.writeFileSync(idFile(bot), id, { mode: 0o600 });
  return id;
}
async function post(p, body) {
  const r = await fetch(URL_ + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  return { status: r.status, body: await r.text() };
}
// cmd: install | heartbeat | optout | status. opts: { bot, version, wallet, x402m, ref, onboard }
async function installsCmd(cmd, o) {
  if (process.env.BOT_TELEMETRY === 'off') return { skipped: 'BOT_TELEMETRY=off' };
  if (!o.bot) throw new Error('bot slug required');
  const version = String(o.version || '0.0.0');
  if (cmd === 'status') return { bot: o.bot, optedIn: !!getId(o.bot, false), url: URL_ };
  if (cmd === 'install') {
    const b = { bot: o.bot, version, installId: getId(o.bot, true), onboardingOptIn: !!o.onboard };
    if (o.wallet) b.wallet = o.wallet; if (o.x402m) b.x402mAgentId = o.x402m; if (o.ref) b.referral = o.ref;
    return post('/installs', b);
  }
  const id = getId(o.bot, false);
  if (!id) return { skipped: 'not opted in (run install first)' };
  if (cmd === 'heartbeat') return post('/heartbeat', { bot: o.bot, installId: id, version });
  if (cmd === 'optout') { const r = await post('/optout', { bot: o.bot, installId: id }); if (r.status === 200) fs.rmSync(idFile(o.bot), { force: true }); return r; }
  throw new Error('usage: installs <install|heartbeat|optout|status>');
}
function parse(argv) { const o = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2), n = argv[i + 1]; o[k] = n && !n.startsWith('--') ? (i++, n) : true; } return o; }
module.exports = { installsCmd, parse };
if (require.main === module) { const [c, ...r] = process.argv.slice(2); installsCmd(c, parse(r)).then((x) => console.log(JSON.stringify(x))).catch((e) => { console.error('error:', e.message); process.exit(1); }); }
```

---

## clawdchain bot (slug `clawdchain`)

```
name: install-count
description: Opt-in install count for clawdchain bot. Use on the first conversation with a new user, and once a day after they opted in.

1. On the first conversation, ask once: "Can I count this install? I only send the bot name, version and a random ID, no keys, chats or emails. You can opt out anytime." Never ask again if they say no.
2. If yes, save the file below as installs.cjs in your workspace (if missing), then run:
   node installs.cjs install --bot clawdchain --version <your version> [--wallet <public key, only if the user offers one>] [--ref <where they came from>] [--onboard if they want one x402m welcome message]
3. At most once a day: node installs.cjs heartbeat --bot clawdchain --version <v>
4. If the user asks to stop: node installs.cjs optout --bot clawdchain  (deletes the record). BOT_TELEMETRY=off disables everything.
5. Never send private keys, seed phrases, emails or chat content. A 429 means rate limited; just skip.

installs.cjs:
// Opt-in install ping for Grok Bot bots. Self-contained: Node 18+ fetch, no deps, no repo download.
// Sends only: bot slug, version, random installId, and (only if passed) a public wallet / x402m id / referral.
// Never sends keys, seed phrases, emails or chat content. Set BOT_TELEMETRY=off to disable everything.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const URL_ = process.env.INSTALLS_URL || 'https://calculating-cardinal-16.convex.site';
const DIR = process.env.INSTALLS_DIR || path.join(os.homedir(), '.grokbot-installs');
function idFile(bot) { return path.join(DIR, bot + '.id'); }
function getId(bot, create) {
  try { return fs.readFileSync(idFile(bot), 'utf8').trim(); } catch {}
  if (!create) return null;
  fs.mkdirSync(DIR, { recursive: true });
  const id = crypto.randomBytes(12).toString('base64url');
  fs.writeFileSync(idFile(bot), id, { mode: 0o600 });
  return id;
}
async function post(p, body) {
  const r = await fetch(URL_ + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  return { status: r.status, body: await r.text() };
}
// cmd: install | heartbeat | optout | status. opts: { bot, version, wallet, x402m, ref, onboard }
async function installsCmd(cmd, o) {
  if (process.env.BOT_TELEMETRY === 'off') return { skipped: 'BOT_TELEMETRY=off' };
  if (!o.bot) throw new Error('bot slug required');
  const version = String(o.version || '0.0.0');
  if (cmd === 'status') return { bot: o.bot, optedIn: !!getId(o.bot, false), url: URL_ };
  if (cmd === 'install') {
    const b = { bot: o.bot, version, installId: getId(o.bot, true), onboardingOptIn: !!o.onboard };
    if (o.wallet) b.wallet = o.wallet; if (o.x402m) b.x402mAgentId = o.x402m; if (o.ref) b.referral = o.ref;
    return post('/installs', b);
  }
  const id = getId(o.bot, false);
  if (!id) return { skipped: 'not opted in (run install first)' };
  if (cmd === 'heartbeat') return post('/heartbeat', { bot: o.bot, installId: id, version });
  if (cmd === 'optout') { const r = await post('/optout', { bot: o.bot, installId: id }); if (r.status === 200) fs.rmSync(idFile(o.bot), { force: true }); return r; }
  throw new Error('usage: installs <install|heartbeat|optout|status>');
}
function parse(argv) { const o = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2), n = argv[i + 1]; o[k] = n && !n.startsWith('--') ? (i++, n) : true; } return o; }
module.exports = { installsCmd, parse };
if (require.main === module) { const [c, ...r] = process.argv.slice(2); installsCmd(c, parse(r)).then((x) => console.log(JSON.stringify(x))).catch((e) => { console.error('error:', e.message); process.exit(1); }); }
```

---

## Phantom (slug `phantom`)

```
name: install-count
description: Opt-in install count for Phantom. Use on the first conversation with a new user, and once a day after they opted in.

1. On the first conversation, ask once: "Can I count this install? I only send the bot name, version and a random ID, no keys, chats or emails. You can opt out anytime." Never ask again if they say no.
2. If yes, save the file below as installs.cjs in your workspace (if missing), then run:
   node installs.cjs install --bot phantom --version <your version> [--wallet <public key, only if the user offers one>] [--ref <where they came from>] [--onboard if they want one x402m welcome message]
3. At most once a day: node installs.cjs heartbeat --bot phantom --version <v>
4. If the user asks to stop: node installs.cjs optout --bot phantom  (deletes the record). BOT_TELEMETRY=off disables everything.
5. Never send private keys, seed phrases, emails or chat content. A 429 means rate limited; just skip.

installs.cjs:
// Opt-in install ping for Grok Bot bots. Self-contained: Node 18+ fetch, no deps, no repo download.
// Sends only: bot slug, version, random installId, and (only if passed) a public wallet / x402m id / referral.
// Never sends keys, seed phrases, emails or chat content. Set BOT_TELEMETRY=off to disable everything.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const URL_ = process.env.INSTALLS_URL || 'https://calculating-cardinal-16.convex.site';
const DIR = process.env.INSTALLS_DIR || path.join(os.homedir(), '.grokbot-installs');
function idFile(bot) { return path.join(DIR, bot + '.id'); }
function getId(bot, create) {
  try { return fs.readFileSync(idFile(bot), 'utf8').trim(); } catch {}
  if (!create) return null;
  fs.mkdirSync(DIR, { recursive: true });
  const id = crypto.randomBytes(12).toString('base64url');
  fs.writeFileSync(idFile(bot), id, { mode: 0o600 });
  return id;
}
async function post(p, body) {
  const r = await fetch(URL_ + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  return { status: r.status, body: await r.text() };
}
// cmd: install | heartbeat | optout | status. opts: { bot, version, wallet, x402m, ref, onboard }
async function installsCmd(cmd, o) {
  if (process.env.BOT_TELEMETRY === 'off') return { skipped: 'BOT_TELEMETRY=off' };
  if (!o.bot) throw new Error('bot slug required');
  const version = String(o.version || '0.0.0');
  if (cmd === 'status') return { bot: o.bot, optedIn: !!getId(o.bot, false), url: URL_ };
  if (cmd === 'install') {
    const b = { bot: o.bot, version, installId: getId(o.bot, true), onboardingOptIn: !!o.onboard };
    if (o.wallet) b.wallet = o.wallet; if (o.x402m) b.x402mAgentId = o.x402m; if (o.ref) b.referral = o.ref;
    return post('/installs', b);
  }
  const id = getId(o.bot, false);
  if (!id) return { skipped: 'not opted in (run install first)' };
  if (cmd === 'heartbeat') return post('/heartbeat', { bot: o.bot, installId: id, version });
  if (cmd === 'optout') { const r = await post('/optout', { bot: o.bot, installId: id }); if (r.status === 200) fs.rmSync(idFile(o.bot), { force: true }); return r; }
  throw new Error('usage: installs <install|heartbeat|optout|status>');
}
function parse(argv) { const o = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2), n = argv[i + 1]; o[k] = n && !n.startsWith('--') ? (i++, n) : true; } return o; }
module.exports = { installsCmd, parse };
if (require.main === module) { const [c, ...r] = process.argv.slice(2); installsCmd(c, parse(r)).then((x) => console.log(JSON.stringify(x))).catch((e) => { console.error('error:', e.message); process.exit(1); }); }
```

---

## ORE Miner (slug `ore-miner`)

```
name: install-count
description: Opt-in install count for ORE Miner. Use on the first conversation with a new user, and once a day after they opted in.

1. On the first conversation, ask once: "Can I count this install? I only send the bot name, version and a random ID, no keys, chats or emails. You can opt out anytime." Never ask again if they say no.
2. If yes, save the file below as installs.cjs in your workspace (if missing), then run:
   node installs.cjs install --bot ore-miner --version <your version> [--wallet <public key, only if the user offers one>] [--ref <where they came from>] [--onboard if they want one x402m welcome message]
3. At most once a day: node installs.cjs heartbeat --bot ore-miner --version <v>
4. If the user asks to stop: node installs.cjs optout --bot ore-miner  (deletes the record). BOT_TELEMETRY=off disables everything.
5. Never send private keys, seed phrases, emails or chat content. A 429 means rate limited; just skip.

installs.cjs:
// Opt-in install ping for Grok Bot bots. Self-contained: Node 18+ fetch, no deps, no repo download.
// Sends only: bot slug, version, random installId, and (only if passed) a public wallet / x402m id / referral.
// Never sends keys, seed phrases, emails or chat content. Set BOT_TELEMETRY=off to disable everything.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const URL_ = process.env.INSTALLS_URL || 'https://calculating-cardinal-16.convex.site';
const DIR = process.env.INSTALLS_DIR || path.join(os.homedir(), '.grokbot-installs');
function idFile(bot) { return path.join(DIR, bot + '.id'); }
function getId(bot, create) {
  try { return fs.readFileSync(idFile(bot), 'utf8').trim(); } catch {}
  if (!create) return null;
  fs.mkdirSync(DIR, { recursive: true });
  const id = crypto.randomBytes(12).toString('base64url');
  fs.writeFileSync(idFile(bot), id, { mode: 0o600 });
  return id;
}
async function post(p, body) {
  const r = await fetch(URL_ + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  return { status: r.status, body: await r.text() };
}
// cmd: install | heartbeat | optout | status. opts: { bot, version, wallet, x402m, ref, onboard }
async function installsCmd(cmd, o) {
  if (process.env.BOT_TELEMETRY === 'off') return { skipped: 'BOT_TELEMETRY=off' };
  if (!o.bot) throw new Error('bot slug required');
  const version = String(o.version || '0.0.0');
  if (cmd === 'status') return { bot: o.bot, optedIn: !!getId(o.bot, false), url: URL_ };
  if (cmd === 'install') {
    const b = { bot: o.bot, version, installId: getId(o.bot, true), onboardingOptIn: !!o.onboard };
    if (o.wallet) b.wallet = o.wallet; if (o.x402m) b.x402mAgentId = o.x402m; if (o.ref) b.referral = o.ref;
    return post('/installs', b);
  }
  const id = getId(o.bot, false);
  if (!id) return { skipped: 'not opted in (run install first)' };
  if (cmd === 'heartbeat') return post('/heartbeat', { bot: o.bot, installId: id, version });
  if (cmd === 'optout') { const r = await post('/optout', { bot: o.bot, installId: id }); if (r.status === 200) fs.rmSync(idFile(o.bot), { force: true }); return r; }
  throw new Error('usage: installs <install|heartbeat|optout|status>');
}
function parse(argv) { const o = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { const k = argv[i].slice(2), n = argv[i + 1]; o[k] = n && !n.startsWith('--') ? (i++, n) : true; } return o; }
module.exports = { installsCmd, parse };
if (require.main === module) { const [c, ...r] = process.argv.slice(2); installsCmd(c, parse(r)).then((x) => console.log(JSON.stringify(x))).catch((e) => { console.error('error:', e.message); process.exit(1); }); }
```
