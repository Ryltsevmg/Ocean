/** Privacy-preserving external support destination. */
import type { ContactConfig } from '../contact-config.ts'

/**
 * Return the support destination without identifying URL fields.
 * @param config - configured HTTPS support destination.
 * @returns support URL without query, fragment or embedded credentials.
 */
export function contactUrl(config: ContactConfig): string {
  const url = new URL(config.contactFormUrl)
  url.search = ''
  url.hash = ''
  url.username = ''
  url.password = ''
  return url.href
}
