---
description: "Computer-use capability packages for selecting and registering one desktop provider."
kind: "package-group"
---

# packages/computer-use

English | [中文](README.zh.md)

## Summary

Computer-use providers let models observe and operate a desktop. This group contains the shared registry that prevents multiple providers from being enabled in one composition. A provider supplies the desktop operations and the tools that expose them.

## Table of Contents

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

-----

<a id="packages"></a>
## Packages

Choose one provider and mount the shared registration service.

| Package | Role | ctx key |
|---|---|---|
| [`computer-use`](computer-use/README.md) | Exclusive named provider registration | `ctx.computerUse` |

<a id="related-documentation"></a>
## Related documentation

- [Computer use](../../docs/subsystems/computer-use.md) — capability ownership and provider registration.

<a id="dev-note"></a>
## Dev Note

None.
