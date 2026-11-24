/** Host registry and HTTP adapter for generic Connection RPC channels. */

import { Context, Service } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { HarnessError } from '@ocean/ocean-error'
import type { WebRoute } from '@ocean/ocean-host-webserver'
import type { PeerId, PeerScope, Principal } from '@ocean/ocean-typert-protocol'
import type { ConnectionInteractions } from './connect-protocol.ts'
import {
  RpcId,
  type ClientRequest,
  type RpcId as RpcIdType,
} from './rpc.ts'
import { clientRequestSchema } from './rpc-schema.ts'
import { bridge } from './http-bridge.ts'
import { isRemoteAuthority, isTrustedApiRequest } from './api-request-trust.ts'
import { API_PATH } from './api-path.ts'
import type { BrowserAuth } from './browser-auth.ts'
import { DEVICE_SCOPES, type DeviceScope } from './device-scopes.ts'
import { deviceRegistryKey, type DeviceId, type DeviceSession, type DeviceSessionKey } from './device-tokens.ts'
import type { DeviceLogin } from './device-login.ts'
import { Peer } from './peer.ts'
import { resolveDeviceTransportLimits } from './host-config.ts'
import type {
  PeerAdmission,
  ConnectionAdmission,
  ConnectionIndexRequest,
  ConnectionIndexResponse,
  ConnectionFetchRoute,
  ConnectionFetchHandler,
  HostConnectionFetch,
  ConnectionRpcEndpointMatcher,
  ConnectionRpcFailure,
  ConnectionRpcHandler,
  ConnectionRpcResult,
  ConnectionRequestRejection,
  ConnectionTrustRequest,
  HostConnectionHandle,
  HostConnectionRpc,
} from './rpc.ts'

const INVALID_REQUEST_RPC_ID = RpcId('invalid-request')
const CHANNEL_PATTERN = /^\/[A-Za-z0-9._~-]+$/
const ENDPOINT_SEGMENT_PATTERN = /^[A-Za-z0-9_$.-]+$/

interface PeerRecord {
  readonly peer: Peer
  ownsSocket: boolean
}

/** Administrative failure that distinguishes durable mutation from transport cleanup. */
export class DeviceAdministrationError extends HarnessError {
  constructor(
    readonly durableOutcome: 'committed' | 'unchanged' | 'unknown',
    readonly liveCleanup: 'complete' | 'failed',
    options: ErrorOptions,
  ) {
    super('Device administration failed. Inspect the device state before retrying.', 'DEVICE_ADMIN_FAILED', options)
  }
}

interface ConnectionRpcInterceptor {
  readonly matches: ConnectionRpcEndpointMatcher
  readonly fetchHandler: ConnectionFetchHandler
}

interface RegisteredFetchRoute {
  readonly methods: ReadonlySet<string>
  readonly requestBody: ConnectionFetchRoute['requestBody']
  readonly fetch: ConnectionFetchRoute['fetch']
  readonly allowRemoteDevice: boolean
}

interface ConnectionServerResponse {
  readonly type: 'server-response'
  readonly rpcId: RpcIdType
  readonly result: ConnectionRpcResult<unknown>
}

declare module '@ocean/ocean-typert-protocol' {
  interface PrincipalMap {
    'remote-device': { readonly kind: 'remote-device'; readonly deviceId: NonNullable<Awaited<ReturnType<DeviceLogin['authenticate']>>>['deviceId'] }
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host Connection transport and RPC registrations. */
    connection: HostConnectionHandle
  }
}

/** Host Connection service whose channel registrations belong to the caller fiber. */
export class HostConnectionService extends Service implements HostConnectionHandle {
  /** The Peer every authenticated browser connection shares. */
  readonly browserPeer: PeerScope
  private readonly peers = new Map<PeerId, PeerRecord>()
  private readonly owner: Context
  private disposed = false
  private deviceRegistryVersion = 0
  private pendingDeviceAdmissions = 0
  private readonly invalidatingDevices = new Map<DeviceId, { count: number }>()
  private readonly deviceLeases = new Map<PeerScope, { session: DeviceSession; active: boolean; release: () => Promise<void> }>()
  private readonly interceptors = new Map<string, ConnectionRpcInterceptor>()
  private readonly fetchRoutes = new Map<string, RegisteredFetchRoute>()

  readonly allowsRemoteAuthorities: boolean

  /**
   * Provide the Host half over the active HTTP server.
   * @param ctx - owning Connection plugin context.
   * @param trustedHosts - deployment authorities accepted by the Host/Origin fence.
   * @param browserAuth - process token and persistent browser-session owner.
   * @param allowOwnerLogin - permit legacy browser and API owner credentials.
   * @param deviceLogin - verifier for device sessions when owner login is disabled.
   * @param deviceLimits - bounds on device authentication and active transport work.
   * @param drainAdmin - Stop and settle accepted administrative commands before releasing Peers.
   */
  constructor(
    ctx: Context,
    private readonly trustedHosts: readonly string[],
    private readonly browserAuth: BrowserAuth,
    private readonly allowOwnerLogin = true,
    private readonly deviceLogin?: DeviceLogin,
    private readonly deviceLimits = resolveDeviceTransportLimits(),
    drainAdmin: () => Promise<void> = () => Promise.resolve(),
  ) {
    super(ctx, 'connection')
    this.owner = ctx
    this.browserPeer = new Peer(ctx, { principal: { kind: 'owner' } })
    ctx.effect(() => async () => {
      try {
        await drainAdmin()
      } finally {
        this.disposed = true
        const peers = [this.browserPeer, ...Array.from(this.peers.values(), record => record.peer)]
        this.peers.clear()
        await Promise.all([...peers.map(peer => peer.dispose()), ...Array.from(this.deviceLeases.values(), lease => lease.release())])
      }
    }, 'client-connection: Peer scopes')
    if (deviceLogin !== undefined) {
      ctx.on('credentials/record-updated', (key) => {
        if (key === deviceRegistryKey) this.deviceRegistryVersion += 1
      })
    }
    this.allowsRemoteAuthorities = trustedHosts.some(isRemoteAuthority)
  }

  /** Generic channel registry scoped to the Context reading this service. */
  get rpc(): HostConnectionRpc {
    const owner = this.ctx
    return {
      handle: (channel, handler) => this.register(owner, channel, handler),
      intercept: (channel, matches, handler) =>
        this.registerInterceptor(owner, channel, matches, handler),
    }
  }

  /** Exact Fetch-route registry scoped to the Context reading this service. */
  get fetch(): HostConnectionFetch {
    const owner = this.ctx
    return {
      register: route => this.registerFetchRoute(owner, route),
    }
  }

  /** Apply the Host/Origin fence and require an authenticated live Peer. */
  requestRejection(request: ConnectionTrustRequest): ConnectionRequestRejection {
    const admission = this.admit(request)
    return 'rejection' in admission ? admission.rejection : undefined
  }

  /** Browser requests share an owner Peer; API HTTP does not depend on an attached socket. */
  admit(request: ConnectionTrustRequest): PeerAdmission {
    if (!this.isTrusted(request)) return { rejection: 403 }
    if (this.disposed || !this.allowOwnerLogin) return { rejection: 401 }
    const secure = this.owner.get('webServer')?.protocol === 'https:'
    if (this.browserAuth.isAuthenticated(request, secure)) return { peer: this.browserPeer }
    const id = this.browserAuth.authenticateApi(request, secure)
    const record = id === undefined ? undefined : this.peers.get(id)
    return record === undefined ? { rejection: 401 } : { peer: record.peer }
  }

  /** Create one in-process Peer owned by the Context that read this service. */
  createPeer(options: { readonly principal: Principal; readonly interactions?: ConnectionInteractions }): PeerScope {
    return new Peer(this.ctx, options)
  }

  /**
   * Own admission, cancellation, and release for one HTTP transport.
   * @param request - Incoming HTTP request carrying authentication.
   * @param response - Response destroyed if its admitted device session is invalidated.
   * @param handle - Admitted handler; the lease is retained until it settles.
   * @returns Completion after the handler and its lease cleanup settle.
   */
  async handleHttpTransport(
    request: IncomingMessage,
    response: ServerResponse,
    handle: (peer: PeerScope) => Promise<void>,
  ): Promise<void> {
    const admission = await this.admitTransport(request, false)
    if ('rejection' in admission) {
      response.writeHead(admission.rejection)
      response.end(admission.rejection === 503 ? 'device transport unavailable' : admission.rejection === 401 ? 'unauthorized' : 'forbidden')
      return
    }
    const abort = (): void => {
      if (admission.peer.principal.kind === 'remote-device') response.destroy()
    }
    admission.peer.signal.addEventListener('abort', abort, { once: true })
    try {
      await handle(admission.peer)
    } finally {
      admission.peer.signal.removeEventListener('abort', abort)
      await admission.release()
    }
  }

  /** Claim API socket ownership synchronously; callers release on termination or failed upgrade. */
  admitConnection(request: ConnectionTrustRequest): ConnectionAdmission {
    const admission = this.admit(request)
    if ('rejection' in admission) return admission
    const record = this.peers.get(admission.peer.id)
    if (record === undefined) return { ...admission, release: () => Promise.resolve() }
    if (record.ownsSocket) return { rejection: 409 }
    record.ownsSocket = true
    let released: Promise<void> | undefined
    return {
      peer: record.peer,
      release: () => {
        if (released !== undefined) return released
        this.peers.delete(record.peer.id)
        released = record.peer.dispose()
        return released
      },
    }
  }

  /**
   * Admit a transport request and allocate a request-owned Peer for device sessions.
   * @param request - Incoming request with its login cookie.
   * @param socket - Claim exclusive socket ownership for legacy API Peers.
   * @returns A rejection or a lease the caller releases when its transport ends.
   */
  async admitTransport(request: ConnectionTrustRequest & { readonly destroyed: boolean }, socket: boolean): Promise<ConnectionAdmission> {
    if (this.deviceLogin === undefined) {
      if (socket) return this.admitConnection(request)
      const admission = this.admit(request)
      return 'rejection' in admission ? admission : { ...admission, release: () => Promise.resolve() }
    }
    return this.admitDevice(this.deviceLogin, request, () => request.destroyed)
  }

  /**
   * Authenticate an index document in device mode, with a lease for rendering.
   * @param request - The browser document request.
   * @returns An admission lease or undefined when legacy index login applies.
   */
  async admitDeviceDocument(request: Request): Promise<ConnectionAdmission | undefined> {
    if (this.deviceLogin === undefined) return undefined
    return this.admitDevice(this.deviceLogin, request, () => request.signal.aborted)
  }

  private async admitDevice(
    login: DeviceLogin, request: ConnectionTrustRequest, disconnected: () => boolean,
  ): Promise<ConnectionAdmission> {
    const listener = this.owner.get('webServer')
    if (listener === undefined || this.disposed) return { rejection: 401 }
    const version = this.deviceRegistryVersion
    if (this.deviceLeases.size + this.pendingDeviceAdmissions >= this.deviceLimits.total) return { rejection: 503 }
    this.pendingDeviceAdmissions += 1
    let session: Awaited<ReturnType<DeviceLogin['authenticate']>>
    try {
      session = await login.authenticate(request, listener)
    } catch (_error) {
      // Never admit on a failed credential read.
      return { rejection: 503 }
    } finally {
      this.pendingDeviceAdmissions -= 1
    }
    // The owner may close while authentication reads storage.
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    if (session === undefined || this.disposed || disconnected() || session.expiresAt <= Date.now()
      || this.invalidatingDevices.has(session.deviceId)) return { rejection: 401 }
    // An unrelated device may have changed the registry during this read.
    if (version !== this.deviceRegistryVersion) return { rejection: 503 }
    let deviceCount = 0
    for (const lease of this.deviceLeases.values()) {
      if (lease.session.deviceId === session.deviceId) deviceCount += 1
    }
    if (deviceCount >= this.deviceLimits.perDevice) return { rejection: 503 }
    const peer = new Peer(this.owner, {
      principal: { kind: 'remote-device', deviceId: session.deviceId }, interactions: 'none',
    })
    let released: Promise<void> | undefined
    const release = (): Promise<void> => {
      lease.active = false
      released ??= peer.dispose().finally(() => { this.deviceLeases.delete(peer) })
      return released
    }
    const lease = { session, release, active: true }
    this.deviceLeases.set(peer, lease)
    const expire = (): void => {
      void release().catch((error: unknown) => { this.owner.logger.warn('Device Peer cleanup failed: %s', error) })
    }
    peer.ctx.effect(() => {
      let timer: ReturnType<typeof setTimeout>
      const schedule = (): void => {
        const remaining = session.expiresAt - Date.now()
        if (remaining <= 0) expire()
        else timer = setTimeout(schedule, Math.min(remaining, 2_147_483_647)).unref()
      }
      schedule()
      return () => { clearTimeout(timer) }
    }, 'client-connection: device login expiry')
    peer.ctx.on('credentials/record-updated', (key) => {
      if (key !== deviceRegistryKey) return
      void login.authenticate(request, listener).then((current) => {
        if (current === undefined) expire()
      }, expire)
    })
    return { peer, release }
  }

  /**
   * Durably revoke a device and finish the cleanup of its live transport Peers.
   * @param id - Device selected by the local administrator.
   * @returns Whether the device was found and is now revoked.
   */
  async revokeDevice(id: DeviceId): Promise<boolean> {
    if (this.deviceLogin === undefined || this.disposed) throw new Error('client-connection: device login is unavailable')
    const tokens = this.deviceLogin.tokens
    return this.invalidateDevice(id, () => tokens.revoke(id))
  }

  /**
   * Rotate a device token and finish cleanup of its existing transport Peers.
   * @param id - Active device selected by the local administrator.
   * @returns The replacement token, or undefined if the device is not active.
   */
  async rotateDevice(id: DeviceId): Promise<string | undefined> {
    if (this.deviceLogin === undefined || this.disposed) throw new Error('client-connection: device login is unavailable')
    const tokens = this.deviceLogin.tokens
    return this.invalidateDevice(id, () => tokens.rotate(id))
  }

  /**
   * Release transports for a login after its durable invalidation.
   * @param login - Device, origin, and verifier of the ended login.
   */
  async closeDeviceSession(login: DeviceSessionKey): Promise<void> {
    this.deviceRegistryVersion += 1
    await Promise.all(Array.from(this.deviceLeases.values())
      .filter(({ session }) => session.deviceId === login.deviceId && session.origin === login.origin
        && session.verifier === login.verifier)
      .map(lease => lease.release()))
  }

  /**
   * Compare live Peers without exposing the device session verifier.
   * @param first - Request Peer.
   * @param second - Event stream Peer.
   * @returns Whether both Peers belong to the same live device login.
   */
  sharesDeviceSession(first: PeerScope, second: PeerScope): boolean {
    const firstLease = this.deviceLeases.get(first)
    const secondLease = this.deviceLeases.get(second)
    const session = firstLease?.session
    const other = secondLease?.session
    return !first.signal.aborted && !second.signal.aborted
      && firstLease?.active === true && secondLease?.active === true
      && session !== undefined && other !== undefined && !this.invalidatingDevices.has(session.deviceId)
      && session.expiresAt > Date.now() && other.expiresAt > Date.now()
      && session.deviceId === other.deviceId && session.origin === other.origin && session.verifier === other.verifier
  }

  /**
   * Read the rights of the device behind a live login.
   * @param deviceId - Device the Peer's principal names.
   * @returns Its scopes, every scope for a device created before scopes, or undefined while no login of it is live.
   */
  deviceScopes(deviceId: string): readonly DeviceScope[] | undefined {
    for (const lease of this.deviceLeases.values()) {
      if (lease.session.deviceId === deviceId && lease.active) return lease.session.scopes ?? DEVICE_SCOPES
    }
    return undefined
  }

  private async invalidateDevice<T>(id: DeviceId, mutate: () => Promise<T>): Promise<T> {
    this.deviceRegistryVersion += 1
    const invalidations = this.invalidatingDevices.get(id) ?? { count: 0 }
    invalidations.count += 1
    this.invalidatingDevices.set(id, invalidations)
    let outcome: DeviceAdministrationError['durableOutcome'] = 'unknown'
    let cleanup: DeviceAdministrationError['liveCleanup'] = 'complete'
    let result: T | undefined
    const failures: unknown[] = []
    try {
      result = await mutate()
      outcome = result === undefined || result === false ? 'unchanged' : 'committed'
    } catch (error) {
      failures.push(error)
    }
    try {
      await this.closeDeviceLeases(id)
    } catch (error) {
      cleanup = 'failed'
      failures.push(error)
    } finally {
      invalidations.count -= 1
      if (invalidations.count === 0) this.invalidatingDevices.delete(id)
    }
    if (failures.length > 0) throw new DeviceAdministrationError(outcome, cleanup, { cause: new AggregateError(failures) })
    return result as T
  }

  private async closeDeviceLeases(id: DeviceId): Promise<void> {
    this.deviceRegistryVersion += 1
    await Promise.all(Array.from(this.deviceLeases.values())
      .filter(lease => lease.session.deviceId === id)
      .map(lease => lease.release()))
  }

  private isTrusted(request: ConnectionTrustRequest): boolean {
    const carrier = this.owner.get('webServer')
    return isTrustedApiRequest(request, this.trustedHosts, carrier?.host, carrier?.protocol ?? 'http:')
  }

  private publishPeer(interactions: ConnectionInteractions): PeerId {
    const peer = new Peer(this.owner, { principal: { kind: 'owner' }, interactions })
    this.peers.set(peer.id, { peer, ownsSocket: false })
    return peer.id
  }

  /**
   * Authenticate and publish a credential before sending the connect redirect.
   * @param request - launch-token request on /connect.
   * @param response - response owned to completion.
   */
  authorizeConnect(request: ConnectionIndexRequest, response: ConnectionIndexResponse): void {
    if (!this.isTrusted(request) || this.disposed || !this.allowOwnerLogin) {
      const unauthorized = this.disposed || !this.allowOwnerLogin
      response.writeHead(unauthorized ? 401 : 403)
      response.end(unauthorized ? 'unauthorized' : 'forbidden')
      return
    }
    this.browserAuth.authorizeConnect(request, response,
      this.owner.get('webServer')?.protocol === 'https:', interactions => this.publishPeer(interactions))
  }

  /**
   * Authenticate an index request; native TLS listeners mint Secure cookies.
   */
  authorizeIndex(request: ConnectionIndexRequest, response: ConnectionIndexResponse): boolean {
    if (this.disposed || !this.allowOwnerLogin) {
      response.writeHead(401, { 'cache-control': 'no-store' })
      response.end()
      return false
    }
    return this.browserAuth.authorizeIndex(request, response, this.ctx.get('webServer')?.protocol === 'https:')
  }

  /** Add this process's launch token to the clean application URL. */
  authenticatedUrl(baseUrl: string): string {
    return this.allowOwnerLogin ? this.browserAuth.authenticatedUrl(baseUrl) : baseUrl
  }

  /**
   * Compose one shared-channel Fetch handler from exact routes and its interceptor.
   * @param channel - shared channel mounted by Connection.
   * @returns Fetch handler that selects one owner or returns 404.
   */
  createSharedFetchHandler(
    channel: '/api',
  ): ConnectionFetchHandler {
    return {
      requestBodyMode: ({ method, url }) => {
        const route = this.fetchRoutes.get(url.pathname)
        return route?.methods.has(method) === true ? route.requestBody : 'buffered'
      },
      fetch: (request, peer) => {
        const pathname = new URL(request.url).pathname
        const route = this.fetchRoutes.get(pathname)
        if (route?.methods.has(request.method) === true) {
          // Exact routes bypass Gateway, so the feature must explicitly allow device access.
          const deviceAllowed = route.allowRemoteDevice && peer.principal.kind === 'remote-device'
          if (peer.principal.kind !== 'owner' && !deviceAllowed) {
            return Promise.resolve(new Response('forbidden', { status: 403 }))
          }
          return route.fetch(request)
        }
        const endpoint = endpointFromPath(channel, pathname)
        const interceptor = this.interceptors.get(channel)
        if (endpoint === undefined || interceptor === undefined || !interceptor.matches(endpoint)) {
          return Promise.resolve(new Response('not found', { status: 404 }))
        }
        return interceptor.fetchHandler.fetch(request, peer)
      },
    }
  }

  private registerFetchRoute(
    owner: Context,
    route: ConnectionFetchRoute,
  ): () => Promise<void> {
    assertFetchRoute(route)
    const registered: RegisteredFetchRoute = {
      methods: new Set(route.methods),
      requestBody: route.requestBody,
      allowRemoteDevice: route.allowRemoteDevice === true,
      fetch: route.fetch,
    }
    return owner.effect(() => {
      if (this.fetchRoutes.has(route.path)) {
        throw new Error(`connection: exact Fetch route ${JSON.stringify(route.path)} is already registered`)
      }
      this.fetchRoutes.set(route.path, registered)
      return () => { this.fetchRoutes.delete(route.path) }
    }, `client-connection: ${route.path} Fetch route`)
  }

  private register(
    owner: Context,
    channel: string,
    handler: ConnectionRpcHandler,
  ): () => Promise<void> {
    assertChannel(channel)
    const fetchHandler = rpcFetchHandler(channel, handler)
    const route: WebRoute = {
      kind: 'prefix',
      path: channel,
      handler: (req, res) => this.handleHttpTransport(req, res, peer => bridge(req, res, fetchHandler, peer)),
    }
    return owner.effect(
      () => owner.webServer.register(route),
      `client-connection: ${channel} rpc channel`,
    )
  }

  private registerInterceptor(
    owner: Context,
    channel: string,
    matches: ConnectionRpcEndpointMatcher,
    handler: ConnectionRpcHandler,
  ): () => Promise<void> {
    if (channel !== API_PATH) {
      throw new Error(`connection: invalid shared RPC channel ${JSON.stringify(channel)}`)
    }
    const interceptor: ConnectionRpcInterceptor = {
      matches,
      fetchHandler: rpcFetchHandler(channel, handler),
    }
    return owner.effect(() => {
      if (this.interceptors.has(channel)) {
        throw new Error(`connection: shared RPC channel ${JSON.stringify(channel)} already has an interceptor`)
      }
      this.interceptors.set(channel, interceptor)
      return () => {
        this.interceptors.delete(channel)
      }
    }, `client-connection: ${channel} rpc interceptor`)
  }
}

function rpcFetchHandler(
  channel: string,
  handler: ConnectionRpcHandler,
): ConnectionFetchHandler {
  return {
    requestBodyMode: () => 'buffered',
    async fetch(request: Request, peer: PeerScope): Promise<Response> {
      const endpoint = endpointFromPath(channel, new URL(request.url).pathname)
      if (request.method !== 'POST' || endpoint === undefined) {
        return new Response('not found', { status: 404 })
      }

      const mediaType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
      if (mediaType !== 'application/json') {
        return new Response('content type must be application/json', { status: 415 })
      }

      let body: unknown
      try {
        body = await request.json()
      } catch {
        return new Response('body is not JSON', { status: 400 })
      }

      const envelope = clientRequestSchema.safeParse(body)
      if (!envelope.success) {
        return invalidEnvelopeResponse(body, envelope.error.issues)
      }
      const message: ClientRequest = envelope.data
      if (message.method !== endpoint) {
        return errorResponse(message.rpcId, {
          code: 'gateway/bad-request',
          message: `method ${JSON.stringify(message.method)} does not match endpoint ${JSON.stringify(endpoint)}`,
          details: { issues: [] },
        })
      }

      try {
        const result = await handler(endpoint, message.payload, request.signal, peer)
        return fullResponse(message.rpcId, result)
      } catch (error) {
        return new Response(`handler failure: ${String(error)}`, { status: 500 })
      }
    },
  }
}

function invalidEnvelopeResponse(body: unknown, issues: readonly object[]): Response {
  const rawId = (body as { rpcId?: unknown } | null)?.rpcId
  const rpcId = typeof rawId === 'string' ? RpcId(rawId) : INVALID_REQUEST_RPC_ID
  return errorResponse(rpcId, {
    code: 'gateway/bad-request',
    message: 'invalid client-request message',
    details: { issues },
  })
}

function endpointFromPath(channel: string, pathname: string): string | undefined {
  if (!pathname.startsWith(`${channel}/`)) return undefined
  const endpoint = pathname.slice(channel.length + 1)
  const segments = endpoint.split('/')
  if (segments.some(segment =>
    segment === '' || segment === '.' || segment === '..' || !ENDPOINT_SEGMENT_PATTERN.test(segment))) {
    return undefined
  }
  return endpoint
}

function errorResponse(rpcId: RpcIdType, error: ConnectionRpcFailure): Response {
  return fullResponse(rpcId, { ok: false, error })
}

function fullResponse(rpcId: RpcIdType, result: Awaited<ReturnType<ConnectionRpcHandler>>): Response {
  if (!result.ok) {
    const body: ConnectionServerResponse = { type: 'server-response', rpcId, result }
    return Response.json(body)
  }
  const { attachments, ...success } = result
  const body: ConnectionServerResponse = { type: 'server-response', rpcId, result: success }
  if (attachments === undefined || attachments.length === 0) return Response.json(body)
  const parts = new FormData()
  const attachmentMetadata = attachments.map((attachment, index) => {
    const part = `bytes-${index}`
    // FileSystem bytes may have SharedArrayBuffer backing, which BlobPart excludes.
    parts.set(part, new Blob([new Uint8Array(attachment.bytes)]))
    return { path: [...attachment.path], codec: 'bytes' as const, part }
  })
  parts.set('metadata', JSON.stringify({ ...body, attachments: attachmentMetadata }))
  return new Response(parts)
}

function assertChannel(channel: string): void {
  if (!CHANNEL_PATTERN.test(channel) || channel === '/api') {
    throw new Error(`connection: invalid or reserved RPC channel ${JSON.stringify(channel)}`)
  }
}

function assertFetchRoute(route: ConnectionFetchRoute): void {
  if (endpointFromPath(API_PATH, route.path) === undefined) {
    throw new Error(`connection: invalid exact Fetch route ${JSON.stringify(route.path)}`)
  }
  if (route.methods.length === 0) {
    throw new Error(`connection: exact Fetch route ${JSON.stringify(route.path)} declares no methods`)
  }
  const methods = new Set(route.methods)
  if (methods.size !== route.methods.length) {
    throw new Error(`connection: exact Fetch route ${JSON.stringify(route.path)} repeats a method`)
  }
}
