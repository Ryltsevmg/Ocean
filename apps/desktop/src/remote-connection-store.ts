/** Main-process storage for the saved remote machines. */
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { writeFileAtomic } from '@ocean/ocean-atomic-write'
import { DeviceClient } from '@ocean/ocean-client-connection/device'
import { z } from 'zod'
import { HarnessError } from '@ocean/ocean-error'

const addressSchema = z.url().refine((value) => {
  const url = URL.parse(value)
  return url?.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
}, { abort: true })

const legacyConnectionSchema = z.strictObject({
  address: addressSchema,
  hostId: z.string().min(1),
  token: z.string().min(1),
})

const machineSchema = z.strictObject({
  hostId: z.string().min(1),
  routes: z.array(addressSchema).min(1),
  token: z.string().min(1),
})

const recordSchema = z.discriminatedUnion('version', [
  legacyConnectionSchema.extend({ version: z.literal(1) }),
  z.strictObject({ version: z.literal(2), connections: z.array(legacyConnectionSchema).min(1) }),
  z.strictObject({ version: z.literal(3), machines: z.array(machineSchema).min(1) }),
])

/** One saved Host: its stable identity, every address that reaches it, and one device token. */
export interface SavedRemoteMachine {
  /** Identity the Host reported; a login to any route must report the same one. */
  readonly hostId: string
  /** Addresses that reach this machine, in save order; the last one is the most recent route. */
  readonly routes: readonly string[]
  /** Device token, shared by every route because they reach one machine. */
  readonly token: string
}

/** A route and its machine, as the caller knows them before saving. */
export interface SavedRemoteRoute {
  readonly address: string
  readonly hostId: string
  readonly token: string
}

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

/** Normalize one saved or entered address to the mount form used for comparison. */
function mountOf(address: string): string {
  return DeviceClient.parseAddress(address).href
}

/** Owns the encrypted machine records under Electron userData. */
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

  /** @returns Saved machines in save order, each with normalized routes and no credentials beyond the token. */
  async machines(): Promise<SavedRemoteMachine[]> {
    return (await this.readMachines()).map(machine => ({
      hostId: machine.hostId, token: machine.token, routes: machine.routes.map(mountOf),
    }))
  }

  /** @returns Every saved route in machine and save order, without credentials. */
  async addresses(): Promise<string[]> {
    return (await this.machines()).flatMap(machine => machine.routes)
  }

  /**
   * @param address - Route to look up, or omit to read the most recently saved machine.
   * @returns The machine that route reaches, when saved.
   */
  async read(address?: string): Promise<SavedRemoteMachine | undefined> {
    const machines = await this.machines()
    if (address === undefined) return machines.at(-1)
    const mount = mountOf(address)
    return machines.find(machine => machine.routes.includes(mount))
  }

  /**
   * Save a verified route. An address always reaches one machine, so a route recorded for
   * another identity moves to this one, and a machine that loses its last route is dropped.
   * @param route - Verified address, Host identity and device token.
   * @returns After the encrypted record has been committed.
   */
  async save(route: SavedRemoteRoute): Promise<void> {
    if (!this.canSave) throw new RemoteConnectionStoreError('DESKTOP_REMOTE_STORAGE_UNAVAILABLE')
    if (!legacyConnectionSchema.safeParse(route).success) throw new RemoteConnectionStoreError('DESKTOP_REMOTE_STORAGE_INVALID')
    const mount = mountOf(route.address)
    await this.update(async () => {
      const existing = await this.readMachines()
      const moved = existing
        .filter(machine => machine.hostId !== route.hostId)
        .map(machine => ({ ...machine, routes: machine.routes.filter(saved => saved !== mount) }))
        .filter(machine => machine.routes.length > 0)
      const target = existing.find(machine => machine.hostId === route.hostId)
      const machine: z.infer<typeof machineSchema> = {
        hostId: route.hostId,
        token: route.token,
        routes: [...(target?.routes ?? []).filter(saved => saved !== mount), mount],
      }
      await this.writeMachines([...moved.filter(other => other.hostId !== route.hostId), machine])
    })
  }

  /**
   * Remove one route, keeping the machine while another route reaches it, or discard an unreadable file.
   * @param address - Saved route to remove. Omit only to discard an unreadable file.
   * @returns After the encrypted file has been updated or removed.
   */
  remove(address?: string): Promise<void> {
    return this.update(async () => {
      const machines = await this.readMachines().catch((error: unknown) => {
        if (address === undefined && error instanceof RemoteConnectionStoreError
          && (error.code === 'DESKTOP_REMOTE_STORAGE_UNAVAILABLE' || error.code === 'DESKTOP_REMOTE_STORAGE_INVALID')) return []
        throw error
      })
      const mount = address === undefined ? undefined : mountOf(address)
      const remaining = machines
        .map(machine => ({ ...machine, routes: machine.routes.filter(saved => saved !== mount) }))
        .filter(machine => machine.routes.length > 0)
      if (remaining.length > 0) {
        const changed = remaining.length < machines.length
          || remaining.some((machine, index) => machine.routes.length !== machines[index]?.routes.length)
        if (changed) await this.writeMachines(remaining)
        return
      }
      try { await rm(this.path, { force: true }) } catch (_error) {
        throw new RemoteConnectionStoreError('DESKTOP_REMOTE_STORAGE_REMOVE')
      }
    })
  }

  private update(operation: () => Promise<void>): Promise<void> {
    const next = this.pendingWrite.then(operation)
    this.pendingWrite = next.catch((_error: unknown) => {
      // The caller receives the failure; later updates may still run.
    })
    return next
  }

  private async readMachines(): Promise<z.infer<typeof machineSchema>[]> {
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
    if (record.data.version === 3) return record.data.machines
    const connections = record.data.version === 2 ? record.data.connections : [record.data]
    // Records saved before machines were grouped store one token per address; the last one wins.
    const machines = new Map<string, z.infer<typeof machineSchema>>()
    for (const connection of connections) {
      const mount = mountOf(connection.address)
      const machine = machines.get(connection.hostId)
      machines.set(connection.hostId, {
        hostId: connection.hostId,
        token: connection.token,
        routes: [...(machine?.routes ?? []).filter(saved => saved !== mount), mount],
      })
    }
    return [...machines.values()]
  }

  private async writeMachines(machines: z.infer<typeof machineSchema>[]): Promise<void> {
    let ciphertext: Buffer
    try { ciphertext = this.secrets.encryptString(JSON.stringify({ version: 3, machines })) } catch (_error) {
      // The encryption provider can include its input in diagnostics.
      throw new RemoteConnectionStoreError('DESKTOP_REMOTE_STORAGE_UNAVAILABLE')
    }
    try { await writeFileAtomic(this.path, ciphertext, { dirMode: 0o700, mode: 0o600 }) } catch (_error) {
      throw new RemoteConnectionStoreError('DESKTOP_REMOTE_STORAGE_WRITE')
    }
  }
}
