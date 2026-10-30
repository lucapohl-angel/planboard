# Publishing Planboard

The registry package is `@koboimomo/planboard`. GitHub releases and npm publication are separate steps; verify both before announcing a release.

## Prepare and publish

1. Use `npm whoami` to verify publisher access. Complete npm's browser or two-factor prompts yourself; never commit credentials.
2. Update the version, changelog, lockfile, and any affected guides. Keep the explicit `files` allowlist, public `publishConfig`, executable name, and Pi manifest.
3. Run the documented checks and `npm publish --dry-run`. Install the packed archive into a fresh prefix and verify the CLI, skill installer, MCP lifecycle, and browser assets. Formative's `prepack` builds its browser assets.
4. Commit the tested release, then run `npm publish --access public`. Confirm the exact registry version and install it into a fresh prefix. A successful pack/dry run is not publication.
5. Tag the release and publish GitHub notes and the matching archive. Keep the previous tags immutable.

## Later releases through GitHub Actions

The manual `.github/workflows/publish.yml` workflow uses npm trusted publishing (OIDC), without a stored npm token. After the first package exists, configure its trusted publisher in npm package settings with GitHub owner `lucapohl-angel`, repository `planboard`, workflow filename `publish.yml`, and permission to publish. GitHub-hosted runners must be available. Repository metadata must identify this repository.

Once configured, dispatch the workflow on a matching release tag:

```bash
gh workflow run publish.yml --repo lucapohl-angel/planboard --ref vVERSION
```

The workflow rejects private packages and mismatched tags, runs checks, and then publishes. It does not run on an ordinary push or pull request. Check the workflow result and registry version before creating or updating release announcements. npm's trusted publisher configuration has a time limit for its first successful use; follow the current npm setup instructions.

[Scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/) · [Trusted publishing](https://docs.npmjs.com/trusted-publishers/)
