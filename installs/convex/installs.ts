import { internalMutation, mutation, query } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import { v } from 'convex/values';
import { BOTS } from './schema';
import { REGISTRY } from './registry';

const DAY = 86_400_000;
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const ID = /^[A-Za-z0-9_-]{8,64}$/;

const VER = /^[A-Za-z0-9._+-]{1,32}$/;
const REF = /^[A-Za-z0-9._:\/-]{1,64}$/;
const AGENT = /^[A-Za-z0-9_-]{8,64}$/;
const WINDOW = 3_600_000; // 1h fixed window
const IP_LIMIT = 60;      // writes per IP per hour
const ID_LIMIT = 12;      // writes per install per hour

// Spam guard: bot must exist in the bots table, fields must be well-formed.
async function check(ctx: MutationCtx, a: { bot: string; installId: string; version?: string; wallet?: string; x402mAgentId?: string; referral?: string }) {
  if (typeof a.bot !== 'string' || a.bot.length > 32) throw new Error('bad bot');
  const known = await ctx.db.query('bots').withIndex('by_slug', (q) => q.eq('slug', a.bot)).unique();
  if (!known) throw new Error('unknown bot');
  if (!ID.test(a.installId)) throw new Error('bad installId');
  if (a.version !== undefined && !VER.test(a.version)) throw new Error('bad version');
  if (a.wallet && !B58.test(a.wallet)) throw new Error('bad wallet');
  if (a.x402mAgentId && !AGENT.test(a.x402mAgentId)) throw new Error('bad x402mAgentId');
  if (a.referral && !REF.test(a.referral)) throw new Error('bad referral');
}

async function hit(ctx: MutationCtx, key: string, limit: number, now: number) {
  const row = await ctx.db.query('rateLimits').withIndex('by_key', (q) => q.eq('key', key)).unique();
  if (!row || now - row.windowStart >= WINDOW) {
    if (row) await ctx.db.patch(row._id, { windowStart: now, count: 1 });
    else await ctx.db.insert('rateLimits', { key, windowStart: now, count: 1 });
    return;
  }
  if (row.count >= limit) throw new Error('rate limited');
  await ctx.db.patch(row._id, { count: row.count + 1 });
}

// Called by HTTP actions before every write. ip comes from request headers.
export const guard = internalMutation({
  args: { ip: v.string(), bot: v.string(), installId: v.string() },
  handler: async (ctx, a) => {
    const now = Date.now();
    await hit(ctx, 'ip:' + a.ip.slice(0, 64), IP_LIMIT, now);
    await hit(ctx, 'id:' + a.bot.slice(0, 32) + ':' + a.installId.slice(0, 64), ID_LIMIT, now);
    return { ok: true };
  },
});

export const register = internalMutation({
  args: {
    bot: v.string(), version: v.string(), installId: v.string(),
    wallet: v.optional(v.string()), x402mAgentId: v.optional(v.string()),
    referral: v.optional(v.string()), onboardingOptIn: v.optional(v.boolean()),
  },
  handler: async (ctx, a) => {
    await check(ctx, a);
    const now = Date.now();
    const version = a.version.slice(0, 32);
    const referral = a.referral?.slice(0, 64);
    const existing = await ctx.db.query('installs')
      .withIndex('by_install', (q) => q.eq('bot', a.bot).eq('installId', a.installId)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, { version, lastSeen: now,
        wallet: a.wallet ?? existing.wallet, x402mAgentId: a.x402mAgentId ?? existing.x402mAgentId,
        onboardingOptIn: a.onboardingOptIn ?? existing.onboardingOptIn });
      return { ok: true, new: false };
    }
    await ctx.db.insert('installs', { bot: a.bot, version, installId: a.installId,
      wallet: a.wallet, x402mAgentId: a.x402mAgentId, referral,
      onboardingOptIn: a.onboardingOptIn ?? false, createdAt: now, lastSeen: now, heartbeats: 0 });
    await ctx.db.insert('installEvents', { bot: a.bot, installId: a.installId, kind: 'install', version, at: now });
    return { ok: true, new: true };
  },
});

export const heartbeat = internalMutation({
  args: { bot: v.string(), installId: v.string(), version: v.string() },
  handler: async (ctx, a) => {
    await check(ctx, a);
    const row = await ctx.db.query('installs')
      .withIndex('by_install', (q) => q.eq('bot', a.bot).eq('installId', a.installId)).unique();
    if (!row) return { ok: false, error: 'not registered' };
    const now = Date.now();
    // at most one heartbeat event per install per hour
    if (now - row.lastSeen > 3_600_000 || row.heartbeats === 0)
      await ctx.db.insert('installEvents', { bot: a.bot, installId: a.installId, kind: 'heartbeat', version: a.version.slice(0, 32), at: now });
    await ctx.db.patch(row._id, { lastSeen: now, heartbeats: row.heartbeats + 1, version: a.version.slice(0, 32) });
    return { ok: true };
  },
});

export const optOut = internalMutation({
  args: { bot: v.string(), installId: v.string() },
  handler: async (ctx, a) => {
    await check(ctx, a);
    const row = await ctx.db.query('installs')
      .withIndex('by_install', (q) => q.eq('bot', a.bot).eq('installId', a.installId)).unique();
    if (row) await ctx.db.delete(row._id); // full removal on request
    return { ok: true };
  },
});

// Aggregates only — no ids or wallets are returned.
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const out: Record<string, { name: string; shareUrl: string | null; total: number; dau: number; wau: number; withWallet: number; optedIn: number; new7d: number }> = {};
    for (const bot of BOTS) {
      const rows = (await ctx.db.query('installs').withIndex('by_bot_lastSeen', (q) => q.eq('bot', bot)).collect())
        .filter((r) => r.referral !== 'test'); // test installs excluded
      const meta = REGISTRY.find((b) => b.slug === bot)!;
      out[bot] = { name: meta.name, shareUrl: meta.shareUrl ?? null,
        total: rows.length,
        dau: rows.filter((r) => now - r.lastSeen < DAY).length,
        wau: rows.filter((r) => now - r.lastSeen < 7 * DAY).length,
        withWallet: rows.filter((r) => r.wallet).length,
        optedIn: rows.filter((r) => r.onboardingOptIn).length,
        new7d: rows.filter((r) => now - r.createdAt < 7 * DAY).length,
      };
    }
    return { at: now, bots: out };
  },
});

export const onboardingQueue = query({
  args: { bot: v.string() },
  handler: async (ctx, { bot }) => {
    const rows = await ctx.db.query('installs').withIndex('by_bot_lastSeen', (q) => q.eq('bot', bot)).collect();
    return rows.filter((r) => r.onboardingOptIn && r.x402mAgentId).map((r) => r.x402mAgentId!);
  },
});

// Idempotent: upserts the bots registry from registry.ts.
export const seedBots = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const b of REGISTRY) {
      const row = await ctx.db.query('bots').withIndex('by_slug', (q) => q.eq('slug', b.slug)).unique();
      const doc = { slug: b.slug, name: b.name, shareUrl: b.shareUrl, x402mAgentId: b.x402mAgentId };
      if (row) await ctx.db.patch(row._id, doc); else await ctx.db.insert('bots', doc);
    }
    return { ok: true, count: REGISTRY.length };
  },
});
