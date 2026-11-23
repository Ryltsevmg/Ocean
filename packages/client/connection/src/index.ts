/** Host HTTP bridge for browser-client RPC. */
import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type {} from '@ocean/ocean-attachment'
import type {} from '@ocean/ocean-credentials'
// Activates the webServer Context merge used below.
import type { WebRoute } from '@ocean/ocean-host-webserver'
import { API_PATH } from './api-path.ts'
import { CONNECT_PATH, DEVICE_BOOTSTRAP_PATH, DEVICE_PAIR_PATH } from './connect-protocol.ts'
import { bridge } from './http-bridge.ts'
import { isLoopbackHostname } from './loopback-hostname.ts'
import { assertTrustedAuthority } from './api-request-trust.ts'
import { DeviceTokens } from './device-tokens.ts'
import { DeviceBootstrap } from './device-bootstrap.ts'
import { listenDeviceAdmin } from './device-admin.ts'
import { loadDeviceHostIdentity } from './device-host-identity.ts'
import { DeviceLogin } from './device-login.ts'
import { BrowserAuth } from './browser-auth.ts'
import { HostConnectionService } from './rpc-host.ts'
import { resolveConnectionConfig } from './recovery-config.ts'
import { resolveHostConnectionConfig, resolveDeviceTransportLimits, type ConnectionConfig } from './host-config.ts'
export { Config } from './host-config.ts'
export type { ConnectionConfig } from './host-config.ts'

export type {
  PeerAdmission,
  ConnectionAdmission,
  ConnectionFetchMethod,
  ConnectionFetchHandler,
  ConnectionFetchRoute,
  ConnectionIndexRequest,
  ConnectionIndexResponse,
  ConnectionRpcEndpointMatcher,
  ConnectionRpcAttachment,
  ConnectionRpcFailure,
  ConnectionRpcHandler,
  ConnectionRpcHandlerResult,
  ConnectionRequestRejection,
  ConnectionRpcResult,
  ConnectionRequestBodyMode,
  ConnectionTrustRequest,
  ClientRequest,
  HostConnectionHandle,
  HostConnectionFetch,
  HostConnectionRpc,
  RpcMessage,
  ServerResponse,
} from './rpc.ts'
export type { PeerId, PeerScope, Principal, RemoteInvocation } from '@ocean/ocean-typert-protocol'
export { RpcId, transportError } from './rpc.ts'
export { Peer } from './peer.ts'
export type { PeerOptions } from './peer.ts'
export type { ConnectionWebSocket, ConnectionWebSocketFactory } from './connect-protocol.ts'
export { CONNECT_PATH, type ConnectionInteractions } from './connect-protocol.ts'
export {
  clientRequestSchema,
  rpcErrorSchema,
  rpcIdSchema,
  rpcMessageSchema,
  rpcResultSchema,
  serverResponseSchema,
} from './rpc-schema.ts'
export { HostConnectionService } from './rpc-host.ts'
export { DeviceBootstrap } from './device-bootstrap.ts'
export type { DeviceId, DeviceMetadata } from './device-tokens.ts'

export { API_PATH } from './api-path.ts'

/** Stable Cordis plugin name. */
export const name = 'client-connection'

declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Admit or wrap an authenticated shared API request, including body transfer.
     * Existing requests continue when a listener refuses subsequent requests.
     * @param request - Authenticated incoming HTTP request.
     * @param response - Response owned until the delegated bridge settles.
     * @param next - Delegate to the next listener or the shared API bridge.
     * @mode waterfall
     */
    'connection/request'(request: IncomingMessage, response: ServerResponse, next: () => Promise<void>): Promise<void>
  }
}

/** Headroom for RPC JSON fields around aggregate base64 image payloads. */
const REQUEST_ENVELOPE_HEADROOM_BYTES = 1024 * 1024

function assertImageBodyCapacity(ctx: Context, maxRequestBodyBytes: number): void {
  const attachments = ctx.get('attachments')
  if (attachments === undefined) return
  const requiredImageBodyBytes = Math.ceil(
    attachments.imageLimits.maxMessageImageBytes * 4 / 3,
  ) + REQUEST_ENVELOPE_HEADROOM_BYTES
  if (maxRequestBodyBytes < requiredImageBodyBytes) {
    throw new Error(
      `client-connection maxRequestBodyBytes (${String(maxRequestBodyBytes)}) must be at least `
      + `${String(requiredImageBodyBytes)} for the configured aggregate image limit`,
    )
  }
}

/** Services required before providing Connection. */
export const inject = ['credentials']

/**
 * Provides carrier-neutral RPC and Fetch registries. When `webServer` is
 * present, the plugin also mounts the `/api` browser transport with Host/Origin
 * checks and persistent browser authentication.
 * @param ctx - Host plugin context.
 * @param config - resolved plugin config (schema defaults applied).
 */
export async function apply(ctx: Context, config?: ConnectionConfig): Promise<void> {
  const resolved = resolveHostConnectionConfig(config)
  if (resolved.deviceBootstrapOnly) {
    new DeviceBootstrap(ctx)
    return
  }
  const recovery = resolveConnectionConfig(resolved.recovery)
  const { trustedHosts, cookieMaxAgeDays, maxRequestBodyBytes } = resolved
  // Config boundary: a malformed entry fails the load loudly here rather than
  // silently authorizing its hostname prefix at request time.
  for (const entry of trustedHosts) assertTrustedAuthority(entry)
  assertImageBodyCapacity(ctx, maxRequestBodyBytes)
  const proxy = resolved.deviceProxyUrl === undefined ? undefined : new URL(resolved.deviceProxyUrl)
  if (proxy !== undefined && (proxy.protocol !== 'https:' || proxy.username || proxy.password)) {
    throw new Error('client-connection: deviceProxyUrl must be HTTPS and contain no credentials')
  }
  const deviceLogin = !resolved.allowOwnerLogin ? new DeviceLogin(new DeviceTokens(ctx.credentials), {
    trustedHosts,
    identity: await loadDeviceHostIdentity(ctx.credentials, ctx.root),
    ...(proxy === undefined ? {} : { proxyOrigin: proxy.origin }),
    lifetimeMs: (resolved.deviceSessionLifetimeSeconds ?? cookieMaxAgeDays * 86_400) * 1000,
    maxSessionsPerDevice: resolved.maxDeviceSessions,
    maxExchangesPerWindow: resolved.maxDeviceExchangesPerWindow,
    exchangeWindowMs: resolved.deviceExchangeWindowMs,
  }) : undefined
  let closeAdmin: (() => Promise<void>) | undefined
  const connection = new HostConnectionService(
    ctx,
    trustedHosts,
    await BrowserAuth.create(ctx.root, ctx.credentials, cookieMaxAgeDays),
    resolved.allowOwnerLogin,
    deviceLogin,
    resolveDeviceTransportLimits(resolved),
    async () => { await closeAdmin?.() },
  )
  if (resolved.deviceAdminSocket !== undefined) {
    if (deviceLogin === undefined) throw new Error('client-connection: deviceAdminSocket requires device mode')
    closeAdmin = await listenDeviceAdmin(resolved.deviceAdminSocket, async (command) => {
      switch (command.action) {
        case 'list': return deviceLogin.tokens.list()
        case 'create': return deviceLogin.tokens.issue(command.label)
        case 'pair': {
          const grant = await deviceLogin.tokens.createPairing(command.label,
            (command.ttlSeconds ?? resolved.devicePairingTtlSeconds) * 1000)
          return {
            grant: grant.secret,
            expiresAt: grant.expiresAt,
            ...resolved.deviceProxyUrl === undefined ? {} : { address: resolved.deviceProxyUrl },
          }
        }
        case 'revoke': return connection.revokeDevice(command.id)
        case 'rotate': return (await connection.rotateDevice(command.id)) ?? null
      }
    })
  }
  ctx.inject(['webServer'], (webCtx) => {
    if (proxy !== undefined && webCtx.webServer.protocol === 'http:' && !isLoopbackHostname(webCtx.webServer.host === '::1' ? '[::1]' : webCtx.webServer.host)) {
      throw new Error('client-connection: the HTTPS proxy backend must bind to loopback')
    }
    assertImageBodyCapacity(webCtx, maxRequestBodyBytes)
    webCtx.on('webserver/index-inject', (table) => {
      table.push({ kind: 'global', name: '__OCEAN_CONNECTION_RECOVERY__', value: recovery })
    })
    const fetchHandler = connection.createSharedFetchHandler(API_PATH)
    const route: WebRoute = {
      kind: 'prefix',
      path: API_PATH,
      handler: (req, res) => connection.handleHttpTransport(req, res, peer =>
        webCtx.waterfall('connection/request', req, res, () => bridge(req, res, fetchHandler, peer, maxRequestBodyBytes))),
    }
    webCtx.effect(() => webCtx.webServer.register(route), 'client-connection: /api route')
    webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact', path: CONNECT_PATH,
      handler: async (req, res) => {
        if (deviceLogin !== undefined && req.method === 'DELETE') {
          await deviceLogin.logout(req, res, webCtx.webServer, login => connection.closeDeviceSession(login))
          return
        }
        if (deviceLogin !== undefined && req.method === 'HEAD') {
          await deviceLogin.identify(req, res, webCtx.webServer)
          return
        }
        if (deviceLogin !== undefined && req.method === 'POST') {
          await deviceLogin.exchange(req, res, webCtx.webServer)
          return
        }
        connection.authorizeConnect(req, res)
      },
    }), 'client-connection: /connect route')
    if (deviceLogin !== undefined) webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact', path: DEVICE_PAIR_PATH,
      handler: async (req, res) => { await deviceLogin.pair(req, res, webCtx.webServer) },
    }), 'client-connection: /connect/pair route')
    if (deviceLogin !== undefined) webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact', path: DEVICE_BOOTSTRAP_PATH,
      resource: async (request) => {
        const headers = { 'cache-control': 'no-store' }
        const admission = await connection.admitDeviceDocument(request)
        if (admission === undefined) return new Response(null, { status: 401, headers })
        if ('rejection' in admission) return new Response(null, { status: admission.rejection, headers })
        try {
          admission.peer.signal.throwIfAborted()
          return Response.json(webCtx.webServer.collectIndexInjections(admission.peer), { headers })
        } finally {
          await admission.release()
        }
      },
    }), 'client-connection: device bootstrap')

  })
  ctx.inject(['attachments'], (attachmentCtx) => {
    assertImageBodyCapacity(attachmentCtx, maxRequestBodyBytes)
  })
}
