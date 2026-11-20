---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-11-20-skill-catalog-source

English | [中文](2026-11-20-skill-catalog-source.zh.md)

## Summary

Adds an optional discovery source to durable skill-catalog entries.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-11-20-skill-catalog-source
baseline: false
changes:
  - root: "event:agent/inbox/spliced"
    previous: "2026-11-17-remote-device-principal"
    after: "58db3d2bda413d764af1272ffc9e45904ab3f26fe8c1164c457e21785d5ed58c"
    decision: same-version
  - root: "event:developer/message"
    previous: "2026-11-17-remote-device-principal"
    after: "33ba2d4b0682046bfbdb10fefb6b493b17555806c72e74f35a13071d4daa1bc9"
    decision: same-version
  - root: "event:session/title-llm-request"
    previous: "2026-11-17-remote-device-principal"
    after: "633925834cb37e550d7e17e605a1e4fc31465f7448c1d4189e7f360f7736f950"
    decision: same-version
  - root: "event:user/message"
    previous: "2026-11-17-remote-device-principal"
    after: "d9d2129fbb8c65eeb6dd0cc194fff034b6b95f864551d89cd755e75f2f1ea38b"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

Existing records remain valid: the field is optional and absent in logs written before this change. Readers treat absence as an unmarked source and render the legacy catalog line and skill_content block. Producers now record the winning discovery source; the catalog text and loaded content are derived from these entries, never rewritten.

<a id="verification"></a>
## Verification

pnpm exec vitest run packages/skill: 226 tests passed. pnpm run test:snapshot refresh/replay: 228/228 and 229/229 after build:artifacts.

<a id="dev-note"></a>
## Dev Note

None.
