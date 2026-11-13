---
description: "Inspect authorized Linux applications through AT-SPI and invoke their advertised semantic actions."
kind: "package-reference"
---

# Ocean Linux Computer Use (experimental)

English | [中文](README.zh.md)

## Summary

This opt-in provider uses the existing Ocean CUA application-consent and logged execution pipeline. It reads AT-SPI accessibility trees and performs semantic actions reported by the selected application. It is not full-desktop remote control.

## Table of Contents

- [Requirements and activation](#requirements-and-activation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

<a id="requirements-and-activation"></a>
## Requirements and activation

Linux with an active user accessibility bus and system Python 3 with PyGObject and the Atspi 2.0 typelib. The default interpreter is `/usr/bin/python3`, not Ocean's bundled Python. No packages are installed, accessibility settings toggled, or daemon started by this plugin. Missing dependencies fail with an explicit unsupported diagnostic. Some applications do not expose AT-SPI until the user enables their own accessibility support.

The optional Computer Use bundle selects this provider on Linux. Merely shipping the package does not enable the bundle or grant application access. Each application is selected and approved through Ocean before its contents or actions can be accessed.

| Field | Default | Meaning |
|---|---|---|
| `pythonPath` | `/usr/bin/python3` | Absolute system Python path with AT-SPI bindings |
| `sessionId` | Unset | Explicit logind graphical-session ID when process discovery is unavailable |
| `maxElements`, `maxDepth` | `500`, `20` | Accessibility snapshot bounds |
| `maxRequestBytes`, `maxResponseBytes` | `65536`, `1048576` | Helper communication limits |

### Explicit graphical-session binding

By default the helper asks logind for its own process session. A desktop launched by the user service manager may have no such session. An administrator can explicitly set `sessionId` in the provider configuration after identifying the user's intended graphical session. The plugin never reads an environment variable or silently chooses another session.

The explicit binding requires exactly one graphical session for the current UID, and it must match the configured ID, be local, active, attached to a seat, and report `LockedHint=false`. The helper pins the session identity and checks it on every guarded operation. Session replacement or unverifiable session facts after binding invalidate that helper for its entire lifetime; reconnect and reauthorize rather than retrying stale handles. Missing/inaccessible logind data or multiple graphical sessions fail closed. This does not change the system's accessibility permissions or lock policy.

The accessibility bus remains user-wide. A session binding is a conservative eligibility check, not a kernel-enforced isolation boundary, and logind's lock hint is not atomic with an action. Live pilot validation and the shared per-application consent remain necessary.

<a id="model-experience"></a>
## Model Experience

### Accessibility operations

#### What the model sees

The existing `cua`/`cua_run_code` API supports only discovery, selected-app/window accessibility snapshots, action listing and semantic action invocation. Snapshots are bounded and replace the previous reference set. Password/protected controls are excluded. More expansive trees cost additional tokens; repeated reads do not reuse stale element references.

#### Token effect

Bounded accessibility snapshots and action lists consume model context; broader trees cost more tokens.

#### KV Cache effect

Provider activation contributes Linux accessibility capabilities and guidance through the shared CUA pipeline. Fresh observations replace previous element references rather than restoring stale handles.

## Known Limitations and Deferred Work
<a id="known-limitations-and-deferred-work"></a>

Each Agent owns a separate helper and opaque handles. Operations validate selected process identity and current element ownership; stale/dead/foreign handles fail closed. Cancellation terminates the helper and invalidates its handles. An action already delivered to an application cannot be undone and is never automatically retried.

- Observations/actions require logind to verify a local active graphical session with `LockedHint=false`. Unknown or locked sessions fail closed. This is a reported state check, not an OS-enforced per-application sandbox.
- No screenshots, full-screen observation, clipboard, raw keyboard/pointer injection, focus changes or application launch.
- Applications not exposing AT-SPI are unsupported; this is not a universal Hyprland adapter.
- Accessibility semantics are supplied by the application. A granted application's content is untrusted and may contain instructions; an advertised action can have real consequences and remains subject to the agent's normal approval policy.
- No OS-enforced per-app isolation is claimed: the user-session accessibility bus itself has broader privileges. The provider and shared Ocean consent layer restrict admitted calls, not third-party code running as the user.
- Real graphical-session qualification is required before installing/enabling for a user. Synthetic tests do not prove every application's AT-SPI behavior.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
