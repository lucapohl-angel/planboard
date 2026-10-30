# Install Planboard

Use **Node.js 24+**, npm, and a local browser. Each project works independently. Claude Code and Codex use their own configured agent through MCP; Pi uses the native extension. No additional provider key is required by Planboard.

## Pi

```bash
pi install npm:@koboimomo/planboard
```

Run `/reload` or start a new Pi session, then invoke `/planboard` in your project. The package declares its native extension and skill; a second MCP connection is unnecessary. Pi installs the runtime dependencies. No build step is required.

## Claude Code

```bash
npm install -g @koboimomo/planboard
planboard install-skill --agent claude
claude mcp add --scope user --transport stdio planboard -- planboard mcp
```

Start a new Claude Code session in your project and invoke `/planboard`. The skill is linked under `~/.claude/skills/planboard`. Verify MCP with `claude mcp list` or `/mcp`. Existing unrelated skills are never overwritten.

## Codex

```bash
npm install -g @koboimomo/planboard
planboard install-skill --agent codex
codex mcp add planboard -- planboard mcp
```

Start a new Codex session in your project and invoke `$planboard`. The installer links the skill under `~/.agents/skills/planboard`. Check `codex mcp list` and the session's tool list. The skill and MCP connection are both needed for the integrated workflow.

Use a persistent installation for skill links. An ephemeral `npx` cache is not a suitable permanent skill location. If you already configured this tool under another server name, reuse or remove that registration instead of connecting twice.

## Install from source

For development or a checkout you want to keep in place:

```bash
git clone https://github.com/lucapohl-angel/planboard.git
cd planboard
npm ci
```

From that checkout, choose one integration:

```bash
# Pi
pi install "$PWD"

# Claude Code
node scripts/install-skill.mjs --agent claude
claude mcp add --scope user --transport stdio planboard -- node "$PWD/bin/planboard.mjs" mcp

# Codex
node scripts/install-skill.mjs --agent codex
codex mcp add planboard -- node "$PWD/bin/planboard.mjs" mcp
```

Keep the checkout in place: skill links and MCP commands point to it. If switching from an existing source installation to npm, remove only the old skill symlink and MCP registration before installing the replacement. The installer intentionally refuses to replace a different skill directory. Project plans and feedback remain untouched.

## Windows and macOS

The global npm commands work without shell-specific path syntax. Ensure the agent can find the installed command on PATH. For source setup in PowerShell, replace `$PWD` with `(Get-Location).Path` and use an absolute entry-file path:

```powershell
$Repo = (Get-Location).Path
claude mcp add --scope user --transport stdio planboard -- node "$Repo\bin\planboard.mjs" mcp
codex mcp add planboard -- node "$Repo\bin\planboard.mjs" mcp
```

The installer creates a directory junction on Windows and a directory symlink elsewhere. Local checks cover Linux. CI is configured for Linux; Windows and macOS have not yet been tested end to end.

## Other agents and feedback delivery

Configure the stdio MCP command `planboard mcp`, or run the entry file with Node using its absolute path. Supply `skills/planboard/SKILL.md` as workflow instructions. Project operations require an explicit absolute `cwd`; the installation directory is not the working project.

MCP feedback requires an active `wait` loop. A background worker must actually have access to the MCP tools. An idle or disconnected host cannot be assumed to wake automatically. See [usage](usage.md) for feedback, recovery, and CLI behavior.

## Release archives

[GitHub releases](https://github.com/lucapohl-angel/planboard/releases/latest) include a `.tgz` runtime as an alternative to the registry. Install a downloaded scoped archive with `npm install -g /path/to/koboimomo-planboard-VERSION.tgz`, then use the same agent commands above. Runtime dependencies still download during installation. The original unscoped GitHub release is historical; use the current scoped package.

## Updates and removal

- npm: `npm install -g @koboimomo/planboard@latest`.
- Pi: `pi update npm:@koboimomo/planboard`; use `pi remove npm:@koboimomo/planboard` to uninstall.
- Source: `git pull --ff-only`, then `npm ci`.

Restart the agent/MCP server and active previews after updating; Pi users can run `/reload`. Skill links follow the persistent installation directory.

Remove MCP with `codex mcp remove planboard` or `claude mcp remove --scope user planboard`. Remove only this tool's skill symlink/junction, then use `npm uninstall -g @koboimomo/planboard` if no longer needed. Uninstalling the runtime does not remove project data.

## Troubleshooting

- **Command not found:** check Node 24+, the npm global bin directory, and the agent's PATH. An absolute Node entry-file command is a supported fallback.
- **Skill not found:** check the installer output and linked directory; restart the agent session.
- **Tool missing:** check MCP registration and stderr; avoid duplicate connections.
- **Preview missing:** keep the runtime alive and open its printed loopback URL. Source Formative installations need `npm run build`; npm includes the built assets.
- **Feedback waits:** confirm the owning agent or worker is actively calling `wait`; saving a note does not mean a model processed it.
- **Remote/SSH agent:** use a trusted SSH tunnel to reach the machine running the server. These are local tools, not public hosted services.

Setup references: [Codex skills](https://learn.chatgpt.com/docs/build-skills), [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli), [Claude Code skills](https://code.claude.com/docs/en/skills), [Claude Code MCP](https://code.claude.com/docs/en/mcp), [Pi packages](https://pi.dev/docs/latest/packages).
