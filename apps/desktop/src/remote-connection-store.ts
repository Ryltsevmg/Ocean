/** Main-process storage for the saved remote Hosts. */
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { writeFileAtomic } from '@ocean/ocean-atomic-write'
import { DeviceClient } from '@ocean/ocean-client-connection/device'
import { z } from 'zod'
import { HarnessError } from '@ocean/ocean-error'

const connectionSchema = z.strictObject({
  address: z.url().refine((value) => {
    const url = URL.parse(value)
    return url?.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
  }, { abort: true }),
  hostId: z.string().min(1),
  token: z.string().min(1),
})

const recordSchema = z.discriminatedUnion('version', [
  connectionSchema.extend({ version: z.literal(1) }),
  z.strictObject({ version: z.literal(2), connections: z.array(connectionSchema).min(1) }),
])

/** Credentials remain in the main process. Address and Host identity are authenticated with the token. */
export type SavedRemoteConnection = z.infer<typeof connectionSchema>

/** Electron safeStorage operations used by the remote connection store. */
export interface RemoteSecretStorage {
  isEncryptionAvailable(): boolean
  getSelectedStorageBackend(): string
  encryptString(plaintext: string): Buffer
  decryptString(ciphertext: Buffer): string
}

/** Storage failures surfaced without including the credential or decrypted record. */
export class RemoteConnectionStoreError extends HarnessError {
  declare readonly code: 'DESKTOP_REMOTE_STORAGE_UNAVAILABLE' | 'DESKTOP_REMOTE_STORAGE_INVALID'
    | 'DESKTOP_REMOTE_STORAGE_READ' | 'DESKTOP_REMOTE_STORAGE_WRITE' | 'DESKTOP_REMOTE_STORAGE_REMOVE'
  /** @param code - Failure category for recovery or reporting. */
  constructor(code: RemoteConnectionStoreError['code']) {
    super(`Desktop remote connection storage: ${code}`, code)
  }
}

/** Owns the encrypted connection records under Electron userData. */
export class RemoteConnectionStore {
  private readonly path: string
  private pendingWrite = Promise.resolve()

  /**
   * @param userData - Electron userData directory.
   * @param secrets - Electron safeStorage, used after the app is ready.
   * @param platform - Platform used to determine whether the Linux backend check applies.
   */
  constructor(userData: string, private readonly secrets: RemoteSecretStorage, private readonly platform = process.platform) {
    this.path = join(userData, 'desktop', 'remote-connection.enc')
  }

  /** Whether protected saving is available for this process. */
  get canSave(): boolean {
    return this.secrets.isEncryptionAvailable()
      && (this.platform !== 'linux' || ['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6'].includes(this.secrets.getSelectedStorageBackend()))
  }

  /** @returns Saved HTTPS addresses in save order, without credentials. */
  async addresses(): Promise<string[]> {
    return (await this.readConnections()).map(connection => DeviceClient.parseAddress(connection.address).href)
  }

  /**
   * @param address - Mount to look up, or omit to read the most recently saved connection.
   * @returns The matching connection when saved.
   */
  async read(address?: string): Promise<SavedRemoteConnection | undefined> {
    const connections = await this.readConnections()
    if (address === undefined) return connections.at(-1)
    const mount = DeviceClient.parseAddress(address).href
    return connections.find(connection => DeviceClient.parseAddress(connection.address).href === mount)
  }

  private async readConnections(): Promise<SavedRemoteConnection[]> {
    let ciphertext: Buffer
    try { ciphertext = await readFile(this.path) } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw new RemoteConnectionStoreError('DESKTOP_REMOTE_STORAGE_READ')
    }
    if (!this.canSave) throw new RemoteConnectionStoreError('DESKTOP_REMOTE_STORAGE_UNAVAILABLE')
    let raw: unknown
    try { raw = JSON.parse(this.secrets.decryptString(ciphertext)) } catch (_error) {
      // Decryption and JSON errors can contain credential material.
      throw new RemoteConnectionStoreError('DESKTOP_REMOTE_STORAGE_INVALID')
    }
    const record = recordSchema.safeParse(raw)
    if (!record.success) throw new RemoteConnectionStoreError('DESKTOP_REMOTE_STORAGE_INVALID')
    if (record.data.version === 2) return record.data.connections
    const { address, hostId, token } = record.data
    return [{ address, hostId, token }]
  }

  /**
   * Upsert a verified address atomically after encryption.
   * @param connection - Verified Host address, identity and device token.
   * @returns After the encrypted record has been committed.
   */
  async save(connection: SavedRemoteConnection): Promise<void> {
    if (!this.canSave) throw new RemoteConnectionStoreError('DESKTOP_REMOTE_STORAGE_UNAVAILABLE')
    const record = connectionSchema.safeParse(connection)
    if (!record.success) throw new RemoteConnectionStoreError('DESKTOP_REMOTE_STORAGE_INVALID')
    const address = DeviceClient.parseAddress(record.data.address).href
    await this.update(async () => {
      const connections = (await this.readConnections()).filter(saved => DeviceClient.parseAddress(saved.address).href !== address)
      await this.writeConnections([...connections, { ...record.data, address }])
    })
  }

  private update(operation: () => Promise<void>): Promise<void> {
    const next = this.pendingWrite.then(operation)
    this.pendingWrite = next.catch((_error: unknown) => {
      // The caller receives the failure; later updates may still run.
    })
    return next
  }

  private async writeConnections(connections: SavedRemoteConnection[]): Promise<void> {
    let ciphertext: Buffer
    try { ciphertext = this.secrets.encryptString(JSON.stringify({ version: 2, connections })) } catch (_error) {
      // The encryption provider can include its input in diagnostics.
      throw new RemoteConnectionStoreError('DESKTOP_REMOTE_STORAGE_UNAVAILABLE')
    }
    try { await writeFileAtomic(this.path, ciphertext, { dirMode: 0o700, mode: 0o600 }) } catch (_error) {
      throw new RemoteConnectionStoreError('DESKTOP_REMOTE_STORAGE_WRITE')
    }
  }

  /**
   * Remove the selected connection, or discard an unreadable file.
   * @param address - Saved mount to remove. Omit only to discard an unreadable file.
   * @returns After the encrypted file has been updated or removed.
   */
  remove(address?: string): Promise<void> {
    return this.update(async () => {
      const connections = await this.readConnections().catch((error: unknown) => {
        if (address === undefined && error instanceof RemoteConnectionStoreError
          && (error.code === 'DESKTOP_REMOTE_STORAGE_UNAVAILABLE' || error.code === 'DESKTOP_REMOTE_STORAGE_INVALID')) return []
        throw error
      })
      const mount = address === undefined ? undefined : DeviceClient.parseAddress(address).href
      const remaining = connections.filter(saved => DeviceClient.parseAddress(saved.address).href !== mount)
      if (remaining.length > 0) {
        if (remaining.length < connections.length) await this.writeConnections(remaining)
        return
      }
      try { await rm(this.path, { force: true }) } catch (_error) {
        throw new RemoteConnectionStoreError('DESKTOP_REMOTE_STORAGE_REMOVE')
      }
    })
  }
}
