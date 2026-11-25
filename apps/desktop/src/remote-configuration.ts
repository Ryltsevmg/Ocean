/** Deployment-owned limits for live Desktop remote Hosts. */
import { HarnessError } from '@ocean/ocean-error'

/** Explicit simultaneous remote-Host limit; local Host does not consume a slot. */
export interface DesktopRemoteConfig {
  readonly maxConnections: number
  /** Host ports forwarded to the same loopback ports of the selected remote Host; empty forwards none. */
  readonly forwardPorts: readonly number[]
}

const PORT = /^[1-9]\d{0,4}$/u

/** Read a comma-separated list of ports from 1 to 65535; an empty list forwards nothing. */
function resolveForwardPorts(raw: string | undefined): number[] {
  if (raw === undefined) return []
  const ports = raw.split(',').map(part => part.trim()).filter(part => part !== '')
  if (ports.some(port => !PORT.test(port) || Number(port) > 65_535)) {
    throw new HarnessError('OCEAN_DESKTOP_FORWARD_PORTS must be a comma-separated list of ports from 1 to 65535', 'DESKTOP_REMOTE_CONFIG_INVALID')
  }
  return [...new Set(ports.map(Number))]
}

/**
 * Resolve the live-connection limit and the forwarded Host ports before accepting remote connections.
 * @param env - Desktop process environment.
 * @returns A positive safe-integer limit and a list of ports; malformed configuration fails startup.
 */
export function resolveDesktopRemoteConfig(env: NodeJS.ProcessEnv): DesktopRemoteConfig {
  const raw = env.OCEAN_DESKTOP_MAX_REMOTE_HOSTS
  const maxConnections = Number(raw)
  if (raw !== undefined && (!/^[1-9]\d*$/u.test(raw) || !Number.isSafeInteger(maxConnections))) {
    throw new HarnessError('OCEAN_DESKTOP_MAX_REMOTE_HOSTS must be a positive safe integer', 'DESKTOP_REMOTE_CONFIG_INVALID')
  }
  return { maxConnections: raw === undefined ? 4 : maxConnections, forwardPorts: resolveForwardPorts(env.OCEAN_DESKTOP_FORWARD_PORTS) }
}
