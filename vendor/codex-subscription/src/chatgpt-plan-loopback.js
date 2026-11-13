/** Single-attempt loopback callback for the host-owned ChatGPT plan login. */
import { createServer } from 'node:http'
import { createPlanAttempt, exchangePlanCode } from './chatgpt-plan-protocol.js'

/** Bind before creating the authorization URL. @param {object} options - Host identity, timeout and exchange operation. @returns {Promise<object>} Login URL, completion and cancellation. */
export async function startPlanLogin({ hostId, timeoutMs, registration, exchange = exchangePlanCode, onDiscard = () => {} }) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('ChatGPT login timeout is invalid')
  const controller = new AbortController()
  let resolve, reject, finished = false, consumed = false, timer, attempt, pendingResponse
  const completion = new Promise((yes, no) => { resolve = yes; reject = no })
  const server = createServer((request, response) => {
    if (finished || consumed || request.method !== 'GET' || typeof request.url !== 'string' || request.url.length > 8192) { response.writeHead(400).end(); return }
    let callback
    try { callback = new URL(request.url, attempt.redirectUri) } catch { response.writeHead(400).end(); return }
    if (callback.origin + callback.pathname !== attempt.redirectUri || callback.searchParams.getAll('state').length !== 1 || callback.searchParams.get('state') !== attempt.state) { response.writeHead(400).end(); return }
    consumed = true
    pendingResponse = response
    void Promise.resolve().then(() => exchange({ attempt, callback, signal: controller.signal })).then(value => {
      if (finished) { void Promise.resolve().then(() => onDiscard(value)).catch(() => {}); return }
      response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }).end('You may return to Ocean.')
      finish(undefined, value)
    }, () => {
      if (finished) return
      response.writeHead(400, { 'cache-control': 'no-store' }).end('Sign-in was not completed.')
      finish(new Error('ChatGPT sign-in was not completed'))
    })
  })
  await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', () => { server.off('error', no); yes() }) })
  const address = server.address()
  if (address === null || typeof address === 'string') { server.close(); throw new Error('ChatGPT login listener unavailable') }
  try { attempt = createPlanAttempt({ hostId, port: address.port, registration }) } catch (error) { server.close(); throw error }
  function finish(error, value) {
    if (finished) return
    finished = true
    clearTimeout(timer)
    controller.abort()
    if (error && pendingResponse && !pendingResponse.headersSent) pendingResponse.writeHead(400, { 'cache-control': 'no-store' }).end('Sign-in was not completed.')
    server.close()
    if (error) reject(error); else resolve(value)
  }
  timer = setTimeout(() => finish(new Error('ChatGPT sign-in timed out')), timeoutMs)
  return { url: attempt.url, completion, cancel: async () => { finish(new Error('ChatGPT sign-in cancelled')) } }
}
