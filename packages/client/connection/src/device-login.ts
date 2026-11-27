/** HTTPS-only exchange of device tokens for browser login credentials. */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { z } from 'zod'
import { isTrustedApiRequest } from './api-request-trust.ts'
import {
  DEVICE_EPOCH_HEADER, DEVICE_HOST_HEADER, DEVICE_LABEL_HEADER, DEVICE_PAIRING_HEADER, DEVICE_PAIRING_PASSWORD,
  DEVICE_PROTOCOL_HEADER, DEVICE_PROTOCOL_VERSION,
} from './connect-protocol.ts'
import type { HostId, HostEpoch } from './connect-protocol.ts'
import type { DevicePairingPassword } from './device-pairing-password.ts'
import type { ConnectionTrustRequest } from './rpc.ts'
import type { DeviceId, DeviceSession, DeviceSessionKey, DeviceTokens } from './device-tokens.ts'
import { DeviceLoginCapacityError } from './device-tokens.ts'

function header(request: ConnectionTrustRequest, name: string): string | undefined {
  if (request.headers instanceof Headers) return request.headers.get(name) ?? undefined
  const value = request.headers[name]
  return typeof value === 'string' ? value : undefined
}

/** Name a device receives from password pairing; printable ASCII keeps it readable in every inventory and log. */
const pairingLabel = z.string().trim().min(1).max(128).regex(/^[\x20-\x7e]+$/u)

/** Authorization bearer of password pairing: the base64url encoding of the UTF-8 password. */
const encodedPassword = /^[A-Za-z0-9_-]+$/u

/** One attempt budget that reopens after `exchangeWindowMs`. */
interface AttemptWindow {
  startedAt: number
  attempts: number
}

/** What the shared fence admits: a device token or pairing grant bearer, or a password pairing request. */
type DeviceAdmission =
    | { mode: 'grant'; bearer: string; origin: string }
    | { mode: 'password'; bearer: string; origin: string; label: string }
    | { rejection: number; headers: Record<string, string> }

/** Resolve device login origins without accepting forwarded headers. */
export class DeviceLogin {
  private windowStartedAt = -Infinity
  private readonly attempts = new Map<DeviceId, number>()
  private readonly grantWindow: AttemptWindow = { startedAt: -Infinity, attempts: 0 }
  private readonly passwordWindow: AttemptWindow = { startedAt: -Infinity, attempts: 0 }
  /**
   * @param tokens - Durable credential registry.
   * @param passwords - Pairing password verifier.
   * @param config - Login limits and the optional HTTPS proxy origin.
   */
  constructor(readonly tokens: DeviceTokens, readonly passwords: DevicePairingPassword, private readonly config: {
    trustedHosts: readonly string[]
    proxyOrigin?: string
    lifetimeMs: number
    maxSessionsPerDevice: number
    maxExchangesPerWindow: number
    maxPairingPasswordAttemptsPerWindow: number
    exchangeWindowMs: number
    identity: { hostId: HostId; epoch: HostEpoch }
  }) {}

  /**
   * Admit a bearer exchange: POST over a trusted origin, the current protocol version, and the
   * Host identity the caller pinned. The token exchange and both pairing modes start here.
   * @param req - Incoming POST request.
   * @param listener - Bound address and transport protocol.
   * @param mode - `grant` reads a device token or pairing grant bearer; `password` reads a label and an encoded pairing password.
   * @returns The bearer without its scheme and the trusted origin, or the rejection status and headers that end the request.
   */
  private admit(req: IncomingMessage, listener: { host: string; protocol: 'http:' | 'https:' }, mode: 'grant' | 'password'):
  DeviceAdmission {
    if (req.method !== 'POST') return { rejection: 405, headers: {} }
    const origin = this.origin(req, listener)
    if (origin === undefined) return { rejection: 403, headers: {} }
    if (req.headers[DEVICE_PROTOCOL_HEADER] !== DEVICE_PROTOCOL_VERSION) {
      return { rejection: 409, headers: { [DEVICE_PROTOCOL_HEADER]: DEVICE_PROTOCOL_VERSION } }
    }
    const expectedHost = header(req, DEVICE_HOST_HEADER)
    if (expectedHost !== undefined && expectedHost !== this.config.identity.hostId) return { rejection: 412, headers: {} }
    const authorization = req.headers.authorization
    if (mode === 'password') {
      const label = pairingLabel.safeParse(header(req, DEVICE_LABEL_HEADER))
      if (!label.success) return { rejection: 400, headers: {} }
      if (authorization === undefined || !authorization.startsWith('Bearer ')) return { rejection: 401, headers: {} }
      const bearer = authorization.slice(7)
      if (!encodedPassword.test(bearer)) return { rejection: 400, headers: {} }
      return { mode, bearer, origin, label: label.data }
    }
    if (authorization?.length !== 87 || !authorization.startsWith('Bearer ')) return { rejection: 401, headers: {} }
    return { mode, bearer: authorization.slice(7), origin }
  }

  /**
   * Count one attempt in a window that reopens after the configured exchange window.
   * @param state - Budget of one exchange kind; grant and password attempts never share one.
   * @param limit - Attempts one window admits.
   * @returns The `Retry-After` seconds once the budget is spent, else undefined after counting the attempt.
   */
  private countAttempt(state: AttemptWindow, limit: number): number | undefined {
    const now = performance.now()
    if (now - state.startedAt >= this.config.exchangeWindowMs) {
      state.startedAt = now
      state.attempts = 0
    }
    if (state.attempts >= limit) return Math.ceil((state.startedAt + this.config.exchangeWindowMs - now) / 1000)
    state.attempts += 1
    return undefined
  }

  /**
   * Run one credential-store operation, reporting a failure as `undefined` so record details stay off the wire.
   * @param operation - Provider read or write.
   * @returns Its result, or undefined when the provider failed.
   */
  private async fromStore<T>(operation: () => Promise<T>): Promise<T | undefined> {
    try {
      return await operation()
    } catch (_error) {
      // Credential provider errors can contain record details.
      return undefined
    }
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
    const admitted = this.admit(req, listener, 'grant')
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
   * Exchange a one-time pairing grant or the pairing password for a new device token.
   * @param req - Incoming POST request with the grant bearer, or the encoded pairing password, in Authorization.
   * @param res - Response owned by the pairing endpoint.
   * @param listener - Bound address and transport protocol.
   */
  async pair(req: IncomingMessage, res: ServerResponse, listener: {
    host: string
    protocol: 'http:' | 'https:'
  }): Promise<void> {
    const selected = req.headers[DEVICE_PAIRING_HEADER]
    if (selected !== undefined && selected !== DEVICE_PAIRING_PASSWORD) { this.refuse(res, { rejection: 400, headers: {} }); return }
    const passwordMode = selected !== undefined
    const admitted = this.admit(req, listener, passwordMode ? 'password' : 'grant')
    // A reply to a request that selected password pairing names the mode, so a client can tell a mode-aware
    // refusal from a Host that ignored the header and read the bearer as a pairing grant.
    const modeHeaders = passwordMode ? { [DEVICE_PAIRING_HEADER]: DEVICE_PAIRING_PASSWORD } : {}
    const reject = (status: number, headers: Record<string, string> = {}): void => {
      this.refuse(res, { rejection: status, headers: { ...modeHeaders, ...headers } })
    }
    if ('rejection' in admitted) { reject(admitted.rejection, admitted.headers); return }
    const limit = admitted.mode === 'password' ? this.config.maxPairingPasswordAttemptsPerWindow : this.config.maxExchangesPerWindow
    const retryAfter = this.countAttempt(admitted.mode === 'password' ? this.passwordWindow : this.grantWindow, limit)
    if (retryAfter !== undefined) { reject(429, { 'retry-after': String(retryAfter) }); return }
    if (admitted.mode === 'password') { await this.pairWithPassword(res, admitted, modeHeaders); return }
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
   * Issue a device that holds every scope to a caller presenting the pairing password.
   * @param res - Response owned by the pairing endpoint.
   * @param admitted - Password-mode admission: the encoded password and the label the device receives.
   * @param modeHeaders - Header naming the selected pairing mode, carried by every reply.
   */
  private async pairWithPassword(
    res: ServerResponse, admitted: { bearer: string; label: string }, modeHeaders: Record<string, string>,
  ): Promise<void> {
    const reply = (status: number, extra: Record<string, string> = {}, body?: string): void => {
      res.writeHead(status, { 'cache-control': 'no-store', ...modeHeaders, ...extra })
      res.end(body)
    }
    const set = await this.fromStore(() => this.passwords.isSet())
    if (set === undefined) { reply(503); return }
    if (!set) { reply(404, this.identityHeaders()); return }
    const password = Buffer.from(admitted.bearer, 'base64url').toString('utf8')
    const matched = await this.fromStore(() => this.passwords.verify(password))
    if (matched === undefined) { reply(503); return }
    if (!matched) { reply(401); return }
    const device = await this.fromStore(() => this.tokens.issue(admitted.label))
    if (device === undefined) { reply(503); return }
    reply(200, { ...this.identityHeaders(), 'content-type': 'application/json' }, JSON.stringify(device))
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
