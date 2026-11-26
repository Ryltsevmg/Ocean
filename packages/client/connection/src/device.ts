/** Node authentication client and wire constants for remote-device transports. */
export {
  DeviceClient, DeviceClientError, DeviceProtocolVersionError, DeviceSessionRejectedError, DeviceSessionUnavailableError,
  type DeviceClientErrorCode, type PairedDevice,
} from './device-client.ts'
export { DEVICE_SCOPES, parseDeviceScopes, type DeviceScope } from './device-scopes.ts'
export { parsePairing, parsePairingLink, parsePairingUrl, type PairingLink } from './device-pairing.ts'
export {
  CONNECT_PATH, DEVICE_BOOTSTRAP_PATH, DEVICE_PAIR_PATH, DEVICE_EPOCH_HEADER, DEVICE_HOST_HEADER, DEVICE_PROTOCOL_HEADER,
  DEVICE_PROTOCOL_VERSION,
  type HostId, type HostEpoch, type HostIdentity,
} from './connect-protocol.ts'
