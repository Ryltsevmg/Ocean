# Ocean GitHub Actions

Only Ocean-owned workflows belong in `workflows/`. The donor upstream workflows, their governance scripts, and their reference archive are not part of this repository; do not reintroduce their triggers, upstream runners, credentials or publication destinations, and do not reactivate COS, package registry, website, policy-bot or self-hosted runner jobs. Keep packaging manual and unsigned until the owner approves a release destination, signing identity and suitable runners.

Use read-only repository permissions, SHA-pinned actions, nonpersistent checkout credentials, hosted runners and explicit timeouts. Do not use `pull_request_target`, signing credentials or publication jobs for untrusted code.

<a id="ocean-qualification"></a>
## Ocean qualification

[Ocean verification](workflows/ocean-verify.yml) is configured for pushes and pull requests targeting `main`, plus manual dispatch, in `Ryltsevmg/Ocean`. It selects offline release-policy tests, build and type checks, localization checks and focused plugin, UI and Codex tests. This is not exhaustive regression coverage, live authentication or visual acceptance.

[Linux packaging](workflows/ocean-package-linux.yml) requires manual dispatch on `main`. Its file-scoped push event registers the definition but does not run packaging. Separate x64 and ARM64 dispatches select native hosted Ubuntu runners. Unsigned archives, SHA-256 checksums and build metadata are retained as workflow artifacts for seven days, not GitHub Releases or an update feed. Both workflows use read-only repository access without signing or deployment secrets.

Hosted execution has not been verified here. Configured tool versions alone do not establish runner availability, quota, memory, native dependency support or download access. Local checks do not qualify hosted CI. Full regression and macOS/Windows packaging and signing are outside these definitions.

<a id="release-prerequisites"></a>
## Release prerequisites

Before publication, verify an Ocean-owned destination and update feed; approve a signing identity, protected release environment and trusted runner; verify key storage, rotation and recovery; test installed-app updates and rollback. macOS needs Developer ID and notarization; Windows needs its approved code-signing setup. Linux needs trusted signature verification plus installation and recovery adapters; offline signing helpers and pure policies alone do not implement an updater. Checksums do not authenticate the publisher. These workflows neither generate nor upload keys or certificates.
