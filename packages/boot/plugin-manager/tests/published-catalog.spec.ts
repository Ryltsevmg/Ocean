import { createHash } from 'node:crypto'
import { createServer, type ServerResponse } from 'node:http'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { expect, it, onTestFinished, vi } from 'vitest'
import { isPublishedCatalogUrl, PublishedCatalogSource } from '../src/published-catalog.ts'
import type { PublishedCatalog } from '../src/types.ts'

const bytes = Buffer.from('archive fixture')
const sha256 = createHash('sha256').update(bytes).digest('hex')
const target = { name: '@ocean/example', version: '1.2.3', sha256 }

async function channel(onIndex?: (response: ServerResponse) => boolean, redirect?: string | null) {
  let index: unknown
  let archive: Buffer = bytes
  let available = true
  let downloads = 0
  const server = createServer((req, res) => {
    if (req.url === '/v1/current.json') {
      if (onIndex?.(res) === true) return
      res.statusCode = available ? 200 : 503
      res.end(JSON.stringify(index))
    } else if (req.url === `/archives/${sha256}/plugin.tgz`) {
      downloads++
      if (redirect !== undefined) { res.writeHead(307, redirect === null ? {} : { location: redirect }).end(); return }
      res.end(archive)
    } else {
      res.writeHead(404).end()
    }
  }).listen(0, '127.0.0.1')
  onTestFinished(() => new Promise<void>((resolve, reject) => {
    server.close((error) => { if (error === undefined) resolve(); else reject(error) })
  }))
  await once(server, 'listening')
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('No fixture port')
  const origin = `http://127.0.0.1:${address.port}`
  const profileDir = await mkdtemp(join(tmpdir(), 'ocean-published-catalog-'))
  onTestFinished(() => rm(profileDir, { force: true, recursive: true }))
  const abort = new AbortController()
  const url = `${origin}/v1/current.json`
  const source = new PublishedCatalogSource({ url, profileDir, timeoutMs: 5_000, runtimeVersion: '1.0.0', lifetime: abort.signal })
  const offer = {
    ...target, ocean: '^1.0.0', title: { en: 'Example', ru: 'Пример' },
    description: { en: 'Example description', ru: 'Описание примера' }, archive: `${origin}/archives/${sha256}/plugin.tgz`,
  }
  index = { schemaVersion: 1, plugins: [offer] }
  return {
    source, abort, profileDir, offer, downloads: () => downloads,
    setIndex: (value: unknown) => { index = value },
    setAvailable: (value: boolean) => { available = value },
    setArchive: (value: Buffer) => { archive = value },
  }
}

it('accepts only the owned repository or a configured loopback channel', () => {
  expect(isPublishedCatalogUrl('https://raw.githubusercontent.com/Ryltsevmg/Ocean/plugin-catalog/v1/current.json')).toBe(true)
  expect(isPublishedCatalogUrl('http://127.0.0.1:62116/current.json')).toBe(true)
  expect(isPublishedCatalogUrl('https://raw.githubusercontent.com/example/Ocean/plugin-catalog/v1/current.json')).toBe(false)
  expect(isPublishedCatalogUrl('http://192.0.2.1/v1/current.json')).toBe(false)
  expect(isPublishedCatalogUrl('http://user@127.0.0.1/index.json')).toBe(false)
})

it('builds a reader only for the owned public repository or a loopback channel', () => {
  const settings = { profileDir: '/fixture', timeoutMs: 5_000, runtimeVersion: '1.0.0', lifetime: new AbortController().signal }
  expect(() => new PublishedCatalogSource({ ...settings, url: 'https://raw.githubusercontent.com/Ryltsevmg/Ocean/plugin-catalog/v1/current.json' })).not.toThrow()
  expect(() => new PublishedCatalogSource({ ...settings, url: 'http://127.0.0.1:62116/current.json' })).not.toThrow()
  // A channel the reader does not own never reaches the network: the refusal is at construction.
  expect(() => new PublishedCatalogSource({ ...settings, url: 'https://example.invalid/Ryltsevmg/Ocean/v1/current.json' }))
    .toThrow('plugin-manager: invalid publishedCatalogUrl')
  expect(() => new PublishedCatalogSource({ ...settings, url: 'https://raw.githubusercontent.com/Ryltsevmg/Ocean/plugin-catalog/v1/current' }))
    .toThrow('plugin-manager: invalid publishedCatalogUrl')
})

it('admits new offers, retains only display data on failure, and accepts an authoritative empty index', async () => {
  const c = await channel()
  c.setAvailable(false)
  expect(await c.source.list()).toEqual({ status: 'unavailable', plugins: [] })
  c.setAvailable(true)
  expect(await c.source.list()).toEqual({ status: 'ready', plugins: [
    { ...target, title: { en: 'Example', ru: 'Пример' }, description: { en: 'Example description', ru: 'Описание примера' }, compatible: true },
  ] })
  c.setAvailable(false)
  expect(await c.source.list()).toMatchObject({ status: 'stale', plugins: [target] })
  await expect(c.source.prepare(target, c.abort.signal)).rejects.toMatchObject({ code: 'published-offer-unavailable' })
  c.setAvailable(true)
  c.setIndex({ schemaVersion: 1, plugins: [] })
  expect(await c.source.list()).toEqual({ status: 'ready', plugins: [] })
  await expect(c.source.prepare(target, c.abort.signal)).rejects.toMatchObject({ code: 'published-offer-unavailable' })
  expect(c.downloads()).toBe(0)
})

it('refuses a catalog beyond its byte limit before reading it any further', async () => {
  const c = await channel()
  // The padding also breaks the strict schema, so only the byte limit can be what stopped this read.
  c.setIndex({ schemaVersion: 1, plugins: [], padding: 'x'.repeat(600 * 1024) })
  expect(await c.source.list()).toEqual({ status: 'unavailable', plugins: [] })
  expect(c.downloads()).toBe(0)
})

it('accepts localized display text with a required English fallback, and plain strings', async () => {
  const c = await channel()
  expect((await c.source.list()).plugins[0]).toMatchObject({ title: { en: 'Example', ru: 'Пример' }, compatible: true })
  c.setIndex({ schemaVersion: 1, plugins: [{ ...c.offer, title: 'Plain title', description: 'Plain description' }] })
  expect((await c.source.list()).plugins[0]).toMatchObject({ title: 'Plain title', description: 'Plain description' })
})

it.each([
  { title: { ru: 'Пример' } },
  { description: { ru: 'Описание примера' } },
  { title: { en: 'Example', ru: '  ' } },
  { title: { en: 'x'.repeat(121) } },
  { description: { en: 'x'.repeat(2049) } },
])('refuses display text without a usable English fallback or beyond its bounds (%j)', async (change) => {
  const c = await channel()
  c.setIndex({ schemaVersion: 1, plugins: [{ ...c.offer, ...change }] })
  expect(await c.source.list()).toEqual({ status: 'unavailable', plugins: [] })
  expect(c.downloads()).toBe(0)
})

it.each(['./local-plugin', 'https://github.com/acme/plugin.git'])(
  'refuses an index holding an offer the installer cannot hold as a registry package: %s', async (name) => {
    const c = await channel()
    // A name install-spec refuses is caught, not propagated: the whole index is rejected as invalid.
    c.setIndex({ schemaVersion: 1, plugins: [{ ...c.offer, name }] })
    expect(await c.source.list()).toEqual({ status: 'unavailable', plugins: [] })
    expect(c.downloads()).toBe(0)
  })

const otherPlatform = process.platform === 'darwin' ? 'win32' : 'darwin'

it.each([
  { platforms: [process.platform], compatible: true },
  { platforms: [otherPlatform], compatible: false },
])('limits a platform-pinned offer to the platforms it names (%j)', async ({ platforms, compatible }) => {
  const c = await channel()
  c.setIndex({ schemaVersion: 1, plugins: [{ ...c.offer, platforms }] })
  expect((await c.source.list()).plugins[0]).toMatchObject({ compatible })
  if (compatible) {
    expect(await c.source.prepare(target, c.abort.signal)).toBe(join(c.profileDir, 'published-plugins', sha256, 'plugin.tgz'))
    expect(c.downloads()).toBe(1)
    return
  }
  await expect(c.source.prepare(target, c.abort.signal)).rejects.toMatchObject({ code: 'published-offer-unavailable' })
  expect(c.downloads()).toBe(0)
})

it('refuses an offer repeating a platform, whatever its declared count', async () => {
  const c = await channel()
  c.setIndex({ schemaVersion: 1, plugins: [{ ...c.offer, platforms: [process.platform, process.platform] }] })
  expect(await c.source.list()).toEqual({ status: 'unavailable', plugins: [] })
  expect(c.downloads()).toBe(0)
})

it('refuses stale, incompatible and wrong-origin offers before downloading', async () => {
  const c = await channel()
  const withOffer = (entry: object) => { c.setIndex({ schemaVersion: 1, plugins: [entry] }) }
  await expect(c.source.prepare({ ...target, version: '9.9.9' }, c.abort.signal)).rejects.toMatchObject({ code: 'published-offer-unavailable' })
  withOffer({ ...c.offer, ocean: '^2.0.0' })
  expect(await c.source.list()).toMatchObject({ status: 'ready', plugins: [{ compatible: false }] })
  await expect(c.source.prepare(target, c.abort.signal)).rejects.toMatchObject({ code: 'published-offer-unavailable' })
  const retired = { ...c.offer, name: '@ocean/ocean-cua-bundle', version: '1.0.1' }
  withOffer(retired)
  expect(await c.source.list()).toMatchObject({ status: 'ready', plugins: [{ compatible: false }] })
  await expect(c.source.prepare(retired, c.abort.signal)).rejects.toMatchObject({ code: 'published-offer-unavailable' })
  withOffer({ ...retired, version: '1.0.0' })
  expect(await c.source.list()).toMatchObject({ status: 'ready', plugins: [{ compatible: true }] })
  withOffer({ ...c.offer, archive: 'https://example.invalid/plugin.tgz' })
  expect(await c.source.list()).toMatchObject({ status: 'stale' })
  expect(c.downloads()).toBe(0)
})

it('serves concurrent listings from one catalog read the first listing started', async () => {
  let reads = 0
  const held = Promise.withResolvers<ServerResponse>()
  const c = await channel((response) => {
    if (reads++ > 0) return false
    held.resolve(response)
    return true
  })
  // Both listings enter the source before the first response arrives, so only one read may reach the channel.
  const listings = [c.source.list(), c.source.list()]
  const response = await held.promise
  response.end(JSON.stringify({ schemaVersion: 1, plugins: [c.offer] }))
  const [first, second] = await Promise.all(listings)
  expect(reads).toBe(1)
  expect(first).toMatchObject({ status: 'ready', plugins: [target] })
  expect(second).toEqual(first)
})

it.each([false, true])('refuses installation if either concurrent read withdraws the offer (install response still lists it: %s)', async (published) => {
  let first = true
  const held = Promise.withResolvers<ServerResponse>()
  const c = await channel((response) => {
    if (!first) return false
    first = false
    held.resolve(response)
    return true
  })
  const prepare = c.source.prepare(target, c.abort.signal)
  const denied = expect(prepare).rejects.toMatchObject({ code: 'published-offer-unavailable' })
  const response = await held.promise
  try {
    c.setIndex({ schemaVersion: 1, plugins: published ? [] : [c.offer] })
    expect((await c.source.list()).plugins).toHaveLength(published ? 0 : 1)
  } finally {
    response.end(JSON.stringify({ schemaVersion: 1, plugins: published ? [c.offer] : [] }))
  }
  await denied
  expect(c.downloads()).toBe(0)
})

it('refuses an archive redirect outside the release-assets origin', async () => {
  const c = await channel(undefined, 'https://evil.example/plugin.tgz')
  await expect(c.source.prepare(target, c.abort.signal)).rejects.toMatchObject({ code: 'published-offer-unavailable' })
  expect(c.downloads()).toBe(1)
})

it('refuses an archive redirect that names no address to follow', async () => {
  const c = await channel(undefined, null)
  await expect(c.source.prepare(target, c.abort.signal)).rejects.toMatchObject({ code: 'published-offer-unavailable' })
  expect(c.downloads()).toBe(1)
})

/** A non-loopback source whose feed origin only affects the redirect policy. */
async function remoteSource() {
  const profileDir = await mkdtemp(join(tmpdir(), 'ocean-published-catalog-'))
  onTestFinished(() => rm(profileDir, { force: true, recursive: true }))
  const abort = new AbortController()
  onTestFinished(() => { abort.abort() })
  const source = new PublishedCatalogSource({
    url: 'https://raw.githubusercontent.com/Ryltsevmg/Ocean/plugin-catalog/v1/current.json',
    profileDir, timeoutMs: 5_000, runtimeVersion: '1.0.0', lifetime: abort.signal,
  })
  return { source, abort }
}

/** Answer one index for the owned repository feed from a stubbed transport, never the network. */
async function remoteListing(archive: string): Promise<PublishedCatalog> {
  const { source } = await remoteSource()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ schemaVersion: 1, plugins: [{
    name: '@ocean/example', version: '1.2.3', sha256, ocean: '^1.0.0', title: 'Example', description: 'Example description', archive,
  }] }), { status: 200 })))
  onTestFinished(() => { vi.unstubAllGlobals() })
  return source.list()
}

it('reads a non-loopback feed only through the release asset address it derives', async () => {
  expect(await remoteListing(`https://github.com/Ryltsevmg/Ocean/releases/download/plugin-${sha256}/plugin.tgz`))
    .toMatchObject({ status: 'ready', plugins: [{ compatible: true }] })
  // The same digest served from the index host is not the feed's own asset, so the whole index is rejected.
  expect(await remoteListing('https://raw.githubusercontent.com/Ryltsevmg/Ocean/plugin-catalog/v1/plugin.tgz'))
    .toEqual({ status: 'unavailable', plugins: [] })
})

it('follows a release-assets redirect with redirect: error', async () => {
  const { source, abort } = await remoteSource()
  const fetcher = source as never as { fetchArchive(url: string, signal: AbortSignal): Promise<Response> }
  const original = globalThis.fetch
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.startsWith('https://release-assets.githubusercontent.com/')) return new Response(bytes, { status: 200 })
    if (init?.redirect === 'manual') {
      return new Response(null, { status: 307, headers: { location: 'https://release-assets.githubusercontent.com/archives/plugin.tgz' } })
    }
    return original(input, init)
  })
  vi.stubGlobal('fetch', fetchMock)
  onTestFinished(() => { vi.unstubAllGlobals() })
  const response = await fetcher.fetchArchive('https://github.com/Ryltsevmg/Ocean/plugin.tgz', abort.signal)
  expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes)
  expect(fetchMock.mock.lastCall?.[0]).toHaveProperty('href', 'https://release-assets.githubusercontent.com/archives/plugin.tgz')
  expect(fetchMock.mock.lastCall?.[1]).toMatchObject({ redirect: 'error' })
})

it('refuses a redirect outside the release-assets origin', async () => {
  const { source, abort } = await remoteSource()
  const fetcher = source as never as { fetchArchive(url: string, signal: AbortSignal): Promise<Response> }
  const original = globalThis.fetch
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    if (init?.redirect === 'manual') {
      return new Response(null, { status: 307, headers: { location: 'https://evil.example/archives/plugin.tgz' } })
    }
    return original(input, init)
  })
  vi.stubGlobal('fetch', fetchMock)
  onTestFinished(() => { vi.unstubAllGlobals() })
  await expect(fetcher.fetchArchive('https://github.com/Ryltsevmg/Ocean/plugin.tgz', abort.signal))
    .rejects.toMatchObject({ code: 'published-offer-unavailable' })
})

it('refuses an installation whose retained-archive path the profile cannot stat', async () => {
  const c = await channel()
  // The profile holds a regular file where the archive directory belongs: reading it fails before any download.
  await writeFile(join(c.profileDir, 'published-plugins'), 'not a directory')
  await expect(c.source.prepare(target, c.abort.signal)).rejects.toMatchObject({ code: 'published-offer-unavailable' })
  expect(c.downloads()).toBe(0)
})

it('verifies bytes before retaining them, and rechecks the offer before reusing them', async () => {
  const c = await channel()
  c.setArchive(Buffer.from('changed archive'))
  const path = join(c.profileDir, 'published-plugins', sha256, 'plugin.tgz')
  await expect(c.source.prepare(target, c.abort.signal)).rejects.toMatchObject({ code: 'published-archive-mismatch' })
  await expect(readFile(path)).rejects.toMatchObject({ code: 'ENOENT' })
  c.setArchive(bytes)
  expect(await c.source.prepare(target, c.abort.signal)).toBe(path)
  expect(await readFile(path)).toEqual(bytes)
  expect(await c.source.prepare(target, c.abort.signal)).toBe(path)
  expect(c.downloads()).toBe(2)
  c.setIndex({ schemaVersion: 1, plugins: [] })
  await expect(c.source.prepare(target, c.abort.signal)).rejects.toMatchObject({ code: 'published-offer-unavailable' })
  expect(await readFile(path)).toEqual(bytes)
  expect(c.downloads()).toBe(2)
})
