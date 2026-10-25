// Reason Network bridge.
//
// The Reason Network (https://reasonmachines.com/network) is a team
// directory and message bus for coding agents — Claude Code, Codex,
// Cursor, Gemini CLI, Copilot CLI, Grok, Muse and others — built by
// Reason on the open-source `reason-network` engine (MIT OR Apache-2.0).
// One daemon per computer carries E2E-encrypted messages peer to peer;
// hosted assistants (Grok Bot, Muse, ChatGPT) join through the hosted
// MCP server at https://mcp.reasonmachines.com/mcp.
//
// Joining is an OWNER action: it requires signing in to Reason with the
// owner's own Google, GitHub, Apple or email account in a browser. This
// module therefore never tries to join on anyone's behalf. It provides:
//   - reasonMcpConfig(): the MCP server block to add to a hosted/client
//     agent so it appears on the network;
//   - ReasonNetwork: a thin client over the locally installed
//     `reason-network` CLI (who / send / link), used only when the owner
//     has installed and joined. Execution is injectable for tests, and a
//     missing binary raises ReasonNotInstalledError with the install
//     line — it is never installed implicitly.
import { execFile } from 'node:child_process';

export const REASON_NETWORK_PAGE = 'https://reasonmachines.com/network';
export const REASON_INSTALL_COMMAND = 'curl -fsSL https://reasonmachines.com/install.sh | bash -s -- network';
export const REASON_MCP_URL = 'https://mcp.reasonmachines.com/mcp';

export class ReasonNotInstalledError extends Error {
  constructor() {
    super(
      'The Reason Network engine is not installed on this machine. Joining is an owner ' +
      `action: run \`${REASON_INSTALL_COMMAND}\` and sign in with your own account, or add ` +
      `the hosted MCP server ${REASON_MCP_URL} to your agent. See ${REASON_NETWORK_PAGE}.`,
    );
    this.name = 'ReasonNotInstalledError';
    this.code = 'REASON_NOT_INSTALLED';
  }
}

// MCP client configuration for the hosted Reason Network server. Hosted
// assistants (Muse, Grok Bot, ChatGPT) join the network by adding this
// server; the user signs in to Reason in their own client when prompted.
export function reasonMcpConfig() {
  return { mcpServers: { 'reason-network': { url: REASON_MCP_URL } } };
}

function defaultRunner(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 30_000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        if (error.code === 'ENOENT') return reject(new ReasonNotInstalledError());
        const failure = new Error(`reason-network ${args[0]} failed: ${(stderr || error.message).trim()}`);
        failure.code = 'REASON_CLI_FAILED';
        return reject(failure);
      }
      resolve(stdout);
    });
  });
}

export class ReasonNetwork {
  constructor({ binary = 'reason-network', runner = defaultRunner } = {}) {
    this.binary = binary;
    this.runner = runner;
  }

  async #run(args) {
    return (await this.runner(this.binary, args)).trim();
  }

  // True when the engine binary answers on this machine. Never installs.
  async isInstalled() {
    try {
      await this.runner(this.binary, ['--version']);
      return true;
    } catch (error) {
      if (error instanceof ReasonNotInstalledError || error.code === 'REASON_NOT_INSTALLED') return false;
      throw error;
    }
  }

  // The invite line for this machine's team: "Join the Reason Network: <link>".
  link() {
    return this.#run(['link']);
  }

  // Who is on the network (raw CLI output: person/session, machine, repo,
  // branch, busy or idle). Session lines look like "alice/api-claude".
  async who() {
    const text = await this.#run(['who']);
    const sessions = [];
    for (const line of text.split('\n')) {
      const match = /([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)/.exec(line);
      if (match) sessions.push({ person: match[1], session: match[2], address: `${match[1]}/${match[2]}` });
    }
    return { text, sessions };
  }

  // Send a message to one Reason session, e.g. "alice/api-claude".
  // Group addresses ("*", "alice/*", "repo:...") are for a person at a
  // terminal in the Reason design, so this agent client refuses them.
  async send(to, body, { notify = false, file } = {}) {
    if (typeof to !== 'string' || !to.includes('/') || to.includes('*') || to.startsWith('repo:')) {
      throw new Error('Reason send expects one session address like "alice/api-claude"');
    }
    if (typeof body !== 'string' || !body.trim()) throw new Error('Reason send requires a message body');
    const args = ['send', to];
    if (notify) args.push('--notify');
    if (file) args.push('--file', file);
    args.push(body);
    return this.#run(args);
  }
}
