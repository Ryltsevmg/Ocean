---
description: "Owner-only Host device administration over Typert Remote: the durable device inventory with its granted scopes, and revocation that also closes the device's live transports."
kind: "package-reference"
---
# Device Controller

English | [中文](README.zh.md)

## Summary

`@ocean/ocean-api-device-controller` owns the Host `ctx.deviceController` service and the generated Client `ctx.remote.devices` namespace. Two methods serve the owner-facing device page: `devices.list` reads the durable device registry, and `devices.revoke` revokes one device through the same Connection path the local administrator socket uses, so a live Peer of that device is dropped rather than left running against a revoked record. Neither response carries a token, a verifier, or a session secret. Both methods are owner-only: the Gateway's `remote-device` policy allows exactly the actions its scope catalog names, and no device scope names `devices/*`.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The controller requires `ctx.connection` and `ctx.typert`, and stays unactivated while either is absent, so a composition without Connection loads cleanly and simply exposes no `devices` namespace. It owns no configuration.

`devices.list()` answers the registry's rows in registry order as `{ id, label, revoked, scopes? }`. `revoked` reports durable state, so an owner can tell an active device from one that is already out; `scopes` carries the rights the device holds and is absent for a device created before scopes existed, which holds every right. A Host that runs without a device registry — owner-login mode, where no device ever authenticates — answers `devices/unavailable` rather than an empty list, because "this Host has no device registry" and "this Host has no devices" are different facts.

`devices.revoke({ id })` resolves the id against the registry first, answers `devices/not-found` for an id it does not hold, and then calls `ctx.connection.revokeDevice`, which writes the revocation and releases every live transport lease of that device. The answer is `{ id, revoked: true }`, so the caller needs no confirming read. Revoking a device that is already revoked is accepted and answers the same receipt.

The Client half is the generated `ctx.remote.devices` face; this package ships no Client service of its own. `@ocean/ocean-client-ui-settings-devices` renders it as the Devices settings section.

-----

<a id="model-experience"></a>
## Model Experience

None, as the namespace is owner administration: it registers no prompt, tool, or session event, and no device-facing capability is widened by it.

#### KV Cache effect

No direct effect; no method of this namespace reaches a model request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- A Host in owner-login mode has no device registry, so both methods answer `devices/unavailable` there; the settings section reports that as a load failure rather than hiding itself.
- Creation and token rotation stay on the local administrator socket (`ocean remote-device`): this namespace only reads and revokes.
- The inventory is not streamed. A revocation performed elsewhere becomes visible on the next `list` call, which is what the settings section's retry does.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
