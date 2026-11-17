---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-11-17-remote-device-principal

English | [中文](2026-11-17-remote-device-principal.zh.md)

## Summary

User and retry attribution can record a remote device identifier in the existing principal field.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-11-17-remote-device-principal
baseline: false
changes:
  - root: "event:agent/inbox/spliced"
    previous: "2026-11-16-experimental-plugins-retired"
    after: "017b78b55d989ac7cb61652120642f6d91c7b81939da788cbc09cd0c7c5c2680"
    decision: same-version
  - root: "event:developer/message"
    previous: "2026-11-16-experimental-plugins-retired"
    after: "26eee70cb2be17f0133f37882e743bcc917cd29068716db856af8c4fe70ea8f6"
    decision: same-version
  - root: "event:session/title-llm-request"
    previous: "2026-11-16-experimental-plugins-retired"
    after: "1df135bf9753320edcb2f4ae31134631d9e077204d0a9cb5350aec8d9172bb37"
    decision: same-version
  - root: "event:user/message"
    previous: "2026-11-16-experimental-plugins-retired"
    after: "31e40341753c471de00118aefa98d67cbfd17952c1c9504b5fcc06ff936b4b5a"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

Current readers accept existing owner attribution. The base revision’s V4 decoder and Session event adoption are unchanged. They preserve the nested principal as JSON under the existing user or retry source kind, so they preserve new device attribution without using it to authorize replay. The Session header version remains 4.

<a id="verification"></a>
## Verification

The native V4 message source suite passed 12 tests, including encode and strict restore with owner and remote-device principals for user and retry messages. A source comparison with HEAD confirmed unchanged V4 and V2 framing, stored event validation, and Session event adoption.

<a id="dev-note"></a>
## Dev Note

None.
