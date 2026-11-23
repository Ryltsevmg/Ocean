import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import * as atomic from '@ocean/ocean-atomic-write'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { RemoteConnectionStore } from '../src/remote-connection-store.ts'

vi.mock('node:fs/promises', async (original) => {
  const filesystem = await original<typeof import('node:fs/promises')>()
  return { ...filesystem, readFile: vi.fn(filesystem.readFile), rm: vi.fn(filesystem.rm) }
})
vi.mock('@ocean/ocean-atomic-write', async (original) => {
  const implementation = await original<typeof import('@ocean/ocean-atomic-write')>()
  return { ...implementation, writeFileAtomic: vi.fn(implementation.writeFileAtomic) }
})

const connection = { address: 'https://ocean.example/', hostId: 'test-host', token: 'test-fixture-token' }
const machine = { hostId: 'test-host', routes: ['https://ocean.example/'], token: 'test-fixture-token' }
const roots: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  vi.mocked(readFile).mockReset()
  vi.mocked(rm).mockReset()
  vi.mocked(atomic.writeFileAtomic).mockReset()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(backend = 'kwallet6') {
  const root = await mkdtemp(join(tmpdir(), 'ocean-remote-store-'))
  roots.push(root)
  const output = Buffer.from('fake-keyring-output')
  let plaintext = ''
  const secrets = {
    isEncryptionAvailable: () => true,
    getSelectedStorageBackend: () => backend,
    encryptString: vi.fn((value: string) => {
      plaintext = value
      return output
    }),
    decryptString: vi.fn((input: Buffer) => {
      if (!input.equals(output)) throw new Error('fake provider detail')
      return plaintext
    }),
  }
  return { root, output, secrets, store: new RemoteConnectionStore(root, secrets, 'linux') }
}

it('commits only encrypted bytes and restores the matching address, Host and token', async () => {
  const { root, output, secrets, store } = await fixture()
  expect(await store.read()).toBeUndefined()
  await store.save(connection)
  expect(await readFile(join(root, 'desktop', 'remote-connection.enc'))).toEqual(output)
  expect(await new RemoteConnectionStore(root, secrets, 'linux').read()).toEqual(machine)
  await store.remove(connection.address)
  expect(await store.read()).toBeUndefined()
})

it('refuses Linux basic_text before invoking encryption or creating a file', async () => {
  const { secrets, store } = await fixture('basic_text')
  expect(store.canSave).toBe(false)
  await expect(store.save(connection)).rejects.toMatchObject({ code: 'DESKTOP_REMOTE_STORAGE_UNAVAILABLE' })
  expect(secrets.encryptString).not.toHaveBeenCalled()
  expect(await store.read()).toBeUndefined()
})

it('rejects an unprotected address and contains decryption errors', async () => {
  const { root, secrets, store } = await fixture()
  await expect(store.save({ ...connection, address: 'http://ocean.example/' })).rejects.toMatchObject({ code: 'DESKTOP_REMOTE_STORAGE_INVALID' })
  expect(secrets.encryptString).not.toHaveBeenCalled()
  await store.save(connection)
  await writeFile(join(root, 'desktop', 'remote-connection.enc'), 'corrupt')
  await expect(store.read()).rejects.toMatchObject({ code: 'DESKTOP_REMOTE_STORAGE_INVALID', message: 'Desktop remote connection storage: DESKTOP_REMOTE_STORAGE_INVALID' })
})

it('loads a legacy record and preserves independent mounts across saves and removal', async () => {
  const { root, secrets, store } = await fixture()
  const legacy = { ...connection, address: 'https://ocean.example/first' }
  const path = join(root, 'desktop', 'remote-connection.enc')
  await store.save(connection)
  await writeFile(path, secrets.encryptString(JSON.stringify({ ...legacy, version: 1 })))
  expect(await store.read('https://ocean.example/first/')).toEqual({
    hostId: legacy.hostId, routes: ['https://ocean.example/first/'], token: legacy.token,
  })

  const second = { address: 'https://ocean.example/second/', hostId: 'other-host', token: 'second-fixture-token' }
  const third = { address: 'https://different.example/', hostId: 'third-host', token: 'third-fixture-token' }
  await Promise.all([store.save(second), store.save(third)])
  const reopened = new RemoteConnectionStore(root, secrets, 'linux')
  expect(await reopened.addresses()).toEqual([legacy.address + '/', second.address, third.address])
  expect(await reopened.read()).toEqual({ hostId: 'third-host', routes: [third.address], token: third.token })
  expect(await reopened.read(second.address)).toEqual({ hostId: 'other-host', routes: [second.address], token: second.token })
  const legacyMachine = { hostId: legacy.hostId, routes: ['https://ocean.example/first/'], token: legacy.token }
  expect(await reopened.read(legacy.address)).toEqual(legacyMachine)
  await reopened.remove('https://ocean.example/second')
  expect(await reopened.read(second.address)).toBeUndefined()
  expect(await reopened.read(legacy.address)).toEqual(legacyMachine)
})

it('rejects malformed decrypted records and allows their explicit removal', async () => {
  const { root, secrets, store } = await fixture()
  await store.save(connection)
  await writeFile(join(root, 'desktop', 'remote-connection.enc'), secrets.encryptString('{"version":2,"connections":[]}'))
  await expect(store.addresses()).rejects.toMatchObject({ code: 'DESKTOP_REMOTE_STORAGE_INVALID' })
  await store.remove()
  expect(await store.addresses()).toEqual([])
})

it('reports read, write, and removal failures without copying filesystem diagnostics', async () => {
  const { store } = await fixture()
  vi.mocked(readFile).mockRejectedValueOnce(new Error('fixture-secret'))
  await expect(store.read()).rejects.toMatchObject({ code: 'DESKTOP_REMOTE_STORAGE_READ' })
  vi.mocked(atomic.writeFileAtomic).mockRejectedValueOnce(new Error('fixture-secret'))
  await expect(store.save(connection)).rejects.toMatchObject({ code: 'DESKTOP_REMOTE_STORAGE_WRITE' })
  await store.save(connection)
  vi.mocked(rm).mockRejectedValueOnce(new Error('fixture-secret'))
  await expect(store.remove(connection.address)).rejects.toMatchObject({ code: 'DESKTOP_REMOTE_STORAGE_REMOVE' })
  expect(await store.read()).toEqual(machine)
})

it('contains encryption failures and preserves an existing record', async () => {
  const { store, secrets } = await fixture()
  await store.save(connection)
  secrets.encryptString.mockImplementationOnce(() => { throw new Error('fixture-secret') })
  await expect(store.save({ ...connection, token: 'replacement-fixture' })).rejects.toMatchObject({
    code: 'DESKTOP_REMOTE_STORAGE_UNAVAILABLE', message: 'Desktop remote connection storage: DESKTOP_REMOTE_STORAGE_UNAVAILABLE',
  })
  expect(await store.read()).toEqual(machine)
})

it('keeps one token and one identity for every route that reaches the same machine', async () => {
  const { root, secrets, store } = await fixture()
  await store.save({ address: 'https://ocean.example/', hostId: 'test-host', token: 'lan-fixture-token' })
  await store.save({ address: 'https://bigpc.tail71ee4f.ts.net/', hostId: 'test-host', token: 'tailnet-fixture-token' })
  const reopened = new RemoteConnectionStore(root, secrets, 'linux')
  expect(await reopened.machines()).toEqual([{
    hostId: 'test-host',
    routes: ['https://ocean.example/', 'https://bigpc.tail71ee4f.ts.net/'],
    token: 'tailnet-fixture-token',
  }])
  // Either route resolves the machine, so a login over one address uses the token saved from the other.
  expect(await reopened.read('https://ocean.example/')).toEqual(await reopened.read('https://bigpc.tail71ee4f.ts.net/'))
  await reopened.save({ address: 'https://ocean.example/', hostId: 'test-host', token: 'lan-fixture-token' })
  expect(await reopened.read('https://bigpc.tail71ee4f.ts.net/')).toMatchObject({ token: 'lan-fixture-token' })
})

it('moves a route to the machine that now answers there and drops a machine left without routes', async () => {
  const { root, secrets, store } = await fixture()
  await store.save({ address: 'https://ocean.example/', hostId: 'old-host', token: 'old-fixture-token' })
  await store.save({ address: 'https://ocean.example/', hostId: 'new-host', token: 'new-fixture-token' })
  const reopened = new RemoteConnectionStore(root, secrets, 'linux')
  expect(await reopened.machines()).toEqual([{ hostId: 'new-host', routes: ['https://ocean.example/'], token: 'new-fixture-token' }])
  expect(await reopened.read('https://ocean.example/')).toMatchObject({ hostId: 'new-host' })
})

it('keeps a machine while another route still reaches it', async () => {
  const { root, secrets, store } = await fixture()
  await store.save({ address: 'https://ocean.example/', hostId: 'test-host', token: 'test-fixture-token' })
  await store.save({ address: 'https://bigpc.tail71ee4f.ts.net/', hostId: 'test-host', token: 'test-fixture-token' })
  const reopened = new RemoteConnectionStore(root, secrets, 'linux')
  await reopened.remove('https://ocean.example/')
  expect(await reopened.machines()).toEqual([{
    hostId: 'test-host', routes: ['https://bigpc.tail71ee4f.ts.net/'], token: 'test-fixture-token',
  }])
  await reopened.remove('https://bigpc.tail71ee4f.ts.net/')
  expect(await reopened.machines()).toEqual([])
  await expect(readFile(join(root, 'desktop', 'remote-connection.enc'))).rejects.toMatchObject({ code: 'ENOENT' })
})

it('groups routes saved by an earlier release under one machine', async () => {
  const { root, secrets, store } = await fixture()
  await store.save(connection)
  const path = join(root, 'desktop', 'remote-connection.enc')
  await writeFile(path, secrets.encryptString(JSON.stringify({
    version: 2,
    connections: [
      { address: 'https://ocean.example/', hostId: 'test-host', token: 'first-fixture-token' },
      { address: 'https://bigpc.tail71ee4f.ts.net/', hostId: 'test-host', token: 'second-fixture-token' },
      { address: 'https://different.example/', hostId: 'other-host', token: 'third-fixture-token' },
    ],
  })))
  const reopened = new RemoteConnectionStore(root, secrets, 'linux')
  expect(await reopened.machines()).toEqual([
    { hostId: 'test-host', routes: ['https://ocean.example/', 'https://bigpc.tail71ee4f.ts.net/'], token: 'second-fixture-token' },
    { hostId: 'other-host', routes: ['https://different.example/'], token: 'third-fixture-token' },
  ])
})

it('leaves the record untouched when the address was never saved', async () => {
  const { root, store } = await fixture()
  await store.save(connection)
  const path = join(root, 'desktop', 'remote-connection.enc')
  const before = await readFile(path)
  await store.remove('https://elsewhere.example/')
  expect(await readFile(path)).toEqual(before)
  expect(await store.machines()).toEqual([machine])
})

it('discards an unreadable record when the caller omits the address', async () => {
  const { root, secrets, store } = await fixture()
  const path = join(root, 'desktop', 'remote-connection.enc')
  await store.save(connection)
  await writeFile(path, secrets.encryptString('not json'))
  await store.remove()
  await expect(readFile(path)).rejects.toMatchObject({ code: 'ENOENT' })
})

it('reports an unreadable record when removing one address', async () => {
  const { root, secrets, store } = await fixture()
  await store.save(connection)
  await writeFile(join(root, 'desktop', 'remote-connection.enc'), secrets.encryptString('not json'))
  await expect(store.remove(connection.address)).rejects.toMatchObject({ code: 'DESKTOP_REMOTE_STORAGE_INVALID' })
})

it('refuses to read an existing record when protected storage is unavailable', async () => {
  const { root, secrets } = await fixture()
  await new RemoteConnectionStore(root, secrets, 'linux').save(connection)
  const blocked = new RemoteConnectionStore(root, secrets, 'linux')
  vi.spyOn(blocked, 'canSave', 'get').mockReturnValue(false)
  await expect(blocked.read()).rejects.toMatchObject({ code: 'DESKTOP_REMOTE_STORAGE_UNAVAILABLE' })
})
