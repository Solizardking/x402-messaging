import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { api, internal } from './_generated/api';

const http = httpRouter();
const H = { 'content-type': 'application/json', 'access-control-allow-origin': '*' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: H });

async function body(req: Request) {
  const t = await req.text();
  if (t.length > 4096) throw new Error('too large');
  return JSON.parse(t);
}
function clientIp(req: Request) {
  const xf = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
  return xf.split(',')[0].trim() || 'unknown';
}
const wrap = (fn: (ctx: any, b: any) => Promise<unknown>) => httpAction(async (ctx, req) => {
  try {
    const b = await body(req);
    if (!b || typeof b !== 'object' || typeof b.bot !== 'string' || typeof b.installId !== 'string') throw new Error('bad body');
    await ctx.runMutation(internal.installs.guard, { ip: clientIp(req), bot: b.bot, installId: b.installId });
    return json(await fn(ctx, b));
  } catch (e) {
    const m = String((e as Error).message ?? e);
    const msg = m.includes('rate limited') ? 'rate limited' : (m.match(/(unknown bot|bad [A-Za-z]+|too large)/)?.[0] ?? 'bad request');
    return json({ ok: false, error: msg }, msg === 'rate limited' ? 429 : 400);
  }
});

http.route({ path: '/installs', method: 'POST', handler: wrap((c, b) => c.runMutation(internal.installs.register, b)) });
http.route({ path: '/heartbeat', method: 'POST', handler: wrap((c, b) => c.runMutation(internal.installs.heartbeat, b)) });
http.route({ path: '/optout', method: 'POST', handler: wrap((c, b) => c.runMutation(internal.installs.optOut, b)) });
http.route({ path: '/stats', method: 'GET', handler: httpAction(async (c) => json(await c.runQuery(api.installs.stats, {}))) });
http.route({ path: '/dashboard', method: 'GET', handler: httpAction(async (c) => {
  const s = await c.runQuery(api.installs.stats, {});
  const rows = Object.entries(s.bots).map(([b, x]: any) =>
    `<tr><td>${x.shareUrl ? `<a href="${x.shareUrl}">${x.name}</a>` : x.name}</td><td>${x.total}</td><td>${x.new7d}</td><td>${x.dau}</td><td>${x.wau}</td><td>${x.withWallet}</td><td>${x.optedIn}</td></tr>`).join('');
  return new Response(`<!doctype html><meta charset=utf-8><title>Bot installs</title><style>body{font:15px system-ui;margin:2rem}td,th{padding:.4rem .8rem;border-bottom:1px solid #ddd;text-align:right}td:first-child,th:first-child{text-align:left}</style><h1>Bot installs</h1><table><tr><th>Bot</th><th>Total</th><th>New 7d</th><th>DAU</th><th>WAU</th><th>Wallet linked</th><th>Onboarding opt-in</th></tr>${rows}</table><p>Updated ${new Date(s.at).toISOString()}</p>`, { headers: { 'content-type': 'text/html' } });
}) });

export default http;
