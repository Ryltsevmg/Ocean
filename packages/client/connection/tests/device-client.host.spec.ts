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
