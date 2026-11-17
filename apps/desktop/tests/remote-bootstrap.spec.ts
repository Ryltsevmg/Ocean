/** Remote release checks precede publication of bootstrap rows to a packaged renderer. */
import { afterEach, expect, it, vi } from 'vitest'
import { assertRemoteBootstrapRelease, RemoteBootstrapCompatibilityError } from '../src/remote-bootstrap.ts'
import { RemoteDesktopHost } from '../src/remote-host.ts'
import { remoteErrorResult } from '../src/remote-result.ts'
import { en } from '../src/locale.ts'

const boot = (release: unknown) => [{ kind: 'global', name: '__OCEAN_BOOT__', value: { release } }]
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

it('accepts matching releases and compares the commit when recorded', () => {
  expect(() => { assertRemoteBootstrapRelease(boot({ version: '1.2.3' }), { version: '1.2.3' }) }).not.toThrow()
  expect(() => {
    assertRemoteBootstrapRelease(boot({ version: '1.2.3', commit: 'abc' }), { version: '1.2.3', commit: 'abc' })
  }).not.toThrow()
})

it.each([
  [],
  boot(undefined),
  boot({ version: '1.2.4' }),
  boot({ version: '1.2.3', commit: 'other' }),
  boot({ version: '1.2.3', commit: '' }),
  boot({ version: '1.2.3', commit: 1 }),
  [...boot({ version: '1.2.3' }), ...boot({ version: '1.2.3' })],
].map(rows => ({ rows })))('refuses an absent, ambiguous, or incompatible release %#', ({ rows }) => {
  expect(() => { assertRemoteBootstrapRelease(rows, { version: '1.2.3' }) }).toThrow(RemoteBootstrapCompatibilityError)
})

it('refuses a Host missing the commit required by the packaged shell', () => {
  expect(() => { assertRemoteBootstrapRelease(boot({ version: '1.2.3' }), { version: '1.2.3', commit: 'abc' }) })
    .toThrow(RemoteBootstrapCompatibilityError)
})

it('logs out an incompatible login before its bootstrap can reach a view', async () => {
  vi.stubEnv('OCEAN_CLIENT_VERSION', '1.2.3')
  vi.stubEnv('OCEAN_CLIENT_COMMIT_HASH', 'abc')
  const send = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 204, headers: {
      'ocean-device-protocol': '1', 'ocean-device-host': 'fixture-host', 'ocean-device-epoch': 'fixture-epoch',
      'set-cookie': '__Host-ocean-device=fixture-login; Secure; HttpOnly',
    } }))
    .mockResolvedValueOnce(Response.json(boot({ version: '2.0.0', commit: 'abc' })))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', send)
  await expect(RemoteDesktopHost.connect('https://ocean.example/', 'fixture-token', new AbortController().signal))
    .rejects.toBeInstanceOf(RemoteBootstrapCompatibilityError)
  expect(send.mock.calls.map(([, init]) => init?.method ?? 'GET')).toEqual(['POST', 'GET', 'DELETE'])
  expect(remoteErrorResult(new RemoteBootstrapCompatibilityError(), en)).toEqual({
    kind: 'failed', code: 'DESKTOP_REMOTE_VERSION_INCOMPATIBLE', message: en.remoteProtocolIncompatible,
  })
})
