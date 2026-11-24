/** Carrier-neutral wire fields and socket interfaces, without either plugin implementation. */
export {
  CONNECT_PATH, DEVICE_BOOTSTRAP_PATH, DEVICE_PAIR_PATH, DEVICE_EPOCH_HEADER, DEVICE_HOST_HEADER,
  DEVICE_PROTOCOL_HEADER, DEVICE_PROTOCOL_VERSION,
} from './connect-protocol.ts'
export type {
  ConnectionInteractions, ConnectionWebSocket, ConnectionWebSocketEventMap, ConnectionWebSocketFactory,
  HostEpoch, HostId, HostIdentity,
} from './connect-protocol.ts'
