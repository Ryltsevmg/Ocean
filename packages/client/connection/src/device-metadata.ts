/**
 * Device identity and administrative inventory metadata, with no credential
 * material. Declared apart from the registry so both compiler faces can name
 * them: the Host handle's device methods expose these types, and a Client
 * program reaches that handle through the transport contract.
 *
 * @module @ocean/ocean-client-connection/device-metadata
 */

import { z } from 'zod'
import type { DeviceScope } from './device-scopes.ts'

/** Validate an identifier supplied by the local administrator. */
export const deviceId = z.uuid().brand<'DeviceId'>()

/** Validated device identifier from the credential registry. */
export type DeviceId = z.infer<typeof deviceId>

/** Administrative device inventory without credential hashes or login secrets. */
export interface DeviceMetadata {
  readonly id: DeviceId
  readonly label: string
  readonly revoked: boolean
  /** Rights the device holds; absent for a device created before scopes, which holds every scope. */
  readonly scopes?: readonly DeviceScope[]
}
