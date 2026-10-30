# Architecture

Planboard is a local Node.js service, browser client, and agent skill. It has no hosted backend or provider account of its own.

| Layer | Responsibility |
| --- | --- |
| `src/plans.mjs` and schema modules | Normalize and validate presentations; persist revisions, annotations, discussions, approval receipts, and review baselines. |
| `src/markdown-plan.mjs` | Archive the source Markdown and preserve the reviewed document through export. |
| `src/server.mjs` and `web/` | Serve the local review UI and API; publish progress and revision events. |
| `src/harness-session.mjs` and `src/mcp.mjs` | Connect a standard MCP host to request queues and explicit progress/answers. |
| `src/extension.ts` | Register native Pi tools and the explicit `/planboard` command. |
| `skills/planboard/` | Teach the agent when to open a review and how to author faithful, useful presentations. |

The browser has no model credentials and never calls a provider. The host handles ordinary MCP requests. Optional fast-model adapters are separate from the default contract; the standalone CLI opts into Pi only with `--pi`.

Storage remains `.pi/plans/` across all hosts for compatibility. Saves and patches check revisions; stale work must be reconciled. Approval captures a specific immutable document and receipt. Changing highlight visibility never rewrites plan history. Existing older records are normalized when read.

The server binds to loopback and checks local request origins. It is a single-user tool for trusted local projects, not a multi-tenant public service. Agent permissions and project trust remain the host's responsibility. Review [SECURITY.md](../SECURITY.md) before exposing a remote preview.

Formative is an optional earlier discovery step. There are no shared imports, runtime services, or installation dependencies between the projects; an ordinary Markdown plan is the handoff.
