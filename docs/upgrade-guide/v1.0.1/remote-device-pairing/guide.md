---
kind: upgrade-guide
description: "Devices pair through one-time links, hold named rights, appear in Settings, and a saved Desktop connection now groups every route to one machine."
---

# Remote devices pair by link and hold named rights

English | [中文](guide.zh.md)

## Change

`ocean remote-device pair <label>` mints a one-time `ocean://pair` link in place of a token copied by hand. The grant lasts ten minutes, is spent once, and the Host stores only its hash. Desktop opens the link, asks for confirmation, and exchanges the grant for a device token; the grant never reaches the form. `create` and `pair` accept repeated `--scope` to narrow a device to named rights; the Gateway allows a device the union of its live login's rights and nothing else. Host compatibility now requires the same `version` and no longer the same `commit`. Desktop stores a saved connection as a machine — Host identity, one token, every HTTPS route that reaches it — in record `version: 3`, and names the machine an address reaches by asking the Host over `HEAD /connect` without a credential. `ocean serve --tailscale-serve` publishes the Host on its tailnet name, and the Desktop dialog can prepare and start a Host on a Linux machine over SSH. Settings gains a **Devices** page that lists and revokes devices.

## Migration

1. **Rolling a Host back to 1.0.0 restores full access to limited devices.** A 1.0.0 Host drops the stored `scopes` the first time it rewrites the registry, and treats a device without rights as unrestricted. Revoke every limited device from 1.0.1 before the rollback. Pending pairing grants are dropped as well, so links minted by 1.0.1 stop working.
2. **Rolling Desktop back to 1.0.0 loses saved connections.** Desktop 1.0.0 cannot read a `version: 3` record and offers to forget it; keep the device tokens to enter them again, or leave Desktop at 1.0.1.
3. **Devices created before rights existed keep every right.** Create a narrower device and revoke the old one when that is not intended.
4. **A Host not yet upgraded** answers `POST /connect/pair` with 404 or 405; Desktop then asks for a device token instead.
5. **Two commits of one version now connect to each other.** The commit is no longer compared, so build unreleased changes from one commit.
6. **A second address for a saved machine becomes a route of that machine.** Saving an address under a different identity moves the route there and drops the machine left without routes.
7. **`--tailscale-serve` refuses an occupied port** instead of replacing another site; pass a free `--tailscale-serve-port`. A node that already serves a directory allows only root to change its serve configuration, so point `--tailscale-command` at a wrapper that runs `sudo -n`.

To verify, pair a device with `--scope sessions:read`, confirm in Settings under **Devices** that it holds only that right and that a session can be listed but a prompt refused, then revoke it there and confirm its open session ends.
