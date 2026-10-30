# Review a plan

Invoke `$planboard` in Codex or `/planboard` in Claude Code/Pi. Supply a Markdown path if you already have one. With no path, the owning agent uses the current conversation's plan, saving it as Markdown when necessary. If the plan is ambiguous, it resolves that before opening the review.

The agent authors a structured presentation that preserves the original document. This is more than automatically converting Markdown headings into boxes: diagrams and walkthroughs need meaningful labels, relationships, and explanations. The skill guides the agent, while the runtime validates its data.

## Read and respond

Open the local URL returned by the tool. Expand sections, follow diagram walkthroughs, inspect components and their connections, and follow source references back to the original Markdown. Select text or a node to anchor feedback. Ask a question for an answer, request a change, or save notes and submit them together. Manual text edits do not require a model call.

The separate Changes control shows revision history and comparison highlights. Moving or clearing the highlight baseline changes what is emphasized, not the plan history. Undo is checked against later changes; conflicts remain visible instead of silently overwriting newer work.

Approval belongs to the exact displayed revision. It saves an immutable Markdown copy and receipt. The owning agent returns the approved file path and asks about implementation separately. Approval never starts implementation automatically.

## Agent connection

Pi's native extension can deliver browser feedback into the owning session. Claude Code and Codex use the shared stdio MCP server: their agent calls `plan_board` with explicit absolute `cwd`, saves/opens a plan, and keeps a `wait` loop active while you review. The next request is handled through `read`, `patch`, `answer`, and `complete` as appropriate. A host may delegate this loop if its worker can use the tools.

MCP does not universally wake an idle agent. If no consumer is waiting, feedback remains queued. Default waits last 45 seconds (maximum 50); idle repeats need another host turn. Disconnects preserve records for retry. Stop the review loop when you explicitly finish or stop. See the [agent contract](../skills/planboard/references/harnesses.md) for tool details and recovery.

The standard MCP workflow uses the owning agent and requires no particular model. `PLANBOARD_FAST_HOST=codex` explicitly enables an optional Codex subprocess adapter for bounded questions/wording changes. It requires an authenticated Codex CLI and access to its configured model; leave it unset for the portable host-owned workflow. Native Pi can use its available model registry for fast requests.

## Local files and offline mode

Records remain under the project's `.pi/plans/` for backward compatibility, including with Claude Code and Codex. The name does not imply a Pi dependency. The source Markdown stays in your project; approved snapshots and receipts are versioned with the review records. These files can contain private plans and conversations, so choose deliberately what enters version control.

`npm run demo` opens fictional sample data in a temporary directory, without an agent. To reopen an existing saved review offline, run `node /path/to/planboard/bin/planboard.mjs /absolute/project`. The optional `--pi` mode starts a standalone Pi reviewer; it is not the default for other agents. Ctrl+C stops the server. Offline notes remain saved but cannot receive an agent answer until a consumer is connected.
