# Contributing

Open an issue with the behavior you want to change and a small reproducible example. Keep examples fictional; do not include project plans, credentials, agent sessions, or personal data.

Use Node 24+ and run `npm ci`. Read [architecture](docs/architecture.md) and the skill before changing a workflow. Keep host-specific behavior in adapters and preserve saved-data compatibility.

Run `npm run test:unit`. For browser coverage, run `npx playwright install chromium` and `npm run test:browser`. Set `PLANBOARD_BROWSER_CHANNEL=msedge` to use an installed Edge instead. Native Pi integration tests run when Pi is available; set `PLANBOARD_PI_CORE` to its installed `dist/core` directory if automatic discovery cannot find it.

Before a release, run `npm run check:release` and inspect `npm pack --dry-run`. Test a fresh checkout, the documented install commands, and the appropriate MCP lifecycle. Explain what was actually tested; protocol tests do not establish live-model quality. Keep screenshot assets under `docs/media/` and use synthetic data only.

Changes should include focused behavior checks when they affect persistence, permissions, lifecycle, or feedback. Preserve original Markdown and user edits. Approval of a reviewed plan never authorizes implementing it.
