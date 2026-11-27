/** Device login endpoint fencing, exchange failure containment, and logout cleanup. */
import { ServerResponse, type IncomingMessage } from 'node:http'
import { Readable } from 'node:stream'
import { expect, it, vi } from 'vitest'
import type { CredentialKey, CredentialProvider } from '@ocean/ocean-credentials'
import type { HostEpoch, HostId } from '../src/connect-protocol.ts'
import { DevicePairingPassword, pairingPasswordKey } from '../src/device-pairing-password.ts'
import { DeviceLogin } from '../src/device-login.ts'
import { DeviceTokens, deviceRegistryKey } from '../src/device-tokens.ts'
import { RecordCredentials } from './browser-credentials.ts'

const LISTENER = { host: '127.0.0.1', protocol: 'https:' } as const
const ORIGIN = 'https://ocean.example'
const IDENTITY = { hostId: 'host-fixture' as HostId, epoch: 'epoch-fixture' as HostEpoch }

/** The credential operations a device Home reads and writes. */
type HomeCredentials = Pick<CredentialProvider, 'readRecord' | 'modifyRecord' | 'deleteRecord'>

/** Route the two credential keys of a device Home to separate fixture records, as a real provider stores them. */
function home(): { credentials: HomeCredentials; tokens: RecordCredentials; passwords: RecordCredentials } {
  const tokens = new RecordCredentials()
  const passwords = new RecordCredentials()
  const records = new Map<CredentialKey, RecordCredentials>([[deviceRegistryKey, tokens], [pairingPasswordKey, passwords]])
  const record = (key: CredentialKey): RecordCredentials => {
    const found = records.get(key)
    if (found === undefined) throw new Error('unexpected credential key')
    return found
  }
  return {
    tokens, passwords,
    credentials: {
      readRecord: key => record(key).readRecord(),
      modifyRecord: (key, mutate) => record(key).modifyRecord(key, mutate),
      deleteRecord: key => record(key).deleteRecord(),
    },
  }
}

/** A DeviceLogin over the fixture registry with the shared trusted authority. */
function deviceLogin(credentials: HomeCredentials, overrides: {
  trustedHosts?: readonly string[]
  maxSessionsPerDevice?: number
  maxPairingPasswordAttemptsPerWindow?: number
  maxExchangesPerWindow?: number
} = {}): DeviceLogin {
  return new DeviceLogin(new DeviceTokens(credentials), new DevicePairingPassword(credentials), {
    trustedHosts: overrides.trustedHosts ?? ['ocean.example'],
    lifetimeMs: 60_000,
    maxSessionsPerDevice: overrides.maxSessionsPerDevice ?? 2,
    maxExchangesPerWindow: overrides.maxExchangesPerWindow ?? 10,
    maxPairingPasswordAttemptsPerWindow: overrides.maxPairingPasswordAttemptsPerWindow ?? 5,
    exchangeWindowMs: 60_000,
    identity: IDENTITY,
  })
}

/** A bodyless request carrying the given method and headers. */
function request(method: string, headers: Record<string, string>): IncomingMessage {
  const message = Readable.from([]) as IncomingMessage
  return Object.assign(message, { url: '/connect', method, headers })
}

/** A real response whose reply status, headers, and body the test reads back. */
function response() {
  const recorder = new ServerResponse(request('POST', {}))
  return { response: recorder, writeHead: vi.spyOn(recorder, 'writeHead'), end: vi.spyOn(recorder, 'end') }
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
  expect(call).not.toHaveProperty('ocean-device-pairing')
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
    const login = new DeviceLogin(new DeviceTokens(new RecordCredentials()), new DevicePairingPassword(new RecordCredentials()), {
      trustedHosts: ['ocean.example'], lifetimeMs: 60_000, maxSessionsPerDevice: 2,
      maxExchangesPerWindow: 2, maxPairingPasswordAttemptsPerWindow: 5, exchangeWindowMs: 10_000, identity: IDENTITY,
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

const PASSWORD = 'correct horse battery'
const IDENTITY_HEADERS = { 'ocean-device-protocol': '1', 'ocean-device-host': 'host-fixture', 'ocean-device-epoch': 'epoch-fixture' }

/** Encode a password the way a device sends it: base64url of its UTF-8 bytes. */
function encoded(password: string): string {
  return Buffer.from(password, 'utf8').toString('base64url')
}

/** Headers of a same-origin password pairing request. */
function passwordHeaders(password = PASSWORD, extra: Record<string, string> = {}): Record<string, string> {
  return exchangeHeaders({
    authorization: `Bearer ${encoded(password)}`,
    'ocean-device-pairing': 'password', 'ocean-device-label': 'Phone', ...extra,
  })
}

it('issues a device holding every scope to the pairing password, named by the label header', async () => {
  const devices = home()
  const login = deviceLogin(devices.credentials)
  await login.passwords.set(PASSWORD)
  const reply = response()
  await login.pair(request('POST', passwordHeaders(`  ${PASSWORD}  `, { 'ocean-device-host': 'host-fixture' })), reply.response, LISTENER)
  expect(reply.response.statusCode).toBe(200)
  expect(reply.writeHead.mock.calls[0]?.[1]).toEqual({
    ...IDENTITY_HEADERS, 'cache-control': 'no-store', 'content-type': 'application/json', 'ocean-device-pairing': 'password',
  })
  const device = JSON.parse(String(reply.end.mock.calls[0]?.[0])) as { id: string; token: string }
  expect(await login.tokens.verify(device.token)).toBe(device.id)
  expect(await login.tokens.list()).toEqual([{ id: device.id, label: 'Phone', revoked: false }])
  // A label may use every printable ASCII character up to the full length.
  const widest = response()
  await login.pair(request('POST', passwordHeaders(PASSWORD, { 'ocean-device-label': ` !~${'x'.repeat(124)}` })), widest.response, LISTENER)
  expect(widest.response.statusCode).toBe(200)
})

it('carries a non-ASCII password through its base64url encoding', async () => {
  const devices = home()
  const login = deviceLogin(devices.credentials)
  await login.passwords.set('пароль-секрет')
  const reply = response()
  await login.pair(request('POST', passwordHeaders('пароль-секрет')), reply.response, LISTENER)
  expect(reply.response.statusCode).toBe(200)
  expect((await login.tokens.list()).map(device => device.label)).toEqual(['Phone'])
})

it('answers 401 to a wrong password and 404 with the Host identity when none is set', async () => {
  const login = deviceLogin(home().credentials)
  const unset = response()
  await login.pair(request('POST', passwordHeaders()), unset.response, LISTENER)
  expect(unset.response.statusCode).toBe(404)
  expect(unset.writeHead.mock.calls[0]?.[1]).toEqual({
    ...IDENTITY_HEADERS, 'cache-control': 'no-store', 'ocean-device-pairing': 'password',
  })
  await login.passwords.set(PASSWORD)
  const wrong = response()
  await login.pair(request('POST', passwordHeaders('wrong password')), wrong.response, LISTENER)
  expect(wrong.response.statusCode).toBe(401)
  expect(wrong.writeHead.mock.calls[0]?.[1]).toEqual({ 'cache-control': 'no-store', 'ocean-device-pairing': 'password' })
  expect(await login.tokens.list()).toEqual([])
})

it('limits password attempts in their own window, counting right and wrong attempts alike', async () => {
  const clock = vi.spyOn(performance, 'now').mockReturnValue(1_000)
  try {
    const login = deviceLogin(home().credentials, { maxPairingPasswordAttemptsPerWindow: 2 })
    await login.passwords.set(PASSWORD)
    const statuses: number[] = []
    for (const [attempt, password] of [PASSWORD, 'wrong password', PASSWORD, 'wrong password'].entries()) {
      const reply = response()
      await login.pair(request('POST', passwordHeaders(password)), reply.response, LISTENER)
      statuses.push(reply.response.statusCode)
      if (attempt === 2) expect(reply.writeHead.mock.calls[0]?.[1]).toEqual({
        'cache-control': 'no-store', 'retry-after': '60', 'ocean-device-pairing': 'password',
      })
    }
    expect(statuses).toEqual([200, 401, 429, 429])
    // The grant budget is separate: pairing links still have their own window.
    const grant = response()
    await login.pair(request('POST', pairHeaders(`${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}.${'A'.repeat(43)}`)), grant.response, LISTENER)
    expect(grant.response.statusCode).toBe(401)
    clock.mockReturnValue(61_000)
    const reopened = response()
    await login.pair(request('POST', passwordHeaders(PASSWORD)), reopened.response, LISTENER)
    expect(reopened.response.statusCode).toBe(200)
  } finally {
    clock.mockRestore()
  }
})

it('fences password pairing like grant pairing and rejects a malformed label, bearer, or mode', async () => {
  const login = deviceLogin(home().credentials)
  const missingLabel = passwordHeaders()
  delete missingLabel['ocean-device-label']
  const missingBearer = passwordHeaders()
  delete missingBearer.authorization
  const cases: [string, string, Record<string, string>, number][] = [
    ['GET', 'method', passwordHeaders(), 405],
    ['POST', 'untrusted origin', passwordHeaders(PASSWORD, { origin: 'https://evil.example' }), 403],
    ['POST', 'protocol', passwordHeaders(PASSWORD, { 'ocean-device-protocol': '2' }), 409],
    ['POST', 'host identity', passwordHeaders(PASSWORD, { 'ocean-device-host': 'other-host' }), 412],
    ['POST', 'missing label', missingLabel, 400],
    ['POST', 'blank label', passwordHeaders(PASSWORD, { 'ocean-device-label': '   ' }), 400],
    ['POST', 'non-ASCII label', passwordHeaders(PASSWORD, { 'ocean-device-label': 'Телефон' }), 400],
    ['POST', 'overlong label', passwordHeaders(PASSWORD, { 'ocean-device-label': 'x'.repeat(129) }), 400],
    ['POST', 'missing bearer', missingBearer, 401],
    ['POST', 'bearer outside base64url', passwordHeaders(PASSWORD, { authorization: 'Bearer not+base64/url=' }), 400],
    ['POST', 'unknown mode', passwordHeaders(PASSWORD, { 'ocean-device-pairing': 'otp' }), 400],
  ]
  for (const [method, label, headers, status] of cases) {
    const reply = response()
    await login.pair(request(method, headers), reply.response, LISTENER)
    expect(reply.response.statusCode, label).toBe(status)
    // Every refusal of a request that selected password pairing names the mode, except the one that named no known mode.
    const named = reply.writeHead.mock.calls[0]?.[1] as Record<string, string>
    expect('ocean-device-pairing' in named, label).toBe(label !== 'unknown mode')
  }
  expect(await login.tokens.list()).toEqual([])
})

it('contains a credential-store failure during password pairing as 503 without record details', async () => {
  const devices = home()
  const login = deviceLogin(devices.credentials)
  await login.passwords.set(PASSWORD)
  const read = vi.spyOn(devices.passwords, 'readRecord').mockRejectedValue(new Error('private store detail'))
  const unreadable = response()
  await login.pair(request('POST', passwordHeaders()), unreadable.response, LISTENER)
  expect(unreadable.response.statusCode).toBe(503)
  expect(unreadable.writeHead).toHaveBeenCalledWith(503, { 'cache-control': 'no-store', 'ocean-device-pairing': 'password' })
  read.mockRestore()
  const verify = vi.spyOn(login.passwords, 'verify').mockRejectedValue(new Error('private store detail'))
  const unchecked = response()
  await login.pair(request('POST', passwordHeaders()), unchecked.response, LISTENER)
  expect(unchecked.response.statusCode).toBe(503)
  verify.mockRestore()
  const modify = vi.spyOn(devices.tokens, 'modifyRecord').mockRejectedValue(new Error('private store detail'))
  const unwritable = response()
  await login.pair(request('POST', passwordHeaders()), unwritable.response, LISTENER)
  expect(unwritable.response.statusCode).toBe(503)
  modify.mockRestore()
})
