/** Browser entry for the Web client. */
import '@ocean/ocean-client-ui-theme/brand-font.css'
import { AppWebEntry, applyIndexInjections } from '@ocean/ocean-client-web'

interface DesktopBootGlobal {
  oceanDesktopBoot?: {
    failed(message: string): Promise<void>
    ready(): Promise<{
      injections: Parameters<typeof applyIndexInjections>[0]
      streamBaseUrl: string
      ownsHost: boolean
      forwardedPorts: number[]
    }>
    /** Tells the carrier that the page lost its Host; the carrier may answer with a route change. */
    connectionLost(): void
    /** Follows the carrier's route changes for the lifetime of the page. */
    onRouteChanged(listener: (route: { streamBaseUrl: string }) => void): () => void
    /** Follows the Host ports the carrier forwards to this computer's loopback. */
    onForwardedPorts(listener: (ports: number[]) => void): () => void
  }
}

/** The page transport as the connection plugin reads it; the route members carry route changes. */
interface DesktopTransport {
  ownsHost: boolean
  streamBaseUrl: string
  /** Loopback ports of this computer that reach the Host; empty outside Desktop and for a local Host. */
  forwardedPorts: number[]
  onConnectionLost?(): void
  onRouteChanged?(listener: () => void): () => void
}
const desktop = (globalThis as DesktopBootGlobal).oceanDesktopBoot
const reportFailure = (reason: unknown): void => {
  if (desktop === undefined) throw reason
  void desktop.failed(reason instanceof Error ? reason.message : String(reason)).catch(console.error)
}

try {
  const el = document.getElementById('root')
  if (el === null) throw new Error('web app: missing #root')
  const entry = new AppWebEntry(el)
  if (desktop !== undefined) {
    const gate = (globalThis as { __OCEAN_BOOT_READY__?: PromiseWithResolvers<void> }).__OCEAN_BOOT_READY__
    if (gate === undefined) throw new Error('desktop web: boot readiness is missing')
    void desktop.ready().then(async ({ injections, streamBaseUrl, ownsHost, forwardedPorts }) => {
      const transport = globalThis as { __OCEAN_TRANSPORT__?: DesktopTransport }
      const hooks: DesktopTransport = { ownsHost, streamBaseUrl, forwardedPorts }
      transport.__OCEAN_TRANSPORT__ = hooks
      desktop.onForwardedPorts((ports) => { hooks.forwardedPorts = ports })
      // A page that owns its Host has no other route to take.
      if (!ownsHost) {
        const routeListeners = new Set<() => void>()
        hooks.onConnectionLost = () => { desktop.connectionLost() }
        hooks.onRouteChanged = (listener) => { routeListeners.add(listener); return () => { routeListeners.delete(listener) } }
        desktop.onRouteChanged((route) => {
          hooks.streamBaseUrl = route.streamBaseUrl
          for (const listener of [...routeListeners]) listener()
        })
      }
      await applyIndexInjections(injections, src => new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = src
        script.onload = () => { resolve() }
        script.onerror = () => { reject(new Error(`desktop web: failed to load ${src}`)) }
        document.head.append(script)
      }))
      gate.resolve()
    }).catch((error: unknown) => { gate.reject(error) })
  }
  void entry.run(desktop === undefined ? undefined : reportFailure)
} catch (reason) {
  reportFailure(reason)
}
