/** Device client checks Host identity before recovering the authenticated session. */
import { expect, it, vi } from 'vitest'
import { DeviceClient, DeviceClientError, DeviceProtocolVersionError, DeviceSessionRejectedError, DeviceSessionUnavailableError } from '../src/device-client.ts'

it.each([
  [401, {}, 'DEVICE_AUTH_REJECTED'],
  [412, {}, 'DEVICE_HOST_CHANGED'],
  [429, {}, 'DEVICE_RATE_LIMITED'],
  [503, { 'ocean-device-error': 'capacity' }, 'DEVICE_CAPACITY_EXCEEDED'],
  [500, {}, 'DEVICE_AUTH_FAILED'],
] as const)('classifies login HTTP %i without exposing the submitted token', async (status, headers, code) => {
  const client = new DeviceClient('https://ocean.example/', async () => new Response(null, { status, headers }))
  await expect(client.login('fixture-secret', new AbortController().signal)).rejects.toMatchObject({ name: 'DeviceClientError', code })
})

it('classifies invalid addresses and network failures while preserving cancellation', async () => {
  expect(() => new DeviceClient('not-an-address')).toThrow(DeviceClientError)
  const cause = new Error('network failure')
  const client = new DeviceClient('https://ocean.example/', async () => { throw cause })
  await expect(client.login('fixture-secret', new AbortController().signal)).rejects.toMatchObject({
    code: 'DEVICE_CONNECTION_FAILED', cause,
  })
  const cancel = new AbortController()
  cancel.abort(new Error('cancelled by caller'))
  await expect(client.login('fixture-secret', cancel.signal)).rejects.toBe(cancel.signal.reason)
})

it('resolves both spellings of a mount to the same credential address', () => {
  expect(DeviceClient.parseAddress('https://ocean.example/mount').href)
    .toBe(DeviceClient.parseAddress('https://ocean.example/mount/').href)
  expect(DeviceClient.parseAddress('https://ocean.example/other').href)
    .not.toBe(DeviceClient.parseAddress('https://ocean.example/mount/').href)
  expect(() => DeviceClient.parseAddress('https://ocean.example/mount?redirect=other')).toThrow('HTTPS URL')
})

it('reuses its login across an epoch change and refuses a different Host', async () => {
  const calls: Array<{ url: string; request: RequestInit | undefined }> = []
  const host = (id: string, epoch: string, cookie?: string) => new Response(null, {
    status: 204,
    headers: {
      'ocean-device-protocol': '1',
      'ocean-device-host': id,
      'ocean-device-epoch': epoch,
      ...(cookie === undefined ? {} : { 'set-cookie': cookie }),
    },
  })
  const fetcher = vi.fn<typeof fetch>(async (url, request) => {
    calls.push({ url: url instanceof URL ? url.href : url instanceof Request ? url.url : url, request })
    if (calls.length === 1) return host('first', 'one', '__Host-ocean-device=login; Secure; HttpOnly')
    if (calls.length === 2) return host('first', 'two')
    return host('different', 'one')
  })
  const client = new DeviceClient('https://ocean.example/mount', fetcher)
  const signal = new AbortController().signal
  expect(await client.login('device-token', signal)).toEqual({ id: 'first', epoch: 'one' })
  const socket = { readyState: 0, send() {}, close() {}, addEventListener() {}, removeEventListener() {} }
  const connect = vi.fn(() => socket)
  expect(client.openSocket('/api/remote.mux', connect)).toBe(socket)
  expect(connect).toHaveBeenCalledWith(new URL('wss://ocean.example/mount/api/remote.mux'), '__Host-ocean-device=login')
  expect(() => client.openSocket('///another.example/api', connect)).toThrow('Invalid Ocean socket route')
  expect(connect).toHaveBeenCalledTimes(1)
  expect(await client.identify(signal)).toEqual({ id: 'first', epoch: 'two' })
  await expect(client.identify(signal)).rejects.toThrow('Host identity changed')
  expect(() => client.request('session/list', '{}', signal)).toThrow('sign-in is required')
  expect(calls).toMatchObject([
    { url: 'https://ocean.example/mount/connect', request: { redirect: 'error', headers: { authorization: 'Bearer device-token' } } },
    { request: { method: 'HEAD', headers: { cookie: '__Host-ocean-device=login' } } },
    { request: { method: 'HEAD' } },
  ])
})

it('does not send a saved token when the address reports a different Host', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => new Response(null, {
    status: 204,
    headers: { 'ocean-device-protocol': '1', 'ocean-device-host': 'replacement', 'ocean-device-epoch': 'launch' },
  }))
  const client = new DeviceClient('https://ocean.example/', fetcher)
  const signal = new AbortController().signal
  await expect(client.login('fixture-token', signal, 'saved')).rejects.toThrow('Host identity changed')
  expect(fetcher.mock.calls.map(([, request]) => request)).toEqual([
    { method: 'HEAD', headers: { 'ocean-device-protocol': '1' }, redirect: 'error', signal },
  ])
})

it('stops saved-token sign-in when the Host rejects the client protocol', async () => {
  const fetcher = vi.fn<typeof fetch>(async () => new Response(null, {
    status: 409, headers: { 'ocean-device-protocol': '2' },
  }))
  const client = new DeviceClient('https://ocean.example/', fetcher)
  const signal = new AbortController().signal
  await expect(client.login('fixture-token', signal, 'saved')).rejects.toBeInstanceOf(DeviceProtocolVersionError)
  expect(() => client.transportCredentials()).toThrow('sign-in is required')
  expect(fetcher.mock.calls.map(([, request]) => request)).toEqual([
    { method: 'HEAD', headers: { 'ocean-device-protocol': '1' }, redirect: 'error', signal },
  ])
})

it('includes the verified Host identity as a precondition of saved-token exchange', async () => {
  const headers = { 'ocean-device-protocol': '1', 'ocean-device-host': 'saved', 'ocean-device-epoch': 'launch' }
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 204, headers }))
    .mockResolvedValueOnce(new Response(null, { status: 412 }))
  const client = new DeviceClient('https://ocean.example/', fetcher)
  await expect(client.login('fixture-token', new AbortController().signal, 'saved')).rejects.toThrow('Host identity changed')
  expect(fetcher.mock.calls[1]?.[1]).toMatchObject({
    method: 'POST', redirect: 'error', headers: { 'ocean-device-host': 'saved' },
  })
})

it.each(['identify', 'bootstrap'] as const)('requires a new sign-in when %s rejects the saved login', async (method) => {
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, {
      status: 204,
      headers: {
        'ocean-device-protocol': '1', 'ocean-device-host': 'host', 'ocean-device-epoch': 'epoch',
        'set-cookie': '__Host-ocean-device=login; Secure; HttpOnly',
      },
    }))
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
  const client = new DeviceClient('https://ocean.example/', fetcher)
  const signal = new AbortController().signal
  await client.login('fixture-token', signal)
  await expect(client[method](signal)).rejects.toBeInstanceOf(DeviceSessionUnavailableError)
  expect(client.transportCredentials().cookie).toBe('__Host-ocean-device=login')
  await expect(client[method](signal)).rejects.toBeInstanceOf(DeviceSessionRejectedError)
  await expect(client.identify(signal)).rejects.toThrow('sign-in is required')
  expect(() => client.transportCredentials()).toThrow('sign-in is required')
  expect(fetcher).toHaveBeenCalledTimes(3)
})

/** A compatible login response issuing the named session cookie. */
function loginResponse(cookie: string): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'ocean-device-protocol': '1', 'ocean-device-host': 'host', 'ocean-device-epoch': 'epoch',
      'set-cookie': `__Host-ocean-device=${cookie}; Secure; HttpOnly`,
    },
  })
}

it('refuses a login without a compatible identity or exactly one session cookie', async () => {
  const signal = new AbortController().signal
  const identity = { 'ocean-device-protocol': '1', 'ocean-device-host': 'host', 'ocean-device-epoch': 'epoch' }
  const noIdentity = new DeviceClient('https://ocean.example/', async () => new Response(null, { status: 204 }))
  await expect(noIdentity.login('fixture-token', signal)).rejects.toMatchObject({ code: 'DEVICE_IDENTITY_INVALID' })
  const noCookie = new DeviceClient('https://ocean.example/', async () => new Response(null, { status: 204, headers: identity }))
  await expect(noCookie.login('fixture-token', signal)).rejects.toMatchObject({ code: 'DEVICE_IDENTITY_INVALID' })
  const foreignCookie = new DeviceClient('https://ocean.example/', async () => new Response(null, {
    status: 204, headers: { ...identity, 'set-cookie': 'other-cookie=value; Secure' },
  }))
  await expect(foreignCookie.login('fixture-token', signal)).rejects.toMatchObject({ code: 'DEVICE_IDENTITY_INVALID' })
  const twoCookieHeaders = new Headers(identity)
  twoCookieHeaders.append('set-cookie', '__Host-ocean-device=one; Secure')
  twoCookieHeaders.append('set-cookie', '__Host-ocean-device=two; Secure')
  const twoCookies = new DeviceClient('https://ocean.example/', async () => new Response(null, {
    status: 204, headers: twoCookieHeaders,
  }))
  await expect(twoCookies.login('fixture-token', signal)).rejects.toMatchObject({ code: 'DEVICE_IDENTITY_INVALID' })
})

it('treats a plain 503 login response as temporary unavailability', async () => {
  const client = new DeviceClient('https://ocean.example/', async () => new Response(null, { status: 503 }))
  await expect(client.login('fixture-token', new AbortController().signal))
    .rejects.toBeInstanceOf(DeviceSessionUnavailableError)
})

it('reads bootstrap injections and classifies malformed or failed bootstrap responses', async () => {
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(loginResponse('login'))
    .mockResolvedValueOnce(Response.json([{ kind: 'global', name: 'fixture', value: 1 }]))
    .mockResolvedValueOnce(new Response('not json', { status: 200 }))
    .mockResolvedValueOnce(Response.json({ rows: [] }))
    .mockResolvedValueOnce(new Response('unavailable', { status: 500 }))
    .mockResolvedValueOnce(new Response(null, { status: 502 }))
  const client = new DeviceClient('https://ocean.example/mount', fetcher)
  const signal = new AbortController().signal
  await client.login('fixture-token', signal)
  expect(await client.bootstrap(signal)).toEqual([{ kind: 'global', name: 'fixture', value: 1 }])
  expect(fetcher.mock.calls[1]?.[0]).toEqual(new URL('https://ocean.example/mount/connect/bootstrap'))
  await expect(client.bootstrap(signal)).rejects.toMatchObject({ code: 'DEVICE_BOOTSTRAP_INVALID' })
  await expect(client.bootstrap(signal)).rejects.toMatchObject({ code: 'DEVICE_BOOTSTRAP_INVALID' })
  await expect(client.bootstrap(signal)).rejects.toMatchObject({
    code: 'DEVICE_BOOTSTRAP_FAILED', message: 'Ocean Host bootstrap failed (HTTP 500)',
  })
  await expect(client.bootstrap(signal)).rejects.toMatchObject({ code: 'DEVICE_BOOTSTRAP_FAILED' })
})

it('sends authenticated unary requests only to canonical endpoints', async () => {
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(loginResponse('login'))
    .mockResolvedValueOnce(Response.json({ ok: true }))
  const client = new DeviceClient('https://ocean.example/mount', fetcher)
  const signal = new AbortController().signal
  await client.login('fixture-token', signal)
  expect(() => client.request('session/list extra', '{}', signal)).toThrow('Invalid Ocean RPC endpoint')
  expect(() => client.request('session', '{}', signal)).toThrow('Invalid Ocean RPC endpoint')
  const response = await client.request('session/list', '{"args":[]}', signal)
  expect(response.status).toBe(200)
  expect(fetcher.mock.calls[1]?.[0]).toEqual(new URL('https://ocean.example/mount/api/session/list'))
  expect(fetcher.mock.calls[1]?.[1]).toMatchObject({
    method: 'POST',
    headers: { cookie: '__Host-ocean-device=login', 'content-type': 'application/json' },
    body: '{"args":[]}',
  })
})

it('logs out once and discards the local cookie even without a login', async () => {
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(loginResponse('login'))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
  const client = new DeviceClient('https://ocean.example/', fetcher)
  const signal = new AbortController().signal
  await client.logout(signal)
  expect(fetcher).not.toHaveBeenCalled()
  await client.login('fixture-token', signal)
  await client.logout(signal)
  expect(fetcher.mock.calls[1]?.[1]).toMatchObject({
    method: 'DELETE',
    headers: { cookie: '__Host-ocean-device=login', 'ocean-device-protocol': '1' },
  })
  expect(() => client.transportCredentials()).toThrow('sign-in is required')
})

it('classifies a rejected logout as an authentication failure', async () => {
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(loginResponse('login'))
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
  const client = new DeviceClient('https://ocean.example/', fetcher)
  const signal = new AbortController().signal
  await client.login('fixture-token', signal)
  await expect(client.logout(signal)).rejects.toMatchObject({ code: 'DEVICE_AUTH_REJECTED' })
  expect(() => client.transportCredentials()).toThrow('sign-in is required')
})

it('keeps a newer login when an older session check is rejected', async () => {
  const pending = Promise.withResolvers<Response>()
  const fetcher = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(loginResponse('first'))
    .mockImplementationOnce(() => pending.promise)
    .mockResolvedValueOnce(loginResponse('preflight'))
    .mockResolvedValueOnce(loginResponse('second'))
  const client = new DeviceClient('https://ocean.example/', fetcher)
  const signal = new AbortController().signal
  await client.login('fixture-token', signal)
  const stale = client.identify(signal)
  await client.login('replacement-token', signal)
  pending.resolve(new Response(null, { status: 401 }))
  await expect(stale).rejects.toBeInstanceOf(DeviceSessionRejectedError)
  expect(client.transportCredentials().cookie).toBe('__Host-ocean-device=second')
})

const PAIRING_GRANT = `${'a'.repeat(8)}-aaaa-4aaa-8aaa-${'a'.repeat(12)}.${'B'.repeat(43)}`
const PAIRED_TOKEN = `${'c'.repeat(8)}-cccc-4ccc-8ccc-${'c'.repeat(12)}.${'D'.repeat(43)}`
const identityHeaders = { 'ocean-device-protocol': '1', 'ocean-device-host': 'host-one', 'ocean-device-epoch': 'epoch-one' }

it('exchanges a pairing grant for a device token and reports the issuing Host', async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = []
  const client = new DeviceClient('https://ocean.example/mount', async (url, init) => {
    calls.push({ url: url instanceof URL ? url.href : url instanceof Request ? url.url : url, init })
    return Response.json({ id: 'device-id', token: PAIRED_TOKEN }, { headers: identityHeaders })
  })
  const paired = await client.pair(PAIRING_GRANT, new AbortController().signal)
  expect(paired).toEqual({ id: 'device-id', token: PAIRED_TOKEN, host: { id: 'host-one', epoch: 'epoch-one' } })
  expect(calls).toHaveLength(1)
  expect(calls[0]!.url).toBe('https://ocean.example/mount/connect/pair')
  expect(calls[0]!.init).toMatchObject({
    method: 'POST', redirect: 'error',
    headers: { authorization: `Bearer ${PAIRING_GRANT}`, 'ocean-device-protocol': '1' },
  })
})

it.each([
  [401, 'DEVICE_PAIRING_REJECTED'],
  [404, 'DEVICE_PAIRING_UNSUPPORTED'],
  [405, 'DEVICE_PAIRING_UNSUPPORTED'],
  [412, 'DEVICE_HOST_CHANGED'],
  [429, 'DEVICE_RATE_LIMITED'],
  [403, 'DEVICE_AUTH_FAILED'],
  [500, 'DEVICE_AUTH_FAILED'],
] as const)('classifies pairing HTTP %i without exposing the grant', async (status, code) => {
  const client = new DeviceClient('https://ocean.example/', async () => new Response(null, { status }))
  const failure = await client.pair(PAIRING_GRANT, new AbortController().signal).catch((error: unknown) => error)
  expect(failure).toMatchObject({ name: 'DeviceClientError', code })
  expect((failure as Error).message).not.toContain(PAIRING_GRANT)
})

it('classifies a pairing protocol mismatch and an unavailable credential store', async () => {
  const mismatch = new DeviceClient('https://ocean.example/', async () => new Response(null, { status: 409 }))
  await expect(mismatch.pair(PAIRING_GRANT, new AbortController().signal)).rejects.toBeInstanceOf(DeviceProtocolVersionError)
  const unavailable = new DeviceClient('https://ocean.example/', async () => new Response(null, { status: 503 }))
  await expect(unavailable.pair(PAIRING_GRANT, new AbortController().signal)).rejects.toBeInstanceOf(DeviceSessionUnavailableError)
})

it('treats a Host that answers without a device identity as lacking pairing', async () => {
  const client = new DeviceClient('https://ocean.example/', async () => new Response('<html></html>', { status: 200 }))
  await expect(client.pair(PAIRING_GRANT, new AbortController().signal)).rejects.toMatchObject({
    code: 'DEVICE_PAIRING_UNSUPPORTED',
  })
})

it.each([
  ['not json', 'text/plain'],
  [JSON.stringify({ id: 'device-id' }), 'application/json'],
  [JSON.stringify({ id: 1, token: PAIRED_TOKEN }), 'application/json'],
  [JSON.stringify({ id: 'device-id', token: 'short' }), 'application/json'],
  [JSON.stringify(null), 'application/json'],
])('rejects a malformed pairing reply %s', async (body, type) => {
  const client = new DeviceClient('https://ocean.example/', async () => new Response(body, {
    status: 200, headers: { ...identityHeaders, 'content-type': type },
  }))
  await expect(client.pair(PAIRING_GRANT, new AbortController().signal)).rejects.toMatchObject({ code: 'DEVICE_IDENTITY_INVALID' })
})

it('keeps cancellation and network failures distinct while pairing', async () => {
  const cause = new Error('network failure')
  const client = new DeviceClient('https://ocean.example/', async () => { throw cause })
  await expect(client.pair(PAIRING_GRANT, new AbortController().signal)).rejects.toMatchObject({
    code: 'DEVICE_CONNECTION_FAILED', cause,
  })
})

it('probes the Host identity without sending a credential', async () => {
  const calls: Array<{ url: string; request: RequestInit | undefined }> = []
  const fetcher = vi.fn<typeof fetch>(async (url, request) => {
    const href = url instanceof URL ? url.href : url instanceof Request ? url.url : url
    calls.push({ url: href, request })
    return new Response(null, {
      status: 204,
      headers: { 'ocean-device-protocol': '1', 'ocean-device-host': 'probe-host', 'ocean-device-epoch': 'probe-epoch' },
    })
  })
  const client = new DeviceClient('https://ocean.example/mount', fetcher)
  expect(await client.probe(new AbortController().signal)).toEqual({ id: 'probe-host', epoch: 'probe-epoch' })
  expect(calls).toHaveLength(1)
  expect(calls[0]?.url).toBe('https://ocean.example/mount/connect')
  expect(calls[0]?.request?.method).toBe('HEAD')
  expect(calls[0]?.request?.redirect).toBe('error')
  // No authorization, cookie, or pinned identity is sent: the probe reveals the Host, not the client.
  expect(calls[0]?.request?.headers).toEqual({ 'ocean-device-protocol': '1' })
})

it('reports a probe of a Host that is not a compatible device endpoint', async () => {
  const reply = (status: number, headers: Record<string, string>) => new DeviceClient(
    'https://ocean.example/', async () => new Response(null, { status, headers }),
  )
  // Only the 204 the device endpoint answers to HEAD counts as a compatible reply.
  await expect(reply(200, {}).probe(new AbortController().signal)).rejects.toMatchObject({ code: 'DEVICE_AUTH_FAILED' })
  await expect(reply(204, {}).probe(new AbortController().signal)).rejects.toMatchObject({ code: 'DEVICE_IDENTITY_INVALID' })
  await expect(reply(204, { 'ocean-device-protocol': '2', 'ocean-device-host': 'h', 'ocean-device-epoch': 'e' })
    .probe(new AbortController().signal)).rejects.toMatchObject({ code: 'DEVICE_IDENTITY_INVALID' })
  await expect(reply(401, {}).probe(new AbortController().signal)).rejects.toMatchObject({ code: 'DEVICE_AUTH_REJECTED' })
  await expect(reply(500, {}).probe(new AbortController().signal)).rejects.toMatchObject({ code: 'DEVICE_AUTH_FAILED' })
})
