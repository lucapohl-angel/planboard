# Install Planboard

Use Node.js **24 or newer**, npm, and a local browser. The tools run on your computer. An agent account is needed for agent work; no additional provider key is required by Planboard itself. Claude Code and Codex use their own configured agent through MCP. Pi uses its native extension.

## Get the runtime

```bash
git clone https://github.com/lucapohl-angel/planboard.git
cd planboard
npm ci
```

Keep the checkout in place after installation: skill links and MCP commands point to it. Commands below run from this directory. You do not need to install the other project.

## Claude Code

```bash
node scripts/install-skill.mjs --agent claude
claude mcp add --scope user --transport stdio planboard -- node "$PWD/src/mcp.mjs"
```

Start a new Claude Code session in the project you want to work on. Invoke `/planboard` to review an existing Markdown plan. The skill is linked under `~/.claude/skills/planboard`. Existing unrelated skills are never overwritten by the installer.

Verify the connection with `claude mcp list` or `/mcp` in the session. If you already configured a server pointing to this checkout under another name, reuse it or remove the old registration instead of connecting twice.

## Codex

```bash
node scripts/install-skill.mjs --agent codex
codex mcp add planboard -- node "$PWD/src/mcp.mjs"
```

Start a new Codex session in your project and invoke `$planboard`. The installer uses the documented user skill directory, `~/.agents/skills/planboard`. Check the server with `codex mcp list` and the session's MCP tool list. The skill and MCP server are both needed for the integrated workflow.

## Pi

After the runtime setup above:

```bash
pi install "$PWD"
```

Run `/reload` in an existing Pi session or start a new one. Invoke `/planboard` in the project you want to work on. The package declares its extension and skill; a second MCP connection is unnecessary. Pi remains optional for Claude Code and Codex installations.

## Windows PowerShell

Use the same clone, npm, and skill-installer commands. For MCP registration, replace the shell-specific `$PWD` command above with:

```powershell
$Repo = (Get-Location).Path
claude mcp add --scope user --transport stdio planboard -- node "$Repo\src\mcp.mjs"
codex mcp add planboard -- node "$Repo\src\mcp.mjs"
# Pi instead:
pi install $Repo
```

The installer creates a directory junction on Windows and a directory symlink elsewhere. Linux is exercised in CI; the commands are written portably, but Windows and macOS are not yet end-to-end tested.

## Other agents and plain CLI

Any local agent that can read skill files and use a stdio MCP server can follow the same workflow. Configure the server command `node src/mcp.mjs` using an absolute path to its entry file, then supply `skills/planboard/SKILL.md` as instructions. Project operations require an explicit absolute `cwd`; the MCP installation directory is not your working project.

MCP feedback requires an active `wait` loop. A host that supports background agents can delegate that loop to a dedicated worker. An idle or disconnected host does not automatically receive new prompts. See [usage and feedback](usage.md) for recovery and the CLI fallback.

## Updates and removal

Update the checkout with `git pull --ff-only`, then run `npm ci`. Restart the agent/MCP server; Pi users can run `/reload`. Restart active previews after an update.

To remove the MCP registration, use `codex mcp remove planboard` or `claude mcp remove --scope user planboard`. For Pi, use `pi remove /absolute/path/to/planboard`. Remove only the corresponding skill symlink/junction if desired. Project plans and feedback remain in their project directories.

## Troubleshooting

- **Skill not found:** check the installer output, the linked checkout, and the agent's skill list; restart the session.
- **Tool not found:** check MCP registration and stderr. Use an absolute entry-file path and Node 24+.
- **Preview missing:** keep the runtime process alive and open its printed loopback URL.
- **Feedback waits indefinitely:** make sure the owning agent or its background worker is actively calling `wait`; a saved note is not proof an agent is processing it.
- **Remote/SSH agent:** the browser must reach the machine running the server. Use a trusted SSH tunnel; these are local tools, not public hosted services.

Setup references: [Codex skills](https://learn.chatgpt.com/docs/build-skills), [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli), [Claude Code skills](https://code.claude.com/docs/en/skills), [Claude Code MCP](https://code.claude.com/docs/en/mcp), [Pi](https://pi.dev/).
