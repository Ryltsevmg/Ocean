/** Inventory reads and revocations behind the Devices section. */

import { describe, expect, it, vi, type Mock } from 'vitest'
import { RemoteError } from '@ocean/ocean-client-test-runtime'
import type { DeviceId, DeviceRecord } from '@ocean/ocean-api-device-controller/types'
import { DevicesController, type DevicesRemote } from '../src/client/devices-controller.ts'

const LAPTOP = '11111111-1111-4111-8111-111111111111' as DeviceId
const PHONE = '22222222-2222-4222-8222-222222222222' as DeviceId

const laptop: DeviceRecord = { id: LAPTOP, label: 'Laptop', revoked: false, scopes: ['sessions:read'] }
const phone: DeviceRecord = { id: PHONE, label: 'Phone', revoked: false }

/** A `devices` face whose two calls the test scripts. */
function remote(): { readonly list: Mock<DevicesRemote['list']>; readonly revoke: Mock<DevicesRemote['revoke']> } {
  return { list: vi.fn<DevicesRemote['list']>(), revoke: vi.fn<DevicesRemote['revoke']>() }
}

describe('DevicesController', () => {
  it('starts loading and publishes the inventory a successful read returns', async () => {
    const devices = remote()
    const controller = new DevicesController(devices)
    expect(controller.state.getSnapshot()).toEqual({ status: 'loading', devices: [] })

    devices.list.mockResolvedValue({ ok: true, value: [laptop, phone] })
    const read = controller.reload()
    expect(controller.state.getSnapshot().status).toBe('loading')
    await read

    expect(controller.state.getSnapshot()).toEqual({ status: 'ready', devices: [laptop, phone] })
  })

  it('reports a refused read and a failed carrier the same way, keeping no rows', async () => {
    const devices = remote()
    const controller = new DevicesController(devices)
    devices.list.mockResolvedValue({ ok: false, error: new RemoteError('devices/unavailable', 'no registry', {}) })

    await controller.reload()
    expect(controller.state.getSnapshot()).toEqual({ status: 'failed', devices: [] })

    devices.list.mockRejectedValue(new Error('carrier closed'))
    await controller.reload()
    expect(controller.state.getSnapshot()).toEqual({ status: 'failed', devices: [] })
  })

  it('drops a read that a newer read superseded, so a retry cannot overwrite fresher rows', async () => {
    const devices = remote()
    const controller = new DevicesController(devices)
    const first = Promise.withResolvers<Awaited<ReturnType<DevicesRemote['list']>>>()
    devices.list.mockReturnValueOnce(first.promise)
    const stale = controller.reload()
    devices.list.mockResolvedValueOnce({ ok: true, value: [phone] })
    await controller.reload()

    first.resolve({ ok: true, value: [laptop] })
    await stale

    expect(controller.state.getSnapshot()).toEqual({ status: 'ready', devices: [phone] })
  })

  it('flips only the revoked row on an accepted receipt, without a second read', async () => {
    const devices = remote()
    const controller = new DevicesController(devices)
    devices.list.mockResolvedValue({ ok: true, value: [laptop, phone] })
    await controller.reload()
    const revoke = Promise.withResolvers<Awaited<ReturnType<DevicesRemote['revoke']>>>()
    devices.revoke.mockReturnValue(revoke.promise)

    const pending = controller.revoke(LAPTOP)
    expect(controller.state.getSnapshot().revoking).toBe(LAPTOP)
    revoke.resolve({ ok: true, value: { id: LAPTOP, revoked: true } })
    await pending

    const state = controller.state.getSnapshot()
    expect(state.revoking).toBeUndefined()
    expect(state.revokeFailed).toBeUndefined()
    expect(state.devices).toEqual([{ ...laptop, revoked: true }, phone])
    expect(devices.list).toHaveBeenCalledOnce()
  })

  it('keeps the row as it was and names it after a refused or failed revocation', async () => {
    const devices = remote()
    const controller = new DevicesController(devices)
    devices.list.mockResolvedValue({ ok: true, value: [laptop] })
    await controller.reload()

    devices.revoke.mockResolvedValue({ ok: false, error: new RemoteError('devices/not-found', 'gone', { id: LAPTOP }) })
    await controller.revoke(LAPTOP)
    expect(controller.state.getSnapshot()).toMatchObject({ revokeFailed: LAPTOP, devices: [laptop] })

    devices.revoke.mockRejectedValue(new Error('carrier closed'))
    await controller.revoke(LAPTOP)
    expect(controller.state.getSnapshot()).toMatchObject({ revokeFailed: LAPTOP, devices: [laptop] })

    // A retry clears the previous message before the call settles.
    const retry = Promise.withResolvers<Awaited<ReturnType<DevicesRemote['revoke']>>>()
    devices.revoke.mockReturnValue(retry.promise)
    const pending = controller.revoke(LAPTOP)
    expect(controller.state.getSnapshot().revokeFailed).toBeUndefined()
    retry.resolve({ ok: true, value: { id: LAPTOP, revoked: true } })
    await pending
    expect(controller.state.getSnapshot().devices).toEqual([{ ...laptop, revoked: true }])
  })

  it('ignores a second revocation while one is in flight', async () => {
    const devices = remote()
    const controller = new DevicesController(devices)
    devices.list.mockResolvedValue({ ok: true, value: [laptop, phone] })
    await controller.reload()
    const first = Promise.withResolvers<Awaited<ReturnType<DevicesRemote['revoke']>>>()
    devices.revoke.mockReturnValueOnce(first.promise)

    const pending = controller.revoke(LAPTOP)
    await controller.revoke(PHONE)
    expect(devices.revoke).toHaveBeenCalledOnce()

    first.resolve({ ok: true, value: { id: LAPTOP, revoked: true } })
    await pending
  })
})
