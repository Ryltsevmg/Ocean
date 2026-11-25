/** Pairing links that add this device to a remote Host without typing its token. */
import { DeviceClient } from './device-client.ts'

/** A pairing link after validation; the grant stays with the caller. */
export interface PairingLink {
  /** Canonical HTTPS mount of the Host, ending in a slash. */
  readonly address: string
  /** Name the Host gives the new device; absent from a browser pairing URL. */
  readonly label?: string
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
 * Read a browser pairing URL, `<https-address>#pair=<grant>`.
 * @param link - Text from a pairing command or an address bar.
 * @returns The validated link, or undefined for any other text.
 */
export function parsePairingUrl(link: string): PairingLink | undefined {
  const url = URL.parse(link.trim())
  if (url === null || url.protocol !== 'https:' || url.username || url.password || url.search) return undefined
  const secret = url.hash.startsWith('#pair=') ? url.hash.slice('#pair='.length) : ''
  if (!grantPattern.test(secret)) return undefined
  return { address: DeviceClient.parseAddress(`${url.origin}${url.pathname}`).href, secret }
}

/**
 * Read either pairing link form.
 * @param text - Text pasted by a user or passed on a command line.
 * @returns The validated link, or undefined for any other text.
 */
export function parsePairing(text: string): PairingLink | undefined {
  return parsePairingLink(text) ?? parsePairingUrl(text)
}
