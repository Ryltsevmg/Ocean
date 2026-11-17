/** Deployment-owned limits for live Desktop remote Hosts. */
import { HarnessError } from '@ocean/ocean-error'

/** Explicit simultaneous remote-Host limit; local Host does not consume a slot. */
export interface DesktopRemoteConfig {
  readonly maxConnections: number
}

/**
 * Resolve the live-connection limit before accepting remote connections.
 * @param env - Desktop process environment.
 * @returns A positive safe-integer limit; malformed configuration fails startup.
 */
export function resolveDesktopRemoteConfig(env: NodeJS.ProcessEnv): DesktopRemoteConfig {
  const raw = env.OCEAN_DESKTOP_MAX_REMOTE_HOSTS
  if (raw === undefined) return { maxConnections: 4 }
  const maxConnections = Number(raw)
  if (!/^[1-9]\d*$/u.test(raw) || !Number.isSafeInteger(maxConnections)) {
    throw new HarnessError('OCEAN_DESKTOP_MAX_REMOTE_HOSTS must be a positive safe integer', 'DESKTOP_REMOTE_CONFIG_INVALID')
  }
  return { maxConnections }
}
