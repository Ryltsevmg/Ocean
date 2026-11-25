/** Choosing which route of a saved machine a sign-in uses. */
import { DeviceClient, type HostIdentity } from '@ocean/ocean-client-connection/device'

/** A saved machine whose other routes may answer when one does not. */
export interface RoutableMachine {
  /** Identity every route of this machine reports. */
  readonly hostId: string
  /** Saved routes in save order; the last is the most recent. */
  readonly routes: readonly string[]
}

/** How long one route gets to answer before the next is tried. A reachable Host answers in one round trip. */
export const ROUTE_PROBE_TIMEOUT_MS = 2_500

/** Ask one route which machine answers it, without sending a credential; the probe ends when its signal aborts. */
export type RouteProbe = (route: string, signal: AbortSignal) => Promise<HostIdentity>

/** The probe Desktop uses: a credential-free `HEAD /connect` through the device client. */
const probeRoute: RouteProbe = (route, signal): Promise<HostIdentity> => new DeviceClient(route).probe(signal)

/**
 * Order the routes of a machine for one sign-in.
 * @param machine - Saved machine.
 * @param preferred - Route to try first, normally the entered or the most recent address.
 * @returns Every route once: the preferred one, then the others from the most recent.
 */
export function orderedRoutes(machine: RoutableMachine, preferred: string): string[] {
  return [preferred, ...machine.routes.filter(route => route !== preferred).reverse()]
}

/**
 * Find the first route of a saved machine that answers as that machine.
 * A machine with one route is not probed: its sign-in alone reports why it fails.
 * @param machine - Saved machine whose identity a route must report to be chosen.
 * @param preferred - Route to try first.
 * @param signal - Cancellation of the whole sign-in.
 * @param probe - Credential-free identity check of one route.
 * @returns The first route that answers as the machine, else the preferred route.
 */
export async function answeringRoute(
  machine: RoutableMachine,
  preferred: string,
  signal: AbortSignal,
  probe: RouteProbe = probeRoute,
): Promise<string> {
  const routes = orderedRoutes(machine, preferred)
  if (routes.length === 1) return preferred
  for (const route of routes) {
    if (signal.aborted) return preferred
    try {
      const identity = await probe(route, AbortSignal.any([signal, AbortSignal.timeout(ROUTE_PROBE_TIMEOUT_MS)]))
      if (identity.id === machine.hostId) return route
    } catch (_error) {
      // A route that cannot be reached leaves the choice to the next one, as does one answering as another machine.
    }
  }
  return preferred
}
