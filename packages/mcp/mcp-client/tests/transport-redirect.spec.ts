import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { Config } from '@ocean/ocean-mcp-client'
import { createTransport } from '@ocean/ocean-mcp-client/src/transport.ts'

const payload = { jsonrpc: '2.0' as const, method: 'notifications/test', params: { data: 'SYNTHETIC_PRIVATE_BODY' } }
const cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const close of cleanup.reverse()) await close()
  cleanup.length = 0
  vi.restoreAllMocks()
})

async function server(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<string> {
  const instance = createServer(handler)
  instance.listen(0, '127.0.0.1')
  await once(instance, 'listening')
  cleanup.push(async () => {
    instance.closeAllConnections()
    await new Promise<void>((resolve, reject) => instance.close((error) => { if (error) reject(error); else resolve() }))
  })
  return `http://127.0.0.1:${(instance.address() as AddressInfo).port}`
}

async function transport(url: string): Promise<StreamableHTTPClientTransport> {
  const result = createTransport(Config({
    transport: 'streamable-http', serverName: 'redirect-test', url,
    headers: { 'X-API-Key': 'SYNTHETIC_SECRET' },
  }))
  if (!(result instanceof StreamableHTTPClientTransport)) throw new Error('Expected HTTP transport')
  await result.start()
  cleanup.push(() => result.close())
  return result
}

describe('Streamable HTTP redirect boundary (real SDK and HTTP)', () => {
  it.each([301, 302, 303])('rejects same-origin POST %s rather than changing method', async (status) => {
    let received = 0
    const source = await server((req, res) => {
      if (req.url === '/mcp') res.writeHead(status, { location: '/final' }).end()
      else { received++; res.writeHead(202).end() }
    })
    await expect((await transport(`${source}/mcp`)).send(payload)).rejects.toThrow(/Redirect.*not followed/)
    expect(received).toBe(0)
  })

  it('bounds same-origin redirect loops', async () => {
    let requests = 0
    const source = await server((_req, res) => { requests++; res.writeHead(307, { location: '/mcp' }).end() })
    await expect((await transport(`${source}/mcp`)).send(payload)).rejects.toThrow(/Redirect.*not followed/)
    expect(requests).toBe(6)
  })

  it('allows only the documented same-host default-port HTTP to HTTPS upgrade', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      expect(init?.redirect).toBe('manual')
      return (input instanceof Request ? input.url : input.toString()) === 'http://mcp.test/mcp'
        ? new Response(null, { status: 307, headers: { location: 'https://mcp.test/mcp' } })
        : new Response(null, { status: 202 })
    })
    await (await transport('http://mcp.test/mcp')).send(payload)
    expect(fetchMock.mock.calls.map(([input]) => (input instanceof Request ? input.url : input.toString()))).toEqual(['http://mcp.test/mcp', 'https://mcp.test/mcp'])
  })

  it('never follows HTTPS to HTTP downgrade', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, {
      status: 307, headers: { location: 'http://mcp.test/mcp' },
    }))
    await expect((await transport('https://mcp.test/mcp')).send(payload)).rejects.toThrow(/plain http not followed/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[1]?.redirect).toBe('manual')
  })

  it.each([301, 302, 303, 307, 308])('blocks cross-origin POST %s before credentials or body leave', async (status) => {
    const received: string[] = []
    const other = await server((req, res) => { received.push(req.url!); res.writeHead(202).end() })
    const source = await server((_req, res) => res.writeHead(status, { location: `${other}/collect` }).end())
    const client = await transport(`${source}/mcp`)
    await expect(client.send(payload)).rejects.toThrow(/Redirect.*not followed/)
    expect(received).toEqual([])
  })

  it.each([307, 308])('preserves same-origin POST %s and its payload', async (status) => {
    const received: { key: string | string[] | undefined; body: string }[] = []
    const source = await server((req, res) => {
      if (req.url === '/mcp') { res.writeHead(status, { location: '/final' }).end(); return }
      let body = ''
      req.setEncoding('utf8')
      req.on('data', (chunk: string) => { body += chunk })
      req.on('end', () => { received.push({ key: req.headers['x-api-key'], body }); res.writeHead(202).end() })
    })
    await (await transport(`${source}/mcp`)).send(payload)
    expect(received).toEqual([{ key: 'SYNTHETIC_SECRET', body: JSON.stringify(payload) }])
  })

  it('checks every hop rather than only the first same-origin redirect', async () => {
    let received = 0
    const other = await server((_req, res) => { received++; res.writeHead(202).end() })
    const source = await server((req, res) => res.writeHead(307, { location: req.url === '/mcp' ? '/hop' : `${other}/collect` }).end())
    await expect((await transport(`${source}/mcp`)).send(payload)).rejects.toThrow(/Redirect.*not followed/)
    expect(received).toBe(0)
  })

  it('blocks cross-origin resumed GET and session DELETE as well as POST', async () => {
    let received = 0
    const other = await server((_req, res) => { received++; res.writeHead(202).end() })
    const source = await server((req, res) => {
      if (req.method === 'POST') { res.writeHead(202, { 'Mcp-Session-Id': 'synthetic-session' }).end(); return }
      res.writeHead(307, { location: `${other}/collect` }).end()
    })
    const client = await transport(`${source}/mcp`)
    await client.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'redirect-test', version: '1' } } })
    expect(client.sessionId).toBe('synthetic-session')
    await expect(client.resumeStream('synthetic-event')).rejects.toThrow(/Redirect.*not followed/)
    await expect(client.terminateSession()).rejects.toThrow(/Redirect.*not followed/)
    expect(received).toBe(0)
  })
})
