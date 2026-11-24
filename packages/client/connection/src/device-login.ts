/** HTTPS-only exchange of device tokens for browser login credentials. */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { isTrustedApiRequest } from './api-request-trust.ts'
import { DEVICE_EPOCH_HEADER, DEVICE_HOST_HEADER, DEVICE_PROTOCOL_HEADER, DEVICE_PROTOCOL_VERSION } from './connect-protocol.ts'
import type { HostId, HostEpoch } from './connect-protocol.ts'
import type { ConnectionTrustRequest } from './rpc.ts'
import type { DeviceId, DeviceSession, DeviceSessionKey, DeviceTokens } from './device-tokens.ts'
import { DeviceLoginCapacityError } from './device-tokens.ts'

function header(request: ConnectionTrustRequest, name: string): string | undefined {
  if (request.headers instanceof Headers) return request.headers.get(name) ?? undefined
  const value = request.headers[name]
  return typeof value === 'string' ? value : undefined
}

/** Resolve device login origins without accepting forwarded headers. */
export class DeviceLogin {
  private windowStartedAt = -Infinity
  private readonly attempts = new Map<DeviceId, number>()
  private pairWindowStartedAt = -Infinity
  private pairAttempts = 0
  /**
   * @param tokens - Durable credential registry.
   * @param config - Login limits and the optional HTTPS proxy origin.
   */
  constructor(readonly tokens: DeviceTokens, private readonly config: {
    trustedHosts: readonly string[]
    proxyOrigin?: string
    lifetimeMs: number
    maxSessionsPerDevice: number
    maxExchangesPerWindow: number
    exchangeWindowMs: number
    identity: { hostId: HostId; epoch: HostEpoch }
  }) {}

  /**
   * Admit a bearer exchange: POST over a trusted origin, the current protocol version, and the
   * Host identity the caller pinned. Both the token and the pairing exchange start here.
   * @param req - Incoming POST request.
   * @param listener - Bound address and transport protocol.
   * @returns The bearer without its scheme and the trusted origin, or the rejection status and headers that end the request.
   */
  private admit(req: IncomingMessage, listener: { host: string; protocol: 'http:' | 'https:' }):
    | { bearer: string; origin: string }
    | { rejection: number; headers: Record<string, string> } {
    if (req.method !== 'POST') return { rejection: 405, headers: {} }
    const origin = this.origin(req, listener)
    if (origin === undefined) return { rejection: 403, headers: {} }
    if (req.headers[DEVICE_PROTOCOL_HEADER] !== DEVICE_PROTOCOL_VERSION) {
      return { rejection: 409, headers: { [DEVICE_PROTOCOL_HEADER]: DEVICE_PROTOCOL_VERSION } }
    }
    const expectedHost = header(req, DEVICE_HOST_HEADER)
    if (expectedHost !== undefined && expectedHost !== this.config.identity.hostId) return { rejection: 412, headers: {} }
    const authorization = req.headers.authorization
    if (authorization?.length !== 87 || !authorization.startsWith('Bearer ')) return { rejection: 401, headers: {} }
    return { bearer: authorization.slice(7), origin }
  }

  /**
   * End a request with an admission's rejection, so a refused exchange carries no body and is never cached.
   * @param res - Response owned by the calling endpoint.
   * @param admitted - A rejection status and the headers that explain it.
   */
  private refuse(res: ServerResponse, admitted: { rejection: number; headers: Record<string, string> }): void {
    res.writeHead(admitted.rejection, { 'cache-control': 'no-store', ...admitted.headers })
    res.end()
  }

  /**
   * Exchange an Authorization bearer and set a host-only login cookie.
   * @param req - Incoming POST request with the device bearer in Authorization.
   * @param res - Response owned by the login endpoint.
   * @param listener - Bound address and transport protocol.
   */
  async exchange(req: IncomingMessage, res: ServerResponse, listener: {
    host: string
    protocol: 'http:' | 'https:'
  }): Promise<void> {
    const reject = (status: number, headers: Record<string, string> = {}): void => {
      res.writeHead(status, { 'cache-control': 'no-store', ...headers })
      res.end()
    }
    const admitted = this.admit(req, listener)
    if ('rejection' in admitted) { this.refuse(res, admitted); return }
    let device: DeviceId | undefined
    try {
      device = await this.tokens.verify(admitted.bearer)
    } catch (_error) {
      // Credential storage details are not part of the public response.
      reject(503); return
    }
    if (device === undefined) { reject(401); return }
    const now = performance.now()
    if (now - this.windowStartedAt >= this.config.exchangeWindowMs) {
      this.windowStartedAt = now
      this.attempts.clear()
    }
    const attempts = this.attempts.get(device) ?? 0
    if (attempts >= this.config.maxExchangesPerWindow) {
      const retryAfter = Math.ceil((this.windowStartedAt + this.config.exchangeWindowMs - now) / 1000)
      reject(429, { 'retry-after': String(retryAfter) }); return
    }
    this.attempts.set(device, attempts + 1)
    let credential: string | undefined
    try {
      credential = await this.tokens.exchange(admitted.bearer, admitted.origin, this.config)
    } catch (error) {
      // Credential provider errors can contain record details. Keep them off the wire.
      if (error instanceof DeviceLoginCapacityError) {
        reject(503, { 'ocean-device-error': 'capacity' }); return
      }
      reject(503); return
    }
    if (credential === undefined) {  reject(401); return }
    res.writeHead(204, {
      ...this.identityHeaders(),
      'cache-control': 'no-store',
      'set-cookie': `__Host-ocean-device=${credential}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${Math.ceil(this.config.lifetimeMs / 1000)}`,
    })
    res.end()
  }

  /**
   * Exchange a one-time pairing grant for a new device token.
   * @param req - Incoming POST request with the grant bearer in Authorization.
   * @param res - Response owned by the pairing endpoint.
   * @param listener - Bound address and transport protocol.
   */
  async pair(req: IncomingMessage, res: ServerResponse, listener: {
    host: string
    protocol: 'http:' | 'https:'
  }): Promise<void> {
    const admitted = this.admit(req, listener)
    if ('rejection' in admitted) { this.refuse(res, admitted); return }
    const now = performance.now()
    if (now - this.pairWindowStartedAt >= this.config.exchangeWindowMs) {
      this.pairWindowStartedAt = now
      this.pairAttempts = 0
    }
    const reject = (status: number, headers: Record<string, string> = {}): void => {
      this.refuse(res, { rejection: status, headers })
    }
    if (this.pairAttempts >= this.config.maxExchangesPerWindow) {
      reject(429, { 'retry-after': String(Math.ceil((this.pairWindowStartedAt + this.config.exchangeWindowMs - now) / 1000)) }); return
    }
    this.pairAttempts += 1
    let device: Awaited<ReturnType<DeviceTokens['redeemPairing']>>
    try {
      device = await this.tokens.redeemPairing(admitted.bearer)
    } catch (_error) {
      // Credential provider errors can contain record details. Keep them off the wire.
      reject(503); return
    }
    if (device === undefined) { reject(401); return }
    res.writeHead(200, {
      ...this.identityHeaders(),
      'cache-control': 'no-store',
      'content-type': 'application/json',
    })
    res.end(JSON.stringify(device))
  }

  /**
   * Report Host identity for an explicit preflight or a valid authenticated reconnect.
   * @param req - Incoming HEAD request.
   * @param res - Response owned by the login endpoint.
   * @param listener - Bound address and protocol.
   */
  async identify(req: IncomingMessage, res: ServerResponse, listener: { host: string; protocol: 'http:' | 'https:' }): Promise<void> {
    const protocol = header(req, DEVICE_PROTOCOL_HEADER)
    if (protocol !== undefined && header(req, 'cookie') === undefined) {
      const trusted = this.origin(req, listener) !== undefined
      const compatible = protocol === DEVICE_PROTOCOL_VERSION
      res.writeHead(!trusted ? 403 : compatible ? 204 : 409, {
        'cache-control': 'no-store',
        ...(trusted ? compatible ? this.identityHeaders() : { [DEVICE_PROTOCOL_HEADER]: DEVICE_PROTOCOL_VERSION } : {}),
      })
      res.end()
      return
    }
    let valid: boolean
    try {
      valid = await this.authenticate(req, listener) !== undefined
    } catch (_error) {
      // A failed read establishes nothing about the presented login.
      res.writeHead(503, { 'cache-control': 'no-store' })
      res.end()
      return
    }
    res.writeHead(valid ? 204 : 401, {
      'cache-control': 'no-store',
      ...(valid ? this.identityHeaders() : {}),
    })
    res.end()
  }

  private identityHeaders(): Record<string, string> {
    return {
      [DEVICE_PROTOCOL_HEADER]: DEVICE_PROTOCOL_VERSION,
      [DEVICE_HOST_HEADER]: this.config.identity.hostId,
      [DEVICE_EPOCH_HEADER]: this.config.identity.epoch,
    }
  }

  /**
   * Remove the current login and expire its browser cookie.
   * @param req - Incoming DELETE request.
   * @param res - Response owned by the login endpoint.
   * @param listener - Bound address and protocol.
   * @param close - Release live transports before confirming logout.
   */
  async logout(
    req: IncomingMessage,
    res: ServerResponse,
    listener: { host: string; protocol: 'http:' | 'https:' },
    close: (login: DeviceSessionKey) => Promise<void>,
  ): Promise<void> {
    const origin = this.origin(req, listener)
    const credential = this.cookie(req)
    if (origin === undefined || credential === undefined || req.headers[DEVICE_PROTOCOL_HEADER] !== DEVICE_PROTOCOL_VERSION) {
      res.writeHead(403, { 'cache-control': 'no-store' })
      res.end()
      return
    }
    try {
      const login = await this.tokens.endSession(credential, origin)
      if (login !== undefined) await close(login)
    } catch (_error) {
      // Logout confirms both durable invalidation and live cleanup.
      res.writeHead(503, { 'cache-control': 'no-store' })
      res.end()
      return
    }
    res.writeHead(204, {
      'cache-control': 'no-store',
      'set-cookie': '__Host-ocean-device=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0',
    })
    res.end()
  }

  /**
   * Resolve a presented login using the same transport and origin checks as exchange.
   * @param req - HTTP request or WebSocket upgrade.
   * @param listener - Bound address and protocol.
   * @returns The authenticated device, if its login is valid.
   */
  async authenticate(req: ConnectionTrustRequest, listener: { host: string; protocol: 'http:' | 'https:' }): Promise<DeviceSession | undefined> {
    const origin = this.origin(req, listener)
    const credential = this.cookie(req)
    if (origin === undefined || credential === undefined) return undefined
    return this.tokens.readSession(credential, origin)
  }

  private cookie(req: ConnectionTrustRequest): string | undefined {
    const prefix = '__Host-ocean-device='
    const cookies = header(req, 'cookie')?.split(';').map(part => part.trim()).filter(part => part.startsWith(prefix))
    return cookies?.length === 1 ? cookies[0]?.slice(prefix.length) : undefined
  }

  private origin(req: ConnectionTrustRequest, listener: { host: string; protocol: 'http:' | 'https:' }): string | undefined {
    if (!isTrustedApiRequest(req, this.config.trustedHosts, listener.host, 'https:')) return undefined
    const host = header(req, 'host')
    if (host === undefined || !/^[a-z0-9.:[\]-]+$/iu.test(host)) return undefined
    let origin: string
    try {
      origin = new URL(`https://${host}`).origin
    } catch (_error) {
      // The Host header must parse as a URL authority.
      /* v8 ignore next -- the trust fence already parsed this exact Host under the same https scheme. */
      return undefined
    }
    const incomingOrigin = header(req, 'origin')
    if (incomingOrigin !== undefined && incomingOrigin !== origin) return undefined
    if (listener.protocol === 'https:') return origin
    return origin === this.config.proxyOrigin ? origin : undefined
  }
}
