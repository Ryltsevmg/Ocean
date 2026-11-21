import { createHash } from 'node:crypto'
import { createServer, type ServerResponse } from 'node:http'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { expect, it, onTestFinished, vi } from 'vitest'
import { isPublishedCatalogUrl, PublishedCatalogSource } from '../src/published-catalog.ts'

const bytes = Buffer.from('archive fixture')
const sha256 = createHash('sha256').update(bytes).digest('hex')
const target = { name: '@ocean/example', version: '1.2.3', sha256 }

async function channel(onIndex?: (response: ServerResponse) => boolean, redirect?: string) {
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
      if (redirect !== undefined) { res.writeHead(307, { location: redirect }).end(); return }
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

it('accepts a platform list and refuses repeated platforms', async () => {
  const c = await channel()
  c.setIndex({ schemaVersion: 1, plugins: [{ ...c.offer, platforms: [process.platform, process.platform] }] })
  expect(await c.source.list()).toEqual({ status: 'unavailable', plugins: [] })
  c.setIndex({ schemaVersion: 1, plugins: [{ ...c.offer, platforms: [process.platform] }] })
  expect((await c.source.list()).plugins[0]).toMatchObject({ compatible: true })
})

it('refuses an offer whose name the registry cannot accept', async () => {
  const c = await channel()
  c.setIndex({ schemaVersion: 1, plugins: [{ ...c.offer, name: 'Not A Package' }] })
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

it('refuses a catalogue response beyond its byte limit', async () => {
  const c = await channel()
  vi.stubGlobal('fetch', vi.fn(async () => new Response('x'.repeat(600 * 1024), { status: 200 })))
  onTestFinished(() => { vi.unstubAllGlobals() })
  expect(await c.source.list()).toEqual({ status: 'unavailable', plugins: [] })
})

it('rejects an invalid published catalogue URL before any request', async () => {
  const profileDir = await mkdtemp(join(tmpdir(), 'ocean-published-catalog-'))
  onTestFinished(() => rm(profileDir, { force: true, recursive: true }))
  const abort = new AbortController()
  expect(() => new PublishedCatalogSource({
    url: 'https://example.com/v1/current.json', profileDir, timeoutMs: 1_000, runtimeVersion: '1.0.0', lifetime: abort.signal,
  })).toThrow('invalid publishedCatalogUrl')
})

it('turns a non-ENOENT archive stat failure into an unavailable offer', async () => {
  const c = await channel()
  await writeFile(join(c.profileDir, 'published-plugins'), 'blocked')
  await expect(c.source.prepare(target, c.abort.signal)).rejects.toMatchObject({ code: 'published-offer-unavailable' })
  expect(c.downloads()).toBe(0)
})

it('shares one in-flight catalogue read between concurrent readers', async () => {
  let release: ((response: ServerResponse) => void) | undefined
  const waiting = new Promise<ServerResponse>((resolve) => { release = resolve })
  let first = true
  const c = await channel((response) => {
    if (!first) return false
    first = false
    release?.(response)
    return true
  })
  const one = c.source.list()
  const two = c.source.list()
  ;(await waiting).end(JSON.stringify({ schemaVersion: 1, plugins: [c.offer] }))
  expect(await one).toMatchObject({ status: 'ready' })
  expect(await two).toMatchObject({ status: 'ready' })
})

it('validates a remote offer against the release-assets archive location', async () => {
  const { source } = await remoteSource()
  const archive = `https://github.com/Ryltsevmg/Ocean/releases/download/plugin-${sha256}/plugin.tgz`
  const offer = { ...target, ocean: '^1.0.0', title: 'Remote', description: 'Remote offer', archive }
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ schemaVersion: 1, plugins: [offer] }), { status: 200 })))
  onTestFinished(() => { vi.unstubAllGlobals() })
  expect(await source.list()).toEqual({ status: 'ready', plugins: [
    { ...target, title: 'Remote', description: 'Remote offer', compatible: true },
  ] })
})

it('refuses a redirect without a location header', async () => {
  const { source, abort } = await remoteSource()
  const fetcher = source as never as { fetchArchive(url: string, signal: AbortSignal): Promise<Response> }
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 307 })))
  onTestFinished(() => { vi.unstubAllGlobals() })
  await expect(fetcher.fetchArchive('https://github.com/Ryltsevmg/Ocean/plugin.tgz', abort.signal))
    .rejects.toMatchObject({ code: 'published-offer-unavailable' })
})

it('marks an offer for another platform incompatible', async () => {
  const other = process.platform === 'darwin' ? 'win32' : 'darwin'
  const c = await channel()
  c.setIndex({ schemaVersion: 1, plugins: [{ ...c.offer, platforms: [other] }] })
  expect((await c.source.list()).plugins[0]).toMatchObject({ compatible: false })
  await expect(c.source.prepare(target, c.abort.signal)).rejects.toMatchObject({ code: 'published-offer-unavailable' })
})
