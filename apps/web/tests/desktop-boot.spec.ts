// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'

const boot = vi.hoisted(() => ({
  run: vi.fn(),
  applyIndexInjections: vi.fn(async () => {}),
}))
vi.mock('@ocean/ocean-client-web', () => ({
  AppWebEntry: class { run = boot.run },
  applyIndexInjections: boot.applyIndexInjections,
}))

type Route = { streamBaseUrl: string }

/** The Desktop transport the shell publishes; the route members exist only for a page that does not own its Host. */
type TransportHooks = {
  ownsHost: boolean
  streamBaseUrl: string
  forwardedPorts: number[]
  onConnectionLost?: () => void
  onRouteChanged?: (listener: () => void) => () => void
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  vi.resetModules()
  document.body.replaceChildren()
})

it.each([
  { ownsHost: true, streamBaseUrl: 'http://127.0.0.1:3080' },
  { ownsHost: false, streamBaseUrl: 'https://ocean.example/mount/' },
])('sets the Desktop transport and reports initialization failures for $streamBaseUrl', async (transport) => {
  document.body.innerHTML = '<div id="root"></div>'
  const gate = Promise.withResolvers<undefined>()
  const failed = vi.fn(async () => {})
  const onRouteChanged = vi.fn((_listener: (route: Route) => void) => () => {})
  const onForwardedPorts = vi.fn((_listener: (ports: number[]) => void) => () => {})
  vi.stubGlobal('__OCEAN_BOOT_READY__', gate)
  vi.stubGlobal('oceanDesktopBoot', {
    ready: async () => ({ injections: [], forwardedPorts: [], ...transport }),
    failed,
    connectionLost: vi.fn(),
    onRouteChanged,
    onForwardedPorts,
  })
  vi.stubGlobal('__OCEAN_TRANSPORT__', undefined)
  await import('../src/main.ts')
  await gate.promise
  // A page that owns its Host gets neither route member.
  const hooks = Reflect.get(globalThis, '__OCEAN_TRANSPORT__') as TransportHooks
  expect(hooks).toMatchObject({ ...transport, forwardedPorts: [] })
  expect(onForwardedPorts).toHaveBeenCalledOnce()
  expect(Object.keys(hooks).sort()).toEqual(transport.ownsHost
    ? ['forwardedPorts', 'ownsHost', 'streamBaseUrl']
    : ['forwardedPorts', 'onConnectionLost', 'onRouteChanged', 'ownsHost', 'streamBaseUrl'])
  expect(onRouteChanged).toHaveBeenCalledTimes(transport.ownsHost ? 0 : 1)
  expect(boot.applyIndexInjections).toHaveBeenCalledWith([], expect.any(Function))
  const report = boot.run.mock.calls[0]![0] as (reason: unknown) => void
  report(new Error('client plugin activation failed'))
  expect(failed).toHaveBeenCalledWith('client plugin activation failed')
})

it('reports Host loss and follows Desktop route changes for a page that does not own its Host', async () => {
  document.body.innerHTML = '<div id="root"></div>'
  const gate = Promise.withResolvers<undefined>()
  const connectionLost = vi.fn()
  const carrierListeners: Array<(route: Route) => void> = []
  const portListeners: Array<(ports: number[]) => void> = []
  vi.stubGlobal('__OCEAN_BOOT_READY__', gate)
  vi.stubGlobal('oceanDesktopBoot', {
    ready: async () => ({ injections: [], streamBaseUrl: 'https://ocean.example/mount/', ownsHost: false, forwardedPorts: [3000] }),
    failed: vi.fn(async () => {}),
    connectionLost,
    onRouteChanged: vi.fn((listener: (route: Route) => void) => { carrierListeners.push(listener); return () => {} }),
    onForwardedPorts: vi.fn((listener: (ports: number[]) => void) => { portListeners.push(listener); return () => {} }),
  })
  vi.stubGlobal('__OCEAN_TRANSPORT__', undefined)
  await import('../src/main.ts')
  await gate.promise
  const hooks = Reflect.get(globalThis, '__OCEAN_TRANSPORT__') as TransportHooks
  const onConnectionLost = hooks.onConnectionLost
  const onRouteChanged = hooks.onRouteChanged
  if (onConnectionLost === undefined || onRouteChanged === undefined) throw new Error('route hooks were not published')
  expect(carrierListeners).toHaveLength(1)
  expect(portListeners).toHaveLength(1)
  const carrier = carrierListeners[0]!
  expect(hooks.streamBaseUrl).toBe('https://ocean.example/mount/')
  // The palette reads the same list: it starts from boot and follows the carrier.
  expect(hooks.forwardedPorts).toEqual([3000])
  portListeners[0]!([3000, 5173])
  expect(hooks.forwardedPorts).toEqual([3000, 5173])

  onConnectionLost()
  expect(connectionLost).toHaveBeenCalledOnce()

  const listener = vi.fn()
  const remove = onRouteChanged(listener)
  carrier({ streamBaseUrl: 'https://other.example/mount/' })
  expect(hooks.streamBaseUrl).toBe('https://other.example/mount/')
  expect(listener).toHaveBeenCalledOnce()

  remove()
  carrier({ streamBaseUrl: 'https://third.example/mount/' })
  expect(hooks.streamBaseUrl).toBe('https://third.example/mount/')
  expect(listener).toHaveBeenCalledOnce()
})

it('rejects the shared boot wait when the Desktop Host cannot start', async () => {
  document.body.innerHTML = '<div id="root"></div>'
  const gate = Promise.withResolvers<undefined>()
  const failure = new Error('Host failed')
  const rejected = expect(gate.promise).rejects.toBe(failure)
  vi.stubGlobal('__OCEAN_BOOT_READY__', gate)
  vi.stubGlobal('oceanDesktopBoot', { ready: async () => { throw failure }, failed: vi.fn() })
  await import('../src/main.ts')
  await rejected
  expect(boot.applyIndexInjections).not.toHaveBeenCalled()
  expect(boot.run).toHaveBeenCalledWith(expect.any(Function))
})

it('leaves browser failure presentation with the Web boot kernel', async () => {
  document.body.innerHTML = '<div id="root"></div>'
  vi.stubGlobal('oceanDesktopBoot', undefined)
  await import('../src/main.ts')
  expect(boot.run).toHaveBeenCalledWith(undefined)
})

it.each(['root', 'readiness'])('reports missing %s before client plugin startup', async (missing) => {
  if (missing !== 'root') document.body.innerHTML = '<div id="root"></div>'
  const failed = vi.fn(async () => {})
  vi.stubGlobal('oceanDesktopBoot', { ready: vi.fn(), failed })
  vi.stubGlobal('__OCEAN_BOOT_READY__', undefined)
  await import('../src/main.ts')
  expect(failed).toHaveBeenCalledWith(missing === 'root'
    ? 'web app: missing #root' : 'desktop web: boot readiness is missing')
  expect(boot.run).not.toHaveBeenCalled()
})
