# Ocean Codex

Built-in Ocean desktop and Web integration for ChatGPT subscription sign-in, account selection, models and quota. It is a modified, pinned copy of WSL043's community plugin, not an OpenAI-endorsed client. The host credential service stores OAuth credentials; the browser receives redacted status, not tokens.

The eight bundled UI dictionaries use Ocean product labels, including the inherited default-model choice. Stored selector values and host protocol identifiers remain unchanged.

## Delivery and permissions

The Web application bundle includes the host and client entries. Repository source aliases cover both the host and `/client` entries, so source-plane assembly tests import the real JSX module rather than executing the production browser-registration bundle. No plugin-manager installation is needed. A fresh Ocean-specific credential namespace requires an explicit sign-in and never imports the donor's saved accounts. OAuth and subsequent model/quota requests use OpenAI subscription services. MIT permission to reuse code does not grant permission to use a service or guarantee subscription compatibility.

The initial Ocean variant exposes account/quota and model settings. Remote control, voice, connectors, runtime installation, credit-reset spending, prediction, subscription search and image-generation integrations are unavailable. Host-side policy rejects their RPC and settings activation; hiding a button is not the security control. Existing Ocean search and subagent choices are preserved.

## ChatGPT plan preview

The separate ChatGPT plan preview requests a new user-authorized grant and stores it independently from existing Codex accounts. On startup, Ocean loads the selected account catalog and offers supported models through a separate Responses route. GPT-6.1 Terra uses metadata from pi-ai 1.5.2 until the pinned pi-ai version includes it; it is offered only when present in the selected account catalog. The configured stream idle timeout also applies to this route. Reading an unexpired grant does not rewrite credentials or emit a credential-change notification. If loading fails, retry in settings. Sign-out attempts remote revocation, clears local tokens, and retains the registration; the interface reports an unconfirmed remote revocation. If the host stops during revocation, recovery in settings retires that registration before a new sign-in. An already-running stream in a second host process is not cancelled by account changes in the first process. Offline tests do not establish live-account acceptance. Host configuration `planLoginTimeoutMs` controls the browser sign-in timeout (10,000–600,000 ms; default 120,000 ms); `planRevocationTimeoutMs` limits each revocation attempt (1,000–60,000 ms; default 10,000 ms). `planRevocationAttempts` sets the maximum attempts (1–3; default 2), and `planRevocationRetryDelayMs` sets the initial retry delay (0–10,000 ms; default 500 ms).

## Source and licenses

The upstream source identity and local modifications are recorded in [the vendor manifest](../README.md). [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) retain upstream notices. [UPSTREAM-README.md](UPSTREAM-README.md) describes the original product, including features not enabled by Ocean. The package version follows the shared Ocean release version; `oceanUpstream` metadata retains the independent donor version and exact commit.

## Verification

Use the repository's build commands to build both faces. The package's `test:ocean` focused tests use fake credentials and mocked transports. [OCEAN-VERIFICATION.md](OCEAN-VERIFICATION.md) records actual results and incomplete checks. [OCEAN-SECURITY-REVIEW.md](OCEAN-SECURITY-REVIEW.md) records the security review scope and remaining risks. A live sign-in, quota read and minimal model request require a separately authorized user test; offline test success is not evidence that OpenAI accepts the account or current subscription endpoint.

## Known limitations and deferred work

This pinned vendor package remains JavaScript/JSX. Ocean's TypeScript build does not typecheck its implementation. Upstream compatibility claims do not establish compatibility with Ocean; host/client composition and packaging must be verified against the exact built commit. Additional donor features stay unavailable pending integration-specific security and product review. This audit is not a security certification or a full transitive-license audit.
