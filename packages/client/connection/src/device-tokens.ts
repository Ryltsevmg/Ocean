/** Durable device token issuance and verification for the Host authentication flow. */
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { credentialKey, type CredentialProvider, type CredentialRecord } from '@ocean/ocean-credentials'
import { z } from 'zod'
import { HarnessError } from '@ocean/ocean-error'
import { DEVICE_SCOPES, type DeviceScope } from './device-scopes.ts'
import { deviceId, type DeviceId, type DeviceMetadata } from './device-metadata.ts'

/** A valid device has no room for another active login. */
export class DeviceLoginCapacityError extends HarnessError {
  constructor() {
    super('End an existing device login before creating another.', 'DEVICE_LOGIN_CAPACITY')
  }
}

/** Credential record whose updates can invalidate live device sessions. */
export const deviceRegistryKey = credentialKey('client-connection', 'remote-devices')
// Re-exported for the registry's own callers; the declarations live in the
// client-safe metadata leaf so the Host handle can name them too.
export { deviceId } from './device-metadata.ts'
export type { DeviceId, DeviceMetadata } from './device-metadata.ts'
/** Device login identity scoped to the origin that issued it. */
export interface DeviceSessionKey {
  readonly deviceId: DeviceId
  readonly origin: string
  readonly verifier: string
}

/** Current expiry of an admitted device login. */
export interface DeviceSession extends DeviceSessionKey {
  readonly expiresAt: number
  /** Rights of the device; absent for a device created before scopes, which holds every scope. */
  readonly scopes?: readonly DeviceScope[]
}

const secretPattern = /^[A-Za-z0-9_-]{43}$/u
const session = z.object({
  hash: z.string().regex(/^[0-9a-f]{64}$/u),
  origin: z.string(),
  expiresAt: z.number().int().positive(),
})
const scopes = z.array(z.enum(DEVICE_SCOPES)).min(1).optional()
const entry = z.object({
  id: deviceId,
  label: z.string().trim().min(1).max(128),
  hash: z.string().regex(/^[0-9a-f]{64}$/u),
  revoked: z.boolean(),
  scopes,
  sessions: z.array(session).default([]),
})
const pairing = z.object({
  id: z.uuid(),
  label: z.string().trim().min(1).max(128),
  hash: z.string().regex(/^[0-9a-f]{64}$/u),
  expiresAt: z.number().int().positive(),
  scopes,
})
const registry = z.object({ version: z.literal(1), devices: z.array(entry), pairings: z.array(pairing).default([]) })

/** The Host already holds the most pairing grants it accepts at once. */
export class DevicePairingCapacityError extends HarnessError {
  constructor() {
    super('Wait for a pending pairing link to expire or be used before creating another.', 'DEVICE_PAIRING_CAPACITY')
  }
}

/** Pairing grants one Host keeps pending at once. */
const maxPendingPairings = 16

function load(record: CredentialRecord | undefined): z.infer<typeof registry> {
  if (record === undefined) return { version: 1, devices: [], pairings: [] }
  const parsed = registry.safeParse(record.kind === 'grant' ? record.payload : null)
  if (!parsed.success || new Set(parsed.data.devices.map(device => device.id)).size !== parsed.data.devices.length) {
    throw new Error('client-connection: invalid remote device credential record')
  }
  return parsed.data
}

/** A record fragment holding the scopes, or nothing: the credential store cannot represent an undefined value. */
function withScopes(held: readonly DeviceScope[] | undefined): { scopes?: readonly DeviceScope[] } {
  return held === undefined ? {} : { scopes: held }
}

function hash(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

function parseBearer(value: string) {
  if (value.length !== 80 || value[36] !== '.') return undefined
  const id = deviceId.safeParse(value.slice(0, 36))
  const secret = value.slice(37)
  if (!id.success || !secretPattern.test(secret)) return undefined
  return { id: id.data, digest: Buffer.from(hash(secret), 'hex') }
}

/** Reads the provider's current snapshot and serializes durable writes through that provider. */
export class DeviceTokens {
  /** @param credentials - Host provider owning the durable device records. */
  constructor(private readonly credentials: Pick<CredentialProvider, 'readRecord' | 'modifyRecord'>) {}

  /**
   * Issue a distinct credential and return its secret once, after the write commits.
   * @param label - User-facing device name.
   * @param granted - Rights the device receives; absent grants every scope.
   * @returns Device identity and bearer token.
   */
  async issue(label: string, granted?: readonly DeviceScope[]): Promise<{ id: DeviceId; token: string }> {
    const secret = randomBytes(32).toString('base64url')
    const device = entry.parse({
      id: randomUUID(), label, hash: hash(secret), revoked: false, ...withScopes(granted),
    })
    const committed = load(await this.modify((current) => {
      const state = load(current)
      return { kind: 'grant', payload: { ...state, devices: [...state.devices, device] } }
    }))
    if (!committed.devices.some(other => other.id === device.id && other.hash === device.hash && !other.revoked)) {
      throw new Error('client-connection: remote device issuance did not commit')
    }
    return { id: device.id, token: `${device.id}.${secret}` }
  }

  /**
   * Create a one-time grant that a new device can exchange for its own token.
   * @param label - Name the device receives when the grant is redeemed.
   * @param ttlMs - Lifetime of the grant in milliseconds.
   * @param granted - Rights the new device receives; absent grants every scope.
   * @returns Grant bearer, shown once after the write commits, and its expiry.
   * @throws {DevicePairingCapacityError} When the Host holds too many unexpired grants.
   */
  async createPairing(
    label: string, ttlMs: number, granted?: readonly DeviceScope[],
  ): Promise<{ id: string; secret: string; expiresAt: number }> {
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) throw new Error('client-connection: invalid pairing lifetime')
    const secret = randomBytes(32).toString('base64url')
    const grant = pairing.parse({
      id: randomUUID(), label, hash: hash(secret), expiresAt: Date.now() + ttlMs, ...withScopes(granted),
    })
    const outcome = { capacityReached: false }
    const committed = load(await this.modify((current) => {
      const state = load(current)
      const live = state.pairings.filter(other => other.expiresAt > Date.now())
      if (live.length >= maxPendingPairings) { outcome.capacityReached = true; return undefined }
      return { kind: 'grant', payload: { ...state, pairings: [...live, grant] } }
    }))
    if (outcome.capacityReached) throw new DevicePairingCapacityError()
    if (!committed.pairings.some(other => other.id === grant.id && other.hash === grant.hash)) {
      throw new Error('client-connection: pairing grant did not commit')
    }
    return { id: grant.id, secret: `${grant.id}.${secret}`, expiresAt: grant.expiresAt }
  }

  /**
   * Spend one pairing grant and create the device it names, in a single write.
   * @param bearer - Grant bearer returned by createPairing.
   * @returns The new device and its token, or undefined for an unknown, spent, or expired grant.
   */
  async redeemPairing(bearer: string): Promise<{ id: DeviceId; token: string } | undefined> {
    const parsed = parseBearer(bearer)
    if (parsed === undefined) return undefined
    const secret = randomBytes(32).toString('base64url')
    const device = entry.parse({ id: randomUUID(), label: 'pending', hash: hash(secret), revoked: false })
    const spent: { label?: string; scopes?: readonly DeviceScope[] } = {}
    const committed = load(await this.modify((current) => {
      const state = load(current)
      const now = Date.now()
      const grant = state.pairings.find(other => other.id === parsed.id)
      if (grant === undefined || grant.expiresAt <= now
        || !timingSafeEqual(Buffer.from(grant.hash, 'hex'), parsed.digest)) return undefined
      spent.label = grant.label
      return { kind: 'grant', payload: {
        ...state,
        devices: [...state.devices, { ...device, label: grant.label, ...grant.scopes === undefined ? {} : { scopes: grant.scopes } }],
        pairings: state.pairings.filter(other => other.id !== grant.id && other.expiresAt > now),
      } }
    }))
    if (spent.label === undefined) return undefined
    if (!committed.devices.some(other => other.id === device.id && other.hash === device.hash)
      || committed.pairings.some(other => other.id === parsed.id)) {
      throw new Error('client-connection: pairing redemption did not commit')
    }
    return { id: device.id, token: `${device.id}.${secret}` }
  }

  /**
   * Verify one presented token against the provider's current device record.
   * @param token - Device identifier and bearer secret.
   * @returns Authorized device identity, or undefined for invalid or revoked credentials.
   */
  async verify(token: string): Promise<DeviceId | undefined> {
    const bearer = parseBearer(token)
    if (bearer === undefined) return undefined
    const state = load(await this.credentials.readRecord(deviceRegistryKey))
    const device = state.devices.find(other => other.id === bearer.id)
    if (device === undefined || device.revoked) return undefined
    return timingSafeEqual(Buffer.from(device.hash, 'hex'), bearer.digest) ? device.id : undefined
  }

  /**
   * Check a device bearer and commit a separate, origin-bound login credential.
   * @param token - Device bearer presented by the client.
   * @param origin - Canonical origin resolved from trusted deployment settings.
   * @param limits - Login lifetime in milliseconds and concurrent logins per device.
   * @returns An opaque client credential, or undefined for an invalid device credential.
   * @throws {DeviceLoginCapacityError} When the device has reached its active login limit.
   */
  async exchange(token: string, origin: string, limits: { lifetimeMs: number; maxSessionsPerDevice: number }): Promise<string | undefined> {
    if (!Number.isSafeInteger(limits.lifetimeMs) || limits.lifetimeMs <= 0
      || !Number.isSafeInteger(limits.maxSessionsPerDevice) || limits.maxSessionsPerDevice <= 0) {
      throw new Error('client-connection: invalid device login limits')
    }
    const bearer = parseBearer(token)
    if (bearer === undefined) return undefined
    const login = randomBytes(32).toString('base64url')
    const loginHash = hash(login)
    const exchange = { capacityReached: false }
    const committed = load(await this.modify((current) => {
      const state = load(current)
      const device = state.devices.find(other => other.id === bearer.id)
      if (device === undefined || device.revoked
        || !timingSafeEqual(Buffer.from(device.hash, 'hex'), bearer.digest)) return undefined
      const now = Date.now()
      const sessions = device.sessions.filter(other => other.expiresAt > now)
      if (sessions.length >= limits.maxSessionsPerDevice) { exchange.capacityReached = true; return undefined }
      const next = session.parse({ hash: loginHash, origin, expiresAt: now + limits.lifetimeMs })
      return {
        kind: 'grant',
        payload: { ...state, devices: state.devices.map(other => other === device
          ? { ...device, sessions: [...sessions, next] }
          : other) },
      }
    }))
    if (exchange.capacityReached) throw new DeviceLoginCapacityError()
    return committed.devices.some(device => device.id === bearer.id && !device.revoked
      && device.sessions.some(other => other.hash === loginHash)) ? `${bearer.id}.${login}` : undefined
  }

  /**
   * Resolve a login independently of its current network connections.
   * @param credential - Login credential returned by exchange.
   * @param origin - Canonical origin of the admitted request.
   * @returns The device identity while its login remains valid.
   */
  async verifySession(credential: string, origin: string): Promise<DeviceId | undefined> {
    return (await this.readSession(credential, origin))?.deviceId
  }

  /**
   * Read the session identity and expiry at transport admission.
   * @param credential - Opaque session bearer.
   * @param origin - Trusted request origin.
   * @returns The current device and expiry, or undefined after invalidation.
   */
  async readSession(credential: string, origin: string): Promise<DeviceSession | undefined> {
    const bearer = parseBearer(credential)
    if (bearer === undefined) return undefined
    const state = load(await this.credentials.readRecord(deviceRegistryKey))
    const device = state.devices.find(other => other.id === bearer.id)
    if (device === undefined || device.revoked) return undefined
    const now = Date.now()
    const login = device.sessions.find(other => other.origin === origin && other.expiresAt > now
      && timingSafeEqual(Buffer.from(other.hash, 'hex'), bearer.digest))
    return login === undefined ? undefined : {
      deviceId: device.id, origin, expiresAt: login.expiresAt, verifier: login.hash, ...withScopes(device.scopes),
    }
  }

  /**
   * Remove one login without revoking the device or its other logins.
   * @param credential - Opaque login bearer.
   * @param origin - Trusted request origin.
   * @returns The scoped login key for live cleanup when the bearer parses.
   */
  async endSession(credential: string, origin: string): Promise<DeviceSessionKey | undefined> {
    const bearer = parseBearer(credential)
    if (bearer === undefined) return
    const digest = bearer.digest.toString('hex')
    const committed = load(await this.modify((current) => {
      const state = load(current)
      const device = state.devices.find(other => other.id === bearer.id)
      if (device === undefined) return undefined
      const sessions = device.sessions.filter(login => login.origin !== origin || login.hash !== digest)
      if (sessions.length === device.sessions.length) return undefined
      return { kind: 'grant', payload: { ...state, devices: state.devices.map(other =>
        other === device ? { ...device, sessions } : other) } }
    }))
    if (committed.devices.some(device => device.id === bearer.id
      && device.sessions.some(login => login.origin === origin && login.hash === digest))) {
      throw new Error('client-connection: logout did not commit')
    }
    return { deviceId: bearer.id, origin, verifier: digest }
  }

  /**
   * Read device metadata suitable for administrative output.
   * @returns Device identities, labels, and revocation state without credential material.
   */
  async list(): Promise<DeviceMetadata[]> {
    const state = load(await this.credentials.readRecord(deviceRegistryKey))
    return state.devices.map(({ id, label, revoked, scopes: held }) => ({ id, label, revoked, ...withScopes(held) }))
  }

  /**
   * Replace an active device token and remove all of its logins in the same write.
   * @param id - Active device to rotate.
   * @returns The new bearer, or undefined when the device is absent or revoked.
   */
  async rotate(id: DeviceId): Promise<string | undefined> {
    const secret = randomBytes(32).toString('base64url')
    const verifier = hash(secret)
    const committed = await this.updateActiveDevice(id, device => ({ ...device, hash: verifier, sessions: [] }))
    const rotated = committed.devices.find(device => device.id === id && !device.revoked)
    if (rotated === undefined) return undefined
    if (rotated.hash !== verifier) {
      throw new Error('client-connection: remote device rotation did not commit')
    }
    return `${id}.${secret}`
  }

  /**
   * Disable a device token for future exchanges. The caller owns live session invalidation.
   * @param id - Device to revoke.
   * @returns Whether a revoked record exists for this device.
   */
  async revoke(id: DeviceId): Promise<boolean> {
    const committed = await this.updateActiveDevice(id, device => ({ ...device, revoked: true, sessions: [] }))
    return committed.devices.some(device => device.id === id && device.revoked)
  }

  private async updateActiveDevice(
    id: DeviceId,
    update: (device: z.infer<typeof entry>) => z.infer<typeof entry>,
  ): Promise<z.infer<typeof registry>> {
    return load(await this.modify((current) => {
      const state = load(current)
      if (!state.devices.some(device => device.id === id && !device.revoked)) return undefined
      return {
        kind: 'grant',
        payload: { ...state, devices: state.devices.map(device => device.id === id ? update(device) : device) },
      }
    }))
  }
  private modify(update: (current: CredentialRecord | undefined) => CredentialRecord | undefined): Promise<CredentialRecord | undefined> {
    return this.credentials.modifyRecord(deviceRegistryKey, current => Promise.resolve(update(current)))
  }

}
