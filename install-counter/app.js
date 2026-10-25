import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

export const TEMPLATE_ID = 'REFgpQ-Emk9iKSarRm6Kj';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED = new Set(['template', 'installId', 'ts']);

export function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'body must be a JSON object';
  for (const k of Object.keys(body)) if (!ALLOWED.has(k)) return `unexpected field: ${k}`;
  if (body.template !== TEMPLATE_ID) return 'unknown template';
  if (typeof body.installId !== 'string' || !UUID_RE.test(body.installId)) return 'installId must be a UUID';
  if (body.ts !== undefined) {
    const t = typeof body.ts === 'number' ? body.ts : Date.parse(body.ts);
    if (typeof body.ts !== 'number' && typeof body.ts !== 'string') return 'ts must be ISO string or epoch ms';
    if (!Number.isFinite(t)) return 'ts invalid';
  }
  return null;
}

// store: { add(id, clientTs) -> {created}, stats() -> {total,last24h,byDay}, remove(id) -> bool }
export function createMemoryStore() {
  const rows = new Map();
  return {
    async add(id) { const k = id.toLowerCase(); if (rows.has(k)) return { created: false }; rows.set(k, Date.now()); return { created: true }; },
    async remove(id) { return rows.delete(id.toLowerCase()); },
    async stats() {
      const now = Date.now(); const byDay = {}; let last24h = 0;
      for (const t of rows.values()) { if (now - t < 864e5) last24h++; const d = new Date(t).toISOString().slice(0, 10); byDay[d] = (byDay[d] || 0) + 1; }
      return { total: rows.size, last24h, byDay };
    },
  };
}

function send(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readJson(req, limit = 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('invalid JSON')); } });
    req.on('error', reject);
  });
}

function adminOk(req, token) {
  if (!token) return false;
  const got = Buffer.from(String(req.headers.authorization || ''));
  const want = Buffer.from(`Bearer ${token}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export function createServer(store, { adminToken } = {}) {
  return http.createServer(async (req, res) => {
    // No IP, user agent, or headers are logged or stored.
    try {
      const url = new URL(req.url, 'http://x');
      if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST', 'access-control-allow-headers': 'content-type' }); return res.end(); }
      if (req.method === 'GET' && url.pathname === '/healthz') return send(res, 200, { ok: true });
      if (req.method === 'GET' && url.pathname === '/v1/stats') return send(res, 200, await store.stats());
      if (req.method === 'POST' && url.pathname === '/v1/install') {
        let body; try { body = await readJson(req); } catch (e) { return send(res, 400, { error: e.message }); }
        const err = validate(body); if (err) return send(res, 400, { error: err });
        const { created } = await store.add(body.installId);
        return send(res, created ? 201 : 200, { ok: true, counted: created });
      }
      const m = url.pathname.match(/^\/v1\/install\/([^/]+)$/);
      if (req.method === 'DELETE' && m) {
        if (!adminOk(req, adminToken)) return send(res, 401, { error: 'unauthorized' });
        if (!UUID_RE.test(m[1])) return send(res, 400, { error: 'installId must be a UUID' });
        return send(res, 200, { ok: true, removed: await store.remove(m[1]) });
      }
      send(res, 404, { error: 'not found' });
    } catch { send(res, 500, { error: 'internal error' }); }
  });
}
