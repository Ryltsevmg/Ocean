/** Device login endpoint fencing, exchange failure containment, and logout cleanup. */
import { ServerResponse, type IncomingMessage } from 'node:http'
import { Readable } from 'node:stream'
import { expect, it, vi } from 'vitest'
import type { HostEpoch, HostId } from '../src/connect-protocol.ts'
import { DeviceLogin } from '../src/device-login.ts'
import { DeviceTokens } from '../src/device-tokens.ts'
import { RecordCredentials } from './browser-credentials.ts'

const LISTENER = { host: '127.0.0.1', protocol: 'https:' } as const
const ORIGIN = 'https://ocean.example'
const IDENTITY = { hostId: 'host-fixture' as HostId, epoch: 'epoch-fixture' as HostEpoch }

/** A DeviceLogin over the fixture registry with the shared trusted authority. */
function deviceLogin(store: RecordCredentials, overrides: {
  trustedHosts?: readonly string[]
  maxSessionsPerDevice?: number
} = {}): DeviceLogin {
  return new DeviceLogin(new DeviceTokens(store), {
    trustedHosts: overrides.trustedHosts ?? ['ocean.example'],
    lifetimeMs: 60_000,
    maxSessionsPerDevice: overrides.maxSessionsPerDevice ?? 2,
    maxExchangesPerWindow: 10,
    exchangeWindowMs: 60_000,
    identity: IDENTITY,
  })
}

/** A bodyless request carrying the given method and headers. */
function request(method: string, headers: Record<string, string>): IncomingMessage {
  const message = Readable.from([]) as IncomingMessage
  return Object.assign(message, { url: '/connect', method, headers })
}

/** A real response whose reply status and headers the test reads back. */
function response() {
  const recorder = new ServerResponse(request('POST', {}))
  return { response: recorder, writeHead: vi.spyOn(recorder, 'writeHead') }
}

/** Headers of a same-origin exchange request with a compatible protocol. */
function exchangeHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { host: 'ocean.example', origin: ORIGIN, 'ocean-device-protocol': '1', ...extra }
}

it('rejects non-POST exchange and malformed bearers before reading storage', async () => {
  const store = new RecordCredentials()
  const login = deviceLogin(store)
  const method = response()
  await login.exchange(request('GET', exchangeHeaders()), method.response, LISTENER)
  expect(method.response.statusCode).toBe(405)
  for (const authorization of [undefined, 'Bearer short', 'X'.repeat(87)]) {
    const reply = response()
    await login.exchange(request('POST', exchangeHeaders(
      authorization === undefined ? {} : { authorization },
    )), reply.response, LISTENER)
    expect(reply.response.statusCode).toBe(401)
    expect(reply.writeHead.mock.calls[0]?.[1]).not.toHaveProperty('set-cookie')
  }
  expect(store.reads).toBe(0)
})

it('contains credential-store failures as 503 without record details', async () => {
  const store = new RecordCredentials()
  const login = deviceLogin(store)
  const { token } = await login.tokens.issue('Laptop')
  const headers = exchangeHeaders({ authorization: `Bearer ${token}` })
  const read = vi.spyOn(store, 'readRecord').mockRejectedValue(new Error('private store detail'))
  const unavailable = response()
  await login.exchange(request('POST', headers), unavailable.response, LISTENER)
  expect(unavailable.response.statusCode).toBe(503)
  expect(unavailable.writeHead).toHaveBeenCalledWith(503, { 'cache-control': 'no-store' })
  read.mockRestore()
  const modify = vi.spyOn(store, 'modifyRecord').mockRejectedValue(new Error('private store detail'))
  const failed = response()
  await login.exchange(request('POST', headers), failed.response, LISTENER)
  expect(failed.response.statusCode).toBe(503)
  expect(failed.writeHead).toHaveBeenCalledWith(503, { 'cache-control': 'no-store' })
  modify.mockRestore()
})

it('reports login capacity separately from other exchange failures', async () => {
  const store = new RecordCredentials()
  const login = deviceLogin(store, { maxSessionsPerDevice: 1 })
  const { token } = await login.tokens.issue('Laptop')
  const limits = { lifetimeMs: 60_000, maxSessionsPerDevice: 1 }
  if (await login.tokens.exchange(token, ORIGIN, limits) === undefined) throw new Error('first login was refused')
  const reply = response()
  await login.exchange(request('POST', exchangeHeaders({ authorization: `Bearer ${token}` })), reply.response, LISTENER)
  expect(reply.response.statusCode).toBe(503)
  expect(reply.writeHead).toHaveBeenCalledWith(503, { 'cache-control': 'no-store', 'ocean-device-error': 'capacity' })
})

it('refuses a device whose registry record vanished between verification and exchange', async () => {
  const store = new RecordCredentials()
  const login = deviceLogin(store)
  const { token } = await login.tokens.issue('Laptop')
  const original = store.modifyRecord.bind(store)
  const wipe = vi.spyOn(store, 'modifyRecord').mockImplementationOnce(async (key, update) => {
    store.record = undefined
    return original(key, update)
  })
  const reply = response()
  await login.exchange(request('POST', exchangeHeaders({ authorization: `Bearer ${token}` })), reply.response, LISTENER)
  expect(reply.response.statusCode).toBe(401)
  expect(reply.writeHead.mock.calls[0]?.[1]).not.toHaveProperty('set-cookie')
  wipe.mockRestore()
})

it('answers an incompatible cookie-less preflight with the supported protocol version', async () => {
  const login = deviceLogin(new RecordCredentials())
  const reply = response()
  await login.identify(request('HEAD', {
    host: 'ocean.example', origin: ORIGIN, 'ocean-device-protocol': '2',
  }), reply.response, LISTENER)
  expect(reply.response.statusCode).toBe(409)
  expect(reply.writeHead).toHaveBeenCalledWith(409, { 'cache-control': 'no-store', 'ocean-device-protocol': '1' })
})

it('confirms logout without live cleanup when the cookie names no parseable login', async () => {
  const login = deviceLogin(new RecordCredentials())
  const close = vi.fn(async () => {})
  const reply = response()
  await login.logout(request('DELETE', exchangeHeaders({ cookie: '__Host-ocean-device=garbage' })), reply.response, LISTENER, close)
  expect(reply.response.statusCode).toBe(204)
  expect(reply.writeHead).toHaveBeenCalledWith(204, expect.objectContaining({
    'set-cookie': expect.stringContaining('Max-Age=0') as string,
  }))
  expect(close).not.toHaveBeenCalled()
})

it('reports failed logout invalidation or live cleanup as 503', async () => {
  const store = new RecordCredentials()
  const login = deviceLogin(store)
  const { token } = await login.tokens.issue('Laptop')
  const credential = await login.tokens.exchange(token, ORIGIN, { lifetimeMs: 60_000, maxSessionsPerDevice: 1 })
  if (credential === undefined) throw new Error('device login was refused')
  const headers = exchangeHeaders({ cookie: `__Host-ocean-device=${credential}` })
  const cleanup = response()
  await login.logout(request('DELETE', headers), cleanup.response, LISTENER, async () => {
    throw new Error('private cleanup detail')
  })
  expect(cleanup.response.statusCode).toBe(503)
  expect(cleanup.writeHead).toHaveBeenCalledWith(503, { 'cache-control': 'no-store' })
  const modify = vi.spyOn(store, 'modifyRecord').mockRejectedValue(new Error('private store detail'))
  const invalidation = response()
  await login.logout(request('DELETE', headers), invalidation.response, LISTENER, async () => {})
  expect(invalidation.response.statusCode).toBe(503)
  expect(invalidation.writeHead).toHaveBeenCalledWith(503, { 'cache-control': 'no-store' })
  modify.mockRestore()
})

it('refuses a trusted authority the canonical origin grammar rejects', async () => {
  const login = deviceLogin(new RecordCredentials(), { trustedHosts: ['under_score.example'] })
  const reply = response()
  await login.exchange(request('POST', {
    host: 'under_score.example', origin: 'https://under_score.example', 'ocean-device-protocol': '1',
  }), reply.response, LISTENER)
  expect(reply.response.statusCode).toBe(403)
})

it('refuses an Origin that differs from the canonical HTTPS origin', async () => {
  const login = deviceLogin(new RecordCredentials())
  for (const [host, origin] of [
    ['ocean.example', 'http://ocean.example'],
    ['ocean.example:443', 'https://ocean.example:443'],
  ] as const) {
    const reply = response()
    await login.exchange(request('POST', {
      host, origin, 'ocean-device-protocol': '1',
    }), reply.response, LISTENER)
    expect(reply.response.statusCode).toBe(403)
  }
})

/** Headers of a same-origin pairing request. */
function pairHeaders(grant: string, extra: Record<string, string> = {}): Record<string, string> {
  return exchangeHeaders({ authorization: `Bearer ${grant}`, ...extra })
}

it('turns a pairing grant into a device token exactly once', async () => {
  const store = new RecordCredentials()
  const login = deviceLogin(store)
  const grant = await login.tokens.createPairing('Phone', 60_000)
  const reply = response()
  await login.pair(request('POST', pairHeaders(grant.secret)), reply.response, LISTENER)
  expect(reply.response.statusCode).toBe(200)
  const call = reply.writeHead.mock.calls[0]?.[1] as Record<string, string>
  expect(call).toMatchObject({
    'cache-control': 'no-store', 'content-type': 'application/json',
    'ocean-device-protocol': '1', 'ocean-device-host': 'host-fixture', 'ocean-device-epoch': 'epoch-fixture',
  })
  const devices = await login.tokens.list()
  expect(devices).toHaveLength(1)
  const second = response()
  await login.pair(request('POST', pairHeaders(grant.secret)), second.response, LISTENER)
  expect(second.response.statusCode).toBe(401)
})

it('fences pairing by method, origin, protocol, Host identity, and bearer shape', async () => {
  const store = new RecordCredentials()
  const login = deviceLogin(store)
  const grant = await login.tokens.createPairing('Phone', 60_000)
  const cases: [string, string, Record<string, string>, number][] = [
    ['GET', 'method', pairHeaders(grant.secret), 405],
    ['POST', 'untrusted origin', pairHeaders(grant.secret, { origin: 'https://evil.example' }), 403],
    ['POST', 'protocol', pairHeaders(grant.secret, { 'ocean-device-protocol': '2' }), 409],
    ['POST', 'host identity', pairHeaders(grant.secret, { 'ocean-device-host': 'other-host' }), 412],
    ['POST', 'missing bearer', exchangeHeaders(), 401],
    ['POST', 'short bearer', exchangeHeaders({ authorization: 'Bearer short' }), 401],
  ]
  for (const [method, label, headers, status] of cases) {
    const reply = response()
    await login.pair(request(method, headers), reply.response, LISTENER)
    expect(reply.response.statusCode, label).toBe(status)
  }
  expect(await login.tokens.list()).toEqual([])
})

it('limits pairing attempts per window and reopens the window', async () => {
  const clock = vi.spyOn(performance, 'now').mockReturnValue(1_000)
  try {
    const login = new DeviceLogin(new DeviceTokens(new RecordCredentials()), {
      trustedHosts: ['ocean.example'], lifetimeMs: 60_000, maxSessionsPerDevice: 2,
      maxExchangesPerWindow: 2, exchangeWindowMs: 10_000, identity: IDENTITY,
    })
    const bogus = `${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}.${'A'.repeat(43)}`
    const statuses: number[] = []
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const reply = response()
      await login.pair(request('POST', pairHeaders(bogus)), reply.response, LISTENER)
      statuses.push(reply.response.statusCode)
      if (attempt === 2) expect(reply.writeHead.mock.calls[0]?.[1]).toMatchObject({ 'retry-after': '10' })
    }
    expect(statuses).toEqual([401, 401, 429])
    clock.mockReturnValue(11_000)
    const reopened = response()
    await login.pair(request('POST', pairHeaders(bogus)), reopened.response, LISTENER)
    expect(reopened.response.statusCode).toBe(401)
  } finally {
    clock.mockRestore()
  }
})

it('contains a credential-store failure while pairing as 503 without record details', async () => {
  const store = new RecordCredentials()
  const login = deviceLogin(store)
  const grant = await login.tokens.createPairing('Phone', 60_000)
  vi.spyOn(store, 'modifyRecord').mockRejectedValue(new Error('private store detail'))
  const reply = response()
  await login.pair(request('POST', pairHeaders(grant.secret)), reply.response, LISTENER)
  expect(reply.response.statusCode).toBe(503)
  expect(reply.writeHead).toHaveBeenCalledWith(503, { 'cache-control': 'no-store' })
})
