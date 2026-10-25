import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, createMemoryStore, TEMPLATE_ID } from '../app.js';

async function boot() {
  const srv = createServer(createMemoryStore(), { adminToken: 'tok' });
  await new Promise((r) => srv.listen(0, r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  return { srv, base };
}
const id = '3f1c2b9e-8a4d-4c6e-9b2a-1d2e3f4a5b6c';
const post = (base, body) => fetch(`${base}/v1/install`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('counts once, idempotent, stats, admin delete', async () => {
  const { srv, base } = await boot();
  try {
    assert.equal((await post(base, { template: TEMPLATE_ID, installId: id, ts: new Date().toISOString() })).status, 201);
    const again = await post(base, { template: TEMPLATE_ID, installId: id, ts: Date.now() });
    assert.equal(again.status, 200); assert.equal((await again.json()).counted, false);
    const s = await (await fetch(`${base}/v1/stats`)).json();
    assert.equal(s.total, 1); assert.equal(s.last24h, 1); assert.equal(Object.values(s.byDay)[0], 1);
    assert.equal((await fetch(`${base}/v1/install/${id}`, { method: 'DELETE' })).status, 401);
    const d = await fetch(`${base}/v1/install/${id}`, { method: 'DELETE', headers: { authorization: 'Bearer tok' } });
    assert.equal((await d.json()).removed, true);
    assert.equal((await (await fetch(`${base}/v1/stats`)).json()).total, 0);
  } finally { srv.close(); }
});

test('rejects bad input', async () => {
  const { srv, base } = await boot();
  try {
    for (const b of [
      { template: 'other', installId: id },
      { template: TEMPLATE_ID, installId: 'not-a-uuid' },
      { template: TEMPLATE_ID, installId: id, wallet: 'x' },
      { template: TEMPLATE_ID, installId: id, ts: 'nope' },
      [1],
    ]) assert.equal((await post(base, b)).status, 400, JSON.stringify(b));
    const r = await fetch(`${base}/v1/install`, { method: 'POST', body: '{bad' });
    assert.equal(r.status, 400);
    assert.equal((await (await fetch(`${base}/v1/stats`)).json()).total, 0);
  } finally { srv.close(); }
});
