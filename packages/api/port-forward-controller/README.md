---
description: "Host loopback TCP port forwarding over Typert Remote: one stream per connection to a port the Host itself runs, carried as base64 frames in both directions."
kind: "package-reference"
---
# Port Forward Controller

English | [中文](README.zh.md)

## Summary

`@ocean/ocean-api-port-forward-controller` owns the Host `ctx.portForwardController` service and the generated Client `ctx.remote.portForward` namespace. One `portForward.open` stream is one TCP connection to a port on the Host's own loopback interface: the Client reaches a service the Host runs without a socket of its own, and the Host keeps the connection on `127.0.0.1` whatever address the Client names. The Gateway's `remote-device` policy admits the action under `terminal:operate` only, because reaching a Host port means reaching a service the Host runs; the Gateway's per-socket stream limit bounds how many connections one device opens.

## Table of Contents

- [Use this package](#use-this-package)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The controller requires `ctx.typert`, and stays unactivated while it is absent, so a composition without a Remote stack loads cleanly and exposes no `portForward` namespace. It owns no configuration.

`portForward.open({ port })` validates `port` as an integer from 1 to 65535 and answers `port-forward/invalid-port` otherwise, before any socket is created. It then connects `127.0.0.1:<port>` and answers frames in wire order:

- `{ type: 'connected', port }` once the connection is established.
- `{ type: 'data', data }` as the port sends bytes, where `data` is base64 of at most 64 KiB of raw bytes per frame.
- `{ type: 'end' }` when the port closes its end of the connection, which is the stream's last frame.
- `{ type: 'failed', code, message }` when the connection is refused (`refused`), fails for another reason, or breaks without a FIN (`unreachable`); the stream ends after it.

Client items travel the same stream's uplink: `{ type: 'data', data }` writes bytes to the socket in order, and `{ type: 'end' }` half-closes it with `socket.end()`. The Host waits for `drain` before reading the next item whenever the port reads slowly, so a Client that writes faster than the port accepts does not grow the socket buffer without bound. Cancelling the stream destroys the socket, which ends the Client's uplink as well.

Only a loopback port is reachable: the Host never resolves the Client's input as an address, so a forwarded port cannot become a general TCP proxy out of the Host.

The Client half is the generated `ctx.remote.portForward` face; this package ships no Client service of its own. Desktop forwards the ports named by `OCEAN_DESKTOP_FORWARD_PORTS` to its own loopback through this namespace.

-----

<a id="model-experience"></a>
## Model Experience

None, as the namespace is a transport surface: it registers no prompt, tool, or session event, and no model-visible input or output passes through it.

#### KV Cache effect

No direct effect; no stream of this namespace reaches a model request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Only `127.0.0.1` is reachable, so a Host service bound to another interface is not forwarded. Widening the address would turn the namespace into a proxy for the Host's network, which needs its own policy decision.
- Each connection costs one stream on the device's socket, bounded by the Gateway's stream limit; there is no multiplexing of several connections over one stream.
- The Host does not report which ports exist. A Client learns that nothing listens only when the connection answers `refused`, so a port list is the Client's own choice.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The uplink pump starts before the connection settles, because `net.Socket` queues writes until `connect`; a Client that writes immediately therefore loses nothing. A rejected uplink read is the Gateway cancelling the stream, which destroys the socket through the abort signal, so the pump swallows it rather than reporting a second failure.

</details>
