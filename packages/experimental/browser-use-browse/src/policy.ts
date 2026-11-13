/** Fixed browser operations and profile-owned connection validation. @module */
import { isAbsolute } from 'node:path'
import { isIP } from 'node:net'
import { z } from 'zod'

/** Explicit connection to a separately installed, paired local browse relay. */
export interface ConnectionConfig {
  /** Explicit HTTP address of the loopback-only local relay. */
  endpoint: string
  /** Absolute path to the private relay token file, never the token value. */
  tokenFile: string
  /** Identifier of the separately paired browser. */
  browser: string
  /** HTTPS origins to which browser operations are restricted. */
  allowedOrigins: string[]
  /** Maximum wait in milliseconds for a human browser handoff. */
  handoffTimeoutMs: number
  /** Maximum duration in milliseconds of a relay operation. */
  timeoutMs: number
  /** Maximum accepted relay response size in bytes. */
  maxResponseBytes: number
}

/** Validate configuration without contacting a browser or reading credentials.
 * @param config - profile-owned connection and operation limits.
 * @returns normalized validated settings.
 */
export function resolveConnection(config: ConnectionConfig): ConnectionConfig {
  const endpoint = new URL(config.endpoint)
  if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1' || endpoint.username || endpoint.password
    || endpoint.pathname !== '/' || endpoint.search || endpoint.hash || !endpoint.port) {
    throw new Error('Browse requires an explicit http://127.0.0.1:port relay')
  }
  if (!isAbsolute(config.tokenFile) || !config.browser.trim()) throw new Error('Browse requires an absolute tokenFile and browser id')
  if (!Number.isInteger(config.handoffTimeoutMs) || config.handoffTimeoutMs < 1000 || config.handoffTimeoutMs > 600000
    || !Number.isInteger(config.timeoutMs) || config.timeoutMs < 100 || config.timeoutMs > 120000
    || !Number.isInteger(config.maxResponseBytes) || config.maxResponseBytes < 1024 || config.maxResponseBytes > 1000000) {
    throw new Error('Browse operation limits are invalid')
  }
  if (!config.allowedOrigins.length || config.allowedOrigins.length > 100) throw new Error('Browse requires a non-empty origin allowlist')
  for (const origin of config.allowedOrigins) {
    const url = new URL(origin)
    if (url.origin !== origin || url.protocol !== 'https:' || url.username || url.password
      || isIP(url.hostname) || !url.hostname.includes('.') || url.hostname.endsWith('.local') || url.hostname.includes('*')) {
      throw new Error('Browse allows exact public HTTPS origins only')
    }
  }
  return { ...config, endpoint: endpoint.origin, allowedOrigins: [...new Set(config.allowedOrigins)] }
}

const reference = z.string().regex(/^e[0-9]+$/u).max(32)
/** Model argument schemas; no upstream session selector or arbitrary JavaScript is exposed. */
export const inputs = {
  navigate: z.strictObject({ url: z.url().max(8192) }),
  snapshot: z.strictObject({}),
  click: z.strictObject({ ref: reference }),
  fill: z.strictObject({ ref: reference, text: z.string().max(4096) }),
  handoff: z.strictObject({ message: z.string().min(1).max(1000) }),
}
/** Operations exposed by the provider. */
export type Operation = keyof typeof inputs

/** Compile one validated narrow operation into fixed upstream source.
 * @param method - operation selected by the provider, not by a page.
 * @param input - untrusted tool JSON.
 * @param origins - immutable user-owned navigation allowlist.
 * @returns fixed code with values encoded only as JSON string literals.
 */
export function operation(method: string, input: unknown, origins: readonly string[]): string {
  const guard = `if (!${JSON.stringify(origins)}.includes(new URL(page.url()).origin)) throw new Error("Page is outside the approved origins");\n`
  switch (method) {
    case 'navigate': {
      const { url } = inputs.navigate.parse(input)
      const parsed = new URL(url)
      if (parsed.username || parsed.password || !origins.includes(parsed.origin)) throw new Error('URL is outside the approved origins')
      return `await page.goto(${JSON.stringify(url)}); return await snapshot();`
    }
    case 'snapshot':
      inputs.snapshot.parse(input)
      return guard + 'return await snapshot();'
    case 'click': {
      const { ref } = inputs.click.parse(input)
      return guard + `await ref(${JSON.stringify(ref)}).click(); return await snapshot();`
    }
    case 'fill': {
      const { ref, text } = inputs.fill.parse(input)
      return guard + `const locator = ref(${JSON.stringify(ref)}); const sensitive = await locator.evaluate(el => el.type === "password" || /password|one-time-code|cc-/i.test(el.autocomplete || "")); if (sensitive) throw new Error("Use human handoff for sensitive input"); await locator.fill(${JSON.stringify(text)}); return await snapshot();`
    }
    case 'handoff': {
      const { message } = inputs.handoff.parse(input)
      return guard + `await handoff(${JSON.stringify(message)}); return await snapshot();`
    }
    default: throw new Error('Unknown browser operation')
  }
}
