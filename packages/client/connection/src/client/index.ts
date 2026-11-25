/** Browser wire client: Remote transport and connection generations. */
import type { Context } from '@deepseek-ai/cordis'
import {
  ConnectionController,
  type ConnectionRecoveryConfig,
  type ConnectionGeneration,
  type ConnectionGenerationSource,
  type ConnectionSinks,
  type ConnectionState,
} from './connection.ts'
import { createWebConnectionRpc, type RpcFetch, type RpcStreamOpen } from './rpc.ts'
import { isLoopbackHostname } from '../loopback-hostname.ts'
import type { ClientConnectionRpc } from '../rpc.ts'
import { resolveConnectionConfig } from '../recovery-config.ts'
import { CONNECT_PATH, DEVICE_PROTOCOL_HEADER, DEVICE_PROTOCOL_VERSION, type ConnectionInteractions } from '../connect-protocol.ts'
import { openConnectionWebSocket, type ConnectionWebSocket, type ConnectionWebSocketFactory } from './socket.ts'

export type { ConnectionInteractions } from '../connect-protocol.ts'
export type { ConnectionWebSocket, ConnectionWebSocketFactory } from './socket.ts'

declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * A connection generation was established. Wire-derived caches must
     * repull; long-lived streams own their own resume and baseline lifecycle.
     * @mode emit
     */
    'connection/reset'(): void
  }
}

// ---- Browser-safe protocol and shared value re-exports ----
export type {
  MessageId,
  RpcRequest, RpcResponse, RpcResult,
  ClientRequest, ServerResponse, RpcMessage,
  SessionId, SessionEvent, ContentBlock, StreamChunk,
} from './api.ts'
export {
  RpcId,
  transportError,
} from './api.ts'

// Connection loop types are public through ConnectionHandle.start; the
// controller remains package-internal.
export type {
  ConnectionRecoveryConfig,
  ConnectionGeneration,
  ConnectionGenerationSource,
  ConnectionHostInfo,
  ConnectionSinks,
  ConnectionState,
} from './connection.ts'
export type {
  ClientConnectionRpc, ConnectionRpcFailure, ConnectionRpcResult,
} from '../rpc.ts'
export type { RpcFetch } from './rpc.ts'

/** Observable identity and Host facts for the active connection generation. */
export interface ConnectionGenerationState {
  /** Active generation, or undefined before readiness and while reconnecting. */
  getSnapshot(): ConnectionGeneration | undefined
  /** Subscribe to generation establishment, replacement, and loss. */
  subscribe(listener: () => void): () => void
}

/** Observable recovery lifecycle of the owned Connection loop. */
export interface ConnectionStateSource {
  /** Current state, or undefined before the first connection outcome. */
  getSnapshot(): ConnectionState | undefined
  /** Subscribe to state changes. */
  subscribe(listener: () => void): () => void
}

/** Required services (none — this is the wire root). */
export const inject: string[] = []

/**
 * Physical carrier selected when the Connection service is installed. The
 * served web app omits it and gets HTTP + WebSocket; a shell that owns a
 * different transport (the worker preview's postMessage tunnel) provides both
 * halves instead of forking this plugin.
 */
export interface ClientTransportHooks {
  /**
   * Already decoded logical RPC carrier. When present it replaces the HTTP
   * caller outright: no envelopes, no `fetch`, no `openStream` (an in-process
   * Host such as a test mock plugs in here).
   */
  rpc?: ClientConnectionRpc
  /** Transport for generic unary RPC channels (the Typert gateway); unused when `rpc` is present. */
  fetch?: RpcFetch
  /** Worker-local Gateway stream carrier; absent when the page uses the Gateway WebSocket or `rpc` is present. */
  openStream?: RpcStreamOpen
  /**
   * Bundle transport for the module system, present when the carrier also owns
   * bundle bytes (the worker tunnel). Absent in the served web app, whose
   * bundles load over HTTP.
   */
  loadBundle?(url: string): Promise<void>
  /**
   * Package-asset resolver for the module system, present when the page cannot
   * request `plugins/<package>/assets/<path>` itself (the worker tunnel): it
   * maps each reference to a URL the page can load. Absent in the served web app.
   */
  resolveAsset?(reference: string): string
  /**
   * The transport owner declares the page owns the Host outright: the Host
   * runs inside a worker this page spawned, so no other party can reach it and
   * the loopback stand-in for "the owner's own machine" is vacuous.
   * `ctx.connection.isLoopback` then reports the privileged surface reachable
   * regardless of the page authority. Only a shell that assembles its own
   * transport can set this; served pages never carry the global at all.
   */
  ownsHost?: boolean
  /** Authenticated WebSocket factory; omission uses the browser API and its cookie jar. */
  createWebSocket?: ConnectionWebSocketFactory
  /** Host base URL for desktop or Node sockets; omission uses the document base. */
  streamBaseUrl?: string
  /**
   * The carrier moves the page to another route of the same Host once the page keeps failing to reach it.
   * It is called on the third failed retry in a row and then on every tenth, and not while the browser is offline,
   * when no route can be reached at all. A served page has no carrier, and a page that owns its Host has no other route.
   */
  onConnectionLost?(): void
  /**
   * The carrier calls the listener after it changes {@link ClientTransportHooks.streamBaseUrl}, so the page reconnects
   * at once instead of waiting for its next retry.
   * @param listener - Callback for one route change.
   * @returns A function that ends the notifications.
   */
  onRouteChanged?(listener: () => void): () => void
}

/** Page global carrying {@link ClientTransportHooks}; absent in the served web app. */
interface ClientTransportGlobal {
  __OCEAN_TRANSPORT__?: ClientTransportHooks
  __OCEAN_CONNECTION_RECOVERY__?: unknown
}

/** Browser location fields used to classify loopback authority. */
export interface ConnectionLocation {
  readonly hostname: string
}

/** Instance-local inputs for installing a Connection service. */
export interface ConnectionInstallOptions {
  /** Forwarded-event participation; omission selects answer for a page and none otherwise. */
  readonly interactions?: ConnectionInteractions
  /** Explicit physical carrier; omit for the browser HTTP + WebSocket carrier. */
  readonly transport?: ClientTransportHooks
  /** Reconnect timing overrides; omitted fields use controller defaults. */
  readonly recovery?: ConnectionRecoveryConfig
  /** Page location; omit for a non-browser composition. */
  readonly location?: ConnectionLocation
  /** Same-origin admission check for a browser document served to a remote device. */
  readonly deviceDocument?: {
    readonly connectUrl: URL
    readonly signIn: () => void
  }
}

/**
 * The ctx.connection service API. API Gateway supplies generation readiness
 * and reset callbacks; Connection stays independent of downstream domain state.
 */
export interface ConnectionHandle {
  /** End this browser login and return to the Host sign-in form. Available on device documents. */
  endDeviceSession?: () => Promise<void>
  /** Forwarded-event participation selected at installation. */
  readonly interactions: ConnectionInteractions
  /**
   * Whether the privileged surface is reachable: the page authority is
   * loopback, the transport declares the page owns the Host
   * ({@link ClientTransportHooks.ownsHost}), or the context is not a browser.
   */
  readonly isLoopback: boolean
  /** Current Remote event generation and the Host facts carried by its opening frame. */
  readonly generation: ConnectionGenerationState
  /** Current recovery lifecycle for connection-specific consumers. */
  readonly state: ConnectionStateSource
  /** Generic logical RPC channels over the same Connection transport. */
  readonly rpc: ClientConnectionRpc
  /**
   * Create a socket on the selected carrier; the channel owns framing and closing.
   * @param path - absolute logical channel path, resolved beneath the Host mount.
   * @returns a newly connecting socket using the installed authentication factory.
   */
  openWebSocket(path: string): ConnectionWebSocket
  /** Reset retry progression and replace the current attempt immediately. */
  reconnect(): void
  /**
   * Register the sole source defining Host generations. The source reports
   * ready only after its incremental listeners are attached.
   * @param source - long-lived generation source owned by the push carrier.
   * @returns disposer withdrawing the source and stopping an active loop.
   */
  registerGenerationSource(source: ConnectionGenerationSource): () => void
  /**
   * Start the connect/reconnect loop with the consumer's state callbacks.
   * API Gateway owns the loop; a second call throws.
   * @param sinks - connection-state callbacks.
   * @param config - explicit timing overrides; omitted fields use Host bootstrap timing.
   * @returns lifecycle controls for the loop.
   */
  start(sinks: ConnectionSinks, config?: ConnectionRecoveryConfig): ConnectionLoop
}

/** Controls retained by the sole owner of a running connection loop. */
export interface ConnectionLoop {
  /** Stop the loop and withdraw its active generation. */
  stop(): void
}

interface ConnectionOwner {
  readonly token: object
  readonly source: ConnectionGenerationSource
  readonly controller: ConnectionController
  readonly stopNetworkWatch: () => void
}

interface BrowserNetworkTarget {
  readonly navigator?: { readonly onLine?: boolean }
  addEventListener(type: 'online' | 'offline', listener: () => void): void
  removeEventListener(type: 'online' | 'offline', listener: () => void): void
}

function watchBrowserNetwork(controller: ConnectionController): () => void {
  const browser = (globalThis as { readonly window?: BrowserNetworkTarget }).window
  const initiallyAvailable = browser?.navigator?.onLine
  if (browser === undefined || initiallyAvailable === undefined) return () => {}
  const online = (): void => { controller.setNetworkAvailable(true) }
  const offline = (): void => { controller.setNetworkAvailable(false) }
  controller.setNetworkAvailable(initiallyAvailable)
  browser.addEventListener('online', online)
  browser.addEventListener('offline', offline)
  return () => {
    browser.removeEventListener('online', online)
    browser.removeEventListener('offline', offline)
  }
}

/** Retries in a row after which the page first reports a Host it cannot reach. */
const LOSS_REPORT_RETRIES = 3
/** Retries between later reports of the same loss. */
const LOSS_REPORT_INTERVAL_RETRIES = 10

/**
 * Install one Context-owned Connection service from explicit composition inputs.
 * @param ctx - client Cordis context.
 * @param options - interaction participation, physical carrier, reconnect timing, and page location.
 */
export function installConnection(ctx: Context, options: ConnectionInstallOptions = {}): void {
  const pageLocation = options.location
  const transport = options.transport
  const deviceDocument = options.deviceDocument
  const recovery = options.recovery ?? {}
  const interactions = options.interactions ?? (pageLocation === undefined ? 'none' : 'answer')
  const rpc = transport?.rpc ?? createWebConnectionRpc(transport?.fetch, transport?.openStream)
  let generationSource: ConnectionGenerationSource | undefined
  let owner: ConnectionOwner | undefined
  let generationId = 0
  let generation: ConnectionGeneration | undefined
  let state: ConnectionState | undefined
  const generationListeners = new Set<() => void>()
  const stateListeners = new Set<() => void>()
  const publishGeneration = (next: ConnectionGeneration | undefined): void => {
    if (Object.is(generation, next)) return
    generation = next
    for (const listener of [...generationListeners]) {
      try {
        listener()
      } catch (error) {
        console.error('[connection] generation listener threw:', error)
      }
    }
  }
  const publishState = (next: ConnectionState | undefined): void => {
    if (state === next) return
    state = next
    for (const listener of [...stateListeners]) {
      try {
        listener()
      } catch (error) {
        console.error('[connection] state listener threw:', error)
      }
    }
  }
  const releaseOwner = (current: ConnectionOwner): void => {
    if (owner !== current) return
    owner = undefined
    current.stopNetworkWatch()
    current.controller.stop()
    publishGeneration(undefined)
    publishState(undefined)
  }
  const handle: ConnectionHandle = {
    ...(deviceDocument === undefined ? {} : {
      async endDeviceSession() {
        const response = await fetch(deviceDocument.connectUrl, {
          method: 'DELETE', credentials: 'same-origin', redirect: 'error',
          headers: { [DEVICE_PROTOCOL_HEADER]: DEVICE_PROTOCOL_VERSION },
        })
        if (response.status !== 204) throw new Error(`Ocean device sign-out failed (HTTP ${response.status})`)
        if (owner !== undefined) releaseOwner(owner)
        deviceDocument.signIn()
      },
    }),
    interactions,
    openWebSocket: path => openConnectionWebSocket(path, transport?.createWebSocket, transport?.streamBaseUrl),
    isLoopback: deviceDocument === undefined
      && (transport?.ownsHost === true || pageLocation === undefined || isLoopbackHostname(pageLocation.hostname)),
    generation: {
      getSnapshot: () => generation,
      subscribe: (listener) => {
        generationListeners.add(listener)
        return () => { generationListeners.delete(listener) }
      },
    },
    state: {
      getSnapshot: () => state,
      subscribe: (listener) => {
        stateListeners.add(listener)
        return () => { stateListeners.delete(listener) }
      },
    },
    rpc,
    reconnect() {
      owner?.controller.reconnect()
    },
    registerGenerationSource(source) {
      if (generationSource !== undefined) {
        throw new Error('connection: a generation source is already registered')
      }
      generationSource = source
      return () => {
        if (generationSource !== source) return
        generationSource = undefined
        const current = owner
        if (current?.source === source) releaseOwner(current)
      }
    },
    start(sinks, config) {
      if (owner !== undefined) throw new Error('connection: the stream loop is already owned by another consumer')
      const source = generationSource
      if (source === undefined) throw new Error('connection: no generation source is registered')
      const token = {}
      const ownsGeneration = (): boolean => owner?.token === token
      let retries = 0
      const reconnectRequested = sinks.onReconnectRequested
      const startGeneration: ConnectionGenerationSource = deviceDocument === undefined ? source : async (signal, ready) => {
        const response = await fetch(deviceDocument.connectUrl, {
          method: 'HEAD', credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal,
        })
        signal.throwIfAborted()
        if (response.status === 401) {
          const current = owner
          /* v8 ignore next -- owner replacement or release aborts this generation first, so throwIfAborted already threw. */
          if (current?.token === token) {
            releaseOwner(current)
            deviceDocument.signIn()
          }
          return
        }
        if (response.status !== 204) throw new Error(`Ocean device session check failed (HTTP ${response.status})`)
        await source(signal, ready)
      }
      const controller = new ConnectionController(startGeneration, {
        ...sinks,
        onReconnectRequested: () => {
          reconnectRequested?.()
          // Every failed attempt asks for the next one; report the loss rarely enough for a carrier to react.
          retries += 1
          if (retries === LOSS_REPORT_RETRIES || retries % LOSS_REPORT_INTERVAL_RETRIES === 0) transport?.onConnectionLost?.()
        },
        onConnected: (host) => {
          retries = 0
          const nextGeneration = { id: ++generationId, host }
          publishGeneration(nextGeneration)
          if (!ownsGeneration() || !Object.is(generation, nextGeneration)) return
          sinks.onConnected?.(host)
        },
        onStateChange: (state) => {
          if (state !== 'connected') {
            publishGeneration(undefined)
          }
          if (!ownsGeneration()) return
          publishState(state)
          sinks.onStateChange?.(state)
        },
      }, { ...recovery, ...config })
      const current = { token, source, controller, stopNetworkWatch: watchBrowserNetwork(controller) }
      owner = current
      controller.start()
      return {
        stop: () => { releaseOwner(current) },
      }
    },
  }
  ctx.provide('connection', handle)
  const stopRouteChanges = transport?.onRouteChanged?.(() => { handle.reconnect() })
  if (stopRouteChanges !== undefined) ctx.effect(() => stopRouteChanges, 'connection: route changes')
}

/**
 * Client plugin body: read the page composition and install its Connection service.
 * @param ctx - client Cordis context.
 */
export function apply(ctx: Context): void {
  const globals = globalThis as ClientTransportGlobal
  const pageLocation = typeof location === 'undefined' ? undefined : location
  const transport = globals.__OCEAN_TRANSPORT__
  const deviceBase = transport === undefined && typeof document !== 'undefined'
    ? document.querySelector<HTMLBaseElement>('base[data-ocean-device]')
    : null
  installConnection(ctx, {
    ...(transport === undefined ? {} : { transport }),
    recovery: resolveConnectionConfig(globals.__OCEAN_CONNECTION_RECOVERY__),
    ...(pageLocation === undefined ? {} : { location: pageLocation }),
    ...(deviceBase == null || pageLocation === undefined ? {} : {
      deviceDocument: {
        connectUrl: new URL(CONNECT_PATH.slice(1), deviceBase.href),
        signIn: () => { pageLocation.reload() },
      },
    }),
  })
}
