/** Remote release checks precede publication of bootstrap rows to a packaged renderer. */
import { afterEach, expect, it, vi } from 'vitest'
import { assertRemoteBootstrapRelease, RemoteBootstrapCompatibilityError } from '../src/remote-bootstrap.ts'
import { RemoteDesktopHost } from '../src/remote-host.ts'
import { remoteErrorResult } from '../src/remote-result.ts'
import { en } from '../src/locale.ts'

const boot = (release: unknown) => [{ kind: 'global', name: '__OCEAN_BOOT__', value: { release } }]
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

it('accepts the same version and returns the Host release, including a commit when recorded', () => {
  expect(assertRemoteBootstrapRelease(boot({ version: '1.2.3' }), { version: '1.2.3' })).toEqual({ version: '1.2.3' })
  expect(assertRemoteBootstrapRelease(boot({ version: '1.2.3', commit: 'abc' }), { version: '1.2.3', commit: 'abc' }))
    .toEqual({ version: '1.2.3', commit: 'abc' })
})

it('accepts builds of one version from different commits, or with a commit on only one side', () => {
  expect(assertRemoteBootstrapRelease(boot({ version: '1.2.3', commit: 'other' }), { version: '1.2.3', commit: 'abc' }))
    .toEqual({ version: '1.2.3', commit: 'other' })
  expect(assertRemoteBootstrapRelease(boot({ version: '1.2.3' }), { version: '1.2.3', commit: 'abc' })).toEqual({ version: '1.2.3' })
  expect(assertRemoteBootstrapRelease(boot({ version: '1.2.3', commit: 'abc' }), { version: '1.2.3' }))
    .toEqual({ version: '1.2.3', commit: 'abc' })
})

it.each([
  { description: 'an empty list', rows: [] },
  { description: 'a missing release', rows: boot(undefined) },
  { description: 'a release without a version', rows: boot({ commit: 'abc' }) },
  { description: 'a non-string version', rows: boot({ version: 1 }) },
  { description: 'an empty commit', rows: boot({ version: '1.2.3', commit: '' }) },
  { description: 'a non-string commit', rows: boot({ version: '1.2.3', commit: 1 }) },
  { description: 'a boot row without a value', rows: [{ kind: 'global', name: '__OCEAN_BOOT__' }] },
  { description: 'two boot graphs', rows: [...boot({ version: '1.2.3' }), ...boot({ version: '1.2.3' })] },
])('refuses $description without naming a Host version', ({ rows }) => {
  expect(() => { assertRemoteBootstrapRelease(rows, { version: '1.2.3' }) }).toThrow(RemoteBootstrapCompatibilityError)
  try { assertRemoteBootstrapRelease(rows, { version: '1.2.3' }) } catch (error) {
    expect(error).toMatchObject({ hostVersion: undefined, clientVersion: '1.2.3' })
  }
})

it('names both versions when the Host runs another one', () => {
  try { assertRemoteBootstrapRelease(boot({ version: '1.2.4', commit: 'abc' }), { version: '1.2.3', commit: 'abc' }) } catch (error) {
    expect(error).toBeInstanceOf(RemoteBootstrapCompatibilityError)
    expect(error).toMatchObject({ hostVersion: '1.2.4', clientVersion: '1.2.3' })
    expect(remoteErrorResult(error, en)).toEqual({
      kind: 'failed', code: 'DESKTOP_REMOTE_VERSION_INCOMPATIBLE',
      message: 'This Host runs Ocean 1.2.4 but this app is 1.2.3. Update the app or the server so both use the same version.',
    })
    return
  }
  throw new Error('a different version was accepted')
})

it('connects to a Host of the same version built from another commit and records the difference', async () => {
  vi.stubEnv('OCEAN_CLIENT_VERSION', '1.2.3')
  vi.stubEnv('OCEAN_CLIENT_COMMIT_HASH', 'abc')
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 204, headers: {
      'ocean-device-protocol': '1', 'ocean-device-host': 'fixture-host', 'ocean-device-epoch': 'fixture-epoch',
      'set-cookie': '__Host-ocean-device=fixture-login; Secure; HttpOnly',
    } }))
    .mockResolvedValueOnce(Response.json(boot({ version: '1.2.3', commit: 'def' }))))
  const host = await RemoteDesktopHost.connect('https://ocean.example/', 'fixture-token', new AbortController().signal)
  expect(host.hostId).toBe('fixture-host')
  expect(warn).toHaveBeenCalledOnce()
  expect(warn.mock.calls[0]![0]).toContain('runs 1.2.3 from commit def; this app was built from abc')
  warn.mockRestore()
})

it('stays quiet when the Host commit matches', async () => {
  vi.stubEnv('OCEAN_CLIENT_VERSION', '1.2.3')
  vi.stubEnv('OCEAN_CLIENT_COMMIT_HASH', 'abc')
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 204, headers: {
      'ocean-device-protocol': '1', 'ocean-device-host': 'fixture-host', 'ocean-device-epoch': 'fixture-epoch',
      'set-cookie': '__Host-ocean-device=fixture-login; Secure; HttpOnly',
    } }))
    .mockResolvedValueOnce(Response.json(boot({ version: '1.2.3', commit: 'abc' }))))
  await RemoteDesktopHost.connect('https://ocean.example/', 'fixture-token', new AbortController().signal)
  expect(warn).not.toHaveBeenCalled()
  warn.mockRestore()
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
