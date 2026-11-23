/** Pairing links that add this device to a remote Host without typing its token. */
import { DeviceClient } from '@ocean/ocean-client-connection/device'

/** A pairing link after validation; the secret stays in the main process. */
export interface PairingLink {
  /** Canonical HTTPS mount of the Host, ending in a slash. */
  readonly address: string
  /** Name the Host gives the new device. */
  readonly label: string
  /** One-time grant bearer for `POST /connect/pair`. */
  readonly secret: string
}

const grantPattern = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\.[A-Za-z0-9_-]{43}$/u

/**
 * Read an `ocean://pair?host=<https-address>&label=<name>#<grant>` link.
 * @param link - Text from a protocol launch or pasted by the user.
 * @returns The validated link, or undefined for any other text.
 */
export function parsePairingLink(link: string): PairingLink | undefined {
  const url = URL.parse(link.trim())
  if (url === null || url.protocol !== 'ocean:' || url.hostname !== 'pair') return undefined
  const host = url.searchParams.get('host')
  const label = url.searchParams.get('label')?.trim()
  const secret = url.hash.slice(1)
  if (host === null || label === undefined || label.length < 1 || label.length > 128 || !grantPattern.test(secret)) return undefined
  try {
    return { address: DeviceClient.parseAddress(host).href, label, secret }
  } catch (_error) {
    // Only a well-formed HTTPS Host address makes a usable link.
    return undefined
  }
}

/**
 * Find a pairing link among process arguments passed to a later launch.
 * @param argv - Command-line arguments of the launch.
 * @returns The first argument that is a pairing link, if any.
 */
export function findPairingArgument(argv: readonly string[]): string | undefined {
  return argv.find(argument => argument.startsWith('ocean://pair'))
}
