# Browser control: setup required

This experimental Ocean adapter uses your existing Chrome/Chromium profile through **anomalyco/browse 0.0.16**. Website logins and cookies are shared with that browser. Ocean creates its own tabs; it does not adopt your open tabs.

**Two separate steps:** enabling this bundle loads its configuration only. The provider stays disabled (`enabled: false`) until you explicitly configure and activate it. The list's enabled switch is not a browser-connected status.

## Connect deliberately

A trusted browse relay and its extension must be installed and paired separately. This bundle never installs them, grants permissions, starts a relay, or changes your browser profile. Review the extension's broad browser access before authorizing it.

In the profile's configuration override for row `browser-use-browse`, set:

- `endpoint`: your local relay, exactly `http://127.0.0.1:port`.
- `tokenFile`: the absolute path of the relay token file, owned by you and readable only by you. Enter the **path**, never paste the token into chat or configuration.
- `browser`: the paired browser ID shown by browse.
- `allowedOrigins`: exact public HTTPS origins you approve, such as `https://example.com`. No wildcards, local addresses or file URLs.
- `enabled`: `true` only after reviewing these choices. Keep it `false` to revoke the provider's tools.

The built-in configuration form for these connection fields is not implemented yet. Use a reviewed profile override; do not guess the browser ID or copy example credentials. Configuration changes reload the provider. They do not undo an action already sent to the browser.

## What is checked

Configuration validation does not contact the relay and **does not prove connection readiness**. The first explicitly requested browser operation verifies the local token and upstream version, then opens the agent's session. An unavailable relay, invalid pairing or rejected configuration is an error, not a working connection. Start with a non-sensitive test page after setup.

Available tools: navigate, snapshot, click, fill and human handoff. No arbitrary JavaScript, recording, remote browser access or automatic extension updates. Site content is untrusted; it cannot authorize actions. Secrets, payment details and verification codes belong in human handoff.

Linux and macOS are the qualified token-file platforms. Windows token ACL support remains deferred. This adapter has synthetic integration tests; a live paired-browser acceptance test is still required. After a crash, inspect browse for abandoned tabs; automatic crash cleanup is not guaranteed.
