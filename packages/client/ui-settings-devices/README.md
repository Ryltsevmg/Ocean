---
description: "Devices settings section: the Host's paired devices with their granted rights, and revocation of any active one."
kind: "package-reference"
---
# Devices Settings

English | [中文](README.zh.md)

## Summary

`@ocean/ocean-client-ui-settings-devices` contributes one settings section listing the devices paired with the Host this browser is connected to, and revoking one of them. It reads and writes the generated `devices` Remote namespace of [`@ocean/ocean-api-device-controller`](../../api/device-controller/README.md); the Host remains the only authority on device state, and this package renders what the registry reports. The section installs only while the calling Peer may read the inventory, so a browser that authenticated as a remote device never sees a page whose every action the Gateway would refuse.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The section registers into `settings.section` under the id `devices`, between General and Models, and shows for the owner of the Host. It renders five states: loading while the first read runs, the inventory, the empty inventory, a failed read with a Retry button, and — inside the inventory — a per-row confirmation before revocation, the in-flight "Revoking…" state, and a per-row failure message with the row left as it was.

Each row shows the device label, the leading eight characters of its registry identifier (the full value is the element's tooltip), whether it is active or revoked, and the rights it holds; a device created before rights existed holds every right and says so instead of showing an empty list. Only an active device offers Revoke. A successful revocation marks the row revoked immediately, because the Host's receipt already means the durable write committed and the device's live transports were closed; a refusal or a carrier failure keeps the row and offers another attempt.

The section reads the inventory on every mount, so reopening Settings reflects a device revoked from the administrator socket in the meantime.

-----

<a id="model-experience"></a>
## Model Experience

None, as the section registers no prompt, tool, or session event.

#### KV Cache effect

No direct effect; no copy here reaches a model request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Pairing a new device and rotating its token stay on the local administrator socket (`ocean remote-device`); this section reads and revokes only.
- The inventory is read, not streamed: a revocation performed in another window becomes visible on the next mount or Retry.
- A Host in owner-login mode has no device registry, so the section reports a load failure there instead of hiding itself.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
