/**
 * node:http ↔ WHATWG fetch bridge for the /api transport (host side of the
 * web carrier; the fetch-shaped handler itself is transport-agnostic).
 */

import type { IncomingMessage } from 'node:http'
import type { PeerScope } from '@ocean/ocean-typert-protocol'
import { Readable } from 'node:stream'
import type { ConnectionFetchHandler } from './rpc.ts'

/** Default carrier cap for all HTTP RPC bodies: sized for the default
 * aggregate image limit (200 MiB) after base64 expansion plus envelope
 * headroom (~267.7 MiB required), rounded up for slack. The bridge buffers
 * each body in memory, so this cap is also the per-request resident bound. */
export const DEFAULT_MAX_REQUEST_BODY_BYTES = 300 * 1024 * 1024

interface BridgeServerResponse {
  readonly destroyed: boolean
  readonly writableEnded: boolean
  on(event: 'close', listener: () => void): this
  off(event: 'close' | 'drain', listener: () => void): this
  once(event: 'close' | 'drain', listener: () => void): this
  writeHead(statusCode: number, headers?: Record<string, string>): unknown
  write(chunk: Uint8Array): boolean
  end(): unknown
}

/**
 * Bridge one node:http request to the fetch-shaped handler (client close
 * aborts; response writes respect backpressure and stop on disconnect).
 * @param req - incoming node:http request.
 * @param res - node:http response the bridge writes and owns to completion.
 * @param apiHandler - fetch-shaped API carrier the request is dispatched to.
 * @param peer - Peer the carrier admitted the request as.
 * @param maxRequestBodyBytes - maximum bytes buffered for a buffered route.
 */
export async function bridge(
  req: IncomingMessage,
  res: BridgeServerResponse,
  apiHandler: ConnectionFetchHandler,
  peer: PeerScope,
  maxRequestBodyBytes = DEFAULT_MAX_REQUEST_BODY_BYTES,
): Promise<void> {
  const abort = new AbortController()
  // Client-disconnect detection MUST hang off the response, not the request:
  // since Node 16, IncomingMessage 'close' fires as soon as the request body is
  // fully consumed (immediately for a bodyless GET), which would abort a
  // streaming response right after open. ServerResponse 'close' fires on connection teardown;
  // writableEnded distinguishes a normal end() from the client going away.
  res.on('close', () => {
    if (!res.writableEnded) abort.abort()
  })
  /* v8 ignore next 2 -- node:http always sets url/method on server requests. */
  const url = new URL(req.url ?? '/', 'http://ocean.internal')
  const method = req.method ?? 'GET'
  const headers = Object.fromEntries(
    Object.entries(req.headers).filter(([, value]) => typeof value === 'string') as [string, string][],
  )
  const bodyMode = apiHandler.requestBodyMode({ method, url })
  const capBody = bodyMode === 'buffered' || peer.principal.kind === 'remote-device'
  const declaredLength = req.headers['content-length']
  const rejectSize = (): void => {
    res.writeHead(413, { connection: 'close' })
    res.end()
    req.destroy()
  }
  if (capBody && declaredLength !== undefined && Number(declaredLength) > maxRequestBodyBytes) {
    rejectSize()
    return
  }
  const upload = { tooLarge: false }
  let request: Request
  if (bodyMode === 'buffered') {
    const chunks: Buffer[] = []
    let received = 0
    for await (const chunk of req) {
      const buffer = chunk as Buffer
      received += buffer.byteLength
      if (received > maxRequestBodyBytes) {
        rejectSize()
        return
      }
      chunks.push(buffer)
    }
    request = new Request(url, {
      method,
      headers,
      ...chunks.length > 0 ? { body: Buffer.concat(chunks) } : {},
      signal: abort.signal,
    })
  } else {
    let body = Readable.toWeb(req, {
      strategy: { highWaterMark: req.readableHighWaterMark, size: (chunk: Uint8Array) => chunk.byteLength },
    }) as ReadableStream<Uint8Array>
    if (capBody) {
      let received = 0
      body = body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, pump) {
          received += chunk.byteLength
          if (received <= maxRequestBodyBytes) pump.enqueue(chunk)
          else {
            upload.tooLarge = true
            pump.error(new Error('Device upload exceeds the configured body limit'))
          }
        },
      }), { preventCancel: true })
    }
    request = new Request(url, {
      method,
      headers,
      body,
      signal: abort.signal,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' })
  }
  let response: Response
  try {
    response = await apiHandler.fetch(request, peer)
  } catch (error) {
    if (!upload.tooLarge) throw error
    rejectSize()
    return
  }
  if (upload.tooLarge) {
    await response.body?.cancel()
    rejectSize()
    return
  }
  const requestUnread = bodyMode === 'streaming' && !req.readableEnded
  const responseHeaders = Object.fromEntries(response.headers.entries())
  res.writeHead(response.status, requestUnread ? { ...responseHeaders, connection: 'close' } : responseHeaders)
  if (response.body === null) {
    res.end()
    if (requestUnread) req.destroy()
    return
  }
  for await (const chunk of response.body) {
    // Drain without writing after disconnect: cancelling Node multipart bodies
    // can race their producer and reject with ERR_INVALID_STATE.
    if (abort.signal.aborted) continue
    // Backpressure: a false return means the socket buffer is full — wait for drain
    // instead of buffering unboundedly (slow or suspended consumers). 'close' also
    // resolves so a mid-wait disconnect cannot park this loop forever.
    if (!res.write(chunk) && !res.destroyed) {
      await new Promise<void>((resolve) => {
        const done = (): void => {
          res.off('drain', done)
          res.off('close', done)
          resolve()
        }
        res.once('drain', done)
        res.once('close', done)
      })
    }
  }
  res.end()
  if (requestUnread) req.destroy()
}
