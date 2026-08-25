# Releasing Gankr

Releases are built by `.github/workflows/release.yml` on a Windows runner and an Ubuntu
runner, triggered by pushing a tag matching `v*`. The workflow always publishes a **draft**
release — nothing goes out automatically, because a client that sees a partial release (one
platform's artifacts missing, or a missing `latest.yml`) fails to update.

## Steps

1. Bump the version in `package.json` (`"version"` field, no `v` prefix).
2. Commit the version bump.
3. Tag the commit: `git tag vX.Y.Z` (matches the version in `package.json`, `v` prefix).
4. Push the commit and the tag: `git push origin main` then `git push origin vX.Y.Z`.
5. Wait for both CI legs (Windows and Ubuntu) to finish in the Actions tab.
6. Open the draft release on GitHub and confirm **both** artifact sets are present:
   - `Gankr-Setup-X.Y.Z.exe` and `latest.yml` (Windows)
   - `Gankr-X.Y.Z.AppImage` and `latest-linux.yml` (Linux)
7. Download and smoke-test at least the Windows installer.
8. Edit the release notes.
9. Publish the draft.

## If a leg fails

Delete the draft release and the tag, fix the problem, and re-tag. Never publish a partial
release — a client that only sees one platform's artifacts, or a release missing its
`latest.yml`, will fail to update.

```
git tag -d vX.Y.Z
git push origin :refs/tags/vX.Y.Z
```

Then delete the draft release itself from the GitHub UI before re-tagging.

## Code signing

Windows signing reads `CSC_LINK` and `CSC_KEY_PASSWORD` from repo secrets
(Settings → Secrets and variables → Actions). Until those secrets exist, electron-builder
skips signing with a warning and the build still succeeds unsigned — no workflow changes are
needed when the certificate is added later, the same `env:` block starts feeding it real
values immediately. The Linux AppImage is never signed, by design.

## Local, unpublished smoke build

To sanity-check packaging without publishing anything, run:

```
npm run build:unpacked
```

This runs `electron-vite build` followed by `electron-builder --dir`, producing an unpacked
app under `dist/` for the host OS. It never touches GitHub.
