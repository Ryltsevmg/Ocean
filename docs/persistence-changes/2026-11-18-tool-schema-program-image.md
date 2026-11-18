---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-11-18-tool-schema-program-image

English | [中文](2026-11-18-tool-schema-program-image.zh.md)

## Summary

The model-facing `ToolSchema` gains an optional `programImage` flag, so an image-producing tool that declares program-image adaptation records `programImage: true` in the logged `request/header` tool list. The Session header keeps format 4.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-11-18-tool-schema-program-image
baseline: false
changes:
  - root: "event:request/header"
    previous: "2026-09-16-session-format-v4"
    after: "ebfcbad087d5a3201d6f2f955b3384512bfb8e1ab25fe2bb458f1ce219f44962"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

Readers that predate the flag treat it as an unknown optional member: header folding copies `tools` verbatim, and provider serializers rebuild each request tool from `name`, `description`, and `parameters`, so the flag never reaches a provider payload and cannot change a request. Logs written with the flag keep their meaning for older readers, which drop an unknown member when they next assemble a header. New readers treat an absent flag as no adaptation, so every existing log behaves exactly as before. No member was made required, renamed, or retyped, and the header version stays 4.

<a id="verification"></a>
## Verification

The schema, PTC type-rendering, and PTC execution suites passed 212 tests (schema 12, ts-types 15, ptc 185), including declared tools returning one image, no image, several images, and a policy-replaced image. The cordis catalog, persistence catalog, and type-equivalence gates pass with regenerated artifacts, and `persistence-changes --check` reports a consistent history.

<a id="dev-note"></a>
## Dev Note

None.
