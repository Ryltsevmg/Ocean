/** Read approved package offers and verify their archives before installation. */
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { writeFileAtomic } from '@ocean/ocean-atomic-write'
import { canSelectBundleVersion } from '@ocean/ocean-official-bundles'
import semver from 'semver'
import { z } from 'zod'
import { ManagementFailure } from './failure.ts'
import { InvalidInstallSpecError, parseInstallSpec } from './install-spec.ts'
import type { PublishedCatalog, PublishedPluginTarget } from './types.ts'

const GITHUB = 'https://github.com'
const RAW = 'https://raw.githubusercontent.com'
const REPOSITORY = 'Ryltsevmg/Ocean'
const RELEASE_ASSETS = 'https://release-assets.githubusercontent.com'
/** The version-2 index carries each offer's artwork and long description beside its metadata. */
const MAX_CATALOG_BYTES = 2 * 1024 * 1024
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024
/** Largest inline icon data URL accepted from an offer. */
const MAX_ICON_BYTES = 400 * 1024
const DIGEST = /^[a-f0-9]{64}$/u
const DATA_ICON = /^data:image\/(?:png|jpeg|svg\+xml|webp);base64,[a-z0-9+/]+=*$/iu

function exactVersion(value: string): boolean {
  const version = semver.parse(value)
  return version !== null && value === version.raw && value === [version.version, version.build.join('.')].filter(Boolean).join('+')
}

// Offer display text is LocalizedText: one bounded string, or per-locale strings with a required English fallback.
const publicText = (max: number) => z.string().trim().min(1).max(max)
const localizedText = (max: number) => z.union([publicText(max), z.object({ en: publicText(max) }).catchall(publicText(max))])

const Entry = z.strictObject({
  name: z.string().min(1).max(214),
  version: z.string().max(128).refine(exactVersion),
  title: localizedText(120),
  description: localizedText(2048),
  /** Inline artwork, so a catalogue card needs no second request; bounded by `MAX_ICON_BYTES`. */
  icon: z.string().max(MAX_ICON_BYTES).regex(DATA_ICON).optional(),
  /** Long Markdown description shown on the plugin's details page, in the languages the publisher supplied. */
  detail: localizedText(32 * 1024).optional(),
  ocean: z.string().min(1).max(128).refine(value => semver.validRange(value) !== null),
  platforms: z.array(z.enum(['darwin', 'linux', 'win32'])).min(1).max(3)
    .refine(values => new Set(values).size === values.length).optional(),
  archive: z.string().max(512),
  sha256: z.string().regex(DIGEST),
})
// Version 1 is the metadata-only index that clients without artwork and long descriptions read.
const Index = z.strictObject({ schemaVersion: z.union([z.literal(1), z.literal(2)]), plugins: z.array(Entry).max(128) })
type Offer = z.infer<typeof Entry>

/** Runtime configuration for the trusted catalog reader, not supplied by a client request. */
export interface PublishedCatalogOptions {
  /** Stable public index URL, or a loopback HTTP URL for an isolated qualification run. */
  url: string
  /** Deadline covering the response headers and body of each request. */
  timeoutMs: number
  /** OCEAN version which will run installed packages. */
  runtimeVersion: string
  /** Profile that owns the retained package archives and its dependency paths. */
  profileDir: string
  /** Cancels a read or download when the manager unloads. */
  lifetime: AbortSignal
}

function loopback(url: URL): boolean {
  return url.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(url.hostname)
}

/**
 * Check the deployment input before issuing any request.
 * @param value - Configured catalog URL, with no credentials, query or fragment.
 * @returns Whether the URL names the owned public repository or an isolated loopback channel.
 */
export function isPublishedCatalogUrl(value: string): boolean {
  const url = URL.parse(value)
  return url !== null && url.username === '' && url.password === '' && url.search === '' && url.hash === ''
    && (loopback(url) || (url.origin === RAW && url.pathname.startsWith(`/${REPOSITORY}/`) && url.pathname.endsWith('.json')))
}

function archiveUrl(feed: URL, sha256: string): string {
  return loopback(feed)
    ? `${feed.origin}/archives/${sha256}/plugin.tgz`
    : `${GITHUB}/${REPOSITORY}/releases/download/plugin-${sha256}/plugin.tgz`
}

function packageIdentity(offer: Offer): boolean {
  try {
    const identity = parseInstallSpec(offer.name)
    return identity.kind === 'registry' && identity.name === offer.name && identity.range === undefined
  } catch (error) {
    /* v8 ignore next -- parseInstallSpec throws only InvalidInstallSpecError */
    if (!(error instanceof InvalidInstallSpecError)) throw error
    return false
  }
}

async function bodyBytes(response: Response, limit: number): Promise<Buffer<ArrayBuffer>> {
  const body = response.body
  if (!response.ok || body === null) {
    await body?.cancel()
    throw new Error(`Catalog request returned HTTP ${response.status}`)
  }
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of body) {
    size += chunk.byteLength
    if (size > limit) throw new Error('Catalog response exceeds its byte limit')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks, size)
}

/** Own the current approved offers; failed refreshes may inform display but never authorize an install. */
export class PublishedCatalogSource {
  private readonly feed: URL
  private cached: readonly Offer[] | undefined
  private reading: Promise<readonly Offer[]> | undefined
  private readsStarted = 0
  private cachedRead = 0

  /** @param options - Validated channel settings and manager lifetime. */
  constructor(private readonly options: PublishedCatalogOptions) {
    if (!isPublishedCatalogUrl(options.url)) throw new Error('plugin-manager: invalid publishedCatalogUrl')
    this.feed = new URL(options.url)
  }

  /**
   * Read the full catalog and report whether the offers are fresh.
   * @returns Inventory without archive URLs.
   */
  async list(): Promise<PublishedCatalog> {
    try {
      return { status: 'ready', plugins: this.display(await this.refresh()) }
    } catch (_error) {
      return this.cached === undefined ? { status: 'unavailable', plugins: [] }
        : { status: 'stale', plugins: this.display(this.cached) }
    }
  }

  /**
   * Re-read the live channel, verify the selected exact offer and retain the verified bytes in the profile.
   * @param target - Identity of the offer the person selected.
   * @param signal - Installation cancellation, including package-manager shutdown.
   * @returns Absolute path to the archive that ordinary pnpm install and repair can read.
   */
  async prepare(target: PublishedPluginTarget, signal: AbortSignal): Promise<string> {
    try {
      const live = await this.read(signal)
      signal.throwIfAborted()
      const offer = live.find(item => this.isCurrentOffer(item, target))
      if (offer === undefined) throw new ManagementFailure('published-offer-unavailable')
      this.assertCurrent(target)
      const path = join(this.options.profileDir, 'published-plugins', offer.sha256, 'plugin.tgz')
      const current = await stat(path).catch((error: unknown) => {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error
        return undefined
      })
      if (current?.isFile() === true && current.size <= MAX_ARCHIVE_BYTES && this.matches(await readFile(path), offer)) {
        this.assertCurrent(target)
        return path
      }
      const deadline = AbortSignal.any([signal, this.options.lifetime, AbortSignal.timeout(this.options.timeoutMs)])
      const response = await this.fetchArchive(offer.archive, deadline)
      const bytes = await bodyBytes(response, MAX_ARCHIVE_BYTES)
      if (!this.matches(bytes, offer)) throw new ManagementFailure('published-archive-mismatch')
      signal.throwIfAborted()
      await writeFileAtomic(path, bytes, { mode: 0o600, dirMode: 0o700 })
      this.assertCurrent(target)
      return path
    } catch (error) {
      if (signal.aborted || error instanceof ManagementFailure) throw error
      throw new ManagementFailure('published-offer-unavailable')
    }
  }

  /**
   * Recheck a prepared offer at the point where package changes start, without authorizing it from the cache alone.
   * @param target - Offer already checked by {@link prepare} in this installation request.
   * @throws If a successful channel read no longer contains the exact compatible offer.
   */
  assertCurrent(target: PublishedPluginTarget): void {
    if (!this.cached?.some(item => this.isCurrentOffer(item, target))) throw new ManagementFailure('published-offer-unavailable')
  }

  private isCurrentOffer(offer: Offer, target: PublishedPluginTarget): boolean {
    return offer.name === target.name && offer.version === target.version && offer.sha256 === target.sha256 && this.compatible(offer)
  }

  private refresh(): Promise<readonly Offer[]> {
    if (this.reading !== undefined) return this.reading
    /* v8 ignore next -- read() assigns cached on every successful read, so a refresh never falls back to its own entries */
    const read = this.read().then(entries => this.cached ?? entries).finally(() => { this.reading = undefined })
    this.reading = read
    return read
  }

  private async read(installSignal?: AbortSignal): Promise<readonly Offer[]> {
    const read = ++this.readsStarted
    const deadline = AbortSignal.timeout(this.options.timeoutMs)
    const signals = [this.options.lifetime, deadline]
    if (installSignal !== undefined) signals.push(installSignal)
    const signal = AbortSignal.any(signals)
    const response = await fetch(this.feed, { signal, redirect: 'error', cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
    const bytes = await bodyBytes(response, MAX_CATALOG_BYTES)
    const raw: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    const entries = Index.parse(raw).plugins
    const names = new Set<string>()
    for (const entry of entries) {
      if (names.has(entry.name) || !packageIdentity(entry) || entry.archive !== archiveUrl(this.feed, entry.sha256)) {
        throw new Error('Catalog contains an invalid or repeated offer')
      }
      names.add(entry.name)
    }
    if (read > this.cachedRead) {
      this.cachedRead = read
      this.cached = entries
    }
    return entries
  }

  private async fetchArchive(url: string, signal: AbortSignal): Promise<Response> {
    const response = await fetch(url, { signal, redirect: 'manual' })
    if (response.status !== 302 && response.status !== 307) return response
    const location = URL.parse(response.headers.get('location') ?? '')
    await response.body?.cancel()
    if (loopback(this.feed) || location?.origin !== RELEASE_ASSETS || location.username !== '' || location.password !== '') {
      throw new ManagementFailure('published-offer-unavailable')
    }
    return fetch(location, { signal, redirect: 'error' })
  }

  private matches(bytes: Uint8Array, offer: Offer): boolean {
    return bytes.byteLength <= MAX_ARCHIVE_BYTES && createHash('sha256').update(bytes).digest('hex') === offer.sha256
  }

  private compatible(offer: Offer): boolean {
    return canSelectBundleVersion(offer.name, offer.version)
      && semver.satisfies(this.options.runtimeVersion, offer.ocean, { includePrerelease: true })
      && (offer.platforms === undefined || offer.platforms.some(platform => platform === process.platform))
  }

  private display(offers: readonly Offer[]): PublishedCatalog['plugins'] {
    return offers.map(offer => ({
      name: offer.name, version: offer.version, sha256: offer.sha256, title: offer.title, description: offer.description,
      ...(offer.icon === undefined ? {} : { icon: offer.icon }),
      ...(offer.detail === undefined ? {} : { detail: offer.detail }),
      compatible: this.compatible(offer),
    }))
  }
}
