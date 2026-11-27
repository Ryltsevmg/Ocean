/** Parse Host Connection settings before acquiring transport resources. */
import z from '@deepseek-ai/schemastery'
import { DEFAULT_MAX_REQUEST_BODY_BYTES } from './http-bridge.ts'
import { ConnectionRecoveryConfigSchema, type ConnectionRecoveryConfig } from './recovery-config.ts'

/** Browser authentication, request limits, and connection recovery configuration. */
export interface ConnectionConfig {
  /** Provide only local device issuance and listing, without transport resources. */
  deviceBootstrapOnly?: boolean
  /** Browser recovery timing, injected into each served page. */
  recovery?: ConnectionRecoveryConfig
  /**
   * Authorities this deployment serves beyond loopback: exact `host:port`, or
   * port-less `host` matching any port. The fence accepts loopback and the
   * listener's own bind IP independently; other remote authorities require
   * an entry here. A non-canonical or non-bare authority fails plugin load.
   */
  trustedHosts?: string[]
  /** Permit launch-token exchanges and owner cookies. Defaults to true for local Web. */
  allowOwnerLogin?: boolean
  /** External HTTPS URL for a reverse proxy that exclusively reaches a loopback listener. */
  deviceProxyUrl?: string
  /** Maximum simultaneous valid logins per device. */
  maxDeviceSessions?: number
  /** Combined limit on pending device admissions and active device transports. */
  maxDeviceTransports?: number
  /** Limit on active HTTP or WebSocket transports for one device. */
  maxDeviceTransportsPerDevice?: number
  /** Maximum credential exchanges per authenticated device per window. */
  maxDeviceExchangesPerWindow?: number
  /** Maximum password pairing attempts across all callers per exchange window; wrong and right attempts both count. Default: 5. */
  maxPairingPasswordAttemptsPerWindow?: number
  /** Window for device credential exchange attempts in milliseconds. */
  deviceExchangeWindowMs?: number
  /** Absolute local administrator socket in an owner-only directory. */
  deviceAdminSocket?: string
  /** Lifetime in seconds of a pairing link created without an explicit lifetime. Default: 600. */
  devicePairingTtlSeconds?: number
  /** Absolute browser and API cookie lifetime in days. Default: 30. */
  cookieMaxAgeDays?: number
  /** Lifetime of new device logins in seconds. Defaults to cookieMaxAgeDays converted to seconds. */
  deviceSessionLifetimeSeconds?: number
  /** Maximum HTTP body for buffered `/api` requests and device uploads. Default: 300 MiB. */
  maxRequestBodyBytes?: number
}

export const Config: z<ConnectionConfig> = z.object({
  deviceBootstrapOnly: z.boolean().default(false),
  recovery: ConnectionRecoveryConfigSchema.default({}),
  trustedHosts: z.array(String).default([]),
  allowOwnerLogin: z.boolean().default(true),
  deviceProxyUrl: z.string(),
  maxDeviceSessions: z.natural().min(1).default(16),
  maxDeviceTransports: z.natural().min(1).default(256),
  maxDeviceTransportsPerDevice: z.natural().min(1).default(32),
  maxDeviceExchangesPerWindow: z.natural().min(1).default(60),
  maxPairingPasswordAttemptsPerWindow: z.natural().min(1).default(5),
  deviceExchangeWindowMs: z.natural().min(1).default(10_000),
  deviceAdminSocket: z.string(),
  devicePairingTtlSeconds: z.natural().min(30).max(3_600).default(600),
  cookieMaxAgeDays: z.natural().min(1).default(30),
  deviceSessionLifetimeSeconds: z.natural().min(1).max(31_536_000),
  maxRequestBodyBytes: z.natural().min(1).default(DEFAULT_MAX_REQUEST_BODY_BYTES),
})

/** Validated Host settings with deployment defaults applied. */
export type ResolvedConnectionConfig = Required<Omit<ConnectionConfig,
  'deviceProxyUrl' | 'deviceAdminSocket' | 'deviceSessionLifetimeSeconds'>>
  & Pick<ConnectionConfig, 'deviceProxyUrl' | 'deviceAdminSocket' | 'deviceSessionLifetimeSeconds'>

/**
 * Validate Host input and resolve every fixed default before resource acquisition.
 * @param config - Caller configuration before schema defaults.
 * @returns Resolved Host settings.
 */
export function resolveHostConnectionConfig(config: ConnectionConfig = {}): ResolvedConnectionConfig {
  return Config(config) as ResolvedConnectionConfig
}

/**
 * Resolve the transport capacity used by a directly constructed Host service.
 * @param config - Host configuration, if supplied by the composition.
 * @returns Total and per-device transport limits.
 */
export function resolveDeviceTransportLimits(config?: ConnectionConfig): { total: number; perDevice: number } {
  const resolved = resolveHostConnectionConfig(config)
  return { total: resolved.maxDeviceTransports, perDevice: resolved.maxDeviceTransportsPerDevice }
}
