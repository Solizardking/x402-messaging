import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

// Bot install tracking. Opt-in, public identifiers only.
// Never store private keys, seed phrases, emails or chat content.
import { REGISTRY } from './registry';
export const BOTS = REGISTRY.map((b) => b.slug);

export default defineSchema({
  bots: defineTable({
    slug: v.string(), name: v.string(), shareUrl: v.optional(v.string()), x402mAgentId: v.optional(v.string()),
  }).index('by_slug', ['slug']),
  installs: defineTable({
    bot: v.string(),
    version: v.string(),
    installId: v.string(), // random anonymous id, or x402m agent_id
    wallet: v.optional(v.string()), // optional Solana pubkey (public)
    x402mAgentId: v.optional(v.string()),
    referral: v.optional(v.string()),
    onboardingOptIn: v.boolean(),
    createdAt: v.number(),
    lastSeen: v.number(),
    heartbeats: v.number(),
  })
    .index('by_install', ['bot', 'installId'])
    .index('by_bot_lastSeen', ['bot', 'lastSeen']),
  rateLimits: defineTable({
    key: v.string(), // 'ip:<addr>' or 'id:<bot>:<installId>'
    windowStart: v.number(),
    count: v.number(),
  }).index('by_key', ['key']),
  installEvents: defineTable({
    bot: v.string(),
    installId: v.string(),
    kind: v.union(v.literal('install'), v.literal('heartbeat'), v.literal('uninstall')),
    version: v.string(),
    at: v.number(),
  }).index('by_bot_at', ['bot', 'at']),
});
