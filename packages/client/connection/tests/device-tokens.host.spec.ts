/** Device credential persistence and independent revocation. */
import { expect, it, vi } from 'vitest'
import { DeviceLoginCapacityError, DeviceTokens } from '../src/device-tokens.ts'
import { RecordCredentials } from './browser-credentials.ts'

it('persists verifiers, rejects the wrong secret and revokes only the selected device', async () => {
  const store = new RecordCredentials()
  const first = new DeviceTokens(store)
  const laptop = await first.issue('Laptop')
  const phone = await first.issue('Phone')
  expect(JSON.stringify(store.record)).not.toContain(laptop.token.split('.')[1])
  const restarted = new DeviceTokens(store)
  expect(await restarted.verify(laptop.token)).toBe(laptop.id)
  expect(await restarted.verify(laptop.id + phone.token.slice(36))).toBeUndefined()
  expect(await first.revoke(laptop.id)).toBe(true)
  expect(await restarted.verify(laptop.token)).toBeUndefined()
  expect(await restarted.verify(phone.token)).toBe(phone.id)
})

it('fails closed on a malformed stored registry', async () => {
  const store = new RecordCredentials()
  const devices = new DeviceTokens(store)
  const device = await devices.issue('Laptop')
  store.record = { kind: 'grant', payload: { version: 2 } }
  await expect(devices.verify(device.token)).rejects.toThrow('invalid remote device credential record')
})

it('keeps a bounded login independent of the device bearer and invalidates it on revoke', async () => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(1_000)
  try {
    const store = new RecordCredentials()
    const devices = new DeviceTokens(store)
    const { id, token } = await devices.issue('Laptop')
    const origin = 'https://ocean.example'
    const limits = { lifetimeMs: 100, maxSessionsPerDevice: 1 }
    const login = await devices.exchange(token, origin, limits)
    if (login === undefined) throw new Error('device login was refused')
    await expect(devices.exchange(token, origin, limits)).rejects.toBeInstanceOf(DeviceLoginCapacityError)
    const restarted = new DeviceTokens(store)
    expect(await restarted.verifySession(login, origin)).toBe(id)
    expect(await restarted.verifySession(login, 'https://other.example')).toBeUndefined()
    expect(await restarted.verifySession(token, origin)).toBeUndefined()
    expect(await restarted.verify(login)).toBeUndefined()
    clock.mockReturnValue(1_100)
    expect(await restarted.verifySession(login, origin)).toBeUndefined()
    const replacement = await restarted.exchange(token, origin, limits)
    if (replacement === undefined) throw new Error('expired login did not release capacity')
    await devices.revoke(id)
    expect(await restarted.verifySession(replacement, origin)).toBeUndefined()
    expect(await restarted.exchange(token, origin, limits)).toBeUndefined()
  } finally {
    clock.mockRestore()
  }
})

it('rotates an active device without changing its identity or preserving old logins', async () => {
  const devices = new DeviceTokens(new RecordCredentials())
  const laptop = await devices.issue('Laptop')
  const phone = await devices.issue('Phone')
  const origin = 'https://ocean.example'
  const limits = { lifetimeMs: 60_000, maxSessionsPerDevice: 1 }
  const login = await devices.exchange(laptop.token, origin, limits)
  if (login === undefined) throw new Error('device login was refused')

  const replacement = await devices.rotate(laptop.id)
  if (replacement === undefined) throw new Error('active device rotation was refused')
  expect(await devices.verify(replacement)).toBe(laptop.id)
  expect(await devices.verify(laptop.token)).toBeUndefined()
  expect(await devices.verifySession(login, origin)).toBeUndefined()
  expect(await devices.verify(phone.token)).toBe(phone.id)
  expect(await devices.list()).toEqual([
    { id: laptop.id, label: 'Laptop', revoked: false },
    { id: phone.id, label: 'Phone', revoked: false },
  ])

  await devices.revoke(laptop.id)
  expect(await devices.rotate(laptop.id)).toBeUndefined()
})
