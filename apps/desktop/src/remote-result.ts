/** Secret-free remote-connection results for the Desktop connection dialog. */
import { DeviceClientError, DeviceProtocolVersionError, type DeviceClientErrorCode } from '@ocean/ocean-client-connection/device'
import type { DesktopMessages } from './locale.ts'
import { RemoteConnectionStoreError } from './remote-connection-store.ts'
import { RemoteBootstrapCompatibilityError } from './remote-bootstrap.ts'

/** Local operation failures distinct from device-protocol failures. */
export type DesktopRemoteFailure = 'invalid-input' | 'token-required' | 'busy' | 'host-limit' | 'timeout' | 'cancelled' | 'unknown'

const localCodes = {
  'invalid-input': 'DESKTOP_REMOTE_INVALID_INPUT', 'token-required': 'DESKTOP_REMOTE_TOKEN_REQUIRED',
  busy: 'DESKTOP_REMOTE_BUSY', 'host-limit': 'DESKTOP_REMOTE_HOST_LIMIT', timeout: 'DESKTOP_REMOTE_TIMEOUT',
  cancelled: 'DESKTOP_REMOTE_CANCELLED', unknown: 'DESKTOP_REMOTE_FAILED',
} as const satisfies Record<DesktopRemoteFailure, string>

/** Dialog result; connection and credential persistence report independent outcomes. */
export type DesktopRemoteResult =
  | { kind: 'connected'; persistence: 'saved' | 'skipped' | 'failed'; message?: string }
  | { kind: 'forgotten'; logout: 'confirmed' | 'unconfirmed'; message?: string }
  | {
    kind: 'failed'
    code: DeviceClientErrorCode | RemoteConnectionStoreError['code']
      | typeof localCodes[DesktopRemoteFailure] | 'DEVICE_PROTOCOL_VERSION_INCOMPATIBLE' | 'DESKTOP_REMOTE_VERSION_INCOMPATIBLE'
    message: string
  }

/**
 * Present a local failure without exposing diagnostics or credentials.
 * @param code - Main-process operation classification.
 * @param messages - Current Desktop locale.
 * @returns A serializable localized failure.
 */
export function remoteFailure(code: DesktopRemoteFailure, messages: DesktopMessages): DesktopRemoteResult {
  const copy = {
    'invalid-input': messages.remoteAddressInvalid,
    'token-required': messages.remoteTokenRequired,
    busy: messages.remoteBusy,
    'host-limit': messages.remoteHostLimit,
    timeout: messages.remoteTimeout,
    cancelled: messages.remoteSwitchFailed,
    unknown: messages.remoteSwitchFailed,
  } satisfies Record<DesktopRemoteFailure, string>
  return { kind: 'failed', code: localCodes[code], message: copy[code] }
}

/**
 * Classify transport and encrypted-storage errors without inspecting their text.
 * @param error - Owning client's structured failure.
 * @param messages - Current Desktop locale.
 * @returns A secret-free localized failure.
 */
export function remoteErrorResult(error: unknown, messages: DesktopMessages): DesktopRemoteResult {
  if (error instanceof AggregateError) {
    const primary = remoteErrorResult(error.errors[0], messages)
    return { ...primary, message: `${primary.message} ${messages.remoteDisconnectUnconfirmed}` }
  }
  if (error instanceof DeviceProtocolVersionError) {
    return { kind: 'failed', code: 'DEVICE_PROTOCOL_VERSION_INCOMPATIBLE', message: messages.remoteProtocolIncompatible }
  }
  if (error instanceof RemoteBootstrapCompatibilityError) {
    return { kind: 'failed', code: 'DESKTOP_REMOTE_VERSION_INCOMPATIBLE', message: messages.remoteProtocolIncompatible }
  }
  if (error instanceof DeviceClientError) {
    const copy = {
      DEVICE_ADDRESS_INVALID: messages.remoteAddressInvalid,
      DEVICE_AUTH_REJECTED: messages.remoteAuthRejected,
      DEVICE_RATE_LIMITED: messages.remoteRateLimited,
      DEVICE_CAPACITY_EXCEEDED: messages.remoteServerCapacity,
      DEVICE_HOST_CHANGED: messages.remoteHostChanged,
      DEVICE_IDENTITY_INVALID: messages.remoteHostChanged,
      DEVICE_BOOTSTRAP_INVALID: messages.remoteBootstrapFailed,
      DEVICE_BOOTSTRAP_FAILED: messages.remoteBootstrapFailed,
      DEVICE_AUTH_FAILED: messages.remoteNetworkFailed,
      DEVICE_CONNECTION_FAILED: messages.remoteNetworkFailed,
      DEVICE_SIGN_IN_REQUIRED: messages.remoteTokenRequired,
    } satisfies Record<DeviceClientError['code'], string>
    return { kind: 'failed', code: error.code, message: copy[error.code] }
  }
  if (error instanceof RemoteConnectionStoreError) {
    const unreadable = error.code === 'DESKTOP_REMOTE_STORAGE_INVALID' || error.code === 'DESKTOP_REMOTE_STORAGE_READ'
    return { kind: 'failed', code: error.code, message: unreadable ? messages.remoteSavedUnreadable : messages.remoteStorageFailed }
  }
  if (error instanceof DOMException && error.name === 'TimeoutError') return remoteFailure('timeout', messages)
  if (error instanceof DOMException && error.name === 'AbortError') return remoteFailure('cancelled', messages)
  return remoteFailure('unknown', messages)
}
