---
kind: upgrade-guide
description: "Remote-device helpers use explicit static package subpaths instead of Host plugin entries."
---

# Remote transport entrypoints and stream limits

English | [中文](guide.zh.md)

## Change

Node consumers of remote-device authentication, stream transport, and upload route constants must use the named static entrypoints. Host plugin entries no longer re-export `DeviceClient`, its typed failures and device constants, `openDeviceStreamSocket`, or `FILE_UPLOAD_ROUTE`. CLI and Desktop consumers must also stop importing the Gateway Client plugin entry for standalone stream helpers.

Gateway now defaults to at most 256 concurrent logical streams per WebSocket, including requests still being dispatched. Opening another stream at `maxStreamsPerSocket` closes the socket with code 1013; clients must reconnect and resynchronize.

## Migration

1. Replace imports of `DeviceClient`, `DeviceClientError`, `DeviceProtocolVersionError`, `DeviceSessionRejectedError`, `DeviceSessionUnavailableError` with imports from `@ocean/ocean-client-connection/device`. Shared Host/Client modules needing only `DEVICE_*` constants, Host identities, or socket interfaces use pure `@ocean/ocean-client-connection/protocol` to avoid loading the other compiler face’s plugin implementation.
2. Import `openDeviceStreamSocket`, `ClientUplinkQueue`, `RemoteStreamCarrierError`, and `RemoteStreamMuxClient` from `@ocean/ocean-api-gateway/device` in Node transport consumers.
3. Import `FILE_UPLOAD_ROUTE` and shared upload protocol values from `@ocean/ocean-client-file-upload/protocol`.
4. Keep Cordis plugin names and `cordis.yml` rows unchanged. Build against the updated package declarations and run a packaged Node import smoke for each used subpath. Node consumers no longer need a TypeScript reference to the Gateway Client face solely for these helpers.

5. Check concurrent subscription demand per socket. Set `maxStreamsPerSocket` explicitly in the Gateway `cordis.yml` config when more capacity is needed, and retain reconnect and resynchronization handling for close code 1013.

See the [Connection](../../../../packages/client/connection/README.md), [Gateway](../../../../packages/api/gateway/README.md), and [upload](../../../../packages/client/file-upload/README.md) references for the owning APIs.
