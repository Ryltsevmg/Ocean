/** Node client for device authentication and authenticated unary requests. */
import { HarnessError } from '@ocean/ocean-error'
import {
  CONNECT_PATH, DEVICE_BOOTSTRAP_PATH, DEVICE_EPOCH_HEADER, DEVICE_HOST_HEADER, DEVICE_PROTOCOL_HEADER, DEVICE_PROTOCOL_VERSION,
  type HostEpoch, type HostId, type HostIdentity,
} from './connect-protocol.ts'

/** Device-client failures the CLI and Desktop can present without inspecting messages. */
export type DeviceClientErrorCode = 'DEVICE_ADDRESS_INVALID' | 'DEVICE_AUTH_REJECTED' | 'DEVICE_RATE_LIMITED'
  | 'DEVICE_CAPACITY_EXCEEDED' | 'DEVICE_HOST_CHANGED' | 'DEVICE_IDENTITY_INVALID' | 'DEVICE_BOOTSTRAP_INVALID'
  | 'DEVICE_BOOTSTRAP_FAILED' | 'DEVICE_AUTH_FAILED' | 'DEVICE_CONNECTION_FAILED' | 'DEVICE_SIGN_IN_REQUIRED'

/** An authentication or transport failure with a secret-free diagnostic. */
export class DeviceClientError extends HarnessError {
  declare readonly code: DeviceClientErrorCode

  constructor(code: DeviceClientErrorCode, message: string, options?: ErrorOptions) {
    super(message, code, options)
  }
}

/** The Host no longer accepts the current device login. */
export class DeviceSessionRejectedError extends HarnessError {
  constructor() {
    super('Ocean device session is no longer valid. Sign in again with an active device token.', 'DEVICE_SESSION_REJECTED')
  }
}

/** The Host temporarily cannot verify a device login. */
export class DeviceSessionUnavailableError extends HarnessError {
  constructor() {
    super('Ocean Host could not verify the device session. Try again.', 'DEVICE_SESSION_UNAVAILABLE')
  }
}

/** The Host requires a different device protocol version. */
export class DeviceProtocolVersionError extends HarnessError {
  constructor() {
    super('Ocean device protocol versions are incompatible', 'DEVICE_PROTOCOL_VERSION_INCOMPATIBLE')
  }
}

function readIdentity(response: Response): HostIdentity {
  const id = response.headers.get(DEVICE_HOST_HEADER)
  const epoch = response.headers.get(DEVICE_EPOCH_HEADER)
  if (!id || !epoch || response.headers.get(DEVICE_PROTOCOL_HEADER) !== DEVICE_PROTOCOL_VERSION) {
    throw new DeviceClientError('DEVICE_IDENTITY_INVALID', 'Ocean Host did not return a compatible device identity')
  }
  return { id: id as HostId, epoch: epoch as HostEpoch }
}

/** Manages a device session in memory and refuses redirects and Host changes. */
export class DeviceClient {
  private readonly base: URL
  private cookie: string | undefined
  private identity: HostIdentity | undefined

  /**
   * @param address - HTTPS base URL of the Host, including any proxy mount path.
   * @param fetcher - HTTP implementation with normal certificate verification.
   */
  constructor(address: string, private readonly fetcher: typeof fetch = fetch) {
    this.base = DeviceClient.parseAddress(address)
  }

  /**
   * Resolve a Host mount to the same URL used for authenticated requests.
   * @param address - HTTPS base URL, with or without a trailing slash.
   * @returns Validated mount URL ending in a slash.
   */
  static parseAddress(address: string): URL {
    let base: URL
    try { base = new URL(address) } catch (cause) {
      throw new DeviceClientError('DEVICE_ADDRESS_INVALID', 'Ocean Host address must be a valid HTTPS URL', { cause })
    }
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
      throw new DeviceClientError('DEVICE_ADDRESS_INVALID', 'Ocean Host address must be an HTTPS URL without credentials, query, or fragment')
    }
    if (!base.pathname.endsWith('/')) base.pathname += '/'
    return base
  }

  /**
   * Exchange a token for an in-memory login and check the supported version.
   * @param token - Device bearer read from the client's secret source.
   * @param signal - Cancellation for the exchange.
   * @param expectedHostId - Saved Host identity. Check it before transmitting the token.
   * @returns Stable Host identity and launch epoch.
   */
  async login(token: string, signal: AbortSignal, expectedHostId?: string): Promise<HostIdentity> {
    const expected = expectedHostId ?? this.identity?.id
    if (expected !== undefined) {
      const preflight = await this.fetchResponse(this.connectUrl(), {
        method: 'HEAD', redirect: 'error', signal,
        headers: { [DEVICE_PROTOCOL_HEADER]: DEVICE_PROTOCOL_VERSION },
      })
      this.requireLogin(preflight)
      this.checkHost(readIdentity(preflight), expected)
    }
    const response = await this.fetchResponse(this.connectUrl(), {
      method: 'POST', redirect: 'error', signal,
      headers: {
        authorization: `Bearer ${token}`,
        [DEVICE_PROTOCOL_HEADER]: DEVICE_PROTOCOL_VERSION,
        ...(expected === undefined ? {} : { [DEVICE_HOST_HEADER]: expected }),
      },
    })
    this.requireLogin(response)
    const identity = readIdentity(response)
    this.checkHost(identity, expected)
    /* v8 ignore next -- the `?? ''` arm cannot run: split always yields a first element. */
    const deviceCookies = response.headers.getSetCookie()
      .map(value => value.split(';', 1)[0] ?? '')
      .filter(value => /^__Host-ocean-device=[A-Za-z0-9_.-]+$/u.test(value))
    if (deviceCookies.length !== 1 || deviceCookies[0] === undefined) {
      throw new DeviceClientError('DEVICE_IDENTITY_INVALID', 'Ocean Host did not issue a device session cookie')
    }
    this.cookie = deviceCookies[0]
    this.identity = identity
    return identity
  }

  /**
   * Validate the current session and re-read the current launch epoch.
   * @param signal - Cancellation for the check.
   * @returns Stable Host identity and current epoch.
   */
  async identify(signal: AbortSignal): Promise<HostIdentity> {
    const cookie = this.requireCookie()
    const response = await this.fetchResponse(this.connectUrl(), {
      method: 'HEAD', redirect: 'error', signal, headers: { cookie },
    })
    this.requireActiveSession(response, cookie)
    this.requireLogin(response)
    const identity = readIdentity(response)
    this.checkHost(identity)
    this.identity = identity
    return identity
  }

  /**
   * Read the structured boot injections for this authenticated device.
   * @param signal - Cancellation for the bootstrap request.
   * @returns Injection rows for the caller's packaged renderer.
   */
  async bootstrap(signal: AbortSignal): Promise<readonly unknown[]> {
    const cookie = this.requireCookie()
    const response = await this.fetchResponse(new URL(DEVICE_BOOTSTRAP_PATH.slice(1), this.base), {
      redirect: 'error', signal, headers: { cookie },
    })
    if (!response.ok) {
      await response.body?.cancel()
      this.requireActiveSession(response, cookie)
      throw new DeviceClientError('DEVICE_BOOTSTRAP_FAILED', `Ocean Host bootstrap failed (HTTP ${response.status})`)
    }
    let rows: unknown
    try { rows = await response.json() } catch (cause) {
      throw new DeviceClientError('DEVICE_BOOTSTRAP_INVALID', 'Ocean Host did not return bootstrap JSON', { cause })
    }
    if (!Array.isArray(rows)) throw new DeviceClientError('DEVICE_BOOTSTRAP_INVALID', 'Ocean Host did not return bootstrap injections')
    const injections: readonly unknown[] = rows
    return injections
  }

  /**
   * Send one authenticated unary request. The caller owns retries and response decoding.
   * @param endpoint - Canonical namespace and method in slash-separated form.
   * @param envelope - Serialized caller-owned request envelope.
   * @param signal - Cancellation for the call.
   * @returns The Host response, including any non-success status.
   */
  request(endpoint: string, envelope: string, signal: AbortSignal): Promise<Response> {
    if (!/^[A-Za-z_$][\w$]*\/[A-Za-z_$][\w$]*$/u.test(endpoint)) throw new Error('Invalid Ocean RPC endpoint')
    return this.fetchResponse(new URL(`api/${endpoint}`, this.base), {
      method: 'POST', redirect: 'error', signal,
      headers: { cookie: this.requireCookie(), 'content-type': 'application/json' },
      body: envelope,
    })
  }

  /**
   * Open an authenticated secure socket under this Host's mount.
   * @param path - Logical socket route relative to the Host.
   * @param connect - Transport factory that keeps redirects disabled.
   * @returns The connecting socket owned by the caller.
   */
  openSocket<Socket>(path: string, connect: (url: URL, cookie: string) => Socket): Socket {
    if (!/^(?:\/[a-z0-9_-]+)+(?:\.[a-z]+)?$/iu.test(path)) throw new Error('Invalid Ocean socket route')
    const url = new URL(path.slice(1), this.base)
    url.protocol = 'wss:'
    return connect(url, this.requireCookie())
  }

  /**
   * Supply the current login to a native transport that keeps credentials in its main process.
   * @returns The HTTPS mount URL and its session cookie.
   */
  transportCredentials(): { address: string; cookie: string } {
    return { address: this.base.href, cookie: this.requireCookie() }
  }

  /**
   * End this login on the Host and discard the local cookie.
   * @param signal - Cancellation for the logout request.
   */
  async logout(signal: AbortSignal): Promise<void> {
    const cookie = this.cookie
    this.cookie = undefined
    if (cookie === undefined) return
    const response = await this.fetchResponse(this.connectUrl(), {
      method: 'DELETE', redirect: 'error', signal,
      headers: { cookie, [DEVICE_PROTOCOL_HEADER]: DEVICE_PROTOCOL_VERSION },
    })
    this.requireLogin(response)
  }

  private connectUrl(): URL {
    return new URL(CONNECT_PATH.slice(1), this.base)
  }

  private async fetchResponse(input: URL, init: RequestInit & { signal: AbortSignal }): Promise<Response> {
    try {
      return await this.fetcher(input, init)
    } catch (cause) {
      init.signal.throwIfAborted()
      throw new DeviceClientError('DEVICE_CONNECTION_FAILED', 'Could not reach Ocean Host securely. Check the address, network, and TLS certificate.', { cause })
    }
  }

  private requireCookie(): string {
    if (this.cookie === undefined) throw new DeviceClientError('DEVICE_SIGN_IN_REQUIRED', 'Ocean device sign-in is required')
    return this.cookie
  }

  private requireActiveSession(response: Response, cookie: string): void {
    if (response.status === 503) throw new DeviceSessionUnavailableError()
    if (response.status !== 401) return
    if (this.cookie === cookie) this.cookie = undefined
    throw new DeviceSessionRejectedError()
  }

  private requireLogin(response: Response): void {
    if (response.status === 204) return
    if (response.status === 401) {
      this.cookie = undefined
      throw new DeviceClientError('DEVICE_AUTH_REJECTED', 'Ocean device authentication was rejected. Use an active device token.')
    }
    if (response.status === 412) {
      this.cookie = undefined
      throw new DeviceClientError('DEVICE_HOST_CHANGED', 'Ocean Host identity changed')
    }
    if (response.status === 409) throw new DeviceProtocolVersionError()
    if (response.status === 429) throw new DeviceClientError('DEVICE_RATE_LIMITED', 'Ocean device sign-in is rate limited')
    if (response.status === 503) {
      if (response.headers.get('ocean-device-error') === 'capacity') {
        throw new DeviceClientError('DEVICE_CAPACITY_EXCEEDED', 'Ocean device login capacity is exhausted. End an existing login.')
      }
      throw new DeviceSessionUnavailableError()
    }
    throw new DeviceClientError('DEVICE_AUTH_FAILED', `Ocean device authentication failed (HTTP ${response.status})`)
  }

  private checkHost(identity: HostIdentity, expected: string | undefined = this.identity?.id): void {
    if (expected !== undefined && expected !== identity.id) {
      this.cookie = undefined
      throw new DeviceClientError('DEVICE_HOST_CHANGED', 'Ocean Host identity changed')
    }
  }
}
