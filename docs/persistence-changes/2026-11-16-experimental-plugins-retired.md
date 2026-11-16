---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-11-16-experimental-plugins-retired

English | [中文](2026-11-16-experimental-plugins-retired.zh.md)

## Summary

Retiring the experimental plugin group removes the `hook/invoked` and `hook/result` event declarations and the experimental message-source and title-request variants from the persistence type history.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-11-16-experimental-plugins-retired
baseline: false
changes:
  - root: "event:agent/inbox/spliced"
    previous: "2026-10-27-retry-control-input"
    after: "552c92b1fb16320b3e885a64a6b8c9a57fecc7aa7cb458f037a469a17be0f700"
    decision: same-version
  - root: "event:developer/message"
    previous: "2026-10-27-retry-control-input"
    after: "9515a567164462897f1e878eadc836188db65fc3d67fab164c3eaf5ae41aaacc"
    decision: same-version
  - root: "event:hook/invoked"
    previous: "2026-09-11-initial"
    after: null
    decision: same-version
  - root: "event:hook/result"
    previous: "2026-09-11-initial"
    after: null
    decision: same-version
  - root: "event:session/title-llm-request"
    previous: "2026-10-27-retry-control-input"
    after: "478a2e9f8d1875d4e5369710738fc7d55217875757e03fbc95fc9f0f2d769fe9"
    decision: same-version
  - root: "event:user/message"
    previous: "2026-10-27-retry-control-input"
    after: "6261361093783863e9b6c25ac3b8bbce12308bbb1786b130a788a36f3ca98f2b"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

Logs written without the hook bridges remain readable. `hook/*` records were log-only (no `surfaceOp`): model history never replayed them and the surface fold's documented default branch skips unknown types. Restore requires every non-ignorable event type in the current vocabulary, so a Session log containing `hook/invoked` or `hook/result` rows no longer opens after this change; the refusal is loud and no log is ever misread. Hook bridges were opt-in experimental capabilities with no product-support commitment, and the upgrade guide announces the withdrawal. Removed `MessageSourceMap` and title-request variants are discriminant strings and payload shapes that current readers treat as absent or opaque; no current producer writes them, and writers cannot emit the removed variants because their declaring packages are gone. `SessionHeader.version` is unchanged: existing discriminators prevent unsafe interpretation.

<a id="verification"></a>
## Verification

pnpm run test:snapshot: 227 passed (recorded-session replay through shipped profiles). node_modules/.bin/vitest run packages/session/session-format-v0-to-v1/tests packages/session/session-format-v3-to-v4/tests/corpus.spec.ts packages/test-support/session-snapshot/tests: all passed; the archived-vocabulary invariant in validation.spec lists `hook/invoked` and `hook/result` beside the earlier archived types. pnpm run test: 47k unit tests with no regressions attributable to these roots.

<a id="dev-note"></a>
## Dev Note

None.
