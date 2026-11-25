/**
 * Host owner of the `devices` Remote namespace: the device inventory an owner
 * sees, and revocation of one device. Both methods read and write the device
 * registry through `ctx.connection`, so the namespace carries the same
 * authority as the local administrator socket: it lists identities, labels,
 * revocation state, and granted scopes, and it never carries a token, a
 * verifier, or a session secret. The namespace is owner-only by default — the
 * Gateway's `remote-device` policy allows only the actions its scope catalog
 * names, and `devices/*` is not one of them.
 * @module @ocean/ocean-api-device-controller
 */

import { Context } from '@deepseek-ai/cordis'
import { brandString } from '@ocean/ocean-brand'
import type { DeviceMetadata } from '@ocean/ocean-client-connection'
import { Remote, RemoteError, TypertRemoteService } from '@ocean/ocean-typert-protocol'
import type { DeviceId, DeviceRecord, DeviceRevokeRequest, DeviceRevokeValue } from './types.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of the `devices` Remote namespace. */
    deviceController: DeviceController
  }
}

/**
 * Read one registry identifier as this namespace's identifier. The registry is
 * the only mint of a device id, so carrying its brand across is an ownership
 * statement rather than validation.
 * @param id - identifier read from the Connection device registry.
 * @returns the same identifier under the `devices` namespace brand.
 */
function wireId(id: string): DeviceId {
  return brandString<DeviceId>(id)
}

/**
 * Project one registry row onto its wire record, field by field, so nothing the
 * registry keeps private reaches a caller.
 * @param device - one row read from the Connection device registry.
 * @returns the same facts under this namespace's branded identifier.
 */
function deviceRecord(device: DeviceMetadata): DeviceRecord {
  return {
    id: wireId(device.id),
    label: device.label,
    revoked: device.revoked,
    ...device.scopes === undefined ? {} : { scopes: device.scopes },
  }
}

/** Host service backing the generated `ctx.remote.devices` namespace. */
export class DeviceController extends TypertRemoteService {
  /**
   * Without a Connection there is no device registry to read, so the service
   * stays unactivated rather than failing the composition at load.
   */
  static inject = ['connection', 'typert']

  /** @param ctx - Host context carrying the Connection device registry. */
  constructor(ctx: Context) {
    super(ctx, 'deviceController', { namespace: 'devices' })
  }

  /**
   * List every device the Host's registry holds, revoked ones included, so an
   * owner can tell an active device from one that is already out.
   * @returns the inventory in registry order, without credential material.
   * @throws RemoteError `devices/unavailable` when this Host runs without a device registry.
   */
  @Remote('list')
  async list(): Promise<readonly DeviceRecord[]> {
    return (await this.inventory()).map(deviceRecord)
  }

  /**
   * Revoke one device through the Connection registry, which also closes the
   * device's live transports: the next login attempt is refused, and a Peer
   * that is already connected loses its leases. The id is resolved against the
   * registry first so an unknown device reports its own failure instead of
   * reading as an already-revoked one.
   * @param request - device to revoke, as `list` reported it.
   * @returns the receipt for a device that is now revoked.
   * @throws RemoteError `devices/not-found` for an id the registry does not hold, or
   *   `devices/unavailable` when this Host runs without a device registry.
   */
  @Remote('revoke')
  async revoke(request: DeviceRevokeRequest): Promise<DeviceRevokeValue> {
    const device = (await this.inventory()).find(candidate => wireId(candidate.id) === request.id)
    if (device === undefined) {
      throw new RemoteError('devices/not-found', `no device ${request.id} in this Host's registry`, { id: request.id })
    }
    await this.ctx.connection.revokeDevice(device.id)
    return { id: request.id, revoked: true }
  }

  /**
   * Read the registry inventory, reporting a Host without device login as its
   * own failure rather than as an empty registry.
   * @returns every device record the registry holds.
   * @throws RemoteError `devices/unavailable` when the Connection provides no device registry.
   */
  private async inventory(): Promise<readonly DeviceMetadata[]> {
    try {
      return await this.ctx.connection.listDevices()
    } catch (error) {
      throw new RemoteError('devices/unavailable', messageOf(error), {}, { cause: error })
    }
  }
}

/**
 * @param error - whatever the registry read threw.
 * @returns its message, or the value's own text.
 */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default DeviceController
