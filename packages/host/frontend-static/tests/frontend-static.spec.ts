/**
 * REAL-composition coverage: a test-only cordis.yml booted through the
 * vendored Loader mounts the webserver and frontend-static rows, and every
 * assertion observes the served HTTP surface — asset serving, explicit index
 * entry points with index taps, 404 misses, traversal rejection, 405 on non-
 * GET/HEAD, and seat release on fiber disposal (HMR safety).
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import * as Connection from '@ocean/ocean-client-connection'
import { DeviceTokens, deviceRegistryKey } from '@ocean/ocean-client-connection/src/device-tokens.ts'
import LocalCredentials from '@ocean/ocean-credentials-local'
import HttpServer from '@ocean/ocean-host-webserver'
import * as FrontendStatic from '../src/index.ts'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

/** Write a dist fixture and the authenticated Web rows, then boot them through the real Loader. */
async function loadComposition(connectionConfig?: Record<string, unknown>): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'ocean-frontend-static-'))
  const dist = join(root, 'dist')
  await mkdir(dist)
  const distIndex = join(dist, 'index.html')
  await writeFile(distIndex, '<head></head><body>shell</body>')
  await writeFile(join(dist, 'app.js'), 'export {}')
  await writeFile(join(dist, 'about.html'), '<body>about</body>')
  await writeFile(join(dist, 'blob.bin'), 'BLOB')
  await writeFile(join(dist, 'manifest.webmanifest'), '{}')
  await writeFile(join(dist, 'icon-192.png'), 'PNG')
  await mkdir(join(dist, 'empty'))
  const configPath = join(root, 'cordis.yml')
  const connectionLines = connectionConfig === undefined
    ? ["- name: '@ocean/ocean-client-connection'"]
    : [
      "- name: '@ocean/ocean-client-connection'",
      '  config:',
      ...Object.entries(connectionConfig).map(([key, value]) => `    ${key}: ${JSON.stringify(value)}`),
    ]
  await writeFile(configPath, [
    "- name: '@ocean/ocean-credentials-local'",
    '  config:',
    `    path: '${join(root, '.credentials.yaml')}'`,
    '    watch: false',
    "- name: '@ocean/ocean-host-webserver'",
    '  config:',
    "    host: '127.0.0.1'",
    '    port: 0',
    ...connectionLines,
    '- id: frontend',
    "  name: '@ocean/ocean-host-frontend-static'",
    '  config:',
    `    distIndex: '${distIndex}'`,
    '',
  ].join('\n'))

  context = new Context()
  context.baseUrl = pathToFileURL(root).href + '/'
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@ocean/ocean-credentials-local', LocalCredentials],
    ['@ocean/ocean-host-webserver', HttpServer],
    ['@ocean/ocean-client-connection', Connection],
    ['@ocean/ocean-host-frontend-static', FrontendStatic],
  ])
  context.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof context.loader.internal>
  await context.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await context.loader.await()
  return context
}

/** GET (by default) one path against the running server; returns status, content-type, and the body. */
async function request(
  port: number | undefined,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; type: string | null; body: string }> {
  if (port === undefined) throw new Error('frontend-static test: the listener has not bound a port')
  const response = await fetch(`http://127.0.0.1:${String(port)}${path}`, init)
  return {
    status: response.status,
    type: response.headers.get('content-type'),
    body: await response.text(),
  }
}

describe('real Loader composition', () => {
  it('serves explicit index entries and files while preserving HTTP error semantics', { timeout: 60_000 }, async () => {
    const loaded = await loadComposition()
    const unloaded = [...loaded.loader.entries()]
      .filter(entry => entry.fiber === undefined && !entry.disabled)
      .map(entry => entry.options.name)
    expect(unloaded).toEqual([])
    const server = loaded.webServer
    const port = server.port
    const launchUrl = loaded.connection.authenticatedUrl(`http://127.0.0.1:${String(port)}`)
    const exchange = await fetch(launchUrl, { redirect: 'manual' })
    expect(exchange.status).toBe(303)
    expect(exchange.headers.get('location')).toBe('./')
    const setCookie = exchange.headers.get('set-cookie')
    if (setCookie === null) throw new Error('authenticated frontend did not set a cookie')
    const cookie = setCookie.split(';', 1)[0]!
    const authenticated = (init?: RequestInit): RequestInit => {
      const headers = new Headers(init?.headers)
      headers.set('cookie', cookie)
      return { ...init, headers }
    }

    expect(await request(port, '/')).toMatchObject({
      status: 401,
      type: 'text/plain; charset=utf-8',
      body: 'ocean web authentication required; reopen the URL printed by ocean web.\n',
    })

    // Real assets with their MIME types; a live rebuild is served on the next read.
    expect(await request(port, '/app.js')).toMatchObject({ status: 200, type: 'text/javascript; charset=utf-8', body: 'export {}' })
    expect(await request(port, '/manifest.webmanifest')).toMatchObject({
      status: 200,
      type: 'application/manifest+json',
      body: '{}',
    })
    // The install icons are images; a launcher must not receive them as octet-stream.
    expect(await request(port, '/icon-192.png')).toMatchObject({ status: 200, type: 'image/png', body: 'PNG' })
    expect(await request(port, '/app.js', { method: 'HEAD' })).toEqual({
      status: 200,
      type: 'text/javascript; charset=utf-8',
      body: '',
    })
    await writeFile(join(root!, 'dist', 'app.js'), 'export const rebuilt = true')
    expect(await request(port, '/app.js')).toMatchObject({ status: 200, body: 'export const rebuilt = true' })

    // Unknown extension ships as octet-stream.
    expect(await request(port, '/blob.bin')).toMatchObject({ status: 200, type: 'application/octet-stream', body: 'BLOB' })

    // Only the root and index path render index.html through registered taps.
    const untap = server.tapIndex(html => html.replace('<head>', '<head><script>window.__T__=1</script>'))
    // A plugin row stands in for the Host's plugin-resource rows: the base the
    // shell inserts must precede it, not merely exist.
    const renderedFor: Connection.PeerScope[] = []
    const offRows = loaded.on('webserver/index-inject', (rows, peer) => {
      renderedFor.push(peer)
      rows.push({ kind: 'script-preload', src: 'plugins/boot.js' })
    })
    for (const path of ['/', '/index.html', '/?view=test']) {
      const got = await request(port, path, authenticated())
      expect(got.status).toBe(200)
      expect(got.type).toBe('text/html; charset=utf-8')
      expect(got.body).toContain('__T__')
      expect(got.body).toContain('shell')
      // The served document carries the entry-directory base exactly once, and
      // it precedes every injected row and tap markup, so the shell's
      // app-owned routes and the Host's resource rows resolve under one mount.
      expect(got.body.match(/<base\b/g)).toHaveLength(1)
      const base = got.body.indexOf('<base href="./">')
      expect(base).toBeLessThan(got.body.indexOf('<link rel="preload" as="script" href="plugins/boot.js">'))
      expect(base).toBeLessThan(got.body.indexOf('<script>window.__T__=1</script>'))
    }
    // An authenticated browser renders for the owner's shared browser Peer.
    expect(renderedFor).toEqual([loaded.connection.browserPeer, loaded.connection.browserPeer, loaded.connection.browserPeer])
    offRows()
    expect(await request(port, '/', authenticated({ method: 'HEAD' }))).toEqual({
      status: 200,
      type: 'text/html; charset=utf-8',
      body: '',
    })
    untap()
    expect((await request(port, '/', authenticated())).body).not.toContain('__T__')

    // A missing configured index follows the same empty-404 contract for both
    // of its public entry paths and for both supported methods.
    await rm(join(root!, 'dist', 'index.html'))
    for (const path of ['/', '/index.html']) {
      const get = await request(port, path, authenticated())
      const head = await request(port, path, authenticated({ method: 'HEAD' }))
      expect(get).toEqual({ status: 404, type: null, body: '' })
      expect(head).toEqual(get)
    }

    // Ordinary unknown paths and static-resource misses are empty 404s for
    // both GET and HEAD; neither class can be mistaken for the HTML shell.
    const ordinaryMisses = ['/no/such/route', '/empty', '/app.js/child']
    const assetMisses = [
      '/missing.js',
      '/missing.css',
      '/missing.mjs',
      '/missing.js.map',
      '/missing.webmanifest',
      '/missing.manifest',
    ]
    for (const path of [...ordinaryMisses, ...assetMisses]) {
      const get = await request(port, path)
      const head = await request(port, path, { method: 'HEAD' })
      expect(get).toEqual({ status: 404, type: null, body: '' })
      expect(head).toEqual(get)
    }
    expect(await request(port, '/api/no/such/route', authenticated())).toEqual({
      status: 404,
      type: 'text/plain;charset=UTF-8',
      body: 'not found',
    })

    // Traversal outside the dist root is 403, non-GET/HEAD is 405, and a
    // malformed filesystem target still reaches the webserver's 400 guard.
    expect((await request(port, '/..%2f..%2fetc%2fpasswd')).status).toBe(403)
    expect((await request(port, '/app.js', { method: 'POST' })).status).toBe(405)
    expect((await request(port, '/bad%00path')).status).toBe(400)

    // HMR safety: disposing the frontend row releases the fallback seat (the
    // unclaimed webserver answers 404) and the seat is claimable again.
    const frontendEntry = [...loaded.loader.entries()].find(e => e.options.id === 'frontend')
    expect(frontendEntry).toBeDefined()
    await frontendEntry!.fiber?.dispose()
    expect((await request(port, '/no/such/route')).status).toBe(404)
    expect(() => server.registerFallback(() => {})).not.toThrow()
  })

  it('answers in-process reads for the given Peer without browser authentication', { timeout: 60_000 }, async () => {
    const loaded = await loadComposition()
    const server = loaded.webServer
    const reader = { principal: { kind: 'owner' } } as Connection.PeerScope
    const read = (path: string, init?: RequestInit) => server.readResource(new Request(`http://reader.invalid${path}`, init), reader)
    const renderedFor: Connection.PeerScope[] = []
    loaded.on('webserver/index-inject', (rows, peer) => {
      renderedFor.push(peer)
      rows.push({ kind: 'global', name: '__READER__', value: peer === reader })
    })

    // The index renders for the reader's Peer with no cookie or token, and
    // keeps the entry-directory base ahead of the injected rows.
    for (const path of ['/', '/index.html']) {
      const index = await read(path)
      expect(index.status).toBe(200)
      expect(index.headers.get('content-type')).toBe('text/html; charset=utf-8')
      const html = await index.text()
      expect(html).toContain('globalThis["__READER__"] = true')
      expect(html.indexOf('<base href="./">')).toBeLessThan(html.indexOf('__READER__'))
      expect(html).toContain('shell')
    }
    expect(renderedFor).toEqual([reader, reader])
    const head = await read('/', { method: 'HEAD' })
    expect({ status: head.status, type: head.headers.get('content-type'), body: await head.text() })
      .toEqual({ status: 200, type: 'text/html; charset=utf-8', body: '' })

    // Assets, misses, traversal, and methods keep the HTTP semantics.
    const asset = await read('/app.js')
    expect({ status: asset.status, type: asset.headers.get('content-type'), body: await asset.text() })
      .toEqual({ status: 200, type: 'text/javascript; charset=utf-8', body: 'export {}' })
    expect((await read('/missing.js')).status).toBe(404)
    expect((await read('/..%2f..%2fetc%2fpasswd')).status).toBe(403)
    expect((await read('/app.js', { method: 'POST', body: 'x' })).status).toBe(405)
    await expect(read('/bad%00path')).rejects.toThrow()
    await rm(join(root!, 'dist', 'index.html'))
    expect((await read('/')).status).toBe(404)
  })

  it('lets browsers revalidate every file except the index', { timeout: 60_000 }, async () => {
    const loaded = await loadComposition()
    const base = `http://127.0.0.1:${String(loaded.webServer.port)}`
    const first = await fetch(`${base}/app.js`)
    const etag = first.headers.get('etag')
    if (etag === null) throw new Error('a dist file carried no ETag')
    expect(etag).toMatch(/^W\/"[A-Za-z0-9_-]+"$/)
    expect(first.headers.get('cache-control')).toBe('no-cache')
    expect(await first.text()).toBe('export {}')

    const revalidated = await fetch(`${base}/app.js`, { headers: { 'if-none-match': etag } })
    expect([revalidated.status, revalidated.headers.get('etag'), revalidated.headers.get('cache-control')]).toEqual([304, etag, 'no-cache'])
    expect(await revalidated.text()).toBe('')
    // An in-process read revalidates the same way.
    const reader = { principal: { kind: 'owner' } } as Connection.PeerScope
    const read = await loaded.webServer.readResource(new Request(`${base}/app.js`, { headers: { 'if-none-match': etag } }), reader)
    expect(read.status).toBe(304)

    // New content under the same name changes the ETag, so the stale copy is replaced.
    await writeFile(join(root!, 'dist', 'app.js'), 'export const rebuilt = true')
    const rebuilt = await fetch(`${base}/app.js`, { headers: { 'if-none-match': etag } })
    expect(rebuilt.status).toBe(200)
    expect(rebuilt.headers.get('etag')).not.toBe(etag)
    expect(await rebuilt.text()).toBe('export const rebuilt = true')

    // Only the rendered index carries no cache headers; another HTML file revalidates.
    const html = await fetch(`${base}/about.html`)
    expect([html.status, html.headers.get('cache-control')]).toEqual([200, 'no-cache'])
    expect(html.headers.get('etag')).toMatch(/^W\//)
    expect(await html.text()).toBe('<body>about</body>')
    const index = await loaded.webServer.readResource(new Request(`${base}/`), reader)
    expect([index.status, index.headers.get('cache-control'), index.headers.get('etag')]).toEqual([200, 'no-store', null])
  })

  it('challenges anonymous browsers with the device sign-in document and admits device logins', { timeout: 60_000 }, async () => {
    const loaded = await loadComposition({
      allowOwnerLogin: false,
      deviceProxyUrl: 'https://app.example',
      trustedHosts: ['app.example'],
      maxDeviceTransports: 1,
    })
    const base = `http://127.0.0.1:${String(loaded.webServer.port)}`

    // An anonymous document request receives the self-contained sign-in
    // challenge, not the legacy plain-text authentication refusal.
    const challenge = await fetch(`${base}/`)
    expect(challenge.status).toBe(401)
    expect(challenge.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(challenge.headers.get('cache-control')).toBe('no-store')
    expect(challenge.headers.get('referrer-policy')).toBe('no-referrer')
    const html = await challenge.text()
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('Sign in to Ocean')
    expect(html).toContain('<input id="device-token" type="password" autocomplete="off" required maxlength="80">')
    expect(html).toContain('<button type="submit" disabled>Sign in</button>')
    expect(html).toContain('<p role="alert" hidden>')
    // The CSP hash admits exactly the one script the document embeds.
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1]
    expect(script).toBeDefined()
    const integrity = createHash('sha256').update(script!).digest('base64')
    expect(challenge.headers.get('content-security-policy')).toBe(
      `default-src 'none'; script-src 'sha256-${integrity}'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'`,
    )

    // HEAD carries the challenge headers without a body; Accept-Language
    // selects the copy, trimmed and case-insensitive.
    const head = await fetch(`${base}/`, { method: 'HEAD' })
    expect(head.status).toBe(401)
    expect(head.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(await head.text()).toBe('')
    for (const [language, lang, title] of [
      ['zh-CN', 'zh', '登录 Ocean'],
      ['  ZH-Hans  ', 'zh', '登录 Ocean'],
      ['fr', 'en', 'Sign in to Ocean'],
    ] as const) {
      const localized = await fetch(`${base}/`, { headers: { 'accept-language': language } })
      expect(localized.status).toBe(401)
      const body = await localized.text()
      expect(body).toContain(`<html lang="${lang}">`)
      expect(body).toContain(`<title>${title}</title>`)
    }

    // Issue a device and an origin-bound login through the real credential store.
    const tokens = new DeviceTokens(loaded.credentials)
    const device = await tokens.issue('laptop')
    const credential = await tokens.exchange(device.token, 'https://app.example', { lifetimeMs: 60_000, maxSessionsPerDevice: 4 })
    if (credential === undefined) throw new Error('device exchange did not commit a login')
    const deviceHeaders = { host: 'app.example', cookie: `__Host-ocean-device=${credential}` }

    // The listener is plain HTTP behind the declared HTTPS proxy origin, so a
    // proxied browser's admission is presented as an in-process read with the
    // same wire headers and no admitted Peer, exactly as HTTP dispatch does.
    const read = (init?: RequestInit, peer?: Connection.PeerScope): Promise<Response> => loaded.webServer.readResource(
      new Request('https://app.example/', init), peer as Connection.PeerScope)
    const renderedFor: Connection.PeerScope[] = []
    const offRows = loaded.on('webserver/index-inject', (_rows, peer) => { renderedFor.push(peer) })

    const admitted = await read({ headers: deviceHeaders })
    expect(admitted.status).toBe(200)
    const document = await admitted.text()
    expect(document).toContain('<base href="./" data-ocean-device>')
    expect(document).toContain('shell')
    expect(document.match(/<base\b/g)).toHaveLength(1)
    expect(renderedFor).toHaveLength(1)
    expect(renderedFor[0]!.principal.kind).toBe('remote-device')
    // maxDeviceTransports is 1: the next admission only succeeds once the
    // previous document's lease released.
    const again = await read({ headers: deviceHeaders })
    expect(again.status).toBe(200)
    await again.body?.cancel()
    const headAdmitted = await read({ method: 'HEAD', headers: deviceHeaders })
    expect(headAdmitted.status).toBe(200)
    expect(await headAdmitted.text()).toBe('')
    offRows()

    // An invalid login falls back to the challenge document.
    const refused = await read({ headers: {
      host: 'app.example',
      cookie: '__Host-ocean-device=00000000-0000-4000-8000-000000000000.invalid',
    } })
    expect(refused.status).toBe(401)
    expect(await refused.text()).toContain('Sign in to Ocean')

    // A failed credential read is a 503, never an admission.
    await loaded.credentials.modifyRecord(deviceRegistryKey, () => Promise.resolve({
      kind: 'grant', payload: { version: 1, devices: 'corrupt' },
    }))
    const unavailable = await read({ headers: deviceHeaders })
    expect(unavailable.status).toBe(503)
    expect(unavailable.headers.get('cache-control')).toBe('no-store')
    expect(await unavailable.text()).toBe('')
  })
})
