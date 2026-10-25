import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReasonNetwork, ReasonNotInstalledError, reasonMcpConfig, REASON_MCP_URL } from './reason.mjs';

test('hosted assistants join through the MCP server config', () => {
  assert.deepEqual(reasonMcpConfig(), { mcpServers: { 'reason-network': { url: REASON_MCP_URL } } });
  assert.equal(REASON_MCP_URL, 'https://mcp.reasonmachines.com/mcp');
});

test('who parses person/session addresses from CLI output', async () => {
  const runner = async () => 'alice/api-claude  busy  acme/api@feat/auth\nmaya/codex  idle  acme/web@main\n';
  const { sessions, text } = await new ReasonNetwork({ runner }).who();
  assert.ok(text.includes('api-claude'));
  assert.deepEqual(sessions.map((s) => s.address), ['alice/api-claude', 'maya/codex']);
});

test('send builds the CLI call and refuses group addresses', async () => {
  const calls = [];
  const runner = async (binary, args) => { calls.push(args); return 'delivered'; };
  const reason = new ReasonNetwork({ runner });
  assert.equal(await reason.send('maya/codex', 'Does the webhook retry on 5xx?'), 'delivered');
  assert.deepEqual(calls[0], ['send', 'maya/codex', 'Does the webhook retry on 5xx?']);
  await assert.rejects(() => reason.send('*', 'broadcast'), /one session address/);
  await assert.rejects(() => reason.send('repo:acme/api', 'broadcast'), /one session address/);
});

test('a missing binary surfaces install guidance, never installs', async () => {
  const runner = async () => { throw new ReasonNotInstalledError(); };
  const reason = new ReasonNetwork({ runner });
  assert.equal(await reason.isInstalled(), false);
  await assert.rejects(() => reason.who(), (error) => {
    assert.equal(error.code, 'REASON_NOT_INSTALLED');
    assert.match(error.message, /install\.sh/);
    assert.match(error.message, /owner/);
    return true;
  });
});
