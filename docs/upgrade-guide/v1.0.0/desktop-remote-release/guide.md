---
kind: upgrade-guide
description: "Desktop refuses remote bootstrap when the Host and packaged client release identities differ or cannot be compared."
---

# Match Desktop and remote Host releases

English | [中文](guide.zh.md)

## Change

A successful device-protocol handshake no longer suffices to start a remote Desktop view. Before executing remote boot injections, Desktop requires exactly one `__OCEAN_BOOT__` graph with the same `release.version` and `release.commit` as its packaged shell. The commit may be absent only when both builds omit it. Missing, malformed, duplicate, or mismatched release metadata rejects the connection and logs out its newly created login. Existing local workspace access remains available.

This comparison covers release identity; it does not establish full static-module ABI or plugin-composition compatibility.

## Migration

1. Deploy the remote Host and Desktop from the same Ocean release and source commit. Rebuild both when using source builds; the build pipeline fixes `OCEAN_CLIENT_VERSION` and `OCEAN_CLIENT_COMMIT_HASH` into the artifacts. Runtime environment overrides do not replace packaged values.
2. For a custom Host bootstrap producer, include one global `__OCEAN_BOOT__` injection whose graph carries those release fields. The shipped client-module registry already publishes them.
3. Reconnect from Desktop. Matching releases open the remote view; incompatible releases show the localized instruction to update the app or server before any remote injection reaches that view. If logout cannot be confirmed after rejection, use the Host's live device administration to revoke the affected device and its logins.

See [Desktop remote connections](../../../../apps/desktop/README.md) for startup and failure behavior.
