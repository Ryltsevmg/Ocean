---
description: "Browser-host wire layer for the web GUI: Remote RPC, event-stream delivery with reconnect, exact Fetch routes, the /api HTTP bridge, and the browser-trust fence."
kind: "package-reference"
---

# @ocean/ocean-client-connection

English | [中文](README.zh.md)

## Summary

The package carries browser-to-Host Remote calls, exact Fetch responses, and connection generations. The Client plugin mounts `ctx.connection` with current-page loopback state, generic RPC, the active generation and its Host facts, observable recovery state, an immediate reconnect command, and the registration point for one generation source. A generation becomes visible when its source reports ready; source completion, failure, withdrawal, or an explicit stop clears it before `ConnectionController` applies its retry policy.

## Table of Contents

- [Use this package](#use-this-package)
- [Browser authentication and request trust](#browser-authentication-and-request-trust)
- [Connection generation](#connection-generation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Shared Host/Client consumers import wire constants, branded identities, and socket interfaces from `./protocol`; this entry loads neither plugin implementation nor the Node device client.

The `./client` import selects the standalone `lib/client.node.js` ESM bundle in Node and the `lib/client.browser.js` loader factory in browsers. The Web Host still serves the browser export at the logical `/plugins/.../client.js` URL. Import the Client entry for a non-page Cordis tree; the separate package root is the Host entry.

A static desktop page can provide `__OCEAN_TRANSPORT__.streamBaseUrl` for the HTTP origin of its owned Host. The Gateway uses that origin for its WebSocket while HTTP transport remains independently selected. The desktop carrier owns authentication; setting the origin alone grants no access.

Unary RPC requests use JSON. A Host handler may return byte attachments that it has already separated from the JSON-compatible result value, with each attachment naming its result-relative path. Connection writes these values as multipart parts. The JSON `metadata` part contains the RPC response envelope with `null` placeholders and an attachment table recording each path, codec, and part identifier. Paths use string keys and numeric array indices; no business field name is reserved. The Client validates the envelope, `rpcId`, attachment table, and parts, then restores each byte value as an `ArrayBuffer`-backed view. Results without attachments, including base64 strings, and failures remain JSON. Logical RPC carriers return decoded native values directly. Connection does not discover binary fields or depend on Typert; the handler that owns a result protocol performs any type-directed or runtime projection before returning. Binary parameters, events, and streamed binary results are unsupported.

The browser uses HTTP POST for Remote unary calls. API Gateway owns the `/api/remote.mux` WebSocket and its logical streams; shell-owned compositions provide equivalent Remote streams, including a stream's uplink, through `connection.rpc.open` without opening a WebSocket. The browser plugin reads the page transport, recovery settings, and location, then delegates to `installConnection(ctx, options)`. A composition that owns its carrier may call the same installer directly; the whole-client test tier does so. Non-page carriers supply `ClientTransportHooks.createWebSocket` with the same authenticated Cookie as HTTP and a `streamBaseUrl`; `ConnectionHandle.openWebSocket()` resolves the Mux path against that base and invokes the selected factory. Each invocation creates one Context-owned service, so several Client trees can use different carriers in one realm. The Host half always provides the carrier-neutral RPC and exact `GET`/`HEAD`/`POST` route registries. When a Web carrier is present it also owns the sole `/api` route, Fetch bridge, browser authentication, and Host/Origin checks; a shell-owned carrier dispatches the shared Fetch handler directly. Each exact route declares buffered or streaming request-body handling before the bridge reads any bytes. Typert Gateway claims generated Remote endpoints, feature packages register non-JSON responses such as Session-log downloads and raw file uploads, and unclaimed requests return 404. Loopback hostname classification remains package-internal to the browser-facing Client state. Browser raw-body transfer is provided by [`ocean-client-file-upload`](../file-upload/README.md).

-----

<a id="browser-authentication-and-request-trust"></a>
## Browser authentication and request trust

In owner mode (`allowOwnerLogin: true`), every Host RPC method and WebSocket stream requires an authenticated browser or API Peer; there is no method-specific loopback tier. The application root mints a random launch token. `ocean-web-app` prints and opens its application URL with `?token=...`, preserving the caller's authority and mount; `frontend-static` delegates root and index requests to `ctx.connection.authorizeIndex`, which accepts that token only on `GET /`, writes an authority-bound signed cookie, and redirects to clean `./`, which drops the token and keeps the request's directory. A missing, expired, malformed, or wrong-authority cookie returns 401 before RPC dispatch. Static assets remain public. The HTTP carrier accepts query tokens only at the root exchange and `/connect`, and accepts no Authorization-header token.

The cookie signing secret is the owner-scoped `client-connection/browser-session` grant record in `ctx.credentials`. The local provider persists it in `$OCEAN_HOME/.credentials.yaml`; `BrowserAuth` loads or creates the record during Connection activation and retains the secret in memory, so request authentication is synchronous. Deleting or replacing the record takes effect on the next Connection activation. Cookies carry an absolute issue/expiry interval, defaulting to 30 days through `cookieMaxAgeDays`, and bind the normalized hostname plus port in both their deterministic name and signed payload. They are host-only, `Path=/`, `HttpOnly`, and `SameSite=Strict`, and carry `Secure` exactly when the listener that received the index request serves TLS; only that listener's own protocol decides, never a `publicUrl` announcement or a forwarded header.

HTTPS cookie names and signed audiences include the `https:` scheme, so HTTP cookies cannot authenticate to a TLS listener even on the same hostname and port. Default ports normalize under the listener's scheme. Existing HTTP cookie audiences remain unchanged.

Before authentication, every request passes `src/api-request-trust.ts`. Its `Host` must be loopback, equal the listener's bind IP literal on any port, or match a `trustedHosts` entry: exact on `host:port`, any port on port-less entries. Host and configured entries use the listener's scheme for WHATWG default-port normalization, not a forwarded header or `Origin`. An attached HTTP(S) `Origin` must name the same authority, with Host parsed under that Origin's scheme to support HTTPS proxies over HTTP upstreams; `sec-fetch-site: cross-site` is refused. Malformed configured authorities fail plugin load. `allowsRemoteAuthorities` reports whether `trustedHosts` permits a non-loopback authority; accepting the bind IP does not change that list. These checks defend DNS rebinding and cross-site browser requests; they never establish identity. A failed Host/Origin check returns 403, while a trusted but unauthenticated request returns 401. `ocean web --host 0.0.0.0` is unsupported.

Every request speaks for one Peer, a `PeerScope` whose `principal` names the caller, whose `interactions` governs participation in forwarded events, and whose `signal` aborts when its scope ends. `ctx.connection.browserPeer` is shared by authenticated browser connections; it has owner principal and defaults to `interactions: 'answer'`. `ctx.connection.admit(request)` checks trust and browser or API authentication and returns the credential's live Peer or a rejection. The `/api` route and Gateway WebSocket upgrade use `admitTransport()`, which resolves owner or device authentication; handlers receive the call's Peer. `ctx.connection.createPeer({ principal, interactions? })` creates an independent in-process Peer, disposed with the Context that read the service or earlier through its own `dispose()`; omitted interactions default to `answer`. The exported `Peer` class accepts the same options. `fetch(request, peer)` and the HTTP bridge take the Peer explicitly; an exact route answers 403 to a non-owner Peer. Method-level access for other principals belongs to [`ocean-api-remote-access`](../../api/remote-access/README.md).

Only API callers use `GET /connect?token=...&interactions=answer|none`: it immediately creates a Peer with owner principal and returns 302 with the Mux destination and a signed API Cookie. The API connection defaults to `none`; invalid or repeated declarations return 400. HTTP may precede WebSocket establishment. One API socket owns cleanup: duplicate attachment returns 409, closure removes its Peer, and later HTTP using that Cookie is refused. Already-admitted unary calls retain request-level cancellation, but `invocation.peer.ctx` cannot register effects after its Peer has been disposed. API callers keep their Cookie separate from browser storage; the authority-specific Cookie name is shared.

Authenticated shared HTTP requests pass through the `connection/request` waterfall before body transfer. A listener may refuse new requests or await `next()` through response completion; removing its owning fiber removes admission behavior. Desktop uses this hook to lock new API work during an approved installation without canceling already-admitted work. Client disconnection aborts the handler signal; the bridge stops socket writes and drains any remaining response chunks. WebSocket stream ownership remains with API Gateway.

### Device credential storage

The Host-side device token store keeps a versioned credential record with SHA-256 verifiers, device labels and revocation state. Issuance returns a cryptographically random bearer secret after committing its verifier. Verification reads the credential provider’s snapshot; local mutations publish immediately and external writes become visible when that provider reconciles them. The device token store is an internal building block. Device mode uses these records for login and transport admission; owner mode retains browser and API Peer authentication.

A device login has a separate opaque credential whose verifier is stored with the login origin and expiry. Exchange limits active logins per device. Revocation clears the stored logins so they cannot be used for future requests.

Set `allowOwnerLogin: false` to refuse the legacy launch-token exchanges and owner cookies on HTTP and WebSocket. Readiness URLs then omit the launch token. The default preserves local Web login.

In device mode, POST `/connect` exchanges an Authorization bearer for a host-only Secure, HttpOnly, SameSite=Strict login cookie. It accepts native TLS or an explicitly configured HTTPS proxy origin with a loopback backend. The proxy must preserve Host, and that authority must pass the trust fence. Forwarded scheme headers do not enable login.

HTTP RPC and WebSocket upgrade admission verify the login cookie and allocate a temporary Peer for each transport. Releasing one Peer leaves the login and other Peers intact. Device Peers start with a distinct principal and require explicit Gateway permissions. Shared and registered HTTP channels use the same admission owner, destroy device responses when the login is invalidated, and release their lease only after handler cleanup.

Set `deviceSessionLifetimeSeconds` on the Host Connection entry to give newly issued device logins a lifetime of 1 to 31,536,000 seconds. When omitted, device logins use `cookieMaxAgeDays`. Existing logins keep their original expiry.

Device transport leases end at login expiry. A notification that the durable registry changed triggers revalidation of live leases. An invalid login or failed credential read ends the Peer and closes its HTTP response or WebSocket. The provider notification is asynchronous and does not acknowledge that teardown has finished.

The registry lists only device identities, labels, and revocation state. Rotating a token preserves the device identity and clears prior logins in the same durable write. Revoked devices cannot be rotated.

Host administration blocks new admission and event replies for the affected device before starting revocation or rotation, then awaits disposal of its Peers. If disposal fails, the operation rejects and the registry change remains committed. The administrator can inspect device state or rotate again to recover a replacement token.

In device mode, `deviceAdminSocket` can enable the local administration listener on Unix. Use an absolute path in an existing directory owned by the server user with no group or other access. The listener accepts JSON create, pair, list, rotate, and revoke commands over the Unix socket. An existing listener is never replaced. The listener stops accepting commands before shutdown and drains accepted operations before the Connection service releases its resources. Administrative failures report `durableOutcome` and `liveCleanup` separately, without credential details. The live administrator listener is Unix-only. The separate `deviceBootstrapOnly` composition publishes `ctx.deviceBootstrap.issue()` and `list()` without any network listener, including on Windows; it never revokes or rotates live devices. A running Host sees bootstrap writes after its credential watcher reconciles them. A provider configured with `watch: false` needs a reload.

Device clients send `Ocean-Device-Protocol: 1` on POST `/connect`. An unsupported or missing version receives 409 with the supported version header before a login is written. Verified device tokens have independent exchange budgets, configured by `maxDeviceExchangesPerWindow` and `deviceExchangeWindowMs`. Invalid tokens do not consume another device’s budget, including when clients share a proxy or network address. When exhausted, the endpoint returns 429 with `Retry-After`.

Successful login returns `Ocean-Device-Host` and `Ocean-Device-Epoch`. The first identifies the credential home and survives a server restart. The second changes with each Host launch. HEAD `/connect` with a valid session cookie returns both values and the supported protocol version without issuing a new session. HEAD with the protocol header and without cookies performs credential-free discovery through the same HTTPS and Origin checks. Clients restoring a saved connection compare the discovered Host identity before sending the token and send the expected identity in the exchange request. The Host rejects a mismatched precondition with HTTP 412 before creating a login. First enrollment trusts the user-selected HTTPS origin and its verified TLS certificate; no prior Host identity is available to compare. Restoring a saved connection requires its pinned identity before transmitting the token.

GET `/connect/bootstrap` returns a non-cacheable JSON injection table for the authenticated device Peer. Packaged clients use it to initialize their own application document.

The `pair` administrator command creates a one-time pairing grant that a new device exchanges for its own device token, so the token never has to be typed or copied. The grant is stored only as a hash in the device registry, lives for `devicePairingTtlSeconds` (default 600; a command may choose 30 to 3600 seconds), and can be spent once. A Host holds at most 16 unexpired grants; creating another reports `DEVICE_PAIRING_CAPACITY`. A client sends POST `/connect/pair` with the grant as the bearer and `Ocean-Device-Protocol: 1`. The Host checks the same HTTPS and Origin rules as `/connect`, shares one attempt budget per window across all grants (`maxDeviceExchangesPerWindow`, `deviceExchangeWindowMs`), then spends the grant and creates the device in one credential write. The reply is `200` with `{ id, token }` and the Host identity headers. Unknown, expired, and already spent grants all return `401`. The new token then signs in through `/connect` like any other, and `rotate` and `revoke` apply to it normally.

Device admission returns 503 when capacity is exhausted. `maxDeviceTransports` limits pending verifications and active HTTP or WebSocket transports combined across the Host. `maxDeviceTransportsPerDevice` limits active transports across a device’s logins. A releasing lease immediately loses permission to answer events but retains its capacity slot until Peer cleanup finishes.

The root-owned `connectionLaunch` retains the launch token and `HostEpoch` across plugin reloads and is released with the application root. `HostId` identifies the durable credential home.

Node clients import `DeviceClient`, typed failures, and wire constants from `@ocean/ocean-client-connection/device`; this entry does not load the Host plugin. They use `DeviceClient` for HTTPS exchange, in-memory cookie reuse, Host identity checks, and unary RPC transport. The transport refuses redirects and changed Host identities. A new launch epoch is reported to the caller, which owns recovery decisions and mutation retries. An HTTP 401 from an authenticated identity check or bootstrap discards the rejected cookie and requires a new sign-in. An HTTP 503 from session verification preserves the cookie. Login capacity exhaustion carries `ocean-device-error: capacity` and becomes `DeviceClientError` with `DEVICE_CAPACITY_EXCEEDED`; invalid credentials remain 401. Other client errors expose stable machine codes and preserve network causes; cancellation keeps the caller’s reason.

DELETE `/connect` with the session cookie and the device protocol header removes that login, releases its active transports, and expires its cookie. The response confirms both durable invalidation and live cleanup. Other logins for the same device are preserved. The command-line client attempts logout before exiting.

`DeviceClient.openSocket()` resolves a secure socket route beneath the configured Host and injects the login into the caller’s socket factory. The factory must keep TLS verification enabled and redirects disabled.

An authenticated device browser document checks its login before establishing each event generation. HTTP 401 stops the loop and reloads the document at its current mount to show the Host sign-in form. Temporary network or service failures follow the normal reconnect policy.

<a id="connection-generation"></a>
## Connection generation

`installConnection` resolves `interactions` to `answer` for pages and `none` for non-page callers unless explicitly supplied. Only answering Clients register the internal `$events` logical stream as the sole generation source, independently of whether any `$on` listener exists. The Host attaches all incremental listeners in the API Remotes source factory, then sends one `{ type: 'ready', clientId, host: { home } }` item before events. `ConnectionController` publishes that generation and calls `onConnected` only after the ready item arrives, so baseline acquisition cannot race ahead of incremental observation.

An ended `$events` stream, a Remote stream error, a non-ready opening item, or a malformed event item invalidates the current generation. A pending handshake logs a slow-Host warning after 3 seconds and logs the readiness timeout and aborts after 15 seconds by default, including time spent waiting for the physical socket. The source must stop delivery, release resources, and settle after cancellation before a replacement starts; late readiness from a cancelled source cannot publish a generation. While the browser reports network availability, the controller publishes `connecting` and retries with 50%–100% jitter under caps of 500ms, 1s, 2s, 4s, 8s, and 10s, continuing at the final cap until recovery. Every retry asks Gateway to replace the physical WebSocket once and reopens `$events`.

`ctx.connection.reconnect()` interrupts active work, resets the sequence, and starts retry 1 immediately. Browser `offline` aborts active work, publishes `disconnected`, and suspends automatic attempts; the next `online` transition resets the sequence and starts at the 500ms tier. Only a ready item publishes `connected`. Gateway mux owns no independent retry schedule.

Set the Host Connection row's `config.recovery` to override retry caps, the growth factor, or handshake warning and cancellation times; the [configuration catalog](../../../docs/config-catalog.md#oceanocean-client-connection) lists accepted fields. The Host validates these values and injects them into each served page. The Client validates the bootstrap data before providing Connection and uses those defaults when Gateway starts its loop; explicit `start()` timing overrides take precedence. The growth factor must be finite and at least one. Readiness, failure, cancellation, or a hard deadline that occurs before the warning cancels that warning. Reload the page after changing Host recovery configuration.


<a id="model-experience"></a>
## Model Experience

None, as the wire consumer layer moves already-composed messages between browser and host; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Buffered `/api` routes retain each request body in memory** — `maxRequestBodyBytes` (default 300 MiB, sized for the default 200 MiB aggregate image limit after base64 expansion plus envelope headroom) bounds ordinary image and RPC envelopes. Streaming routes receive backpressured chunks. The same cap applies to device uploads, including chunked bodies. Owner streams retain their route-specific limits. An exact route must explicitly enable authenticated device access. Route implementations own persistence, cancellation, and storage quotas.
- **A plain-HTTP listener exposes the bearer cookie in transit** — such a deployment cannot mark the browser cookie `Secure`, so serving the same authority over a network can leak the session cookie; configure TLS on the Web carrier ([`ocean-host-webserver`](../../host/webserver/README.md)) to have the cookie marked `Secure` and confined to TLS.
- **Unused API Peers may remain until Host shutdown** — no connect deadline or idle collection is imposed on lightweight records whose caller never establishes a WebSocket. Cookie expiry still rejects new requests. API callers must reconnect through `/connect` after their owning socket closes or the Host restarts.
- **Owner browser authentication has no server-side logout operation** — clearing the browser cookie ends one browser session; deleting the owner credential record and restarting `ocean` revokes every session.


<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
