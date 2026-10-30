# Harness setup

Invocation is explicit only: Pi and Claude read `disable-model-invocation: true`; Codex reads `agents/openai.yaml` with `allow_implicit_invocation: false`. Do not auto-trigger from plan mode or draft completion. Browser feedback continues the review the user already started.

The browser and storage are shared. Pi uses a native extension; other hosts use the stdio MCP server. The browser never runs a model or reads credentials. Architecture work stays with the host session. MCP feedback uses the owning host by default. An optional Codex fast adapter can be enabled explicitly; native Pi can use its configured model registry. No specific provider is required for the standard MCP workflow.

From the kit directory, install its locked transport dependency with `npm ci --omit=peer`. Only the MCP server needs that SDK; native Pi still supplies its own extension API. Run MCP with `node /absolute/path/to/planboard/src/mcp.mjs`.

- **Pi / Orca:** keep the package in Pi settings and the planboard skill installed; `/reload` after changes. Use native `plan_board`, not a second MCP connection in the same session. `/planboard [file.md|id]` starts an explicit review. With no argument, the owning agent uses the current conversation draft and saves Markdown if needed.
- **Codex:** `codex mcp add planboard -- node /absolute/path/to/planboard/src/mcp.mjs`. Install this skill under `~/.agents/skills/planboard`. Start a new session to load the tool and skill. Invoke `$planboard`; the optional `prompts/planboard.md` wrapper installed under `~/.codex/prompts/planboard.md` exposes `/prompts:planboard` in the current CLI. Codex does not document a bare `/planboard` custom command.
- **Claude Code:** `claude mcp add --scope user --transport stdio planboard -- node /absolute/path/to/planboard/src/mcp.mjs`. Install this skill under `~/.claude/skills/planboard`. Invoke `/planboard` (optional plan path). Reconnect through `/mcp` or start a new session.
- **Other MCP hosts:** configure the same command and argument, and supply this skill's workflow instructions. Hosts without MCP need an adapter; compatibility with arbitrary harnesses is not automatic.

MCP actions have the same `save/read/patch/inbox/answer/open/catalog/list` contract as Pi, plus `wait/progress/complete`; both also support `undo/reconcile`. Pass `cwd` explicitly on every project action; a server's startup directory is not reliably the user's project. Use `markdownPath` on the first save. For example: `plan_board({action:"save",cwd:"/project",markdownPath:"plans/release.md",plan:...})`, then `open` with its returned ID.

The agent calls `wait` while the user reviews. It blocks without a model call until feedback arrives or its timeout expires (default 45 seconds, maximum 50). Repeating an idle wait requires another host turn and can consume tokens. Standard MCP does not guarantee background push into an idle host. Do not promise an always-on agent; keep the review loop active until approval or a stop request. Pi's native extension can directly push follow-ups instead.

Use `progress` only for short public updates. MCP exposes explicit progress and saved edits, not an automatic stream of the host's private reasoning or unrelated tool activity. `answer` completes a discussion. `complete` acknowledges a submitted annotation batch or approval by requestId. Approval returns an immutable Markdown path and receipt. The owning agent shows the path and review URL, then asks whether the user wants implementation; it never starts automatically.

Notes remain local until sent. Disconnecting queues unfinished requests for retry; reconcile the latest revision before replaying work. Existing records and source archives are preserved. `.pi/plans/` remains the shared storage location for compatibility, including when the host is not Pi.

`node src/cli.mjs /project` is an offline viewer. `--pi` explicitly opts into the older standalone Pi reviewer; do not use it as the default connection from other harnesses.

Protocol references: [Codex MCP](https://developers.openai.com/codex/mcp/), [Claude Code MCP](https://code.claude.com/docs/en/mcp), [MCP tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools).

## Public activity and focused reads

`progress` reports a short public summary to the current request. MCP hosts may include `toolName`, a stable `toolCallId`, and `toolStatus` (`running`, `complete`, `error`) to expose tool lifecycle metadata without arguments or output. Native Pi reports these events automatically. Private thinking is excluded. MCP cannot automatically observe tools outside this server.

`read` accepts optional `paths`: use `["technologies/sessions"]` for a component or `["plan"]` for the reviewed presentation without the source archive and discussion history. Omit paths for a complete record. `answer` returns a compact saved-status acknowledgement; it does not repeat the response and historical quote.


## Fast model adapters

Automatic Codex subprocess routing is opt-in: set `PLANBOARD_FAST_HOST=codex` in the MCP server environment only if you want it. Client-name detection alone does not enable it. Quick calls run `codex exec --model gpt-6-luna` with low reasoning, an ephemeral read-only working directory, no project files, no inherited MCP servers, and disabled shell/apps/plugins/memories/subagents. The child emits a bounded structured answer or one selected wording change; the server validates and commits it. Architecture work returns through `wait` to the open session. The Codex CLI must be installed, authenticated and have Luna access. Failure remains retryable and never triggers another provider.

Pi selects Luna first when available, then an available Flash or other configured fast-family model. `PLANBOARD_FAST_MODEL=provider/model-id` pins a supported fast model from its available registry. Native Pi uses a nested model call without changing the open session model. Standalone Pi sets the worker model per request and restores the original model/reasoning for architecture. Standalone approval cannot wake an unrelated agent; reopen it through the owning agent for implementation handoff.

Reconnecting MCP or reloading the Pi extension is required after adapter/schema changes. Browser reload alone only updates the UI.
