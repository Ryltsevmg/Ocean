/** Node half: registers the /api prefix route bridging to the api gateway. */
import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import { createServer, request as httpRequest } from 'node:http'
import { Readable } from 'node:stream'
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import type { AddressInfo } from 'node:net'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AttachmentStore } from '@ocean/ocean-attachment'
import { HostConnectionService } from '../src/rpc-host.ts'
import { DeviceTokens, deviceId, deviceRegistryKey } from '../src/device-tokens.ts'
import { credentialKey, type CredentialProvider } from '@ocean/ocean-credentials'
import type { IndexInjection, WebServer, WebRoute, WebResourceRoute, WebUpgradeRoute } from '@ocean/ocean-host-webserver'
import {
  API_PATH,
  RpcId,
  apply,
  inject,
  type ClientRequest,
  type ConnectionConfig,
  type HostConnectionHandle,
  type PeerScope,
} from '../src/index.ts'
import { DEFAULT_MAX_REQUEST_BODY_BYTES } from '../src/http-bridge.ts'
import { provideBrowserCredentials } from './browser-credentials.ts'

/** The Peer an index render speaks for; this listener reads no field of it. */
const PAGE_PEER = { principal: { kind: 'owner' } } as Parameters<WebServer['renderIndex']>[1]

/** Structural webServer fake recording both route registries. */
function fakeHttpServer(
  routes: WebRoute[],
  upgrades: WebUpgradeRoute[],
  host = '127.0.0.1',
  protocol: WebServer['protocol'] = 'http:',
  resources: WebResourceRoute[] = [],
): Pick<WebServer, 'register' | 'registerUpgrade' | 'tapIndex' | 'port' | 'host' | 'protocol' | 'collectIndexInjections'> {
  return {
    host,
    protocol,
    collectIndexInjections: peer => [{ kind: 'global', name: 'principal', value: peer.principal.kind }],
    register(route) {
      if ('resource' in route) {
        resources.push(route)
        return () => { resources.splice(resources.indexOf(route), 1) }
      }
      if (routes.some(candidate => candidate.kind === route.kind && candidate.path === route.path)) {
        throw new Error(`duplicate route ${route.path}`)
      }
      routes.push(route)
      return () => { routes.splice(routes.indexOf(route), 1) }
    },
    registerUpgrade(route) {
      upgrades.push(route)
      return () => { upgrades.splice(upgrades.indexOf(route), 1) }
    },
    tapIndex: () => () => {},
    port: 0,
  }
}

/** Bodyless GET carrying the given headers (enough for the trust fence + bridge). */
function fakeRequest(headers: Record<string, string>, url = `${API_PATH}/session.list`): IncomingMessage {
  const request = Readable.from([]) as IncomingMessage
  Object.assign(request, { url, method: 'GET', headers })
  return request
}

/** JSON POST carrying a complete client-request envelope. */
function fakePost(headers: Record<string, string>, url: string, body: unknown): IncomingMessage {
  const request = Readable.from([Buffer.from(JSON.stringify(body))]) as IncomingMessage
  Object.assign(request, { url, method: 'POST', headers: { 'content-type': 'application/json', ...headers } })
  return request
}

/** Raw POST for malformed-body and media-type boundary cases. */
function fakeRawPost(headers: Record<string, string>, url: string, body: string): IncomingMessage {
  const request = Readable.from([Buffer.from(body)]) as IncomingMessage
  Object.assign(request, { url, method: 'POST', headers })
  return request
}

/** Response recorder compatible with both the fence's short-circuit and the bridge. */
function fakeResponse(): {
  response: ServerResponse
  state: { status?: number; headers?: Record<string, string>; body?: unknown }
} {
  const state: { status?: number; headers?: Record<string, string>; body?: unknown } = {}
  const chunks: Buffer[] = []
  const response = Object.assign(new EventEmitter(), {
    writableEnded: false,
    writeHead(value: number, headers?: Record<string, string>) {
      state.status = value
      if (headers !== undefined) state.headers = headers
      return this
    },
    write(value: string | Uint8Array) { chunks.push(Buffer.from(value)); return true },
    end(this: { writableEnded: boolean }, value?: unknown) {
      if (typeof value === 'string' || value instanceof Uint8Array) chunks.push(Buffer.from(value))
      else if (value !== undefined) throw new TypeError('fake response only accepts string or Uint8Array bodies')
      if (chunks.length > 0) state.body = Buffer.concat(chunks).toString()
      this.writableEnded = true
      return this
    },
  }) as unknown as ServerResponse
  return { response, state }
}

async function mounted(
  config?: ConnectionConfig,
  protocol: WebServer['protocol'] = 'http:',
  credentials?: CredentialProvider,
): Promise<{
  ctx: Context
  routes: WebRoute[]
  resources: WebResourceRoute[]
  upgrades: WebUpgradeRoute[]
  connection: HostConnectionHandle
  dispose: () => Promise<void>
}> {
  const ctx = new Context()
  const routes: WebRoute[] = []
  const upgrades: WebUpgradeRoute[] = []
  if (credentials === undefined) provideBrowserCredentials(ctx)
  else ctx.provide('credentials', credentials)
  const resources: WebResourceRoute[] = []
  ctx.provide('webServer', fakeHttpServer(routes, upgrades, '127.0.0.1', protocol, resources) as WebServer)
  const fiber = ctx.plugin({ inject: [...inject], apply }, config)
  await fiber.await()
  return {
    ctx,
    routes,
    resources,
    upgrades,
    connection: ctx.get('connection') as HostConnectionHandle,
    dispose: () => fiber.dispose(),
  }
}

/** Exchange a service's process token for one authority-bound Cookie header. */
function browserCookie(connection: HostConnectionHandle, authority: string): string {
  const url = new URL(connection.authenticatedUrl(`http://${authority}`))
  const exchanged = fakeResponse()
  connection.authorizeIndex(
    fakeRequest({ host: authority }, `${url.pathname}${url.search}`),
    exchanged.response,
  )
  const setCookie = exchanged.state.headers?.['set-cookie']
  if (setCookie === undefined) throw new Error('browser token exchange did not set a cookie')
  return setCookie.split(';', 1)[0]!
}

describe('connection node half', () => {
  it('bootstraps device issuance through the credential provider without publishing transports', async () => {
    const ctx = new Context()
    provideBrowserCredentials(ctx)
    const fiber = ctx.plugin({ inject: [...inject], apply }, { deviceBootstrapOnly: true })
    try {
      await fiber.await()
      expect(ctx.get('connection')).toBeUndefined()
      const bootstrap = ctx.get('deviceBootstrap')
      if (bootstrap === undefined) throw new Error('bootstrap service was not published')
      const device = await bootstrap.issue('Windows laptop')
      expect(await bootstrap.list()).toEqual([{ id: device.id, label: 'Windows laptop', revoked: false }])
      expect(await new DeviceTokens(ctx.credentials).verify(device.token)).toBe(device.id)
    } finally {
      await fiber.dispose()
      expect(ctx.get('deviceBootstrap')).toBeUndefined()
    }
  })

  it('keeps failed and independent device exchanges out of another device login budget', async () => {
    const host = await mounted({ allowOwnerLogin: false, maxDeviceExchangesPerWindow: 1 }, 'https:')
    try {
      const tokens = new DeviceTokens(host.ctx.credentials)
      const first = await tokens.issue('Laptop')
      const second = await tokens.issue('Phone')
      const route = host.routes.find(route => route.path === '/connect')
      if (route === undefined) throw new Error('missing connect route')
      const exchange = async (token: string): Promise<number | undefined> => {
        const reply = fakeResponse()
        await route.handler(fakePost({
          host: 'localhost', 'ocean-device-protocol': '1', authorization: `Bearer ${token}`,
        }, '/connect', null), reply.response)
        return reply.state.status
      }
      expect(await exchange(first.id + second.token.slice(36))).toBe(401)
      expect(await exchange(first.token)).toBe(204)
      expect(await exchange(first.token)).toBe(429)
      expect(await exchange(second.token)).toBe(204)
    } finally {
      await host.dispose()
    }
  })

  it.each(['revoke', 'rotate'] as const)('rejects device event replies while %s commits before live cleanup', async (action) => {
    const host = await mounted({ allowOwnerLogin: false }, 'https:')
    const committed = Promise.withResolvers<undefined>()
    const finish = Promise.withResolvers<undefined>()
    const tokens = new DeviceTokens(host.ctx.credentials)
    const device = await tokens.issue('Laptop')
    const login = await tokens.exchange(device.token, 'https://localhost', { lifetimeMs: 60_000, maxSessionsPerDevice: 1 })
    const req = fakeRequest({ host: 'localhost', cookie: `__Host-ocean-device=${login ?? ''}` })
    const first = await host.connection.admitTransport(req, true)
    const second = await host.connection.admitTransport(req, false)
    if ('rejection' in first || 'rejection' in second || !(host.connection instanceof HostConnectionService)) {
      throw new Error('device admission failed')
    }
    const original = host.ctx.credentials.modifyRecord.bind(host.ctx.credentials)
    const mutation = vi.spyOn(host.ctx.credentials, 'modifyRecord').mockImplementation(async (key, update) => {
      const result = await original(key, update)
      committed.resolve(undefined)
      await finish.promise
      return result
    })
    const pending = action === 'revoke' ? host.connection.revokeDevice(device.id) : host.connection.rotateDevice(device.id)
    try {
      await committed.promise
      expect(host.connection.sharesDeviceSession?.(first.peer, second.peer)).toBe(false)
      expect(await host.connection.admitTransport(req, true)).toEqual({ rejection: 401 })
    } finally {
      finish.resolve(undefined)
      await pending
      mutation.mockRestore()
      await host.dispose()
    }
  })

  it('distinguishes a committed revocation from failed live cleanup', async () => {
    const host = await mounted({ allowOwnerLogin: false }, 'https:')
    const tokens = new DeviceTokens(host.ctx.credentials)
    const device = await tokens.issue('Laptop')
    const login = await tokens.exchange(device.token, 'https://localhost', { lifetimeMs: 60_000, maxSessionsPerDevice: 1 })
    const lease = await host.connection.admitTransport(fakeRequest({ host: 'localhost', cookie: `__Host-ocean-device=${login ?? ''}` }), true)
    if ('rejection' in lease || !(host.connection instanceof HostConnectionService)) throw new Error('device admission failed')
    const failure = vi.spyOn(lease.peer, 'dispose').mockRejectedValue(new Error('private cleanup detail'))
    try {
      await expect(host.connection.revokeDevice(device.id)).rejects.toMatchObject({
        code: 'DEVICE_ADMIN_FAILED', durableOutcome: 'committed', liveCleanup: 'failed',
      })
      expect(host.connection.sharesDeviceSession?.(lease.peer, lease.peer)).toBe(false)
      expect(await tokens.verify(device.token)).toBeUndefined()
    } finally {
      failure.mockRestore()
      await lease.peer.dispose()
      await host.dispose()
    }
  })

  it('revalidates live device leases when the credential provider publishes an external revocation', async () => {
    const host = await mounted({ allowOwnerLogin: false }, 'https:')
    try {
      const tokens = new DeviceTokens(host.ctx.credentials)
      const device = await tokens.issue('Laptop')
      const login = await tokens.exchange(device.token, 'https://localhost', { lifetimeMs: 60_000, maxSessionsPerDevice: 1 })
      const lease = await host.connection.admitTransport(fakeRequest({ host: 'localhost', cookie: `__Host-ocean-device=${login ?? ''}` }), true)
      if ('rejection' in lease) throw new Error('device admission failed')
      await tokens.revoke(device.id)
      host.ctx.emit('credentials/record-updated', deviceRegistryKey)
      await vi.waitFor(() => { expect(lease.peer.signal.aborted).toBe(true) })
      expect(host.connection.sharesDeviceSession?.(lease.peer, lease.peer)).toBe(false)
    } finally {
      await host.dispose()
    }
  })

  it.each(['native', 'proxy', 'plaintext'] as const)('exchanges device tokens over %s transport only when protected', async (mode) => {
    const origin = 'https://ocean.example'
    const host = await mounted({
      allowOwnerLogin: false,
      trustedHosts: ['ocean.example'],
      maxDeviceExchangesPerWindow: 1,
      maxDeviceTransports: mode === 'native' ? 2 : 3,
      maxDeviceTransportsPerDevice: 2,
      ...(mode === 'proxy' ? { deviceProxyUrl: origin } : {}),
    }, mode === 'native' ? 'https:' : 'http:')
    try {
      const tokens = new DeviceTokens(host.ctx.credentials)
      const { id, token } = await tokens.issue('Laptop')
      const route = host.routes.find(route => route.path === '/connect')
      if (route === undefined) throw new Error('missing connect route')
      const headers = { host: 'ocean.example', authorization: `Bearer ${token}`, 'x-forwarded-proto': 'https' }
      const crossSite = fakeResponse()
      await route.handler(fakePost({ ...headers, origin: 'https://elsewhere.example' }, '/connect', null), crossSite.response)
      expect(crossSite.state.status).toBe(403)
      if (mode !== 'plaintext') {
        const incompatible = fakeResponse()
        await route.handler(fakePost({ ...headers, origin, 'ocean-device-protocol': '0' }, '/connect', null), incompatible.response)
        expect(incompatible.state).toMatchObject({ status: 409, headers: { 'ocean-device-protocol': '1' } })
        expect(incompatible.state.headers?.['set-cookie']).toBeUndefined()
      }
      const discoveryHeaders = { host: 'ocean.example', origin, 'ocean-device-protocol': '1' }
      const discovery = fakeResponse()
      await route.handler(Object.assign(fakeRequest(discoveryHeaders, '/connect'), { method: 'HEAD' }), discovery.response)
      expect(discovery.state.status).toBe(mode === 'plaintext' ? 403 : 204)
      expect(discovery.state.headers?.['set-cookie']).toBeUndefined()
      const foreignDiscovery = fakeResponse()
      await route.handler(Object.assign(fakeRequest({ ...discoveryHeaders, origin: 'https://elsewhere.example' }, '/connect'),
        { method: 'HEAD' }), foreignDiscovery.response)
      expect(foreignDiscovery.state.status).toBe(403)
      expect(foreignDiscovery.state.headers?.['ocean-device-host']).toBeUndefined()
      const compatible = { ...headers, origin, 'ocean-device-protocol': '1' }
      if (mode !== 'plaintext') {
        const stale = fakeResponse()
        await route.handler(fakePost({ ...compatible, 'ocean-device-host': 'different-host' }, '/connect', null), stale.response)
        expect(stale.state.status).toBe(412)
        expect(stale.state.headers?.['set-cookie']).toBeUndefined()
      }
      const reply = fakeResponse()
      await route.handler(fakePost(compatible, '/connect', null), reply.response)
      if (mode === 'plaintext') {
        expect(reply.state.status).toBe(403)
        return
      }
      expect(reply.state.status).toBe(204)
      expect(discovery.state.headers?.['ocean-device-host']).toEqual(expect.any(String))
      expect(discovery.state.headers?.['ocean-device-host']).toBe(reply.state.headers?.['ocean-device-host'])
      const throttled = fakeResponse()
      await route.handler(fakePost(compatible, '/connect', null), throttled.response)
      expect(throttled.state.status).toBe(429)
      expect(throttled.state.headers?.['retry-after']).toMatch(/^\d+$/u)
      const cookie = reply.state.headers?.['set-cookie'] ?? ''
      expect(cookie).toMatch(/^__Host-ocean-device=[^;]+; Path=\/; Secure; HttpOnly; SameSite=Strict;/u)
      expect(cookie).not.toContain(token)
      const bootstrap = host.resources.find(candidate => candidate.path === '/connect/bootstrap')
      if (bootstrap === undefined) throw new Error('missing device bootstrap route')
      const destination = `${origin}/connect/bootstrap`
      const denied = await bootstrap.resource(new Request(destination, { headers: { host: 'ocean.example' } }))
      expect(denied.status).toBe(401)
      const boot = await bootstrap.resource(new Request(destination, {
        headers: { host: 'ocean.example', cookie: cookie.split(';', 1)[0] ?? '' },
      }))
      expect(boot.headers.get('cache-control')).toBe('no-store')
      expect(await boot.json()).toEqual([{ kind: 'global', name: 'principal', value: 'remote-device' }])

      const login = cookie.split(';', 1)[0]?.slice('__Host-ocean-device='.length) ?? ''
      expect(await tokens.verifySession(login, origin)).toBe(id)
      const loginHeaders = { host: 'ocean.example', origin, cookie: `__Host-ocean-device=${login}` }
      const request = fakeRequest(loginHeaders)
      const read = vi.spyOn(host.ctx.credentials, 'readRecord')
        .mockRejectedValueOnce(new Error('credential store unavailable'))
        .mockRejectedValueOnce(new Error('credential store unavailable'))
      try {
        const unavailable = fakeResponse()
        await route.handler(Object.assign(fakeRequest(loginHeaders, '/connect'), { method: 'HEAD' }), unavailable.response)
        expect(unavailable.state).toEqual({ status: 503, headers: { 'cache-control': 'no-store' } })
        expect(await host.connection.admitTransport(request, true)).toEqual({ rejection: 503 })
      } finally {
        read.mockRestore()
      }
      const first = await host.connection.admitTransport(request, true)
      const second = await host.connection.admitTransport(request, true)
      if ('rejection' in first || 'rejection' in second) throw new Error('valid device session was refused')
      expect(first.peer.principal).toEqual({ kind: 'remote-device', deviceId: id })
      expect(second.peer.id).not.toBe(first.peer.id)
      expect(await host.connection.admitTransport(request, true)).toEqual({ rejection: 503 })
      await first.release()
      const replacement = await host.connection.admitTransport(request, false)
      if ('rejection' in replacement) throw new Error('released device capacity was not recovered')
      expect(host.connection.sharesDeviceSession?.(second.peer, replacement.peer)).toBe(true)
      await replacement.release()
      const otherLogin = await tokens.exchange(token, origin, { lifetimeMs: 10_000, maxSessionsPerDevice: 2 })
      const other = await host.connection.admitTransport(fakeRequest({
        host: 'ocean.example', origin, cookie: `__Host-ocean-device=${otherLogin ?? ''}`,
      }), false)
      if ('rejection' in other) throw new Error('other login was refused')
      expect(host.connection.sharesDeviceSession?.(second.peer, other.peer)).toBe(false)
      expect(first.peer.signal.aborted).toBe(true)
      expect(second.peer.signal.aborted).toBe(false)
      const logout = fakeResponse()
      await route.handler(Object.assign(request, { method: 'DELETE' }), logout.response)
      expect(logout.state.status).toBe(403)
      expect(await tokens.verifySession(login, origin)).toBe(id)
      const validLogout = fakeResponse()
      const cleanupStarted = Promise.withResolvers<undefined>()
      const releaseCleanup = Promise.withResolvers<undefined>()
      second.peer.ctx.effect(() => () => {
        cleanupStarted.resolve(undefined)
        return releaseCleanup.promise
      })
      const ending = route.handler(Object.assign(fakeRequest({
        ...loginHeaders, 'ocean-device-protocol': '1',
      }, '/connect'), { method: 'DELETE' }), validLogout.response)
      try {
        await Promise.race([cleanupStarted.promise, ending])
        expect(validLogout.state.status).toBeUndefined()
        expect(await tokens.verifySession(login, origin)).toBeUndefined()
      } finally {
        releaseCleanup.resolve(undefined)
        await ending
      }
      expect(validLogout.state.status).toBe(204)
      expect(validLogout.state.headers?.['set-cookie']).toContain('Max-Age=0')
      expect(second.peer.signal.aborted).toBe(true)
      expect(other.peer.signal.aborted).toBe(false)
      expect(await tokens.verifySession(login, origin)).toBeUndefined()
      expect(await tokens.verify(token)).toBe(id)
      const connection = host.connection
      if (!(connection instanceof HostConnectionService)) throw new Error('missing Host Connection service')
      const independent = await tokens.issue('Phone')
      const independentLogin = await tokens.exchange(independent.token, origin, {
        lifetimeMs: 10_000, maxSessionsPerDevice: 1,
      })
      if (independentLogin === undefined) throw new Error('independent device exchange failed')
      const independentPeer = await connection.admitTransport(fakeRequest({
        host: 'ocean.example', origin, cookie: `__Host-ocean-device=${independentLogin}`,
      }), true)
      if ('rejection' in independentPeer) throw new Error('independent device admission failed')
      expect(await connection.revokeDevice(id)).toBe(true)
      expect(other.peer.signal.aborted).toBe(true)
      if (otherLogin === undefined) throw new Error('other login exchange failed')
      expect(await tokens.verifySession(otherLogin, origin)).toBeUndefined()
      expect(independentPeer.peer.signal.aborted).toBe(false)
      expect(await tokens.verifySession(independentLogin, origin)).toBe(independent.id)
      await independentPeer.release()
      await other.release()
      await second.release()
      expect(await host.connection.admitTransport(request, false)).toEqual({ rejection: 401 })
    } finally {
      await host.dispose()
    }
  })

  it('releases all attachments at login expiry and rejects the expired cookie', async () => {
    const origin = 'https://ocean.example'
    const host = await mounted({ allowOwnerLogin: false, trustedHosts: ['ocean.example'] }, 'https:')
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    try {
      const tokens = new DeviceTokens(host.ctx.credentials)
      const { id, token } = await tokens.issue('Laptop')
      const login = await tokens.exchange(token, origin, { lifetimeMs: 1_000, maxSessionsPerDevice: 2 })
      const otherLogin = await tokens.exchange(token, origin, { lifetimeMs: 2_000, maxSessionsPerDevice: 2 })
      const request = (secret: string | undefined): IncomingMessage => {
        if (secret === undefined) throw new Error('device exchange failed')
        return fakeRequest({ host: 'ocean.example', origin, cookie: `__Host-ocean-device=${secret}` })
      }
      const first = await host.connection.admitTransport(request(login), true)
      const second = await host.connection.admitTransport(request(login), false)
      const other = await host.connection.admitTransport(request(otherLogin), true)
      if ('rejection' in first || 'rejection' in second || 'rejection' in other) {
        throw new Error('valid device session was refused')
      }
      await vi.advanceTimersByTimeAsync(999)
      expect(first.peer.signal.aborted).toBe(false)
      expect(second.peer.signal.aborted).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      expect(first.peer.signal.aborted).toBe(true)
      expect(second.peer.signal.aborted).toBe(true)
      expect(other.peer.signal.aborted).toBe(false)
      expect(await host.connection.admitTransport(request(login), true)).toEqual({ rejection: 401 })
      expect(await host.connection.admitTransport(request(login), false)).toEqual({ rejection: 401 })
      expect(await tokens.verify(token)).toBe(id)
      await Promise.all([first.release(), second.release(), other.release()])
    } finally {
      vi.useRealTimers()
      await host.dispose()
    }
  })

  it('identifies the same Host with a new epoch after restart using the saved login', async () => {
    const config = { allowOwnerLogin: false }
    const first = await mounted(config, 'https:')
    const tokens = new DeviceTokens(first.ctx.credentials)
    let previous: Readonly<Record<string, string>> | undefined
    let cookie = ''
    try {
      const { token } = await tokens.issue('Laptop')
      const route = first.routes.find(route => route.path === '/connect')
      if (route === undefined) throw new Error('missing connect route')
      const reply = fakeResponse()
      await route.handler(fakePost({
        host: 'localhost', authorization: `Bearer ${token}`, 'ocean-device-protocol': '1',
      }, '/connect', null), reply.response)
      expect(reply.state.status).toBe(204)
      previous = reply.state.headers
      cookie = previous?.['set-cookie']?.split(';', 1)[0] ?? ''
    } finally {
      await first.dispose()
    }

    const second = await mounted(config, 'https:', first.ctx.credentials)
    try {
      const route = second.routes.find(route => route.path === '/connect')
      if (route === undefined) throw new Error('missing connect route')
      const head = (headers: Record<string, string>) => Object.assign(fakeRequest(headers, '/connect'), { method: 'HEAD' })
      const anonymous = fakeResponse()
      await route.handler(head({ host: 'localhost' }), anonymous.response)
      expect(anonymous.state.status).toBe(401)
      expect(anonymous.state.headers?.['ocean-device-host']).toBeUndefined()
      const reply = fakeResponse()
      await route.handler(head({ host: 'localhost', cookie }), reply.response)
      expect(reply.state.status).toBe(204)
      expect(reply.state.headers?.['ocean-device-host']).toBe(previous?.['ocean-device-host'])
      expect(reply.state.headers?.['ocean-device-epoch']).toEqual(expect.any(String))
      expect(reply.state.headers?.['ocean-device-epoch']).not.toBe(previous?.['ocean-device-epoch'])
      expect(reply.state.headers?.['set-cookie']).toBeUndefined()
    } finally {
      await second.dispose()
    }
  })

  it('rejects legacy owner tokens and cookies when owner login is disabled', async () => {
    const owner = await mounted()
    const locked = await mounted({ allowOwnerLogin: false }, 'http:', owner.ctx.credentials)
    try {
      const url = new URL(owner.connection.authenticatedUrl('http://localhost/'))
      const cookie = browserCookie(owner.connection, 'localhost')
      expect(locked.connection.authenticatedUrl('http://localhost/')).toBe('http://localhost/')
      const headers = { host: 'localhost', cookie }
      const index = fakeResponse()
      expect(locked.connection.authorizeIndex(fakeRequest(headers, `/${url.search}`), index.response)).toBe(false)
      expect(index.state.status).toBe(401)
      const route = locked.routes.find(route => route.path === '/connect')
      const exchange = fakeResponse()
      await route?.handler(fakeRequest(headers, `/connect${url.search}`), exchange.response)
      expect(exchange.state.status).toBe(401)
      expect(locked.connection.admit(fakeRequest(headers, '/api'))).toEqual({ rejection: 401 })
    } finally {
      await Promise.all([locked.dispose(), owner.dispose()])
    }
  })

  it('runs request admission after authentication and removes it with its owning fiber', async () => {
    const { ctx, routes, connection, dispose } = await mounted()
    let admitted = 0
    const guard = ctx.plugin({ apply(owner: Context) {
      owner.on('connection/request', async (_request, response) => {
        admitted++
        response.writeHead(503)
        response.end()
      })
    } })
    try {
      await guard.await()
      const unauthorized = fakeResponse()
      await routes[0]!.handler(fakeRequest({ host: 'localhost' }), unauthorized.response)
      expect(unauthorized.state.status).toBe(401)
      expect(admitted).toBe(0)
      const headers = { host: 'localhost', cookie: browserCookie(connection, 'localhost') }
      const refused = fakeResponse()
      await routes[0]!.handler(fakeRequest(headers), refused.response)
      expect(refused.state.status).toBe(503)
      expect(admitted).toBe(1)
      await guard.dispose()
      const allowed = fakeResponse()
      await routes[0]!.handler(fakeRequest(headers), allowed.response)
      expect(allowed.state.status).toBe(404)
      expect(admitted).toBe(1)
    } finally { await guard.dispose(); await dispose() }
  })

  it('awaits delegated response transfer before releasing the admission listener', async () => {
    const { ctx, routes, connection, dispose } = await mounted()
    const entered = Promise.withResolvers<undefined>()
    const finish = Promise.withResolvers<undefined>()
    let completed = false
    connection.fetch.register({ path: '/api/held', methods: ['GET'], requestBody: 'buffered',
      async fetch() {
        return new Response(new ReadableStream({ async start(controller) {
          entered.resolve(undefined)
          await finish.promise
          controller.close()
        } }))
      },
    })
    const remove = ctx.on('connection/request', async (_request, _response, next) => {
      await next()
      completed = true
    })
    const response = fakeResponse()
    const pending = routes[0]!.handler(fakeRequest({ host: 'localhost', cookie: browserCookie(connection, 'localhost') }, '/api/held'), response.response)
    try {
      await entered.promise
      expect(completed).toBe(false)
      finish.resolve(undefined)
      await pending
      expect(completed).toBe(true)
    } finally { finish.resolve(undefined); await pending; remove(); await dispose() }
  })

  it('provides the carrier-neutral service without a Web server', async () => {
    const ctx = new Context()
    provideBrowserCredentials(ctx)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    try {
      await fiber.await()
      const connection = ctx.get('connection') as HostConnectionHandle
      const cookie = browserCookie(connection, 'localhost')
      expect(connection.admit(fakeRequest({ host: 'localhost', cookie }))).toEqual({ peer: connection.browserPeer })
    } finally {
      await fiber.dispose()
    }
  })

  it('accepts the bind address of a web carrier attached after Connection', async () => {
    const ctx = new Context()
    const routes: WebRoute[] = []
    const upgrades: WebUpgradeRoute[] = []
    provideBrowserCredentials(ctx)
    const fiber = ctx.plugin({ inject: [...inject], apply }, { trustedHosts: ['harness.example'] })
    try {
      await fiber.await()
      const connection = ctx.get('connection') as HostConnectionHandle
      const web = ctx.plugin((webCtx) => {
        webCtx.provide('webServer', fakeHttpServer(routes, upgrades, '10.1.2.3') as WebServer)
      })
      try {
        await web.await()
        await expect.poll(() => routes.find(route => route.path === API_PATH)).toBeDefined()
        const bound = browserCookie(connection, '10.1.2.3:3080')
        expect(connection.requestRejection(fakeRequest({ host: '10.1.2.3:3080', cookie: bound }))).toBeUndefined()
      } finally {
        await web.dispose()
      }
    } finally {
      await fiber.dispose()
    }
  })

  it('uses the TLS default port for markerless exact-authority grants', async () => {
    const { connection, dispose } = await mounted({ trustedHosts: ['tls.example:443', 'plain.example:80'] }, 'https:')
    try {
      expect(connection.requestRejection(fakeRequest({ host: 'tls.example' }))).toBe(401)
      expect(connection.requestRejection(fakeRequest({ host: 'plain.example' }))).toBe(403)
      expect(connection.requestRejection(fakeRequest({ host: 'tls.example:444' }))).toBe(403)
    } finally {
      await dispose()
    }
  })

  it('marks the minted browser cookie Secure from the mounted listener protocol', async () => {
    for (const [protocol, secure] of [['http:', false], ['https:', true]] as const) {
      const { connection, dispose } = await mounted(undefined, protocol)
      try {
        const url = new URL(connection.authenticatedUrl('http://127.0.0.1:3080'))
        const exchanged = fakeResponse()
        connection.authorizeIndex(
          fakeRequest({ host: '127.0.0.1:3080', 'x-forwarded-proto': secure ? 'http' : 'https' }, `${url.pathname}${url.search}`),
          exchanged.response,
        )
        const setCookie = exchanged.state.headers?.['set-cookie']
        expect(setCookie?.endsWith('; Secure'), protocol).toBe(secure)
        if (setCookie === undefined) throw new Error('browser token exchange did not set a cookie')
        expect(connection.requestRejection(fakeRequest({
          host: '127.0.0.1:3080',
          cookie: setCookie.split(';', 1)[0]!,
        }))).toBeUndefined()
      } finally {
        await dispose()
      }
    }
  })

  it('injects validated browser recovery timing and withdraws it on disposal', async () => {
    const { ctx, dispose } = await mounted({ recovery: { generationReadyTimeoutMs: 25_000 } })
    try {
      const rows: IndexInjection[] = []
      ctx.emit('webserver/index-inject', rows, PAGE_PEER)
      expect(rows).toEqual([{
        kind: 'global', name: '__OCEAN_CONNECTION_RECOVERY__', value: {
          backoffBaseMs: 500, backoffFactor: 2, backoffMaxMs: 10_000,
          generationReadyWarnMs: 3_000, generationReadyTimeoutMs: 25_000,
        },
      }])
      await dispose()
      const after: IndexInjection[] = []
      ctx.emit('webserver/index-inject', after, PAGE_PEER)
      expect(after).toEqual([])
    } finally {
      await dispose()
    }
  })

  it.each([
    { recovery: { backoffBaseMs: 0 }, error: /backoffBaseMs/ },
    { recovery: { backoffFactor: NaN }, error: /backoffFactor.*finite/ },
  ])('rejects invalid recovery timing before acquiring Host resources: $recovery', async ({ recovery, error }) => {
    const ctx = new Context()
    await expect(apply(ctx, { recovery })).rejects.toThrow(error)
    expect(ctx.get('connection')).toBeUndefined()
  })

  it('reports allowsRemoteAuthorities from validated trustedHosts only', async () => {
    const cases: { trustedHosts: string[]; expected: boolean }[] = [
      { trustedHosts: ['127.0.0.1', 'localhost', '[::1]'], expected: false },
      { trustedHosts: ['harness.example'], expected: true },
      { trustedHosts: ['127.0.0.1', 'harness.example'], expected: true },
    ]
    for (const { trustedHosts, expected } of cases) {
      const deployment = await mounted({ trustedHosts })
      try {
        expect(deployment.connection.allowsRemoteAuthorities, trustedHosts.join(',')).toBe(expected)
      } finally {
        await deployment.dispose()
      }
    }
  })

  it('reserves enough default carrier capacity for the 200 MiB image batch', () => {
    expect(DEFAULT_MAX_REQUEST_BODY_BYTES).toBe(300 * 1024 * 1024)
    expect(DEFAULT_MAX_REQUEST_BODY_BYTES).toBeGreaterThan(Math.ceil(200 * 1024 * 1024 * 4 / 3) + 1024 * 1024)
  })

  it('fails loud when the carrier cap cannot hold the configured image batch', async () => {
    const ctx = new Context()
    const routes: WebRoute[] = []
    ctx.provide('webServer', fakeHttpServer(routes, []) as WebServer)
    ctx.provide('attachments', {
      imageLimits: { maxMessageImageBytes: 20 * 1024 * 1024 },
    } as AttachmentStore)
    await expect(apply(ctx, { maxRequestBodyBytes: 1024 }))
      .rejects.toThrow(/must be at least .* aggregate image limit/)
    expect(routes).toHaveLength(0)
  })

  it('fails the load on a trustedHosts entry that is not a bare authority', async () => {
    const routes: WebRoute[] = []
    const upgrades: WebUpgradeRoute[] = []
    const ctx = new Context()
    provideBrowserCredentials(ctx)
    ctx.provide('webServer', fakeHttpServer(routes, upgrades) as WebServer)
    const fiber = ctx.plugin({ inject: [...inject], apply }, { trustedHosts: ['harness.internal/path'] })
    await expect(fiber).rejects.toThrow(/not a bare host\[:port\] authority/)
    expect(routes).toHaveLength(0)
    expect(upgrades).toHaveLength(0)
  })

  it('registers the API and connect HTTP routes and removes them with the fiber', async () => {
    const { routes, upgrades, dispose } = await mounted()
    expect(routes).toHaveLength(2)
    expect(routes[0]).toMatchObject({ kind: 'prefix', path: API_PATH })
    expect(upgrades).toHaveLength(0)
    await dispose()
    expect(routes).toHaveLength(0)
    expect(upgrades).toHaveLength(0)
  })

  it('refuses an untrusted Host on any /api path before the bridge runs', async () => {
    const { routes, dispose } = await mounted()
    const { response, state } = fakeResponse()
    await routes[0]!.handler(fakeRequest({
      host: 'harness.example', origin: 'http://harness.example', 'sec-fetch-site': 'same-origin',
    }), response)
    expect(state.status).toBe(403)
    expect(state.body).toBe('forbidden')
    await dispose()
  })

  it('requires the same browser session for every method on every trusted authority', async () => {
    const { routes, connection, dispose } = await mounted({ trustedHosts: ['harness.example'] })
    const methods = [
      'session/openWorkspacePath',
      'llm/discoverModels', 'skills/list', 'agentPresets/list',
    ]
    for (const method of methods) {
      const denied = fakeResponse()
      await routes[0]!.handler(fakeRequest({ host: 'harness.example' }, `${API_PATH}/${method}`), denied.response)
      expect([method, denied.state.status, denied.state.body]).toEqual([method, 401, 'unauthorized'])
    }

    const cookie = browserCookie(connection, 'harness.example')
    for (const method of methods) {
      const allowed = fakeResponse()
      await routes[0]!.handler(
        fakeRequest({ host: 'harness.example', cookie }, `${API_PATH}/${method}`),
        allowed.response,
      )
      expect([method, allowed.state.status]).toEqual([method, 404])
    }

    const forged = fakeResponse()
    await routes[0]!.handler(fakeRequest({ host: 'localhost:3080' }), forged.response)
    expect(forged.state).toMatchObject({ status: 401, body: 'unauthorized' })
    await dispose()
  })

  it('passes loopback and declared-authority requests through to the bridge', async () => {
    const { routes, connection, dispose } = await mounted({ trustedHosts: ['harness.example:3080', '192.168.1.5'] })
    // Loopback, no browser markers (curl shape): the fence passes; the carrier
    // answers 404 for a GET unary path — proof the bridge ran.
    const loopback = fakeResponse()
    await routes[0]!.handler(fakeRequest({
      host: '127.0.0.1:3080',
      cookie: browserCookie(connection, '127.0.0.1:3080'),
    }), loopback.response)
    expect(loopback.state.status).toBe(404)
    const lan = fakeResponse()
    await routes[0]!.handler(fakeRequest({
      host: '192.168.1.5:3080',
      cookie: browserCookie(connection, '192.168.1.5:3080'),
    }), lan.response)
    expect(lan.state.status).toBe(404)
    // Declared public authority, same-origin browser shape.
    const declared = fakeResponse()
    await routes[0]!.handler(fakeRequest({
      host: 'harness.example:3080',
      origin: 'http://harness.example:3080',
      'sec-fetch-site': 'same-origin',
      cookie: browserCookie(connection, 'harness.example:3080'),
    }), declared.response)
    expect(declared.state.status).toBe(404)
    await dispose()
  })

  it('shares its configured trust and authentication policy with sibling routes', async () => {
    const { connection, dispose } = await mounted({ trustedHosts: ['harness.example'] })
    const loopback = fakeRequest({ host: '127.0.0.1:3080' })
    const declared = fakeRequest({ host: 'harness.example' })

    expect(connection.requestRejection(loopback)).toBe(401)
    expect(connection.requestRejection(declared)).toBe(401)
    expect(connection.requestRejection(fakeRequest({
      host: 'harness.example',
      cookie: browserCookie(connection, 'harness.example'),
    }))).toBeUndefined()
    await dispose()
  })

  it('provides a disposable dedicated RPC channel', async () => {
    const ctx = new Context()
    const routes: WebRoute[] = []
    provideBrowserCredentials(ctx)
    ctx.provide('webServer', fakeHttpServer(routes, []) as WebServer)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(routes).toHaveLength(2)
    expect(routes[0]).toMatchObject({ kind: 'prefix', path: API_PATH })

    const connection = ctx.get('connection') as HostConnectionHandle
    const calls: unknown[] = []
    const remove = connection.rpc.handle('/rpc', async (endpoint, payload) => {
      calls.push({ endpoint, payload })
      return { ok: true, value: { accepted: true } }
    })
    const route = routes.find(candidate => candidate.path === '/rpc')
    expect(route).toBeDefined()

    const request: ClientRequest = {
      type: 'client-request',
      rpcId: RpcId('rpc-dedicated'),
      method: 'goals/create',
      payload: { args: { agentId: 'agent-1' } },
    }
    const result = fakeResponse()
    await route!.handler(fakePost({
      host: '127.0.0.1:3080',
      cookie: browserCookie(connection, '127.0.0.1:3080'),
    }, '/rpc/goals/create', request), result.response)
    expect(result.state.status).toBe(200)
    expect(JSON.parse(String(result.state.body))).toEqual({
      type: 'server-response',
      rpcId: 'rpc-dedicated',
      result: { ok: true, value: { accepted: true } },
    })
    expect(calls).toEqual([{
      endpoint: 'goals/create',
      payload: { args: { agentId: 'agent-1' } },
    }])

    expect(() => connection.rpc.handle('/rpc', async () => ({ ok: true, value: null })))
      .toThrow(/duplicate route/)
    await remove()
    expect(routes.map(candidate => candidate.path)).toEqual([API_PATH, '/connect'])
    await fiber.dispose()
    expect(routes).toHaveLength(0)
  })

  it('dispatches claimed /api endpoints and withdraws the claim', async () => {
    const ctx = new Context()
    const routes: WebRoute[] = []
    provideBrowserCredentials(ctx)
    ctx.provide('webServer', fakeHttpServer(routes, []) as WebServer)
    const fiber = ctx.plugin({ inject: [...inject], apply }, { trustedHosts: ['harness.example'] })
    await fiber.await()
    const connection = ctx.get('connection') as HostConnectionHandle
    const calls: unknown[] = []
    const remove = connection.rpc.intercept(
      '/api',
      endpoint => endpoint === 'goals/create',
      async (endpoint, payload) => {
        calls.push({ endpoint, payload })
        return { ok: true, value: { accepted: true } }
      },
    )
    expect(() => connection.rpc.intercept(
      '/api',
      () => true,
      async () => ({ ok: true, value: null }),
    )).toThrow('already has an interceptor')
    expect(() => connection.rpc.intercept(
      '/rpc' as '/api',
      () => true,
      async () => ({ ok: true, value: null }),
    )).toThrow('invalid shared RPC channel')
    const route = routes.find(candidate => candidate.path === API_PATH)!
    const request: ClientRequest = {
      type: 'client-request',
      rpcId: RpcId('rpc-shared'),
      method: 'goals/create',
      payload: { args: { agentId: 'agent-1' } },
    }

    const claimed = fakeResponse()
    const loopbackCookie = browserCookie(connection, '127.0.0.1:3080')
    await route.handler(fakePost({
      host: '127.0.0.1:3080', cookie: loopbackCookie,
    }, '/api/goals/create', request), claimed.response)
    expect(JSON.parse(String(claimed.state.body))).toEqual({
      type: 'server-response',
      rpcId: 'rpc-shared',
      result: { ok: true, value: { accepted: true } },
    })
    expect(calls).toEqual([{
      endpoint: 'goals/create',
      payload: { args: { agentId: 'agent-1' } },
    }])

    const denied = fakeResponse()
    await route.handler(fakePost({ host: 'other.example' }, '/api/goals/create', request), denied.response)
    expect(denied.state).toMatchObject({ status: 403, body: 'forbidden' })
    expect(calls).toHaveLength(1)

    const unclaimed = fakeResponse()
    await route.handler(fakeRequest({
      host: '127.0.0.1:3080', cookie: loopbackCookie,
    }, '/api/session.list'), unclaimed.response)
    expect(unclaimed.state.status).toBe(404)

    await remove()
    const withdrawn = fakeResponse()
    await route.handler(fakePost({
      host: '127.0.0.1:3080', cookie: loopbackCookie,
    }, '/api/goals/create', request), withdrawn.response)
    expect(withdrawn.state.status).toBe(404)
    expect(calls).toHaveLength(1)

    const removeAuthenticated = connection.rpc.intercept(
      '/api',
      endpoint => endpoint === 'goals/create',
      async () => ({ ok: true, value: null }),
    )
    const declared = fakeResponse()
    await route.handler(fakePost({
      host: 'harness.example',
      cookie: browserCookie(connection, 'harness.example'),
    }, '/api/goals/create', request), declared.response)
    expect(declared.state.status).toBe(200)
    await removeAuthenticated()
    await fiber.dispose()
  })

  it('admits every trusted, authenticated request as the owner browser Peer and hands each call that Peer', async () => {
    const { connection, routes, dispose } = await mounted({ trustedHosts: ['harness.example'] })
    const peers: PeerScope[] = []
    const remove = connection.rpc.intercept(
      '/api',
      () => true,
      async (_endpoint, _payload, _signal, peer) => {
        peers.push(peer)
        return { ok: true, value: null }
      },
    )
    expect(connection.admit(fakeRequest({ host: 'other.example' }))).toEqual({ rejection: 403 })
    expect(connection.admit(fakeRequest({ host: '127.0.0.1:3080' }))).toEqual({ rejection: 401 })
    const cookie = browserCookie(connection, '127.0.0.1:3080')
    expect(connection.admit(fakeRequest({ host: '127.0.0.1:3080', cookie }))).toEqual({ peer: connection.browserPeer })

    const route = routes.find(candidate => candidate.path === API_PATH)!
    const request: ClientRequest = {
      type: 'client-request',
      rpcId: RpcId('rpc-peer'),
      method: 'goals/create',
      payload: { args: {} },
    }
    const answered = fakeResponse()
    await route.handler(fakePost({ host: '127.0.0.1:3080', cookie }, '/api/goals/create', request), answered.response)
    expect(JSON.parse(String(answered.state.body))).toMatchObject({ result: { ok: true, value: null } })
    // A shell-owned carrier dispatches the shared handler without the bridge and speaks for the browser Peer too.
    const direct = await connection.createSharedFetchHandler('/api').fetch(new Request('http://127.0.0.1:3080/api/goals/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    }), connection.browserPeer)
    expect(direct.status).toBe(200)
    expect(peers).toEqual([connection.browserPeer, connection.browserPeer])
    expect(connection.browserPeer.principal).toEqual({ kind: 'owner' })

    // Racing disposals share one completion, and the scope goes with the Connection.
    await Promise.all([connection.browserPeer.dispose(), connection.browserPeer.dispose()])
    await remove()
    await dispose()
  })

  it('applies the configured trust fence and JSON envelope checks to generic channels', async () => {
    const ctx = new Context()
    const routes: WebRoute[] = []
    provideBrowserCredentials(ctx)
    ctx.provide('webServer', fakeHttpServer(routes, []) as WebServer)
    const fiber = ctx.plugin({ inject: [...inject], apply }, { trustedHosts: ['harness.example'] })
    await fiber.await()
    const connection = ctx.get('connection') as HostConnectionHandle
    const remove = connection.rpc.handle('/rpc', async (endpoint) => {
      if (endpoint === 'fail') throw new Error('handler broke')
      return { ok: true, value: null }
    })
    const route = routes.find(candidate => candidate.path === '/rpc')!
    const harnessHeaders = {
      host: 'harness.example',
      cookie: browserCookie(connection, 'harness.example'),
    }

    const denied = fakeResponse()
    await route.handler(fakePost({ host: 'other.example' }, '/rpc/goals/create', {}), denied.response)
    expect(denied.state).toMatchObject({ status: 403, body: 'forbidden' })

    const unauthenticated = fakeResponse()
    await route.handler(fakePost({ host: 'harness.example' }, '/rpc/goals/create', {}), unauthenticated.response)
    expect(unauthenticated.state).toMatchObject({ status: 401, body: 'unauthorized' })

    const methodMismatch = fakeResponse()
    await route.handler(fakePost(harnessHeaders, '/rpc/goals/create', {
      type: 'client-request', rpcId: 'rpc-bad', method: 'other', payload: {},
    }), methodMismatch.response)
    expect(JSON.parse(String(methodMismatch.state.body))).toMatchObject({
      rpcId: 'rpc-bad',
      result: { ok: false, error: { code: 'gateway/bad-request' } },
    })

    for (const [request, status] of [
      [fakeRequest(harnessHeaders, '/rpc/goals/create'), 404],
      [fakePost(harnessHeaders, '/outside/goals/create', {}), 404],
      [fakePost(harnessHeaders, '/rpc/goals//create', {}), 404],
      [fakeRawPost(harnessHeaders, '/rpc/goals/create', '{}'), 415],
      [fakeRawPost({ ...harnessHeaders, 'content-type': 'text/plain' }, '/rpc/goals/create', '{}'), 415],
      [fakeRawPost({ ...harnessHeaders, 'content-type': 'application/json; charset=utf-8' }, '/rpc/goals/create', '{'), 400],
    ] as const) {
      const response = fakeResponse()
      await route.handler(request, response.response)
      expect(response.state.status).toBe(status)
    }

    for (const [body, rpcId] of [
      [{ rpcId: 'retained-id' }, 'retained-id'],
      [{ rpcId: 42 }, 'invalid-request'],
      [null, 'invalid-request'],
    ] as const) {
      const response = fakeResponse()
      await route.handler(fakePost(harnessHeaders, '/rpc/goals/create', body), response.response)
      expect(JSON.parse(String(response.state.body))).toMatchObject({
        rpcId,
        result: { ok: false, error: { code: 'gateway/bad-request' } },
      })
    }

    const failed = fakeResponse()
    await route.handler(fakePost(harnessHeaders, '/rpc/fail', {
      type: 'client-request', rpcId: 'rpc-fail', method: 'fail', payload: {},
    }), failed.response)
    expect(failed.state).toMatchObject({ status: 500, body: 'handler failure: Error: handler broke' })

    expect(() => connection.rpc.handle('/api', async () => ({ ok: true, value: null })))
      .toThrow('invalid or reserved RPC channel')
    expect(() => connection.rpc.handle('api3', async () => ({ ok: true, value: null })))
      .toThrow('invalid or reserved RPC channel')
    await remove()
    await fiber.dispose()
  })
})

describe('operator-scoped connect', () => {
  async function connect(
    host: Awaited<ReturnType<typeof mounted>>,
    query = '',
    headers: Record<string, string> = {},
  ): Promise<{ cookie: string; state: ReturnType<typeof fakeResponse>['state'] }> {
    const token = new URL(host.connection.authenticatedUrl('http://localhost')).search
    const response = fakeResponse()
    await host.routes.find(route => route.path === '/connect')!.handler(
      fakeRequest({ host: 'localhost', ...headers }, `/connect${token}${query}`), response.response,
    )
    return { cookie: response.state.headers?.['set-cookie']?.split(';', 1)[0] ?? '', state: response.state }
  }

  function admitted(connection: HostConnectionHandle, cookie: string): PeerScope {
    const admission = connection.admit(fakeRequest({ host: 'localhost', cookie }))
    if ('rejection' in admission) throw new Error(`operator refused: ${admission.rejection}`)
    return admission.peer
  }

  it('defaults API callers to none regardless of Accept and honors explicit declarations', async () => {
    const host = await mounted()
    try {
      for (const [query, headers, interactions, status, location] of [
        ['', {}, 'none', 302, './api/remote.mux'],
        ['&interactions=none', {}, 'none', 302, './api/remote.mux'],
        ['&interactions=answer', {}, 'answer', 302, './api/remote.mux'],
        ['', { accept: 'text/html,application/xhtml+xml' }, 'none', 302, './api/remote.mux'],
        ['&interactions=answer', { accept: 'text/html' }, 'answer', 302, './api/remote.mux'],
      ] as const) {
        const result = await connect(host, query, headers)
        expect(result.state).toMatchObject({ status, headers: { location, 'cache-control': 'no-store' } })
        expect(admitted(host.connection, result.cookie).interactions).toBe(interactions)
      }
      const rootCookie = browserCookie(host.connection, 'localhost')
      expect(admitted(host.connection, rootCookie).interactions).toBe('answer')
    } finally { await host.dispose() }
  })

  it('keeps all browser cookies on the shared operator and creates independent API operators', async () => {
    const host = await mounted()
    try {
      const cookie = browserCookie(host.connection, 'localhost')
      expect(admitted(host.connection, cookie)).toBe(host.connection.browserPeer)
      expect(admitted(host.connection, browserCookie(host.connection, 'localhost'))).toBe(host.connection.browserPeer)
      const api = await connect(host, '', { cookie })
      expect(admitted(host.connection, api.cookie)).not.toBe(host.connection.browserPeer)
      const second = await connect(host, '', { cookie: api.cookie })
      expect(admitted(host.connection, second.cookie)).not.toBe(admitted(host.connection, api.cookie))
      const denied = fakeResponse()
      expect(host.connection.authorizeIndex(fakeRequest(
        { host: 'localhost', cookie: api.cookie }, '/',
      ), denied.response)).toBe(false)
      expect(denied.state.status).toBe(401)
    } finally { await host.dispose() }
  })

  it('refuses invalid declarations, authentication, and untrusted connect requests without a cookie', async () => {
    const host = await mounted()
    try {
      for (const query of ['&interactions=observe', '&interactions=', '&interactions=none&interactions=answer']) {
        const result = await connect(host, query)
        expect(result.state.status).toBe(400)
        expect(result.cookie).toBe('')
      }
      for (const headers of [{ host: 'untrusted.example' }, { origin: 'http://untrusted.example' }]) {
        expect((await connect(host, '', headers)).state.status).toBe(403)
      }
      const route = host.routes.find(route => route.path === '/connect')!
      for (const request of [
        fakeRequest({ host: 'localhost' }, '/connect?token=invalid'),
        fakePost({ host: 'localhost' }, '/connect', {}),
      ]) {
        const response = fakeResponse()
        await route.handler(request, response.response)
        expect(response.state.status).toBe(401)
        expect(response.state.headers?.['set-cookie']).toBeUndefined()
      }
    } finally { await host.dispose() }
  })

  it('refuses a captured connect request after the owning fiber is disposed', async () => {
    const host = await mounted()
    try {
      const route = host.routes.find(candidate => candidate.path === '/connect')!
      const request = fakeRequest({ host: 'localhost' }, host.connection.authenticatedUrl('http://localhost/connect'))
      await host.dispose()
      const response = fakeResponse()

      await route.handler(request, response.response)

      expect(response.state).toEqual({ status: 401, body: 'unauthorized' })
      expect(response.response.writableEnded).toBe(true)
    } finally { await host.dispose() }
  })

  it('dispatches HTTP before a socket and lets an admitted call finish after socket release', async () => {
    const host = await mounted()
    const finish = Promise.withResolvers<undefined>()
    const started = Promise.withResolvers<AbortSignal>()
    try {
      const first = await connect(host)
      const second = await connect(host)
      const peer = admitted(host.connection, first.cookie)
      expect(admitted(host.connection, second.cookie).id).not.toBe(peer.id)
      host.connection.rpc.intercept('/api', () => true, async (_endpoint, _payload, signal, caller) => {
        expect(caller).toBe(peer)
        if (_endpoint === 'fixture/held') {
          started.resolve(signal)
          await finish.promise
        }
        return { ok: true, value: { id: caller.id } }
      })
      const api = host.routes.find(route => route.path === '/api')!
      const post = (method: string): IncomingMessage => fakePost({ host: 'localhost', cookie: first.cookie }, `/api/${method}`, {
        type: 'client-request', rpcId: 'connect-test', method, payload: {},
      })
      const beforeSocket = fakeResponse()
      await api.handler(post('fixture/now'), beforeSocket.response)
      expect(JSON.parse(String(beforeSocket.state.body))).toMatchObject({ result: { ok: true, value: { id: peer.id } } })

      const pendingResponse = fakeResponse()
      const pending = api.handler(post('fixture/held'), pendingResponse.response)
      const signal = await started.promise
      const owner = host.connection.admitConnection(fakeRequest({ host: 'localhost', cookie: first.cookie }))
      if ('rejection' in owner) throw new Error('first socket was refused')
      expect(owner.peer).toBe(peer)
      expect(host.connection.admitConnection(fakeRequest({ host: 'localhost', cookie: first.cookie })))
        .toEqual({ rejection: 409 })
      expect(admitted(host.connection, first.cookie)).toBe(peer)
      const cleanup = vi.fn()
      peer.ctx.effect(() => cleanup)
      const released = owner.release()
      expect(host.connection.admit(fakeRequest({ host: 'localhost', cookie: first.cookie }))).toEqual({ rejection: 401 })
      expect(owner.release()).toBe(released)
      await released
      expect(cleanup).toHaveBeenCalledOnce()
      expect(signal.aborted).toBe(false)
      finish.resolve(undefined)
      await pending
      expect(pendingResponse.state.status).toBe(200)
      const afterSocket = fakeResponse()
      await api.handler(post('fixture/now'), afterSocket.response)
      expect(afterSocket.state.status).toBe(401)
      expect(host.connection.admitConnection(fakeRequest({ host: 'localhost', cookie: first.cookie })))
        .toEqual({ rejection: 401 })
    } finally { finish.resolve(undefined); await host.dispose() }
  })

  it('retains unused operators for arbitrary elapsed time but rejects expired cookies', async () => {
    const host = await mounted({ cookieMaxAgeDays: 36_500 })
    vi.useFakeTimers()
    try {
      const { cookie } = await connect(host)
      const peer = admitted(host.connection, cookie)
      await vi.advanceTimersByTimeAsync(10 * 365 * 86_400_000)
      expect(admitted(host.connection, cookie)).toBe(peer)
      const disposed = vi.fn()
      peer.ctx.effect(() => disposed)
      await vi.advanceTimersByTimeAsync(100 * 365 * 86_400_000)
      expect(host.connection.admit(fakeRequest({ host: 'localhost', cookie }))).toEqual({ rejection: 401 })
      expect(disposed).not.toHaveBeenCalled()
      await host.dispose()
      expect(disposed).toHaveBeenCalledOnce()
    } finally { vi.useRealTimers(); await host.dispose() }
  })

  it('preserves browser tabs and restart recovery without resurrecting API operators', async () => {
    const host = await mounted()
    const browser = { cookie: browserCookie(host.connection, 'localhost') }
    const api = await connect(host)
    const browserPeer = admitted(host.connection, browser.cookie)
    try {
      const request = fakeRequest({ host: 'localhost', cookie: browser.cookie })
      const one = host.connection.admitConnection(request)
      const two = host.connection.admitConnection(request)
      if ('rejection' in one || 'rejection' in two) throw new Error('browser tab was refused')
      expect(two.peer).toBe(one.peer)
      await one.release()
      expect(admitted(host.connection, browser.cookie)).toBe(browserPeer)
      await two.release()
      expect(admitted(host.connection, browser.cookie)).toBe(browserPeer)
      const refresh = fakeResponse()
      expect(host.connection.authorizeIndex(fakeRequest({ host: 'localhost', cookie: browser.cookie }, '/'), refresh.response)).toBe(true)
      const cleanup = vi.fn()
      browserPeer.ctx.effect(() => cleanup)
      await host.dispose()
      expect(cleanup).toHaveBeenCalledOnce()
      expect(host.connection.admit(request)).toEqual({ rejection: 401 })
      const restarted = await mounted(undefined, 'http:', host.ctx.credentials)
      try {
        expect(admitted(restarted.connection, browser.cookie)).toBe(restarted.connection.browserPeer)
        expect(admitted(restarted.connection, browser.cookie)).not.toBe(browserPeer)
        expect(restarted.connection.admit(fakeRequest({ host: 'localhost', cookie: api.cookie }))).toEqual({ rejection: 401 })
      } finally { await restarted.dispose() }
    } finally { await host.dispose() }
  })
})

describe('connection transport leases and device administration', () => {
  /** Exchange the launch token for one API operator cookie. */
  async function apiCookie(host: Awaited<ReturnType<typeof mounted>>): Promise<string> {
    const token = new URL(host.connection.authenticatedUrl('http://localhost')).search
    const reply = fakeResponse()
    await host.routes.find(route => route.path === '/connect')!.handler(
      fakeRequest({ host: 'localhost' }, `/connect${token}`), reply.response,
    )
    return reply.state.headers?.['set-cookie']?.split(';', 1)[0] ?? ''
  }

  /** Issue one device with an origin-bound login and its admitted-request shape. */
  async function deviceSession(host: Awaited<ReturnType<typeof mounted>>): Promise<{
    tokens: DeviceTokens
    device: { id: ReturnType<typeof deviceId.parse>; token: string }
    request: IncomingMessage
  }> {
    const tokens = new DeviceTokens(host.ctx.credentials)
    const device = await tokens.issue('Laptop')
    const login = await tokens.exchange(device.token, 'https://localhost', { lifetimeMs: 60_000, maxSessionsPerDevice: 2 })
    if (login === undefined) throw new Error('device login was refused')
    return { tokens, device, request: fakeRequest({ host: 'localhost', cookie: `__Host-ocean-device=${login}` }) }
  }

  /** The concrete service behind a mounted Host handle. */
  function serviceOf(connection: HostConnectionHandle): HostConnectionService {
    if (!(connection instanceof HostConnectionService)) throw new Error('missing Host Connection service')
    return connection
  }

  it('claims API socket ownership through admitTransport and keeps device administration out of owner mode', async () => {
    const host = await mounted()
    try {
      const cookie = await apiCookie(host)
      const request = fakeRequest({ host: 'localhost', cookie })
      const claim = await host.connection.admitTransport(request, true)
      if ('rejection' in claim) throw new Error('API socket was refused')
      expect(await host.connection.admitTransport(request, true)).toEqual({ rejection: 409 })
      const http = await host.connection.admitTransport(request, false)
      if ('rejection' in http) throw new Error('API HTTP call was refused')
      expect(http.peer).toBe(claim.peer)
      await http.release()
      expect(host.connection.admit(request)).toEqual({ peer: claim.peer })
      await claim.release()
      expect(await host.connection.admitDeviceDocument?.(new Request('http://localhost/'))).toBeUndefined()
      const service = serviceOf(host.connection)
      const absent = deviceId.parse(randomUUID())
      await expect(service.revokeDevice(absent)).rejects.toThrow('device login is unavailable')
      await expect(service.rotateDevice(absent)).rejects.toThrow('device login is unavailable')
    } finally { await host.dispose() }
  })

  it('refuses device transports without a mounted Web carrier', async () => {
    const ctx = new Context()
    provideBrowserCredentials(ctx)
    const fiber = ctx.plugin({ inject: [...inject], apply }, { allowOwnerLogin: false })
    try {
      await fiber.await()
      const connection = ctx.get('connection') as HostConnectionHandle
      expect(await connection.admitTransport(fakeRequest({ host: 'localhost', cookie: '__Host-ocean-device=unused' }), true))
        .toEqual({ rejection: 401 })
    } finally { await fiber.dispose() }
  })

  it('releases retained device leases on disposal and refuses later admission and administration', async () => {
    const host = await mounted({ allowOwnerLogin: false }, 'https:')
    try {
      const { device, request } = await deviceSession(host)
      const lease = await host.connection.admitTransport(request, true)
      if ('rejection' in lease) throw new Error('device admission failed')
      await host.dispose()
      expect(lease.peer.signal.aborted).toBe(true)
      expect(await host.connection.admitTransport(request, true)).toEqual({ rejection: 401 })
      const service = serviceOf(host.connection)
      await expect(service.revokeDevice(device.id)).rejects.toThrow('device login is unavailable')
      await expect(service.rotateDevice(device.id)).rejects.toThrow('device login is unavailable')
    } finally { await host.dispose() }
  })

  it('refuses admission when the device registry changes during the credential read', async () => {
    const host = await mounted({ allowOwnerLogin: false }, 'https:')
    const { request } = await deviceSession(host)
    const original = host.ctx.credentials.readRecord.bind(host.ctx.credentials)
    const read = vi.spyOn(host.ctx.credentials, 'readRecord').mockImplementation(async (key) => {
      host.ctx.emit('credentials/record-updated', deviceRegistryKey)
      return original(key)
    })
    try {
      expect(await host.connection.admitTransport(request, true)).toEqual({ rejection: 503 })
    } finally { read.mockRestore(); await host.dispose() }
  })

  it('expires a device lease when revalidation fails and contains cleanup failures', async () => {
    const host = await mounted({ allowOwnerLogin: false }, 'https:')
    const { request } = await deviceSession(host)
    const lease = await host.connection.admitTransport(request, true)
    if ('rejection' in lease) throw new Error('device admission failed')
    const warn = vi.spyOn(host.ctx.logger, 'warn').mockImplementation(() => {})
    const cleanup = vi.spyOn(lease.peer, 'dispose').mockRejectedValueOnce(new Error('private cleanup detail'))
    const read = vi.spyOn(host.ctx.credentials, 'readRecord').mockRejectedValueOnce(new Error('store offline'))
    try {
      host.ctx.emit('credentials/record-updated', deviceRegistryKey)
      await vi.waitFor(() => {
        expect(warn).toHaveBeenCalledWith('Device Peer cleanup failed: %s', expect.any(Error))
      })
      expect(host.connection.sharesDeviceSession?.(lease.peer, lease.peer)).toBe(false)
    } finally {
      cleanup.mockRestore()
      read.mockRestore()
      warn.mockRestore()
      await lease.peer.dispose()
      await host.dispose()
    }
  })

  it('keeps a live lease through unrelated and validating registry updates', async () => {
    const host = await mounted({ allowOwnerLogin: false }, 'https:')
    const { request } = await deviceSession(host)
    const lease = await host.connection.admitTransport(request, true)
    if ('rejection' in lease) throw new Error('device admission failed')
    try {
      host.ctx.emit('credentials/record-updated', credentialKey('fixture', 'unrelated'))
      await new Promise(resolve => setImmediate(resolve))
      expect(lease.peer.signal.aborted).toBe(false)
      expect(host.connection.sharesDeviceSession?.(lease.peer, lease.peer)).toBe(true)
      // A registry update that revalidates the same login leaves the lease in place.
      host.ctx.emit('credentials/record-updated', deviceRegistryKey)
      await new Promise(resolve => setImmediate(resolve))
      expect(lease.peer.signal.aborted).toBe(false)
      expect(host.connection.sharesDeviceSession?.(lease.peer, lease.peer)).toBe(true)
    } finally { await lease.release(); await host.dispose() }
  })

  it('writes device transport rejection bodies and destroys an invalidated device response', async () => {
    const host = await mounted({ allowOwnerLogin: false, maxDeviceTransports: 1 }, 'https:')
    const { device, request } = await deviceSession(host)
    const service = serviceOf(host.connection)
    const lease = await service.admitTransport(request, true)
    if ('rejection' in lease) throw new Error('device admission failed')
    try {
      const busy = fakeResponse()
      await service.handleHttpTransport(request, busy.response, async () => {})
      expect(busy.state).toMatchObject({ status: 503, body: 'device transport unavailable' })
      const owner = await mounted()
      try {
        const forbidden = fakeResponse()
        await serviceOf(owner.connection).handleHttpTransport(fakeRequest({ host: 'other.example' }), forbidden.response, async () => {})
        expect(forbidden.state).toMatchObject({ status: 403, body: 'forbidden' })
      } finally { await owner.dispose() }
      await lease.release()
      const destroyed = vi.fn()
      const live = fakeResponse()
      Object.assign(live.response, { destroy: destroyed })
      const entered = Promise.withResolvers<undefined>()
      const finish = Promise.withResolvers<undefined>()
      const handling = service.handleHttpTransport(request, live.response, async () => {
        entered.resolve(undefined)
        await finish.promise
      })
      await entered.promise
      await service.revokeDevice(device.id)
      expect(destroyed).toHaveBeenCalledOnce()
      finish.resolve(undefined)
      await handling
    } finally { await host.dispose() }
  })

  it('reports unchanged devices and contains administration storage failures', async () => {
    const host = await mounted({ allowOwnerLogin: false }, 'https:')
    const { tokens, device } = await deviceSession(host)
    const service = serviceOf(host.connection)
    try {
      const absent = deviceId.parse(randomUUID())
      expect(await service.revokeDevice(absent)).toBe(false)
      expect(await service.rotateDevice(absent)).toBeUndefined()
      const modify = vi.spyOn(host.ctx.credentials, 'modifyRecord').mockRejectedValue(new Error('store offline'))
      await expect(service.revokeDevice(device.id)).rejects.toMatchObject({
        code: 'DEVICE_ADMIN_FAILED', durableOutcome: 'unknown', liveCleanup: 'complete',
      })
      modify.mockRestore()
      expect(await service.revokeDevice(device.id)).toBe(true)
      expect(await tokens.verify(device.token)).toBeUndefined()
    } finally { await host.dispose() }
  })

  it('keeps the invalidation guard until concurrent administrations of one device settle', async () => {
    const host = await mounted({ allowOwnerLogin: false, maxDeviceTransports: 2, maxDeviceTransportsPerDevice: 2 }, 'https:')
    const { tokens, device, request } = await deviceSession(host)
    const service = serviceOf(host.connection)
    const first = await service.admitTransport(request, true)
    const second = await service.admitTransport(request, false)
    if ('rejection' in first || 'rejection' in second) throw new Error('device admission failed')
    const gates: Array<PromiseWithResolvers<undefined>> = []
    const original = host.ctx.credentials.modifyRecord.bind(host.ctx.credentials)
    const modify = vi.spyOn(host.ctx.credentials, 'modifyRecord').mockImplementation(async (key, update) => {
      const gate = Promise.withResolvers<undefined>()
      gates.push(gate)
      await gate.promise
      return original(key, update)
    })
    try {
      const revoking = service.revokeDevice(device.id)
      const rotating = service.rotateDevice(device.id)
      await vi.waitFor(() => { expect(gates).toHaveLength(2) })
      expect(service.sharesDeviceSession(first.peer, second.peer)).toBe(false)
      gates[0]?.resolve(undefined)
      expect(await revoking).toBe(true)
      expect(first.peer.signal.aborted).toBe(true)
      expect(second.peer.signal.aborted).toBe(true)
      gates[1]?.resolve(undefined)
      expect(await rotating).toBeUndefined()
      expect(await tokens.verify(device.token)).toBeUndefined()
    } finally {
      for (const gate of gates) gate.resolve(undefined)
      modify.mockRestore()
      await host.dispose()
    }
  })
})

describe('connection node half over a real HTTP server', () => {
  /** Serve the registered prefix route from a real server and return its port. */
  async function serve(routes: WebRoute[]): Promise<{ port: number; close: () => Promise<void> }> {
    const server = createServer((request, response) => {
      void routes[0]!.handler(request, response)
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as AddressInfo
    return {
      port: address.port,
      close: () => new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined || error === null) resolve()
          else reject(error)
        })
      }),
    }
  }

  /** One real request; `host` spoofs the authority the way a LAN client's browser would send it. */
  function call(port: number, method: string, host: string, cookie?: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const request = httpRequest(
        {
          host: '127.0.0.1',
          port,
          path: `${API_PATH}/${method}`,
          method: 'GET',
          headers: { host, ...cookie === undefined ? {} : { cookie } },
        },
        (response) => {
          response.resume()
          response.on('end', () => { resolve(response.statusCode ?? 0) })
        },
      )
      request.on('error', reject)
      request.end()
    })
  }

  it('requires authentication uniformly over a real HTTP request', async () => {
    // A real IncomingMessage pins the exploit boundary: a client-controlled
    // Host naming loopback passes the rebinding fence but never authenticates.
    const { routes, connection, dispose } = await mounted({ trustedHosts: ['harness.example'] })
    const { port, close } = await serve(routes)
    try {
      const methods = [
        'settings/openSettingsDocument',
        'session/openWorkspacePath',
        'llm/discoverModels', 'skills/list',
        'agentPresets/list',
        'llm/listProviders', 'session/modelCatalog',
      ]
      for (const method of methods) {
        expect([method, await call(port, method, 'localhost')]).toEqual([method, 401])
        expect([method, await call(port, method, 'harness.example')]).toEqual([method, 401])
      }
      expect(await call(port, 'settings/openSettingsDocument', 'other.example')).toBe(403)

      const declaredCookie = browserCookie(connection, 'harness.example')
      for (const method of methods) {
        expect([method, await call(port, method, 'harness.example', declaredCookie)]).toEqual([method, 404])
      }
      const loopbackAuthority = `127.0.0.1:${String(port)}`
      expect(await call(
        port,
        'settings/openSettingsDocument',
        loopbackAuthority,
        browserCookie(connection, loopbackAuthority),
      )).toBe(404)
    } finally {
      await close()
      await dispose()
    }
  })
})
