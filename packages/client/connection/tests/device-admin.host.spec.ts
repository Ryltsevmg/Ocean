/** The local administration listener uses filesystem permissions and bounded commands. */
import { chmod, mkdtemp, rm } from 'node:fs/promises'
import { once } from 'node:events'
import { request, type Server } from 'node:http'
import { connect as netConnect, type Socket } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, onTestFinished, vi } from 'vitest'
import { listenDeviceAdmin } from '../src/device-admin.ts'
import { DeviceAdministrationError } from '../src/rpc-host.ts'

/** Administration listeners created through the observing node:http factory. */
const capturedServers = vi.hoisted(() => [] as Server[])

vi.mock('node:http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:http')>()
  return {
    ...actual,
    createServer: ((...args: Parameters<typeof actual.createServer>) => {
      const server = actual.createServer(...args)
      capturedServers.push(server)
      return server
    }) as typeof actual.createServer,
  }
})

function post(socketPath: string, data: unknown, origin?: string): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    const req = request({
      socketPath, path: '/', method: 'POST',
      headers: origin === undefined ? {} : { origin },
    }, (res) => {
      res.resume()
      res.once('end', () => { resolve(res.statusCode) })
    })
    req.once('error', reject)
    req.end(JSON.stringify(data))
  })
}

/** POST one raw body and resolve the reply status. */
function postRaw(socketPath: string, body: string): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    const req = request({ socketPath, path: '/', method: 'POST' }, (res) => {
      res.resume()
      res.once('end', () => { resolve(res.statusCode) })
    })
    req.once('error', reject)
    req.end(body)
  })
}

/** POST one command and resolve the reply status with its complete body. */
function postJson(socketPath: string, data: unknown): Promise<{ status: number | undefined; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ socketPath, path: '/', method: 'POST' }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => { chunks.push(chunk) })
      res.once('end', () => { resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }) })
    })
    req.once('error', reject)
    req.end(JSON.stringify(data))
  })
}

/** An owner-only temporary socket directory removed after the test. */
async function adminDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'ocean-device-'))
  onTestFinished(() => rm(dir, { recursive: true, force: true }))
  await chmod(dir, 0o700)
  return dir
}

it.skipIf(process.platform === 'win32')('accepts valid local requests only from an owner-only socket directory', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ocean-device-'))
  onTestFinished(() => rm(dir, { recursive: true, force: true }))
  const path = join(dir, 'admin.sock')
  const dispatch = vi.fn(async () => [])
  await chmod(dir, 0o755)
  await expect(listenDeviceAdmin(path, dispatch)).rejects.toThrow('no group or other access')
  await chmod(dir, 0o700)
  const close = await listenDeviceAdmin(path, dispatch)
  try {
    expect(await post(path, { action: 'list' }, 'https://other.example')).toBe(404)
    expect(await post(path, { action: 'revoke', id: 'invalid' })).toBe(400)
    expect(await post(path, { action: 'list' })).toBe(200)
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({ action: 'list' })
    await expect(listenDeviceAdmin(path, dispatch)).rejects.toMatchObject({ code: 'EADDRINUSE' })
    expect(await post(path, { action: 'list' })).toBe(200)
  } finally {
    await close()
  }
  // macOS may reuse a pooled socket and report EPIPE after the listener closes.
  await post(path, { action: 'list' }).then(() => { throw new Error('closed listener accepted a command') }, (error: unknown) => {
    if (!(error instanceof Error) || !('code' in error)) throw error
    expect(['ENOENT', 'EPIPE']).toContain(error.code)
  })
})

it.skipIf(process.platform === 'win32')('dispatches the pairing password command and refuses a password outside the rule', async () => {
  const path = join(await adminDir(), 'admin.sock')
  const dispatch = vi.fn(async () => ({ set: true }))
  const close = await listenDeviceAdmin(path, dispatch)
  try {
    expect(await post(path, { action: 'password', password: 'correct horse' })).toBe(200)
    expect(dispatch).toHaveBeenLastCalledWith({ action: 'password', password: 'correct horse' })
    expect(await post(path, { action: 'password', password: null })).toBe(200)
    expect(dispatch).toHaveBeenLastCalledWith({ action: 'password', password: null })
    for (const password of ['short', 'x'.repeat(257), 12, undefined]) {
      expect(await post(path, { action: 'password', password }), String(password)).toBe(400)
    }
    expect(dispatch).toHaveBeenCalledTimes(2)
  } finally {
    await close()
  }
})

it.skipIf(process.platform === 'win32')('drains accepted administrative replies before close completes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ocean-device-'))
  onTestFinished(() => rm(dir, { recursive: true, force: true }))
  const path = join(dir, 'admin.sock')
  const started = Promise.withResolvers<undefined>()
  const finish = Promise.withResolvers<undefined>()
  const close = await listenDeviceAdmin(path, async () => {
    started.resolve(undefined)
    await finish.promise
    return []
  })
  const result = post(path, { action: 'list' })
  await started.promise
  const closing = close()
  let closed = false
  void closing.then(() => { closed = true })
  try {
    expect(close()).toBe(closing)
    await Promise.resolve()
    expect(closed).toBe(false)
    finish.resolve(undefined)
    expect(await result).toBe(200)
    await closing
  } finally {
    finish.resolve(undefined)
    await close()
  }
})

it.skipIf(process.platform === 'win32')('reports a committed revocation separately from failed live cleanup', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ocean-device-'))
  onTestFinished(() => rm(dir, { recursive: true, force: true }))
  const path = join(dir, 'admin.sock')
  const close = await listenDeviceAdmin(path, () => Promise.reject(new DeviceAdministrationError(
    'committed', 'failed', { cause: new Error('private cleanup details') },
  )))
  try {
    const response = await new Promise<{ status: number | undefined; body: string }>((resolve, reject) => {
      const req = request({ socketPath: path, path: '/', method: 'POST' }, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => { chunks.push(chunk) })
        res.once('end', () => { resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }) })
      })
      req.once('error', reject)
      req.end(JSON.stringify({ action: 'revoke', id: '00000000-0000-4000-8000-000000000001' }))
    })
    expect(response.status).toBe(500)
    expect(JSON.parse(response.body)).toEqual({ error: {
      code: 'DEVICE_ADMIN_FAILED',
      message: 'Device administration failed. Inspect the device state before retrying.',
      durableOutcome: 'committed',
      liveCleanup: 'failed',
    } })
    expect(response.body).not.toContain('private cleanup details')
  } finally {
    await close()
  }
})

it.skipIf(process.platform === 'win32')('requires an absolute socket path and a POSIX uid', async () => {
  await expect(listenDeviceAdmin('relative.sock', async () => []))
    .rejects.toThrow('absolute Unix socket path')
  const uid = vi.spyOn(process, 'getuid').mockReturnValue(undefined as never)
  try {
    await expect(listenDeviceAdmin(join(tmpdir(), 'unused.sock'), async () => []))
      .rejects.toThrow('absolute Unix socket path')
  } finally {
    uid.mockRestore()
  }
})

it.skipIf(process.platform === 'win32')('rejects a directory this user does not own', async () => {
  const dir = await adminDir()
  const path = join(dir, 'admin.sock')
  const ownership = vi.spyOn(process, 'getuid').mockReturnValue((process.getuid?.() ?? 0) + 1)
  try {
    await expect(listenDeviceAdmin(path, async () => []))
      .rejects.toThrow('owned by this user')
  } finally {
    ownership.mockRestore()
  }
})

it.skipIf(process.platform === 'win32')('destroys oversized command bodies without dispatching them', async () => {
  const path = join(await adminDir(), 'admin.sock')
  const dispatch = vi.fn(async () => [])
  const close = await listenDeviceAdmin(path, dispatch)
  try {
    const outcome = await new Promise<string>((resolve) => {
      const req = request({ socketPath: path, path: '/', method: 'POST' }, (res) => {
        res.resume()
        res.once('end', () => { resolve(`status ${String(res.statusCode)}`) })
      })
      req.once('error', (error: NodeJS.ErrnoException) => { resolve(error.code ?? 'error') })
      req.end(JSON.stringify({ action: 'create', label: 'x'.repeat(2000) }))
    })
    expect(['ECONNRESET', 'EPIPE']).toContain(outcome)
    expect(dispatch).not.toHaveBeenCalled()
    expect(await post(path, { action: 'list' })).toBe(200)
  } finally {
    await close()
  }
})

it.skipIf(process.platform === 'win32')('rejects invalid JSON and survives a client that abandons its body', async () => {
  const path = join(await adminDir(), 'admin.sock')
  const dispatch = vi.fn(async () => [])
  const close = await listenDeviceAdmin(path, dispatch)
  try {
    expect(await postRaw(path, '{')).toBe(400)
    const abandoned = request({ socketPath: path, path: '/', method: 'POST', headers: { 'content-length': '64' } })
    abandoned.once('error', () => {})
    abandoned.write('{"action":')
    abandoned.destroy()
    expect(await post(path, { action: 'list' })).toBe(200)
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({ action: 'list' })
  } finally {
    await close()
  }
})

it.skipIf(process.platform === 'win32')('reports a non-administrative dispatch failure as an unknown outcome', async () => {
  const path = join(await adminDir(), 'admin.sock')
  const close = await listenDeviceAdmin(path, () => Promise.reject(new Error('private detail')))
  try {
    const reply = await postJson(path, { action: 'list' })
    expect(reply.status).toBe(500)
    expect(JSON.parse(reply.body)).toEqual({ error: {
      code: 'DEVICE_ADMIN_FAILED',
      message: 'Device administration failed. Inspect the device state before retrying.',
      durableOutcome: 'unknown',
      liveCleanup: 'failed',
    } })
    expect(reply.body).not.toContain('private detail')
  } finally {
    await close()
  }
})

it.skipIf(process.platform === 'win32')('destroys the reply when the dispatch result cannot be serialized', async () => {
  const path = join(await adminDir(), 'admin.sock')
  const circular: Record<string, unknown> = {}
  circular.self = circular
  const close = await listenDeviceAdmin(path, async () => circular)
  try {
    const outcome = await new Promise<string>((resolve) => {
      const req = request({ socketPath: path, path: '/', method: 'POST' }, (res) => {
        res.once('aborted', () => { resolve('aborted') })
        res.once('error', () => { resolve('aborted') })
        res.once('end', () => { resolve('ended') })
        res.resume()
      })
      req.once('error', () => { resolve('reset') })
      req.end(JSON.stringify({ action: 'list' }))
    })
    expect(['aborted', 'reset']).toContain(outcome)
  } finally {
    await close()
  }
})

it.skipIf(process.platform === 'win32')('destroys a connection that sends no command within the socket timeout', async () => {
  const path = join(await adminDir(), 'admin.sock')
  const close = await listenDeviceAdmin(path, async () => [])
  const socket = netConnect(path)
  try {
    await once(socket, 'connect')
    // The listener owns the 5s idle bound; the client only observes the teardown.
    await once(socket, 'close')
  } finally {
    socket.destroy()
    await close()
  }
}, 15_000)

it.skipIf(process.platform === 'win32')('refuses further commands on an accepted connection once closing starts', async () => {
  const path = join(await adminDir(), 'admin.sock')
  const gates: Array<PromiseWithResolvers<undefined>> = []
  const close = await listenDeviceAdmin(path, async () => {
    const gate = Promise.withResolvers<undefined>()
    gates.push(gate)
    await gate.promise
    return []
  })
  const command = '{"action":"list"}'
  const frame = `POST / HTTP/1.1\r\nHost: localhost\r\nContent-Length: ${String(Buffer.byteLength(command))}\r\n\r\n${command}`
  const statuses = (socket: ReturnType<typeof netConnect>): number[] => {
    const seen: number[] = []
    socket.on('data', (chunk: Buffer) => {
      for (const match of chunk.toString('utf8').matchAll(/HTTP\/1\.1 (\d{3})/gu)) seen.push(Number(match[1]))
    })
    return seen
  }
  const first = netConnect(path)
  const second = netConnect(path)
  const firstStatuses = statuses(first)
  statuses(second)
  try {
    await Promise.all([once(first, 'connect'), once(second, 'connect')])
    first.write(frame)
    second.write(frame)
    await vi.waitFor(() => { expect(gates).toHaveLength(2) })
    const closing = close()
    // The first reply settles while the second command keeps the listener draining.
    gates[0]?.resolve(undefined)
    await vi.waitFor(() => { expect(firstStatuses).toContain(200) })
    first.write(frame)
    await vi.waitFor(() => { expect(firstStatuses).toContain(503) })
    gates[1]?.resolve(undefined)
    await closing
  } finally {
    for (const gate of gates) gate.resolve(undefined)
    first.destroy()
    second.destroy()
    await close()
  }
})

it.skipIf(process.platform === 'win32')('drops the reply when the client disconnected during dispatch', async () => {
  const path = join(await adminDir(), 'admin.sock')
  const entered = Promise.withResolvers<undefined>()
  const gate = Promise.withResolvers<undefined>()
  const before = capturedServers.length
  const close = await listenDeviceAdmin(path, async () => {
    entered.resolve(undefined)
    await gate.promise
    return []
  })
  const server = capturedServers[before]
  if (server === undefined) throw new Error('administration listener was not captured')
  const sockets: Socket[] = []
  server.on('connection', (socket) => { sockets.push(socket) })
  try {
    const req = request({ socketPath: path, path: '/', method: 'POST' })
    req.once('error', () => {})
    req.end(JSON.stringify({ action: 'list' }))
    await entered.promise
    const accepted = sockets[0]
    if (accepted === undefined) throw new Error('administration connection was not captured')
    req.destroy()
    await vi.waitFor(() => { expect(accepted.destroyed).toBe(true) })
    gate.resolve(undefined)
    expect(await post(path, { action: 'list' })).toBe(200)
  } finally {
    gate.resolve(undefined)
    await close()
  }
})

it.skipIf(process.platform === 'win32')('surfaces a listener that stopped before the disposer ran', async () => {
  const path = join(await adminDir(), 'admin.sock')
  const before = capturedServers.length
  const close = await listenDeviceAdmin(path, async () => [])
  try {
    expect(capturedServers.length).toBe(before + 1)
    const server = capturedServers.at(-1)
    if (server === undefined) throw new Error('administration listener was not captured')
    await new Promise<void>((resolve) => { server.close(() => { resolve() }) })
    await expect(close()).rejects.toMatchObject({ code: 'ERR_SERVER_NOT_RUNNING' })
  } finally {
    await close().catch(() => {})
  }
})
