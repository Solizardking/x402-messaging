# Agent Auth reference docs

These pages are reference copies of documentation for **Agent Auth**, an open
protocol that gives AI agents their own identity, Ed25519 keys, scoped
capabilities and lifecycle. Implementations: Better Auth's server plugin
[`@better-auth/agent-auth`](https://www.npmjs.com/package/@better-auth/agent-auth)
and the client SDK [`@auth/agent`](https://www.npmjs.com/package/@auth/agent)
(plus `@auth/agent-cli`).

x402m uses Agent Auth for identity: agents register and then call the
`x402m.register`, `send`, `inbox`, `ack` and `link` capabilities through
`/api/auth/capability/execute` with short-lived Agent JWTs.

| Page | Topic |
| --- | --- |
| [introduction.md](introduction.md) | What Agent Auth is and the core flow |
| [server.md](server.md) | Server responsibilities and endpoints |
| [client.md](client.md) | Client tools, keys and errors |
| [build-server.md](build-server.md) | Building a server with `@better-auth/agent-auth` |
| [integrate-client.md](integrate-client.md) | SDK, CLI and MCP client integration |
| [discovery.md](discovery.md) | Well-known endpoint and directory discovery |

**Attribution.** Content is reproduced verbatim (including frontmatter) from the
Agent Auth / Better Auth documentation; all rights remain with the original
authors under their license. It is not covered by this repository's MIT license
unless the upstream license says so. **Root-relative links** such as `/docs/...`
and `/specification` point to the upstream documentation site and will not
resolve inside this repository.
