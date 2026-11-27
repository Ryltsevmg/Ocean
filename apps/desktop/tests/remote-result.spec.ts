/** Desktop error reports classify failures without copying credential-bearing causes. */
import { expect, it } from 'vitest'
import { HarnessError } from '@ocean/ocean-error'
import { DeviceClientError, DeviceProtocolVersionError, type DeviceClientErrorCode } from '@ocean/ocean-client-connection/device'
import { resolveDesktopLocale } from '../src/locale.ts'
import { RemoteConnectionStoreError } from '../src/remote-connection-store.ts'
import { remoteErrorResult } from '../src/remote-result.ts'
import { RemoteSshError, type RemoteSshErrorCode, type RemoteSshStep } from '../src/remote-ssh.ts'

const messages = resolveDesktopLocale('en-US').messages

it.each([
  ['DEVICE_ADDRESS_INVALID', messages.remoteAddressInvalid],
  ['DEVICE_AUTH_REJECTED', messages.remoteAuthRejected],
  ['DEVICE_RATE_LIMITED', messages.remoteRateLimited],
  ['DEVICE_CAPACITY_EXCEEDED', messages.remoteServerCapacity],
  ['DEVICE_HOST_CHANGED', messages.remoteHostChanged],
  ['DEVICE_IDENTITY_INVALID', messages.remoteHostChanged],
  ['DEVICE_BOOTSTRAP_INVALID', messages.remoteBootstrapFailed],
  ['DEVICE_BOOTSTRAP_FAILED', messages.remoteBootstrapFailed],
  ['DEVICE_AUTH_FAILED', messages.remoteNetworkFailed],
  ['DEVICE_CONNECTION_FAILED', messages.remoteNetworkFailed],
  ['DEVICE_SIGN_IN_REQUIRED', messages.remoteTokenRequired],
  ['DEVICE_PAIRING_PASSWORD_UNSET', messages.remotePairingPasswordUnset],
] satisfies [DeviceClientErrorCode, string][])('presents %s without raw transport diagnostics', (code, message) => {
  const error = new DeviceClientError(code, 'fixture-secret', { cause: new Error('fixture-secret') })
  expect(remoteErrorResult(error, messages)).toEqual({ kind: 'failed', code, message })
})

it.each([
  'DESKTOP_REMOTE_STORAGE_UNAVAILABLE', 'DESKTOP_REMOTE_STORAGE_INVALID', 'DESKTOP_REMOTE_STORAGE_READ',
  'DESKTOP_REMOTE_STORAGE_WRITE', 'DESKTOP_REMOTE_STORAGE_REMOVE',
] satisfies RemoteConnectionStoreError['code'][])('uses structured storage errors for %s', (code) => {
  const error = new RemoteConnectionStoreError(code)
  expect(error).toBeInstanceOf(HarnessError)
  expect(error.name).toBe('RemoteConnectionStoreError')
  expect(remoteErrorResult(error, messages)).toMatchObject({ kind: 'failed', code })
})

it('distinguishes protocol versions and timeouts from unknown failures', () => {
  expect(remoteErrorResult(new DeviceProtocolVersionError(), messages)).toMatchObject({ message: messages.remoteProtocolIncompatible })
  expect(remoteErrorResult(new DOMException('fixture-secret', 'TimeoutError'), messages)).toMatchObject({ code: 'DESKTOP_REMOTE_TIMEOUT' })
  expect(remoteErrorResult(new Error('fixture-secret'), messages)).toEqual({ kind: 'failed', code: 'DESKTOP_REMOTE_FAILED', message: messages.remoteSwitchFailed })
})

it.each([
  ['inspect', 'DESKTOP_SSH_UNREACHABLE', 'remoteSshInspectFailed'],
  ['inspect', 'DESKTOP_SSH_UNSUPPORTED', 'remoteSshInspectFailed'],
  ['inspect', 'DESKTOP_SSH_TOOLS_MISSING', 'remoteSshInspectFailed'],
  ['download', 'DESKTOP_SSH_DOWNLOAD_FAILED', 'remoteSshDownloadFailed'],
  ['download', 'DESKTOP_SSH_RELEASE_MISSING', 'remoteSshReleaseMissing'],
  ['verify', 'DESKTOP_SSH_CHECKSUM_FAILED', 'remoteSshChecksumFailed'],
  ['extract', 'DESKTOP_SSH_EXTRACT_FAILED', 'remoteSshExtractFailed'],
  ['serve', 'DESKTOP_SSH_SERVE_FAILED', 'remoteSshServeFailed'],
  ['pair', 'DESKTOP_SSH_PAIR_FAILED', 'remoteSshPairFailed'],
] as [RemoteSshStep, RemoteSshErrorCode, keyof typeof messages][])(
  'names the machine-preparation step that failed: %s %s',
  (step, code, copy) => {
    const result = remoteErrorResult(new RemoteSshError(code, step, 'Ocean remote SSH: detail'), messages)
    expect(result).toEqual({ kind: 'failed', code, message: messages[copy] })
    // The remote diagnostics never reach the form.
    expect(result.message).not.toContain('detail')
  },
)
