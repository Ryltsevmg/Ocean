/** Secret-free remote-connection results for the Desktop connection dialog. */
import { DeviceClientError, DeviceProtocolVersionError, type DeviceClientErrorCode } from '@ocean/ocean-client-connection/device'
import { formatDesktopMessage, type DesktopMessages } from './locale.ts'
import { RemoteConnectionStoreError } from './remote-connection-store.ts'
import { RemoteBootstrapCompatibilityError } from './remote-bootstrap.ts'
import { RemoteSshError, type RemoteSshErrorCode, type RemoteSshStep } from './remote-ssh.ts'

/** Local operation failures distinct from device-protocol failures. */
export type DesktopRemoteFailure = 'invalid-input' | 'token-required' | 'busy' | 'host-limit' | 'timeout' | 'cancelled' | 'pair-link-invalid' | 'unknown'

const localCodes = {
  'invalid-input': 'DESKTOP_REMOTE_INVALID_INPUT', 'token-required': 'DESKTOP_REMOTE_TOKEN_REQUIRED',
  busy: 'DESKTOP_REMOTE_BUSY', 'host-limit': 'DESKTOP_REMOTE_HOST_LIMIT', timeout: 'DESKTOP_REMOTE_TIMEOUT',
  cancelled: 'DESKTOP_REMOTE_CANCELLED', 'pair-link-invalid': 'DESKTOP_REMOTE_PAIR_LINK_INVALID', unknown: 'DESKTOP_REMOTE_FAILED',
} as const satisfies Record<DesktopRemoteFailure, string>

/** Dialog result; connection and credential persistence report independent outcomes. */
export type DesktopRemoteResult =
  | { kind: 'connected'; persistence: 'saved' | 'skipped' | 'failed'; message?: string }
  | { kind: 'forgotten'; logout: 'confirmed' | 'unconfirmed'; message?: string }
  | { kind: 'pairing'; address: string }
  | {
    kind: 'failed'
    code: DeviceClientErrorCode | RemoteConnectionStoreError['code'] | RemoteSshErrorCode
      | typeof localCodes[DesktopRemoteFailure] | 'DEVICE_PROTOCOL_VERSION_INCOMPATIBLE' | 'DESKTOP_REMOTE_VERSION_INCOMPATIBLE'
    message: string
  }

/** A failed dialog result. */
export type DesktopRemoteFailureResult = Extract<DesktopRemoteResult, { kind: 'failed' }>

/**
 * Present a local failure without exposing diagnostics or credentials.
 * @param code - Main-process operation classification.
 * @param messages - Current Desktop locale.
 * @returns A serializable localized failure.
 */
export function remoteFailure(code: DesktopRemoteFailure, messages: DesktopMessages): DesktopRemoteFailureResult {
  const copy = {
    'invalid-input': messages.remoteAddressInvalid,
    'token-required': messages.remoteTokenRequired,
    busy: messages.remoteBusy,
    'host-limit': messages.remoteHostLimit,
    timeout: messages.remoteTimeout,
    cancelled: messages.remoteSwitchFailed,
    'pair-link-invalid': messages.remotePairLinkInvalid,
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
export function remoteErrorResult(error: unknown, messages: DesktopMessages): DesktopRemoteFailureResult {
  if (error instanceof AggregateError) {
    const primary = remoteErrorResult(error.errors[0], messages)
    return { ...primary, message: `${primary.message} ${messages.remoteDisconnectUnconfirmed}` }
  }
  if (error instanceof DeviceProtocolVersionError) {
    return { kind: 'failed', code: 'DEVICE_PROTOCOL_VERSION_INCOMPATIBLE', message: messages.remoteProtocolIncompatible }
  }
  if (error instanceof RemoteBootstrapCompatibilityError) {
    const message = error.hostVersion === undefined || error.clientVersion === undefined
      ? messages.remoteProtocolIncompatible
      : formatDesktopMessage(messages.remoteVersionMismatch, { host: error.hostVersion, client: error.clientVersion })
    return { kind: 'failed', code: 'DESKTOP_REMOTE_VERSION_INCOMPATIBLE', message }
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
      DEVICE_PAIRING_REJECTED: messages.remotePairingRejected,
      DEVICE_PAIRING_UNSUPPORTED: messages.remotePairingUnsupported,
    } satisfies Record<DeviceClientError['code'], string>
    return { kind: 'failed', code: error.code, message: copy[error.code] }
  }
  if (error instanceof RemoteConnectionStoreError) {
    const unreadable = error.code === 'DESKTOP_REMOTE_STORAGE_INVALID' || error.code === 'DESKTOP_REMOTE_STORAGE_READ'
    return { kind: 'failed', code: error.code, message: unreadable ? messages.remoteSavedUnreadable : messages.remoteStorageFailed }
  }
  if (error instanceof RemoteSshError) {
    // The step names where the machine preparation stopped, which the copy turns into an action.
    const copy: Record<RemoteSshStep, string> = {
      inspect: messages.remoteSshInspectFailed,
      download: error.code === 'DESKTOP_SSH_RELEASE_MISSING' ? messages.remoteSshReleaseMissing : messages.remoteSshDownloadFailed,
      verify: messages.remoteSshChecksumFailed,
      extract: messages.remoteSshExtractFailed,
      serve: messages.remoteSshServeFailed,
      pair: messages.remoteSshPairFailed,
    }
    return { kind: 'failed', code: error.code, message: copy[error.step] }
  }
  if (error instanceof DOMException && error.name === 'TimeoutError') return remoteFailure('timeout', messages)
  if (error instanceof DOMException && error.name === 'AbortError') return remoteFailure('cancelled', messages)
  return remoteFailure('unknown', messages)
}
