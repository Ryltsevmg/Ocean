/** Authenticated, bounded communication with the separately managed browse relay. @module */
import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { open } from 'node:fs/promises'
import { z } from 'zod'
import { operation, resolveConnection } from './policy.ts'
import type { ConnectionConfig, Operation } from './policy.ts'

const versionSchema = z.object({ version: z.literal('0.0.16'), instanceId: z.string().min(1) })
const sessionSchema = z.object({ session: z.object({ id: z.string(), browser: z.string(), allowedOrigins: z.array(z.string()) }) })
const resultSchema = z.object({ text: z.string(), isError: z.boolean(), warnings: z.array(z.string()).optional(),
  aftermath: z.record(z.string(), z.json()).optional(), session: z.object({ id: z.string() }) })

/** The only operations available on one provider-owned relay session. */
export interface BrowseConnection {
  /** Execute fixed source; an uncertain outcome prevents further execution.
   * @param method - validated operation kind.
   * @param args - untrusted model arguments.
   * @param signal - caller cancellation.
   * @returns bounded page text; page content is untrusted.
   */
  execute(method: Operation, args: unknown, signal: AbortSignal): Promise<string>
  /** Delete only this session, stopping its active work; never stop the relay or browser. */
  close(): Promise<void>
}

async function token(file: string): Promise<string> {
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const stat = await handle.stat()
    if (!stat.isFile() || stat.size > 64 || (stat.mode & 0o077) !== 0
      || (process.getuid !== undefined && stat.uid !== process.getuid())) throw new Error('Browse token file must be private and owned by this user')
    const buffer = Buffer.alloc(65)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    if (bytesRead > 64) throw new Error('Browse token file is too large')
    const value = buffer.subarray(0, bytesRead).toString('utf8').trim()
    if (!/^[A-Za-z0-9_-]{43}$/u.test(value)) throw new Error('Browse token file is invalid')
    return value
  } finally { await handle.close() }
}

async function request(config: ConnectionConfig, path: string, body: object | undefined,
  signal: AbortSignal, timeoutMs = config.timeoutMs): Promise<unknown> {
  signal.throwIfAborted()
  const controller = new AbortController()
  const timer = setTimeout(() => { controller.abort(new Error('Browse request timed out')) }, timeoutMs)
  const combined = AbortSignal.any([signal, controller.signal])
  let response: Response | undefined
  try {
    const secret = await token(config.tokenFile)
    combined.throwIfAborted()
    response = await fetch(config.endpoint + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: combined, redirect: 'error',
    })
    if (!response.ok || !response.body) throw new Error('Browse relay rejected the request')
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let bytes = 0
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        bytes += chunk.value.byteLength
        if (bytes > config.maxResponseBytes) throw new Error('Browse response exceeds the configured byte limit')
        chunks.push(chunk.value)
      }
    } finally { await reader.cancel(); reader.releaseLock() }
    combined.throwIfAborted()
    const decoded: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return decoded
  } catch {
    // Neither local credential paths nor upstream exceptions/bodies reach the model.
    throw new Error('Browse request failed or timed out; do not retry an action whose result is unknown')
  } finally {
    clearTimeout(timer)
    if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {})
  }
}

/** Open a unique browser session on the configured local relay; never install or pair it.
 * @param input - explicit user-approved connection configuration.
 * @param signal - resource-owner cancellation.
 * @returns connection whose cleanup affects only the newly allocated session.
 */
export async function openBrowse(input: ConnectionConfig, signal: AbortSignal): Promise<BrowseConnection> {
  const config = resolveConnection(input)
  const version = versionSchema.safeParse(await request(config, '/version', undefined, signal))
  if (!version.success) throw new Error('Browse relay version must be 0.0.16 with an instance identity')
  const instanceId = version.data.instanceId
  const id = `ocean-${randomUUID()}`
  let poisoned = false
  let closing: Promise<void> | undefined
  const checkInstance = async (currentSignal: AbortSignal) => {
    const current = versionSchema.safeParse(await request(config, '/version', undefined, currentSignal))
    if (!current.success || current.data.instanceId !== instanceId) throw new Error('Browse relay changed; start a new Ocean session')
  }
  const close = () => closing ??= (async () => {
    poisoned = true
    const cleanupSignal = new AbortController().signal
    await checkInstance(cleanupSignal)
    z.object({ id: z.literal(id), deleted: z.boolean() }).parse(await request(config, '/cli/session/delete', { id }, cleanupSignal))
    // A matching id with deleted:false confirms the session was already absent.
  })()
  try {
    const created = sessionSchema.parse(await request(config, '/cli/session/new', {
      id, browser: config.browser, allowedOrigins: config.allowedOrigins,
    }, signal))
    if (created.session.id !== id || created.session.browser !== config.browser
      || JSON.stringify(created.session.allowedOrigins) !== JSON.stringify(config.allowedOrigins)) {
      throw new Error('Browse session configuration was not confirmed')
    }
    signal.throwIfAborted()
  } catch (error) {
    try { await close() } catch { throw new Error('Browse session startup and cleanup were not confirmed; inspect the relay before reconnecting') }
    throw error
  }
  return {
    async execute(method, args, currentSignal) {
      if (poisoned || closing) throw new Error('Browse session has an uncertain result or is closed; start a new Ocean session')
      const code = operation(method, args, config.allowedOrigins)
      currentSignal.throwIfAborted()
      try {
        await checkInstance(currentSignal)
        const result = resultSchema.parse(await request(config, '/cli/execute', {
          sessionId: id, createIfMissing: false, code, timeoutMs: config.timeoutMs,
        }, currentSignal, method === 'handoff' ? config.handoffTimeoutMs : config.timeoutMs))
        if (result.session.id !== id) throw new Error('Browse returned a different session')
        if (result.isError) {
          const diagnostics = JSON.stringify({ warnings: result.warnings, aftermath: result.aftermath })
            .slice(0, Math.floor((config.maxResponseBytes - 128) / 4))
          throw new Error(`Browse action failed; inspect the page before continuing. ${diagnostics}`)
        }
        return result.warnings || result.aftermath
          ? JSON.stringify({ text: result.text, warnings: result.warnings, aftermath: result.aftermath })
          : result.text
      } catch (error) {
        poisoned = true
        throw error
      }
    },
    close,
  }
}
