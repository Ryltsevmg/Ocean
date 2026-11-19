/** Local HTTP commands over a Unix socket inside an owner-only directory. */
import { lstat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { dirname, isAbsolute } from 'node:path'
import { z } from 'zod'
import { deviceId } from './device-tokens.ts'
import { DeviceAdministrationError } from './rpc-host.ts'

const command = z.discriminatedUnion('action', [
  z.object({ action: z.literal('list') }),
  z.object({ action: z.literal('create'), label: z.string().trim().min(1).max(128) }),
  z.object({ action: z.literal('revoke'), id: deviceId }),
  z.object({ action: z.literal('rotate'), id: deviceId }),
])

type DeviceAdminCommand = z.infer<typeof command>

/**
 * Start a local-only administrator endpoint. An existing socket is left to its owner.
 * @param path - Absolute socket path in an existing directory accessible only to its owner.
 * @param dispatch - Host operation returning only after its work has settled.
 * @returns An idempotent disposer that stops admission and waits for accepted replies.
 */
export async function listenDeviceAdmin(
  path: string, dispatch: (value: DeviceAdminCommand) => Promise<unknown>,
): Promise<() => Promise<void>> {
  const uid = process.getuid?.()
  if (uid === undefined || !isAbsolute(path)) throw new Error('device administration requires an absolute Unix socket path')
  const parent = await lstat(dirname(path))
  if (!parent.isDirectory() || parent.uid !== uid || (parent.mode & 0o077) !== 0) {
    throw new Error('device administration requires a directory owned by this user with no group or other access')
  }
  const pending = new Set<Promise<void>>()
  let accepting = true
  const server = createServer({ requestTimeout: 5_000, headersTimeout: 5_000 }, (req, res) => {
    if (!accepting) { res.writeHead(503); res.end(); return }
    const job = serve(req, res, dispatch).catch(() => { res.destroy() })
    pending.add(job)
    void job.then(() => { pending.delete(job) })
  })
  server.on('connection', (socket) => {
    socket.setTimeout(5_000, () => { socket.destroy() })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(path, () => {
      server.removeListener('error', reject)
      resolve()
    })
  })
  let closing: Promise<void> | undefined
  return () => {
    if (closing !== undefined) return closing
    accepting = false
    closing = (async () => {
      const closed = new Promise<void>((resolve, reject) => {
        server.close((error) => { if (error === undefined) resolve(); else reject(error) })
      })
      await Promise.all(pending)
      server.closeIdleConnections()
      await closed
      // Node removes its own Unix socket on close.
    })()
    return closing
  }
}

async function serve(req: IncomingMessage, res: ServerResponse, dispatch: (value: DeviceAdminCommand) => Promise<unknown>): Promise<void> {
  const reply = (status: number, value: unknown): void => {
    if (res.destroyed) return
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    res.end(JSON.stringify(value))
  }
  if (req.method !== 'POST' || req.url !== '/' || req.headers.origin !== undefined) {
    reply(404, { error: 'unsupported request' })
    return
  }
  let input: unknown
  try {
    const chunks: Buffer[] = []
    let bytes = 0
    for await (const chunk of req) {
      /* v8 ignore next -- node:http IncomingMessage always yields Buffer chunks; no object-mode stream reaches this server. */
      if (!Buffer.isBuffer(chunk)) throw new Error('expected raw bytes')
      bytes += chunk.length
      if (bytes > 1024) {
        req.destroy()
        return
      }
      chunks.push(chunk)
    }
    input = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch (_error) {
    // Invalid or interrupted JSON is not dispatched.
    reply(400, { error: 'invalid command' })
    return
  }
  const parsed = command.safeParse(input)
  if (!parsed.success) {
    reply(400, { error: 'invalid command' })
    return
  }
  req.socket.setTimeout(0)
  try {
    reply(200, { result: await dispatch(parsed.data) })
  } catch (error) {
    // A committed write may have preceded a teardown failure.
    reply(500, { error: {
      code: 'DEVICE_ADMIN_FAILED',
      message: 'Device administration failed. Inspect the device state before retrying.',
      durableOutcome: error instanceof DeviceAdministrationError ? error.durableOutcome : 'unknown',
      liveCleanup: error instanceof DeviceAdministrationError ? error.liveCleanup : 'failed',
    } })
  }
}
