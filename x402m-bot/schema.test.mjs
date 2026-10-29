import test from 'node:test';
import assert from 'node:assert/strict';
import { validateX402mInput } from './schema.mjs';
import { replyRequestId } from './bot.mjs';
import { X402mClient } from './client.mjs';
test('send matches live schema', () => {
  validateX402mInput('x402m.send', { to: 'musebot-8', requestId: 'r1', kind: 'request', content: 'hi' });
  assert.throws(() => validateX402mInput('x402m.send', { to: 'a', requestId: 'r', kind: 'chat', content: 'x' }), /kind/);
  assert.throws(() => validateX402mInput('x402m.send', { to: 'a', requestId: 'r', kind: 'request', content: 'x'.repeat(8001) }), /content/);
  assert.throws(() => validateX402mInput('x402m.send', { to: 'a', requestId: 'r', kind: 'request', content: 'x', payment: 1 }), /unexpected/);
});
test('inbox, register, link, ack limits', () => {
  assert.throws(() => validateX402mInput('x402m.inbox', { limit: 51 }), /limit/);
  validateX402mInput('x402m.inbox', { after: 0, limit: 50 });
  validateX402mInput('x402m.register', { handle: 'musebot-8', name: 'musebot', templateId: 'musebot' });
  assert.throws(() => validateX402mInput('x402m.register', { handle: 'h', name: 'n', templateId: 'other' }), /templateId/);
  assert.throws(() => validateX402mInput('x402m.link', {}), /directoryAgentId/);
  assert.throws(() => validateX402mInput('x402m.ack', { id: 'x'.repeat(129) }), /id/);
});
test('reply requestId stays within 128 chars and is stable', () => {
  assert.equal(replyRequestId('abc'), 'reply:abc');
  const long = 'm'.repeat(128);
  assert.ok(replyRequestId(long).length <= 128);
  assert.equal(replyRequestId(long), replyRequestId(long));
});
test('client rejects invalid input before signing', async () => {
  const c = new X402mClient({ agentId: 'a', privateKey: {}, fetchImpl: () => { throw new Error('no network'); } });
  await assert.rejects(c.execute('x402m.inbox', { limit: 500 }), /limit/);
});
