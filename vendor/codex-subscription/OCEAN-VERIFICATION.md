# Ocean integration verification

## Verified locally

- Final combined repository `pnpm run build`: 10 passed, 0 failed. This includes artifact production and aggregate checks after the Ocean wordmark and direct Settings navigation were integrated.
- Focused auth, account, Ocean policy/UI, settings schema, provider transport and client-registration tests: 100 passed, 0 failed, 1 optional native-loader test initially skipped. The native-loader suite was then run with `DSH_NATIVE_CLIENT_MODULES_ENTRY` pointing at the built Ocean client modules: 9 passed, 0 skipped.
- `OCEAN_COMPOSITION_SMOKE=1 node --test tests/ocean-composition.test.mjs`: 1 passed. A real Web profile starts in a fresh temporary home, the plugin reaches ACTIVE, its client enters the module graph, account status stays signed out, forbidden RPCs fail, outbound fetch/socket attempts remain zero, and disposal completes.
- Cordis composition verifier: 345 configurations passed. Client package imports/assets verifier passed. Runtime dependency closure: 4 presets and 193 packages passed.
- A local package tarball contains the host and three browser artifacts, Ocean icon, MIT license, third-party notices and security review. This packaging inspection is not a signed release or an installed desktop acceptance test.
- Upstream LICENSE and THIRD_PARTY_NOTICES.md were compared byte-for-byte with the pinned donor and match.

The focused Node test command lists `auth-security`, `account-vault`, `account-status-controller`, `account-usage`, `subscription-transport`, `ocean-ui`, `ocean-policy`, `settings-adapter`, `host-settings-schema`, `transport-contract`, `oauth-network`, `subscription-settings-entry` and `client-chunks` test files. Fake credentials and mocked transports are used; no live OAuth or real model request ran.

## Incomplete and failed checks

Repository `doc-sync` reported 31 passed and 12 failed. Failures include stale DSH-to-Ocean generated catalogs, translation pairings, README conventions and old link fragments. The tsconfig-path generator mismatch was compared against the committed pre-plugin state: both produce the same 16 additions and zero removals, none belonging to this vendor package. No verifier or policy was weakened to hide these failures.

The entire upstream test suite was not run. Upstream delivery tests describe the original repository, release scripts, artwork and unrestricted UI, not the restricted Ocean distribution. JavaScript source remains explicitly unchecked by TypeScript; its allowJs project supplies the real transitive source graph for browser import/asset verification.

Visual browser acceptance is blocked on the laptop: the supported UI inventory exposes no apps or browsers, and opening the in-app browser reports it unavailable. No screenshot, native Electron interaction, live sign-in, real quota read/model response, ARM64/Windows/macOS package, signing, installation or publication is claimed here. These remain separate validation steps.

## Catalog failure diagnostics (2026-11-12)

The absence of `nativeVersion` at Ocean's catalog call sites does not construct an
undefined URL: the fallback uses this package's version and `originator: pi`.
This is a model-catalog request, not the OAuth authorization URL. Offline tests
cover both normal and subagent catalog callers. No official CLI identity/version
was substituted. These tests do not establish server compatibility for this
undocumented endpoint or authorization to use the upstream OAuth client.

Catalog status now exposes only an allowlisted failure category and, for HTTP
failures, its numeric status. No exception message, response body, URL, account,
or credential is included. The Models card displays that diagnostic code.
Synthetic HTTP, transport, invalid JSON, and incompatible catalog tests cover
redaction and state clearing. Live diagnosis still requires the installed build
and the normal UI catalog load; a saved login alone does not prove model access.

An ARM64 diagnostic build reported `empty-catalog` during a live refresh using the original profile. The server returned an empty models array; the cause remains unconfirmed. The packaged base provider contains nine models. Synthetic tests distinguish an empty server catalog, a catalog with no visible models, and an unavailable base model list without exposing account data.

## Separate ChatGPT plan flow (2026-11-12)

The separate flow has 48 passing synthetic protocol, vault, service, RPC and Responses-adapter tests. The React component fixture covers pending-revocation confirmation, cancel visibility, retired-registration renewal suppression and durable warning display. This is not browser acceptance.

Recovery is explicit and permanently retires the old registration, so a delayed revoke from another Host cannot invalidate a newly created registration. Unconfirmed sign-out also retires the registration. Remote-revocation warnings persist across Host restarts. An independent manual review identified three defects in this lifecycle and RPC wiring; all three were corrected and re-reviewed. The automatic security inventory still excludes vendor; a complete automated scan is not claimed.

The entire donor test command was attempted but is not green: missing upstream fixture/template/readme files and restricted-Ocean expectation mismatches remain; the run also encountered a full /tmp filesystem. Supported Ocean tests are checked separately with a disk-backed TMPDIR. No real credential was read, revoked, cleared, or migrated. Live OAuth/catalog/inference and assembled-page visual acceptance remain required before calling the integration production-verified.
