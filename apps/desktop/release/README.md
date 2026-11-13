# Ocean Linux release preparation

English | [中文](README.zh.md)

Reference: offline verification and remaining installation requirements. This directory does not enable automatic updates or publish releases.

## Current implementation

`../scripts/ocean-release-manifest.mjs` prepares exact unsigned JSON bytes and verifies detached Ed25519 signatures against a public key supplied independently by the caller. The public key must come from an approved, pinned trust store, never from the manifest or its download endpoint. SHA-256 and size bind the archive to the signed metadata. Product, architecture, channel, expiry, and a caller-supplied monotonic sequence floor are checked before returning authenticated metadata. The expiry interval is at most seven days. The final artifact path must be a regular file, not a symlink. Verification is offline; it does not extract, install, switch launchers, alter profiles, or restart processes.

The verifier accepts an artifact path separately because download caches may use temporary names. Its result is a point-in-time integrity check, not authorization to install or a guarantee against subsequent file replacement. An installer must protect its staging directory and reverify the bytes it consumes. A checksum file alone is not proof of publisher identity. The tests use a publicly known RFC 8032 key solely as a fixture; it must never be trusted in a released client.

The manual GitHub package workflow targets native `ubuntu-24.04` x64 or `ubuntu-24.04-arm` ARM64 runners, checks native architecture, and retains unsigned archives, checksums, and source/run metadata for review. Both architectures require separate successful dispatches. Hosted ARM64 access, native package contents, and packaged UI execution remain qualification requirements. Build evidence is informational and is not a signed attestation. No workflow creates signing keys or publishes artifacts as a release.

Run the offline tests with `node --test apps/desktop/scripts/ocean-release-signing.test.mjs apps/desktop/scripts/ocean-release-manifest.test.mjs apps/desktop/scripts/ocean-linux-update-policy.test.mjs apps/desktop/scripts/ocean-linux-archive-policy.test.mjs` from the repository root. Existing Electron update/task-drain tests remain independently required; this test does not exercise installation.

## Offline operator signing

`../scripts/ocean-release-signing.mjs` pins the new Ocean Electron Ed25519 publisher key `ocean-electron-release-v1`. Its SPKI SHA-256 fingerprint is `91f3e2aeb0880fa5ec0550ad5a76d99bec1496a92ff4b440fd449eaf39d7289f`. Only the public key is committed. The old project's release key is not reused. `verifyOceanRelease` uses this fixed pin, not an input-supplied publisher key; it is an offline helper, not yet an installed updater integration.

The operator keeps the private PKCS8 PEM outside the repository in a private local directory (0700), file mode 0600. Local storage alone is not an independent backup: confirm a separately recoverable Bitwarden copy before a public release. Do not put the private key in arguments, logs, artifacts, or general CI secrets. The signing command accepts a **path**, never the private key itself. It refuses symlinks, hardlinks, loose permissions, a mismatched key and an existing output. It verifies the signature and artifact before writing public release metadata. A partial output after an I/O error is not a release; do not publish it.

After reviewing the source revision and built archive, choose an unused, monotonically increasing sequence and ISO timestamps no more than seven days apart. Example (replace every placeholder; this does not publish):

```sh
node apps/desktop/scripts/ocean-release-signing.mjs \
  --artifact /absolute/path/ocean-linux-x64.tar.gz \
  --private-key /private/operator/path/ocean-release.private.pem \
  --output /absolute/path/new-signed-metadata \
  --version 0.2.2-rc.3 --sequence 1 --channel nightly --target linux-x64 \
  --created-at <ISO-UTC-created-time> --expires-at <ISO-UTC-expiry-time>
```

Output: `manifest.json` and raw 64-byte `manifest.sig`; neither contains secrets. The command does not update a durable sequence ledger, upload, activate or publish. The operator must prevent sequence reuse and reverify the exact artifact bytes immediately before publication; the signer does not freeze the input archive. This is Linux manifest signing, not macOS notarization or Windows Authenticode.

## Transaction policy

`../scripts/ocean-linux-update-policy.mjs` implements pure, fail-closed decisions for staged → quiescing → ready → activating → checking → complete. Callers must persist each returned record before performing its returned operation. Every event, including failure, must match both the transaction identity and current revision. Installation approval additionally binds the source version, target version, and archive digest. Transaction IDs must be unique and never reused by the journal adapter; all required observations must be explicit. Missing approval, stale verification, unknown or active tasks, an incomplete drain, missing shutdown acknowledgement, or an unverified consistent backup prevents activation. After task drain, activation requires fresh full manifest verification against the current trust store, expiry time, and durable sequence floor; the initial approval-time verification cannot be reused. A changed staged digest or missing retained previous installation also prevents switching. Completion requires both the intended version and runtime readiness.

Every incomplete transaction maps to an inspection requirement after a crash; the policy never automatically replays a switch, restarts a process, downgrades a binary, or restores data. Failure moves the transaction to recovery. A separate binary rollback predicate requires fresh approval, quiescence, a verified previous binary, and explicit profile compatibility; merely having a backup is insufficient. The tests cover interrupted phases, stale events, missing facts, active work, and migrated profiles.

This policy has no filesystem or process effects and is not an installer. Persistence, exclusive transaction ownership, actual extraction, artifact verification, task observations, launcher mutation, health checks, and recovery UI must be implemented by trusted main-process adapters. A renderer must not supply facts such as `taskStateKnown` or `profileCompatibleWithPrevious`; these must come from verified local state. The policy's boolean evidence is not a substitute for performing those checks. Before wiring the rollback predicate, the adapter must bind approval and observations to the exact transaction, retained binary digest, and source/target versions. Normal candidate selection must reject version downgrades even when their release sequence is higher; downgrade recovery is separate. The future journal adapter must reject unknown schemas and use atomic durable writes; a crash during activation requires inspecting both the journal and launcher, since either side effect may have completed.

## Archive layout policy

`../scripts/ocean-linux-archive-policy.mjs` validates parser-resolved application-root metadata without filesystem effects. It rejects absolute/traversing/noncanonical paths, duplicate entries, non-directory ancestors, hardlinks, special files, and malformed Unicode paths, and excessive entry counts (including inferred parent directories) or expanded bytes. Only the bundled Python `bin/python` and `bin/python3` aliases are permitted, both relative to the same included nonempty regular `python3.X` interpreter. This preserves the existing primary-runtime smoke requirement; other links are rejected. Regular files and directories must be materialized before creating these two aliases, never by following an archive-provided link.

This is not a tar parser or extractor. The future adapter must reject unsupported headers, validate effective PAX/GNU paths without first sanitizing traversal, and identify any top-level archive wrapper explicitly. Use a new private staging directory, never an existing installation or profile; reject pre-existing components and enforce actual streamed byte limits. Do not restore archive ownership, setuid/setgid bits or untrusted metadata. Validate the full plan before writes, create directories/files without following links, verify interpreter content/permissions and runtime layout, and create only planned aliases last. Same-user races, staging ownership, immutable verified archive consumption, interruption cleanup and atomic activation remain the adapter's responsibility.

## Installation requirements not implemented here

Linux packages are currently tar archives and deliberately excluded from the inherited publisher. The inherited `electron-updater` integration does not turn those archives into an installer. Do not embed a GitHub personal access token in a client to fetch private releases. Distribution needs an approved HTTPS endpoint or a separately designed authenticated download service, plus an independently approved signing identity and key custody. Existing `OCEAN_DOWNLOAD_ORIGIN` alone is insufficient for Linux installation.

A future installer must stage versioned directories beside the installed application, verify the signed manifest and archive again, reject unsafe archive paths, hardlinks, special files and unsupported symlinks, enforce expanded-size limits, validate the expected executable/runtime layout, and leave the running installation untouched. Installation must be explicit. Reuse the existing main-process task authorization, admission lock, drain, and graceful shutdown flow; unknown status, active work without approval, a failed drain, or shutdown failure must stop installation. No automatic installation on ordinary quit.

Switch only after verified staging and quiescence. Journal each durable step, atomically replace the launcher target, and retain the previous version. A successful launch is not enough: validate local runtime readiness and the resulting version before marking the transaction complete. Interrupted operations need idempotent recovery. Never delete the old version while it is executing or before the owner has a recoverable fallback.

Binary rollback is distinct from data rollback. Ocean session generations and SQLite schema versions are monotonic; an older binary must not open a profile migrated by a newer binary without explicit compatibility evidence. Before an upgrade that can migrate data, make a consistent, verified backup after writes are stopped, including SQLite WAL handling. Rollback must not silently discard work created after upgrade. A backup can contain credentials and private conversations; keep it local, protect its permissions, and do not upload it with diagnostics or release artifacts.

The sequence floor must be durable and independently stored by the installer; a manifest-supplied floor provides no replay protection. Downgrades require a separate explicit recovery operation and compatibility checks, not a lower normal sequence floor. Key rotation needs an independently trusted transition and revocation design before production activation.

## Release checklist

- Reconcile the current feature commit with remote main without dropping the Ocean Codex, branding, navigation, or feedback changes; run focused tests plus the final build/type checks.
- Qualify both hosted architectures and independently verify the packaged runtime, native dependencies, permissions, launch, tray, task protection, and offline plugin paths.
- Choose version, channels, distribution URL, signing identity, and key custody. Keep secrets outside repository files, logs, client bundles, and untrusted CI jobs.
- Complete and test the Linux staging/install/recovery implementation, including interruption at every journal step, concurrent update attempts, low disk space, tampering, replay, wrong architecture, active tasks, unknown task state, and data migration compatibility.
- Test a signed update from the actually installed older Ocean build on an isolated profile. This also establishes the bootstrap path for existing unsigned installations; they cannot gain a trusted updater solely by publishing metadata.
- Publish only after approval and verification. Retain release notes, immutable source SHA, artifact digests, detached signatures, and rollback instructions. A published candidate is not automatically a stable release.
