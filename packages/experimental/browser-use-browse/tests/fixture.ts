import { createServer } from 'node:http'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect } from 'vitest'
const cleanups: (() => Promise<void>)[] = []
export async function cleanupFixture() { for (const cleanup of cleanups.splice(0).reverse()) await cleanup() }
export async function fixture(options: { version?: string
  oversized?: boolean
  wrongSession?: boolean
  failNew?: boolean
  failDelete?: boolean
  warnings?: boolean
  delayMs?: number
  instanceId?: string
  actionError?: boolean
  alreadyAbsent?: boolean } = {}) {
  const calls: { path: string; body: Record<string, unknown> }[] = []
  const dir = await mkdtemp(join(tmpdir(), 'ocean-browse-test-'))
  cleanups.push(() => rm(dir, { recursive: true, force: true }))
  const tokenFile = join(dir, 'relay-token')
  await writeFile(tokenFile, 'a'.repeat(43), { mode: 0o600 })
  const server = createServer((req, res) => {
    void (async () => {
      expect(req.headers.authorization).toBe(`Bearer ${'a'.repeat(43)}`)
      let raw = ''; for await (const chunk of req) raw += String(chunk)
      const body = raw ? JSON.parse(raw) as Record<string, unknown> : {}
      calls.push({ path: req.url!, body })
      res.setHeader('content-type', 'application/json')
      if ((options.failNew && req.url === '/cli/session/new') || (options.failDelete && req.url === '/cli/session/delete')) { res.statusCode = 500; res.end('{}') }
      else if (req.url === '/version') res.end(JSON.stringify({ version: options.version ?? '0.0.16', instanceId: options.instanceId ?? 'test-relay' }))
      else if (req.url === '/cli/session/new') res.end(JSON.stringify({ session: { id: body.id, browser: 'test', allowedOrigins: ['https://example.com'] } }))
      else if (req.url === '/cli/session/delete') res.end(JSON.stringify({ deleted: !options.alreadyAbsent, id: body.id }))
      else {
        if (options.delayMs) await new Promise(resolve => setTimeout(resolve, options.delayMs))
        res.end(JSON.stringify({ text: options.oversized ? 'x'.repeat(20000) : 'page snapshot', isError: !!options.actionError, ...(options.warnings ? { warnings: ['Navigation blocked'], aftermath: { challenge: { kind: 'captcha' } } } : {}), session: { id: options.wrongSession ? 'foreign' : body.sessionId } }))
      }
    })().catch((error: unknown) => { res.destroy(error instanceof Error ? error : new Error(String(error))) })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  cleanups.push(async () => {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => {
      server.close((error) => { if (error) reject(error); else resolve() })
    })
  })
  const addr = server.address(); if (!addr || typeof addr === 'string') throw new Error('No port')
  const config = { endpoint: `http://127.0.0.1:${addr.port}`, tokenFile, browser: 'test', allowedOrigins: ['https://example.com'], timeoutMs: 1000, handoffTimeoutMs: 5000, maxResponseBytes: 10000 }
  return { calls, config }
}
