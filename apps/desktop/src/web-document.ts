/** Local Web document and authenticated HTTP forwarding for the application window. */
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon',
}
const BOOT = '<script>globalThis.__OCEAN_BOOT_READY__ = Promise.withResolvers()</script>'

/**
 * Read an application-owned static asset; the index waits for asynchronous Host injections.
 * @param request - Local application request.
 * @param root - Packaged Web dist directory.
 * @returns Static response, or a missing/invalid path response.
 */
export async function serveWebDocument(request: Request, root: string): Promise<Response> {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 })
  const url = new URL(request.url)
  let pathname: string
  try { pathname = decodeURIComponent(url.pathname) } catch { return new Response(null, { status: 400 }) }
  const target = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname))
  const directory = resolve(root)
  if (!target.startsWith(directory + sep)) return new Response(null, { status: 403 })
  let body: Buffer
  try { body = await readFile(target) } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Response(null, { status: 404 })
    throw error
  }
  const content = pathname === '/' || pathname === '/index.html'
    ? body.toString().replace('<head>', '<head>' + BOOT) : new Uint8Array(body)
  return new Response(request.method === 'HEAD' ? null : content, {
    headers: { 'content-type': MIME[extname(target)] ?? 'application/octet-stream' },
  })
}

/**
 * Exchange the Host launch URL for an authority-bound browser cookie.
 * @param url - Authenticated URL reported by the owned Host process.
 * @returns Cookie header for requests forwarded to that Host.
 */
export async function authenticateWebHost(url: string): Promise<string> {
  const response = await fetch(url, { redirect: 'manual' })
  const cookie = response.headers.get('set-cookie')
  await response.body?.cancel()
  if (response.status !== 303 || cookie === null) throw new Error('Desktop Host authentication failed')
  const end = cookie.indexOf(';')
  return end < 0 ? cookie : cookie.slice(0, end)
}

/** Cookie store operations used to remove legacy Host authentication cookies. */
export interface HostCookieStore {
  get(filter: { url: string }): Promise<readonly { readonly name: string }[]>
  remove(url: string, name: string): Promise<void>
}

/**
 * Remove every `dsh-auth-*` cookie that earlier releases left in a cookie store for the Host's hostname.
 * Cookies ignore ports, so cookies from earlier random-port Hosts would otherwise travel with every
 * request to that hostname until they expire.
 * @param cookies - Electron session cookie store.
 * @param url - Host URL; cookies for its hostname on every port are removed.
 */
export async function removeLegacyHostCookies(cookies: HostCookieStore, url: string): Promise<void> {
  const origin = new URL(url).origin
  for (const { name } of await cookies.get({ url: origin })) {
    if (name.startsWith('dsh-auth-')) await cookies.remove(origin, name)
  }
}

/**
 * Response headers not relayed to the renderer. `set-cookie` would hand the
 * Host's authentication cookie to the page's cookie jar, which the shell owns
 * instead; the rest describe the Node `fetch` connection (its encoding, length,
 * and hop-by-hop transport), which Chromium never sees.
 */
const WITHHELD_RESPONSE_HEADERS = [
  'set-cookie',
  'content-encoding', 'content-length',
  'transfer-encoding', 'connection', 'keep-alive', 'te', 'trailer', 'upgrade', 'proxy-authenticate', 'proxy-authorization',
]

/** Host routes whose responses carry immutable cache headers keyed by a per-process revision. */
const PLUGIN_BUNDLE_PATH = /^\/plugins\//u

/**
 * Forward local application requests to its authenticated Host, preserving streaming and cancellation.
 * Validated application origins are represented as the Host origin for same-origin checks.
 * Plugin bundle responses lose their `cache-control` for `no-store`: the Host marks them immutable
 * under a revision that changes every launch, so Chromium's disk cache would only accumulate bundles
 * no later launch can reuse.
 * @param request - Request from the application origin.
 * @param host - Authenticated Host URL, including its mount path.
 * @param cookie - Host-issued authentication cookie.
 * @param containRemoteRedirects - Remap read redirects within the selected HTTPS mount and reject all others.
 * @returns Host response without connection-level headers.
 */
export async function forwardWebRequest(request: Request, host: string, cookie: string, containRemoteRedirects = false): Promise<Response> {
  const source = new URL(request.url)
  if (source.protocol !== 'dsh-app:' || source.host !== 'app' || source.username || source.password) {
    return new Response(null, { status: 403 })
  }
  const origin = request.headers.get('origin')
  if ((origin !== null && origin !== 'dsh-app://app') || request.headers.get('sec-fetch-site') === 'cross-site') return new Response(null, { status: 403 })
  const target = new URL(host)
  const mount = target.pathname.endsWith('/') ? target.pathname : target.pathname + '/'
  target.pathname = mount + source.pathname.slice(1)
  if (!target.pathname.startsWith(mount)) return new Response(null, { status: 403 })
  target.search = source.search
  const headers = new Headers(request.headers)
  for (const name of ['host', 'origin', 'cookie', 'authorization', 'sec-fetch-site']) headers.delete(name)
  headers.set('origin', target.origin)
  headers.set('cookie', cookie)
  const init = { method: request.method, headers, body: request.body, signal: request.signal, duplex: 'half', redirect: 'manual' as const }
  const response = await fetch(target, init)
  const outgoing = new Headers(response.headers)
  const location = outgoing.get('location')
  if (containRemoteRedirects && response.status >= 300 && response.status < 400 && location !== null) {
    const redirect = remoteReadRedirect(request, target, mount, location)
    if (redirect === undefined) {
      await response.body?.cancel()
      return new Response(null, { status: 502 })
    }
    outgoing.set('location', redirect)
  }
  for (const name of WITHHELD_RESPONSE_HEADERS) outgoing.delete(name)
  if (PLUGIN_BUNDLE_PATH.test(source.pathname)) outgoing.set('cache-control', 'no-store')
  return new Response(response.body, { status: response.status, headers: outgoing })
}

/** Preserve versioned media reads without exposing a credential-bearing Host URL to Chromium. */
function remoteReadRedirect(request: Request, target: URL, mount: string, location: string): string | undefined {
  if (request.method !== 'GET' && request.method !== 'HEAD') return undefined
  let redirect: URL
  try { redirect = new URL(location, target) } catch (_error) {
    // A malformed Location is not a destination the owned view can request.
    return undefined
  }
  if (redirect.origin !== target.origin || redirect.username || redirect.password || !redirect.pathname.startsWith(mount)) return undefined
  const local = new URL(request.url)
  local.pathname = '/' + redirect.pathname.slice(mount.length)
  local.search = redirect.search
  local.hash = redirect.hash
  return local.href
}
