# Ocean GitHub Actions

Only Ocean-owned workflows belong in `workflows/`. The donor upstream workflows, their governance scripts, and their reference archive are not part of this repository; do not reintroduce their triggers, upstream runners, credentials or publication destinations, and do not reactivate COS, package registry, website, policy-bot or self-hosted runner jobs. Keep packaging manual and unsigned until the owner approves a release destination, signing identity and suitable runners.

Use read-only repository permissions, SHA-pinned actions, nonpersistent checkout credentials, hosted runners and explicit timeouts. Do not use `pull_request_target`, signing credentials or publication jobs for untrusted code.

<a id="ocean-qualification"></a>
## Ocean qualification

[Ocean verification](workflows/ocean-verify.yml) is configured for pushes and pull requests targeting `main`, plus manual dispatch, in `Ryltsevmg/Ocean`. Separate hosted jobs run static checks, the unit inventory with per-file coverage, and built CLI, Session, Python SDK and Web comparisons. Coverage-heavy exemptions run uninstrumented once. Build stages and each job’s test workers are bounded independently; the workflow owns their exact limits. All replay is keyless and compares committed expected output.

[Linux packaging](workflows/ocean-package-linux.yml) and [Windows packaging](workflows/ocean-package-windows.yml) require manual dispatch on `main`. Their file-scoped push events register the definitions but do not run packaging. Separate Linux x64 and ARM64 dispatches select native hosted Ubuntu runners; Windows x64 selects a hosted Windows runner. An optional `build_version` input packages an extended prerelease build version whose prefix must match the checkout product version; empty packages the checkout version. Unsigned archives/installers, SHA-256 checksums and build metadata are retained as workflow artifacts for seven days, not GitHub Releases or an update feed. These workflows use read-only repository access without signing or deployment secrets.

Hosted execution has not been verified here. Configured checks and tool versions do not establish runner availability, quota, memory, native dependency support or download access. Local checks do not qualify hosted CI. Live authentication, real-model tests, performance benchmarks, compatibility matrices, installed Python wheels, macOS packaging, and macOS/Windows signing are outside these definitions.

<a id="release-prerequisites"></a>
## Release prerequisites

Before publication, verify an Ocean-owned destination and update feed; approve a signing identity, protected release environment and trusted runner; verify key storage, rotation and recovery; test installed-app updates and rollback. macOS needs Developer ID and notarization; Windows needs its approved code-signing setup. Linux needs trusted signature verification plus installation and recovery adapters; offline signing helpers and pure policies alone do not implement an updater. Checksums do not authenticate the publisher. These workflows neither generate nor upload keys or certificates.
