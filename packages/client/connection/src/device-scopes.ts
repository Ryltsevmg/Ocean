/** Rights a device holds on a Host; the Gateway maps each name to Remote actions. */

/** Every scope a Host can grant, in the order documentation lists them. */
export const DEVICE_SCOPES = [
  'sessions:read',
  'sessions:write',
  'files:read',
  'files:write',
  'terminal:operate',
  'settings:manage',
] as const

/** One right a device may hold. */
export type DeviceScope = typeof DEVICE_SCOPES[number]

/**
 * Validate scope names supplied by an administrator.
 * @param names - Scope names as typed; duplicates are allowed.
 * @returns The distinct scopes in catalog order.
 * @throws {Error} When a name is not a scope or no scope is named.
 */
export function parseDeviceScopes(names: readonly string[]): DeviceScope[] {
  if (names.length === 0) throw new Error('client-connection: name at least one device scope')
  const unknown = names.filter(name => !(DEVICE_SCOPES as readonly string[]).includes(name))
  if (unknown.length > 0) {
    throw new Error(`client-connection: unknown device scope ${JSON.stringify(unknown[0])}; use ${DEVICE_SCOPES.join(', ')}`)
  }
  return DEVICE_SCOPES.filter(scope => names.includes(scope))
}
