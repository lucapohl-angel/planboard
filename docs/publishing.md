# Publishing Planboard

GitHub releases and npm registry publication are separate. The first GitHub release includes a tested runtime archive. Registry publication is being prepared; do not advertise a registry install command until that exact package/version exists.

## First npm publication

1. Sign in locally with `npm login` and verify the intended account using `npm whoami`. Complete npm's browser or two-factor prompts yourself; never put credentials into a repository or chat.
2. Choose a package name the account owns. `formative` is an unrelated existing package, so prefer a consistent user/organization scope for both tools. The CLI names and skill names remain `planboard` and `formative` regardless of the npm scope.
3. Set the final `package.json` name, remove `private: true`, and set `publishConfig` to `{"access":"public","registry":"https://registry.npmjs.org/"}`. Update the lockfile, installation guides, and version. Keep the explicit `files` allowlist and Pi manifest.
4. Run the documented checks, `npm publish --dry-run`, and a fresh archive install. Verify the executable, skill installer, MCP lifecycle, and browser assets. Formative must be built before packing; its `prepack` script does this.
5. Commit and tag the tested release. Run `npm publish --access public` from the checkout, completing npm authentication if requested. Confirm the exact registry version and install it into a temporary prefix before announcing availability. A successful pack/dry run is not a published package.

## Later releases through GitHub Actions

The manual `.github/workflows/publish.yml` workflow uses npm trusted publishing (OIDC), without a stored npm token. After the first package exists, configure its trusted publisher in npm package settings with GitHub owner `lucapohl-angel`, repository `planboard`, workflow filename `publish.yml`, and permission to publish. GitHub-hosted runners must be available. Repository metadata must identify this repository.

Once configured, dispatch the workflow on a matching release tag:

```bash
gh workflow run publish.yml --repo lucapohl-angel/planboard --ref vVERSION
```

The workflow rejects private packages and mismatched tags, runs checks, and then publishes. It does not run on an ordinary push or pull request. Check the workflow result and registry version before creating or updating release announcements. npm's trusted publisher configuration has a time limit for its first successful use; follow the current npm setup instructions.

[Scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/) · [Trusted publishing](https://docs.npmjs.com/trusted-publishers/)
