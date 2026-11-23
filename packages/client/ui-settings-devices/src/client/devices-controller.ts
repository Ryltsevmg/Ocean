/**
 * Load and revocation state behind the Devices settings section. One read
 * replaces the whole inventory; a revocation flips only the row it answered
 * for, so an owner never waits for a second read to see the device leave.
 */

import { createSnapshotStore } from '@ocean/ocean-client-store'
import type { DeviceId, DeviceRecord, DeviceRevokeValue } from '@ocean/ocean-api-device-controller/types'
import type { RemoteResult } from '@ocean/ocean-api-remotes/client'

/** The generated `devices` namespace face the controller drives. */
export interface DevicesRemote {
  /** @returns every device the Host's registry holds, or the refusal. */
  list(): Promise<RemoteResult<readonly DeviceRecord[]>>
  /** @param request - device to revoke. @returns the receipt, or the refusal. */
  revoke(request: { readonly id: DeviceId }): Promise<RemoteResult<DeviceRevokeValue>>
}

/** What the section renders. */
export interface DevicesState {
  /** `loading` while a read is in flight, `failed` after a read that produced no inventory. */
  status: 'loading' | 'ready' | 'failed'
  /** Latest inventory; empty while loading and after a failed read. */
  devices: readonly DeviceRecord[]
  /** Device whose revocation is in flight; its row reports progress and offers no second action. */
  revoking?: DeviceId
  /** Device whose revocation failed; its row carries the message and offers Retry. */
  revokeFailed?: DeviceId
}

/** Reads and revokes devices for one section instance. */
export class DevicesController {
  /** Observable state the section subscribes to. */
  readonly state = createSnapshotStore<DevicesState>({ status: 'loading', devices: [] })

  private generation = 0

  /** @param remote - the generated `devices` namespace face. */
  constructor(private readonly remote: DevicesRemote) {}

  /**
   * Read the inventory again. A read that a newer read superseded publishes
   * nothing, so a retry pressed during the first attempt cannot overwrite the
   * rows that attempt is still waiting for.
   * @returns completion after this read settles.
   */
  async reload(): Promise<void> {
    const generation = ++this.generation
    this.state.update((state) => { state.status = 'loading' })
    let result: RemoteResult<readonly DeviceRecord[]> | undefined
    try {
      result = await this.remote.list()
    } catch (_carrierFailure) {
      // A carrier failure and a refused read reach the user the same way: the section offers Retry.
    }
    if (generation !== this.generation) return
    const devices = result?.ok === true ? result.value : undefined
    this.state.update((state) => {
      state.status = devices === undefined ? 'failed' : 'ready'
      state.devices = devices ?? []
    })
  }

  /**
   * Revoke one device the owner confirmed. The accepted receipt is the whole
   * update: the row becomes revoked without a second read, and a refusal keeps
   * the row as it was with its own message.
   * @param id - device to revoke.
   * @returns completion after the call settles.
   */
  async revoke(id: DeviceId): Promise<void> {
    if (this.state.getSnapshot().revoking !== undefined) return
    this.state.update((state) => {
      state.revoking = id
      delete state.revokeFailed
    })
    let revoked = false
    try {
      revoked = (await this.remote.revoke({ id })).ok
    } catch (_carrierFailure) {
      // A carrier failure reads as a refused revocation: the row reports it and offers Retry.
    }
    this.state.update((state) => {
      delete state.revoking
      if (!revoked) {
        state.revokeFailed = id
        return
      }
      delete state.revokeFailed
      state.devices = state.devices.map(device => device.id === id ? { ...device, revoked: true } : device)
    })
  }
}
