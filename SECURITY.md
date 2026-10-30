# Security and local data

Planboard is a local, single-user tool. Its browser server binds to loopback and validates request origin/host and the relevant session capability. Do not expose it directly to the internet.

Agent connections can read and modify the project directory selected through their tools. Use trusted project folders and the host's normal tool permissions. The browser does not receive model credentials. Sending feedback to an agent is subject to that agent/provider's data policy.

Project records, feedback, source documents, and review exports are user data. They are excluded from this repository. Public examples and screenshots are fictional. Custom components are trusted developer code, not a sandbox for untrusted plugins.

Report a reproducible security issue through GitHub's private vulnerability reporting when available. Do not publish credentials or private plans in an issue. No security audit or suitability for multi-user hosting is claimed.
