import { createHash } from 'node:crypto'
import { createServer, type ServerResponse } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { expect, it, onTestFinished } from 'vitest'
import { isPublishedCatalogUrl, PublishedCatalogSource } from '../src/published-catalog.ts'

const bytes = Buffer.from('archive fixture')
const sha256 = createHash('sha256').update(bytes).digest('hex')
const target = { name: '@ocean/example', version: '1.2.3', sha256 }

async function channel(onIndex?: (response: ServerResponse) => boolean) {
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
  const offer = { ...target, ocean: '^1.0.0', title: 'Example', description: 'Example description', archive: `${origin}/archives/${sha256}/plugin.tgz` }
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
    { ...target, title: 'Example', description: 'Example description', compatible: true },
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
