/** Pairing password kept as a salted scrypt verifier, so a device can pair without a one-time link. */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { credentialKey, type CredentialProvider } from '@ocean/ocean-credentials'
import { HarnessError } from '@ocean/ocean-error'
import { z } from 'zod'

/** An acceptable pairing password once trimmed: long enough to resist guessing and short enough to type. */
export const pairingPassword = z.string().trim().min(8).max(256)

/** Credential record holding the pairing password verifier; the password itself is never stored. */
export const pairingPasswordKey = credentialKey('client-connection', 'pairing-password')

const stored = z.object({
  version: z.literal(1),
  algorithm: z.literal('scrypt'),
  salt: z.string().regex(/^[0-9a-f]{32}$/u),
  hash: z.string().regex(/^[0-9a-f]{128}$/u),
})

/** The supplied pairing password is outside the rule {@link pairingPassword} states. */
export class DevicePairingPasswordError extends HarnessError {
  constructor() {
    super('Use a pairing password of 8 to 256 characters.', 'DEVICE_PAIRING_PASSWORD_INVALID')
  }
}

/**
 * Derive the verifier with Node's default scrypt parameters.
 * @param password - Password to verify.
 * @param salt - Stored 16-byte salt.
 * @returns The 64-byte derived key.
 */
function derive(password: string, salt: Buffer): Promise<Buffer> {
  // The promise form keeps a Host's event loop free while a password is checked.
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (error, key) => {
      /* v8 ignore next -- scrypt with a fixed key length and Node's default parameters fails only on an internal error. */
      if (error !== null) reject(error)
      else resolve(key)
    })
  })
}

/** Reads the provider's current snapshot and serializes durable writes through that provider. */
export class DevicePairingPassword {
  /** @param credentials - Host provider owning the pairing password record. */
  constructor(private readonly credentials: Pick<CredentialProvider, 'readRecord' | 'modifyRecord' | 'deleteRecord'>) {}

  /**
   * Store a fresh salted verifier, replacing any earlier one.
   * @param password - New pairing password; 8 to 256 characters after trimming.
   * @throws {DevicePairingPasswordError} When the password is outside the rule.
   * @throws {Error} When the provider did not commit the record.
   */
  async set(password: string): Promise<void> {
    const parsed = pairingPassword.safeParse(password)
    if (!parsed.success) throw new DevicePairingPasswordError()
    const salt = randomBytes(16)
    const payload: z.infer<typeof stored> = {
      version: 1, algorithm: 'scrypt', salt: salt.toString('hex'), hash: (await derive(parsed.data, salt)).toString('hex'),
    }
    const committed = await this.credentials.modifyRecord(pairingPasswordKey, () => Promise.resolve({ kind: 'grant', payload }))
    const readBack = stored.safeParse(committed?.kind === 'grant' ? committed.payload : null)
    if (!readBack.success || readBack.data.hash !== payload.hash) throw new Error('client-connection: pairing password did not commit')
  }

  /**
   * Remove the pairing password. Removing an absent password succeeds, and the Host then refuses password pairing with 404.
   */
  async clear(): Promise<void> {
    await this.credentials.deleteRecord(pairingPasswordKey)
  }

  /**
   * Report whether a pairing password is stored.
   * @returns Whether password pairing is configured.
   * @throws {Error} When the provider fails or the stored record is not a pairing password verifier.
   */
  async isSet(): Promise<boolean> {
    return (await this.read()) !== undefined
  }

  /**
   * Verify a presented password against the stored verifier in constant time.
   * @param password - Password as presented by a device.
   * @returns Whether it matches; false when no password is stored or the input is outside the rule.
   * @throws {Error} When the provider fails or the stored record is not a pairing password verifier.
   */
  async verify(password: string): Promise<boolean> {
    const parsed = pairingPassword.safeParse(password)
    if (!parsed.success) return false
    const record = await this.read()
    if (record === undefined) return false
    return timingSafeEqual(Buffer.from(record.hash, 'hex'), await derive(parsed.data, Buffer.from(record.salt, 'hex')))
  }

  /**
   * Read the stored verifier.
   * @returns The verifier, or undefined while no pairing password is stored.
   * @throws {Error} When the provider fails or the stored record is not a pairing password verifier.
   */
  private async read(): Promise<z.infer<typeof stored> | undefined> {
    const record = await this.credentials.readRecord(pairingPasswordKey)
    if (record === undefined) return undefined
    const parsed = stored.safeParse(record.kind === 'grant' ? record.payload : null)
    if (!parsed.success) throw new Error('client-connection: invalid pairing password credential record')
    return parsed.data
  }
}
