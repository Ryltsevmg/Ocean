/**
 * Wire types of the generated `devices` Remote namespace: the Host device
 * inventory and one owner-requested revocation. Client-safe: no Host imports,
 * so the same declarations reach the browser half unchanged.
 * @module @ocean/ocean-api-device-controller/types
 */

import type { Branded } from '@ocean/ocean-brand'
import type { DeviceScope } from '@ocean/ocean-client-connection/device'

export type { DeviceScope } from '@ocean/ocean-client-connection/device'

/**
 * Identifies one device record in the Host's device registry. The registry
 * mints it; every caller passes back an identifier it read from `devices.list`.
 */
export type DeviceId = Branded<'DeviceId'>

/**
 * One device as the owner-facing inventory reports it. No token, verifier, or
 * session secret reaches this type: the registry keeps those private.
 */
export interface DeviceRecord {
  readonly id: DeviceId
  /** Name the device received when its administrator created it. */
  readonly label: string
  /** Whether the device was revoked; a revoked device accepts no further login. */
  readonly revoked: boolean
  /**
   * Rights the device holds. Absent for a device created before scopes, which
   * holds every scope.
   */
  readonly scopes?: readonly DeviceScope[]
}

/** Target of one `devices.revoke` call. */
export interface DeviceRevokeRequest {
  /** Device to revoke, as `devices.list` reported it. */
  readonly id: DeviceId
}

/**
 * Receipt after the Host revoked a device. Live transports of the device are
 * already closed when this value is produced, so the caller needs no second
 * read to confirm the device is out.
 */
export interface DeviceRevokeValue {
  readonly id: DeviceId
  readonly revoked: true
}

declare module '@ocean/ocean-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** The Host device registry holds no record under that id. */
    'devices/not-found': { readonly id: DeviceId }
    /** This Host runs without a device registry, so it has no devices to administer. */
    'devices/unavailable': {}
  }
}
