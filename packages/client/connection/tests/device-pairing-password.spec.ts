/** Pairing password storage: a salted scrypt verifier, constant-time verification, and removal. */
import { expect, it } from 'vitest'
import { z } from 'zod'
import { DevicePairingPassword, DevicePairingPasswordError } from '../src/device-pairing-password.ts'
import { RecordCredentials } from './browser-credentials.ts'

const PASSWORD = 'correct horse battery'
const verifier = z.object({ version: z.literal(1), algorithm: z.literal('scrypt'), salt: z.string(), hash: z.string() })

/** The stored verifier of a credential home that holds a pairing password. */
async function storedVerifier(store: RecordCredentials): Promise<z.infer<typeof verifier>> {
  const record = store.record
  if (record?.kind !== 'grant') throw new Error('no pairing password record')
  return verifier.parse(record.payload)
}

it('verifies the stored password, trimming both sides, and refuses any other or an absent one', async () => {
  const store = new RecordCredentials()
  const passwords = new DevicePairingPassword(store)
  expect(await passwords.isSet()).toBe(false)
  expect(await passwords.verify(PASSWORD)).toBe(false)
  await passwords.set(`  ${PASSWORD}  `)
  expect(await passwords.verify(` ${PASSWORD} `)).toBe(true)
  expect(await passwords.verify('correct horse batterY')).toBe(false)
  expect(await passwords.isSet()).toBe(true)
  expect(JSON.stringify(store.record)).not.toContain(PASSWORD)
})

it('stores only a versioned scrypt verifier with a 16-byte salt and a 64-byte hash', async () => {
  const store = new RecordCredentials()
  await new DevicePairingPassword(store).set(PASSWORD)
  const record = store.record
  const stored = await storedVerifier(store)
  expect(record?.kind).toBe('grant')
  expect(stored.version).toBe(1)
  expect(stored.algorithm).toBe('scrypt')
  expect(stored.salt).toMatch(/^[0-9a-f]{32}$/u)
  expect(stored.hash).toMatch(/^[0-9a-f]{128}$/u)
})

it('salts every write, so the same password stores a different verifier each time', async () => {
  const store = new RecordCredentials()
  const passwords = new DevicePairingPassword(store)
  await passwords.set(PASSWORD)
  const first = await storedVerifier(store)
  await passwords.set(PASSWORD)
  const second = await storedVerifier(store)
  expect(second.salt).not.toBe(first.salt)
  expect(second.hash).not.toBe(first.hash)
  expect(await passwords.verify(PASSWORD)).toBe(true)
})

it('removes the record on clear, so verification fails again, and clearing an absent password succeeds', async () => {
  const store = new RecordCredentials()
  const passwords = new DevicePairingPassword(store)
  await passwords.clear()
  expect(store.modifies).toBe(0)
  await passwords.set(PASSWORD)
  await passwords.clear()
  expect(store.record).toBeUndefined()
  expect(await passwords.isSet()).toBe(false)
  expect(await passwords.verify(PASSWORD)).toBe(false)
})

it('rejects a password outside the rule before it reaches the credential store', async () => {
  const store = new RecordCredentials()
  const passwords = new DevicePairingPassword(store)
  for (const password of ['', 'short', 'x'.repeat(257), '   '.repeat(3)]) {
    await expect(passwords.set(password)).rejects.toBeInstanceOf(DevicePairingPasswordError)
  }
  expect(await passwords.verify('short')).toBe(false)
  expect(store.reads).toBe(0)
  expect(store.modifies).toBe(0)
  await expect(passwords.set('x'.repeat(256))).resolves.toBeUndefined()
})

it('fails closed on a stored record that is not a pairing password verifier', async () => {
  const store = new RecordCredentials()
  const passwords = new DevicePairingPassword(store)
  for (const record of [
    { kind: 'grant', payload: { version: 2 } },
    { kind: 'grant', payload: null },
    { kind: 'api-key', key: 'secret' },
  ] as const) {
    store.record = record
    await expect(passwords.isSet()).rejects.toThrow('invalid pairing password credential record')
    await expect(passwords.verify(PASSWORD)).rejects.toThrow('invalid pairing password credential record')
  }
  await passwords.set(PASSWORD)
  expect(await passwords.verify(PASSWORD)).toBe(true)
})

it('reports a provider that did not commit the verifier', async () => {
  const store = new RecordCredentials()
  store.discardWrites = true
  await expect(new DevicePairingPassword(store).set(PASSWORD)).rejects.toThrow('pairing password did not commit')
})
