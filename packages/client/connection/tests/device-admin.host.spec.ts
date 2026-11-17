/** The local administration listener uses filesystem permissions and bounded commands. */
import { chmod, mkdtemp, rm } from 'node:fs/promises'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, onTestFinished, vi } from 'vitest'
import { listenDeviceAdmin } from '../src/device-admin.ts'
import { DeviceAdministrationError } from '../src/rpc-host.ts'

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
