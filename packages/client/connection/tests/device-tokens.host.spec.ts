/** Device credential persistence and independent revocation. */
import { expect, it, vi } from 'vitest'
import { DeviceLoginCapacityError, DevicePairingCapacityError, DeviceTokens } from '../src/device-tokens.ts'
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

it('refuses malformed bearers at every credential entry point', async () => {
  const store = new RecordCredentials()
  const devices = new DeviceTokens(store)
  const { id, token } = await devices.issue('Laptop')
  const secret = token.slice(37)
  const origin = 'https://ocean.example'
  const limits = { lifetimeMs: 60_000, maxSessionsPerDevice: 1 }
  const malformed = [
    'short',
    `${id}X${secret}`,
    `${'x'.repeat(36)}.${secret}`,
    `${id}.${'!'.repeat(43)}`,
  ]
  for (const bearer of malformed) {
    expect(await devices.verify(bearer)).toBeUndefined()
    expect(await devices.exchange(bearer, origin, limits)).toBeUndefined()
    expect(await devices.verifySession(bearer, origin)).toBeUndefined()
    expect(await devices.readSession(bearer, origin)).toBeUndefined()
    expect(await devices.endSession(bearer, origin)).toBeUndefined()
  }
  expect(store.reads).toBe(0)
})

it('fails closed when the registry key holds a foreign record kind', async () => {
  const store = new RecordCredentials()
  const devices = new DeviceTokens(store)
  const { token } = await devices.issue('Laptop')
  store.record = { kind: 'api-key', key: 'foreign credential' }
  await expect(devices.verify(token)).rejects.toThrow('invalid remote device credential record')
})

it('reports issuance that did not commit', async () => {
  const store = new RecordCredentials()
  store.discardWrites = true
  await expect(new DeviceTokens(store).issue('Laptop')).rejects.toThrow('remote device issuance did not commit')
})

it('rejects invalid login limits before reading or writing storage', async () => {
  const store = new RecordCredentials()
  const devices = new DeviceTokens(store)
  for (const limits of [
    { lifetimeMs: 0, maxSessionsPerDevice: 1 },
    { lifetimeMs: 1.5, maxSessionsPerDevice: 1 },
    { lifetimeMs: Number.MAX_SAFE_INTEGER + 1, maxSessionsPerDevice: 1 },
    { lifetimeMs: 100, maxSessionsPerDevice: 0 },
    { lifetimeMs: 100, maxSessionsPerDevice: -1 },
  ]) {
    await expect(devices.exchange('unused', 'https://ocean.example', limits))
      .rejects.toThrow('invalid device login limits')
  }
  expect(store.reads).toBe(0)
  expect(store.modifies).toBe(0)
})

it('returns the scoped logout key when no matching login exists and keeps other devices intact', async () => {
  const store = new RecordCredentials()
  const devices = new DeviceTokens(store)
  const laptop = await devices.issue('Laptop')
  const phone = await devices.issue('Phone')
  const origin = 'https://ocean.example'
  const limits = { lifetimeMs: 60_000, maxSessionsPerDevice: 2 }
  const login = await devices.exchange(laptop.token, origin, limits)
  if (login === undefined) throw new Error('device login was refused')

  // A parseable bearer for an absent device changes nothing but still names the scoped key.
  const absent = '00000000-0000-4000-8000-000000000099'
  expect(await devices.endSession(`${absent}.${'a'.repeat(43)}`, origin))
    .toEqual({ deviceId: absent, origin, verifier: expect.any(String) as string })
  // A login at another origin is not removed.
  const otherOrigin = 'https://other.example'
  expect(await devices.endSession(login, otherOrigin))
    .toEqual({ deviceId: laptop.id, origin: otherOrigin, verifier: expect.any(String) as string })
  expect(await devices.verifySession(login, origin)).toBe(laptop.id)

  // Removing one device's login leaves the other device record untouched.
  expect(await devices.endSession(login, origin))
    .toEqual({ deviceId: laptop.id, origin, verifier: expect.any(String) as string })
  expect(await devices.verifySession(login, origin)).toBeUndefined()
  expect(await devices.verify(laptop.token)).toBe(laptop.id)
  expect(await devices.list()).toEqual([
    { id: laptop.id, label: 'Laptop', revoked: false },
    { id: phone.id, label: 'Phone', revoked: false },
  ])
})

it('reports a logout that did not commit', async () => {
  const store = new RecordCredentials()
  const devices = new DeviceTokens(store)
  const { id, token } = await devices.issue('Laptop')
  const origin = 'https://ocean.example'
  const login = await devices.exchange(token, origin, { lifetimeMs: 60_000, maxSessionsPerDevice: 1 })
  if (login === undefined) throw new Error('device login was refused')
  const stale = new DeviceTokens(uncommittedWrites(store))
  await expect(stale.endSession(login, origin)).rejects.toThrow('logout did not commit')
  expect(await devices.verifySession(login, origin)).toBe(id)
})

/** A provider that runs the requested update but keeps returning the pre-write record. */
function uncommittedWrites(store: RecordCredentials): ConstructorParameters<typeof DeviceTokens>[0] {
  return {
    readRecord: () => store.readRecord(),
    modifyRecord: async (_key, update) => {
      const current = store.record
      await update(current)
      return current
    },
  }
}

it('reports a rotation that did not commit', async () => {
  const store = new RecordCredentials()
  const devices = new DeviceTokens(store)
  const { id, token } = await devices.issue('Laptop')
  const stale = new DeviceTokens(uncommittedWrites(store))
  await expect(stale.rotate(id)).rejects.toThrow('remote device rotation did not commit')
  expect(await devices.verify(token)).toBe(id)
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

it('exchanges a pairing grant for one device once and keeps only its hash', async () => {
  const store = new RecordCredentials()
  const devices = new DeviceTokens(store)
  const grant = await devices.createPairing('Phone', 60_000)
  expect(JSON.stringify(store.record)).not.toContain(grant.secret.split('.')[1])
  const paired = await new DeviceTokens(store).redeemPairing(grant.secret)
  if (paired === undefined) throw new Error('the grant was refused')
  expect(await devices.verify(paired.token)).toBe(paired.id)
  expect(await devices.list()).toEqual([{ id: paired.id, label: 'Phone', revoked: false }])
  expect(await devices.redeemPairing(grant.secret)).toBeUndefined()
  expect(JSON.stringify(store.record)).not.toContain(grant.secret.split('.')[1])
})

it('refuses expired, wrong, malformed, and unknown pairing grants without creating a device', async () => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(1_000)
  try {
    const store = new RecordCredentials()
    const devices = new DeviceTokens(store)
    const grant = await devices.createPairing('Phone', 100)
    const wrong = `${grant.secret.slice(0, 37)}${'A'.repeat(43)}`
    expect(await devices.redeemPairing(wrong)).toBeUndefined()
    expect(await devices.redeemPairing('not-a-grant')).toBeUndefined()
    expect(await devices.redeemPairing(`${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}${grant.secret.slice(36)}`)).toBeUndefined()
    clock.mockReturnValue(1_100)
    expect(await devices.redeemPairing(grant.secret)).toBeUndefined()
    expect(await devices.list()).toEqual([])
  } finally {
    clock.mockRestore()
  }
})

it('bounds pending pairing grants and frees expired ones', async () => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(1_000)
  try {
    const devices = new DeviceTokens(new RecordCredentials())
    for (let index = 0; index < 16; index += 1) await devices.createPairing(`Device ${index}`, 100)
    await expect(devices.createPairing('One more', 100)).rejects.toBeInstanceOf(DevicePairingCapacityError)
    clock.mockReturnValue(1_100)
    await expect(devices.createPairing('After expiry', 100)).resolves.toMatchObject({ expiresAt: 1_200 })
  } finally {
    clock.mockRestore()
  }
})

it('rejects a non-positive pairing lifetime before writing', async () => {
  const store = new RecordCredentials()
  await expect(new DeviceTokens(store).createPairing('Phone', 0)).rejects.toThrow('invalid pairing lifetime')
  expect(store.record).toBeUndefined()
})

it('reports a pairing write the provider did not keep', async () => {
  const store = new RecordCredentials()
  const devices = new DeviceTokens(store)
  vi.spyOn(store, 'modifyRecord').mockResolvedValue(undefined)
  await expect(devices.createPairing('Phone', 60_000)).rejects.toThrow('pairing grant did not commit')
})

it('reports a redemption the provider did not keep', async () => {
  const store = new RecordCredentials()
  const devices = new DeviceTokens(store)
  const grant = await devices.createPairing('Phone', 60_000)
  const kept = structuredClone(store.record)
  vi.spyOn(store, 'modifyRecord').mockImplementation(async (_key, update) => {
    await update(kept)
    return kept
  })
  await expect(devices.redeemPairing(grant.secret)).rejects.toThrow('pairing redemption did not commit')
})

it('keeps scopes on a created device, lists them, and reports them on its login', async () => {
  const store = new RecordCredentials()
  const devices = new DeviceTokens(store)
  const limited = await devices.issue('Phone', ['sessions:read', 'files:read'])
  const full = await devices.issue('Laptop')
  expect(await devices.list()).toEqual([
    { id: limited.id, label: 'Phone', revoked: false, scopes: ['sessions:read', 'files:read'] },
    { id: full.id, label: 'Laptop', revoked: false },
  ])
  expect(JSON.stringify(store.record)).not.toContain('"scopes":null')
  const origin = 'https://ocean.example'
  const limits = { lifetimeMs: 60_000, maxSessionsPerDevice: 2 }
  const login = await devices.exchange(limited.token, origin, limits)
  const fullLogin = await devices.exchange(full.token, origin, limits)
  expect((await new DeviceTokens(store).readSession(login ?? '', origin))?.scopes).toEqual(['sessions:read', 'files:read'])
  expect(await devices.readSession(fullLogin ?? '', origin)).not.toHaveProperty('scopes')
})

it('carries a pairing grant\'s scopes to the device it creates and omits them when none were chosen', async () => {
  const devices = new DeviceTokens(new RecordCredentials())
  const narrow = await devices.createPairing('Phone', 60_000, ['sessions:read'])
  const broad = await devices.createPairing('Tablet', 60_000)
  const first = await devices.redeemPairing(narrow.secret)
  const second = await devices.redeemPairing(broad.secret)
  const listed = await devices.list()
  expect(listed.find(device => device.id === first?.id)?.scopes).toEqual(['sessions:read'])
  expect(listed.find(device => device.id === second?.id)).not.toHaveProperty('scopes')
})

it('refuses an empty or unknown scope list when reading the stored registry', async () => {
  const store = new RecordCredentials()
  const devices = new DeviceTokens(store)
  const { token } = await devices.issue('Phone', ['sessions:read'])
  const record = structuredClone(store.record) as { payload: { devices: { scopes?: unknown }[] } }
  record.payload.devices[0]!.scopes = ['not-a-scope']
  store.record = record as typeof store.record
  await expect(devices.verify(token)).rejects.toThrow('invalid remote device credential record')
  record.payload.devices[0]!.scopes = []
  await expect(devices.verify(token)).rejects.toThrow('invalid remote device credential record')
})
