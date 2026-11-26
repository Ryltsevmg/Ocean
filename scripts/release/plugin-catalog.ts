/** Build the public plugin catalog from a reviewed inventory without publishing or modifying files. */

import { createHash } from 'node:crypto'
import { closeSync, constants, fstatSync, openSync, readSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { gunzipSync } from 'node:zlib'
import semver from 'semver'
import { list } from 'tar'
import { z } from 'zod'
import { InvalidInstallSpecError, parseInstallSpec } from '../../packages/boot/plugin-manager/src/install-spec.ts'
import { HarnessError } from '../../packages/util/error/src/index.ts'
import { canSelectBundleVersion } from '../../packages/util/official-bundles/src/bundles.ts'
import {
  languageChain, readPackageDocument, README_NAMES, type DetailFiles,
} from '../../packages/util/plugin-detail/src/index.ts'

const RELEASE_URL = 'https://github.com/Ryltsevmg/Ocean/releases/download'
/** The version-2 index carries a plugin's artwork and long description, so it is larger than the metadata-only one. */
const CATALOG_LIMIT = 2 * 1024 * 1024
const INVENTORY_LIMIT = 512 * 1024
const ARCHIVE_LIMIT = 64 * 1024 * 1024
const UNPACKED_LIMIT = 256 * 1024 * 1024
const MANIFEST_LIMIT = 1024 * 1024
const MANIFEST_PATH = 'package/package.json'
/** Largest package icon the catalogue carries, matching the manifest declaration's own limit. */
const ICON_LIMIT = 256 * 1024
/** Largest detail document stored per language. */
const DETAIL_LIMIT = 64 * 1024
const USAGE = 'Usage: pnpm exec tsx scripts/release/plugin-catalog.ts --inventory <file>'
const utf8 = new TextDecoder('utf-8', { fatal: true })

/** Languages the catalogue stores a detail document for, in display-preference order. */
const DETAIL_LANGUAGES = ['en', 'ru', 'zh', 'ja', 'de', 'es', 'fr', 'pt', 'ko'] as const
/** Icon media types the catalogue serves inline as data URLs. */
const ICON_TYPES = new Map([
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.svg', 'image/svg+xml'], ['.webp', 'image/webp'],
])

const platformList = z.array(z.enum(['darwin', 'linux', 'win32'])).min(1).max(3)
  .refine(values => new Set(values).size === values.length, 'must not contain duplicate platforms')
const publicText = (max: number) => z.string().max(max).refine(value => value.trim() !== '', 'must not be blank')
// Display text is LocalizedText: one bounded string, or per-locale strings with a required English fallback.
const localizedText = (max: number) => z.union([publicText(max), z.object({ en: publicText(max) }).catchall(publicText(max))])

function barePackageName(value: string): boolean {
  try {
    const spec = parseInstallSpec(value)
    return spec.kind === 'registry' && spec.name === value && spec.range === undefined
  } catch (error) {
    if (!(error instanceof InvalidInstallSpecError)) throw error
    return false
  }
}

const inventorySchema = z.strictObject({
  schemaVersion: z.literal(1),
  plugins: z.array(z.strictObject({
    name: z.string().max(214).refine(barePackageName, 'must be a bare npm package name'),
    version: z.string().max(128).refine((value) => {
      const parsed = semver.parse(value)
      return parsed !== null && value === (parsed.build.length ? `${parsed.version}+${parsed.build.join('.')}` : parsed.version)
    }, 'must be an exact SemVer version'),
    title: localizedText(120),
    description: localizedText(2048),
    ocean: z.string().max(128).refine(value => value.trim() !== '' && semver.validRange(value) !== null, 'must be a SemVer range'),
    platforms: platformList.optional(),
    archive: z.string().regex(/\.(?:tgz|tar\.gz)$/iu)
      .refine(value => !/^(?:[a-z][a-z0-9+.-]*:\/\/|file:|[\\/]{2})|\p{Cc}/iu.test(value), 'must be a local .tgz or .tar.gz path'),
    sha256: z.string().regex(/^[0-9a-f]{64}$/u),
  })).max(128),
})
type ApprovedPlugin = z.infer<typeof inventorySchema>['plugins'][number]

type CatalogErrorCode = 'PLUGIN_CATALOG_USAGE' | 'PLUGIN_CATALOG_INVALID_INVENTORY' | 'PLUGIN_CATALOG_INVALID_ARCHIVE'

function failure(code: CatalogErrorCode, message: string, cause?: unknown): HarnessError {
  return new HarnessError(message, code, { cause })
}

function boundedFile(path: string, limit: number): Buffer {
  const fd = openSync(path, constants.O_RDONLY | (process.platform === 'win32' ? 0 : constants.O_NONBLOCK))
  try {
    const stat = fstatSync(fd)
    if (!stat.isFile()) throw new Error('must be a regular file')
    const { size } = stat
    if (size > limit) throw new Error(`must not exceed ${limit} bytes`)
    const bytes = Buffer.allocUnsafe(size)
    let offset = 0
    while (offset < size) {
      const read = readSync(fd, bytes, offset, size - offset, offset)
      if (read === 0) throw new Error('file shrank while it was being read')
      offset += read
    }
    if (readSync(fd, Buffer.alloc(1), 0, 1, size) !== 0) throw new Error('file grew while it was being read')
    return bytes
  } finally {
    closeSync(fd)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function portablePath(path: string): boolean {
  if (path.length > 4096 || /[\\:<>|?*"\p{Cc}]/u.test(path)) return false
  const segments = path.split('/')
  return segments.length <= 128 && segments.every(segment => segment !== '' && !/[. ]$/u.test(segment)
    && !/^(?:aux|con|nul|prn|(?:com|lpt)[1-9¹²³])(?:\.|$)/iu.test(segment))
}

/** Files whose bytes the catalogue needs: the manifest, locale files, Markdown documents, and package icons. */
function neededContent(path: string): boolean {
  if (path === MANIFEST_PATH) return true
  const name = path.slice(path.lastIndexOf('/') + 1)
  return /\.(?:md|markdown)$/iu.test(name) || README_NAMES.includes(name)
    || /^locale\/[^/]+\.json$/u.test(path.slice('package/'.length)) || /^icon\.(?:png|jpe?g|svg|webp)$/iu.test(name)
}

function inspectArchive(bytes: Buffer): {
  manifest: Record<string, unknown>
  files: ReadonlySet<string>
  contents: ReadonlyMap<string, Buffer>
} {
  const data = gunzipSync(bytes, { maxOutputLength: UNPACKED_LIMIT })
  const paths = new Map<string, string>()
  const directories = new Map<string, string>()
  const files = new Set<string>()
  const contents = new Map<string, Buffer>()
  const pathKey = (path: string) => path.normalize('NFC').toLowerCase()
  const manifestChunks: Buffer[] = []
  const tarState = { eof: false }
  const parser = list({
    strict: true, brotli: false, zstd: false, maxMetaEntrySize: MANIFEST_LIMIT,
    onReadEntry(entry) {
      const directory = entry.type === 'Directory'
      const file = entry.type === 'File' || entry.type === 'OldFile'
      const rawPath = entry.header.path ?? entry.path
      const path = directory ? rawPath.replace(/\/$/u, '') : rawPath
      if (!(file || directory) || !portablePath(path) || !(path.startsWith('package/') || (directory && path === 'package'))) {
        throw new Error(`invalid archive entry ${JSON.stringify(rawPath)} (${entry.type})`)
      }
      const key = pathKey(path)
      if (paths.has(key)) throw new Error(`duplicate archive entry ${JSON.stringify(path)}`)
      paths.set(key, path)
      if (paths.size > 100_000) throw new Error('archive contains more than 100000 entries')
      if (file) files.add(path)
      if (file && path === MANIFEST_PATH) {
        if (entry.size > MANIFEST_LIMIT) throw new Error(`package.json must not exceed ${MANIFEST_LIMIT} bytes`)
        entry.on('data', (chunk: Buffer) => { manifestChunks.push(chunk) })
      } else if (file && neededContent(path) && entry.size <= ICON_LIMIT) {
        const chunks: Buffer[] = []
        entry.on('data', (chunk: Buffer) => { chunks.push(chunk) })
        entry.on('end', () => { contents.set(path, Buffer.concat(chunks)) })
      }
    },
  })
  parser.on('ignoredEntry', () => { throw new Error('archive contains an unsupported entry') })
  parser.on('eof', () => { tarState.eof = true })
  // Feed whole tar blocks so bytes after the first end marker can only be zero padding.
  let offset = 0
  for (; offset + 512 <= data.length && !tarState.eof; offset += 512) {
    parser.write(data.subarray(offset, offset + 512))
  }
  parser.end()
  if (!tarState.eof) throw new Error('archive is missing its end marker')
  if (data.subarray(offset).some(byte => byte !== 0)) throw new Error('archive contains data after its end marker')
  if (!files.has(MANIFEST_PATH)) throw new Error(`archive has no regular ${MANIFEST_PATH}`)
  for (const path of paths.values()) {
    let parent = path
    for (let slash = parent.lastIndexOf('/'); slash !== -1; slash = parent.lastIndexOf('/')) {
      parent = parent.slice(0, slash)
      const key = pathKey(parent)
      const declared = paths.get(key) ?? directories.get(key)
      if (declared !== undefined && (declared !== parent || files.has(declared))) {
        throw new Error(`conflicting archive path ${JSON.stringify(path)}`)
      }
      directories.set(key, parent)
    }
  }
  const manifest: unknown = JSON.parse(utf8.decode(Buffer.concat(manifestChunks)))
  if (!isRecord(manifest)) throw new Error('package.json must be an object')
  return { manifest, files, contents }
}

/**
 * The package icon as an inline data URL, so a catalogue card needs no second request.
 * @param manifest - the archive's package.json.
 * @param files - every regular file path in the archive.
 * @param contents - bytes collected for the files the catalogue reads.
 * @returns the data URL, or undefined when the manifest declares no icon.
 */
function iconDataUrl(
  manifest: Record<string, unknown>, files: ReadonlySet<string>, contents: ReadonlyMap<string, Buffer>,
): string | undefined {
  const declared = manifest.icon ?? (isRecord(manifest.exports) ? manifest.exports['./icon'] : undefined)
  if (declared === undefined) return undefined
  if (typeof declared !== 'string') throw new Error('package.json icon must be a string')
  const relative = declared.replace(/^\.\//u, '')
  if (!portablePath(relative) || relative.startsWith('/')) throw new Error('package.json icon must be a relative path')
  const path = `package/${relative}`
  const mediaType = ICON_TYPES.get(relative.slice(relative.lastIndexOf('.')).toLowerCase())
  if (mediaType === undefined) throw new Error(`package.json icon must be PNG, JPEG, SVG or WebP: ${declared}`)
  const icon = contents.get(path)
  if (icon === undefined) {
    throw new Error(files.has(path) ? `icon exceeds ${ICON_LIMIT} bytes` : `package.json icon ${declared} is not a regular file`)
  }
  return `data:${mediaType};base64,${icon.toString('base64')}`
}

/**
 * Drop images the index cannot serve. A document's pictures live inside its package, which the catalogue does not
 * distribute, so a relative destination would render as its alt text; absolute addresses stay.
 * @param markdown - the document text.
 * @returns the text without relative images and the blank lines they leave.
 */
function withoutRelativeImages(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/gu,
      (match, destination: string) => /^(?:https?:|data:)/iu.test(destination) ? match : '')
    .split('\n').map(line => line.trimEnd()).join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()
}

/** Detail documents of one archive, read in the same order a bundle page uses. */
async function detailText(contents: ReadonlyMap<string, Buffer>): Promise<Record<string, string> | undefined> {
  const files: DetailFiles = {
    key: 'catalog-archive',
    read: path => Promise.resolve(contents.get(`package/${path}`)),
    readme(dir) {
      const prefix = dir === '' ? '' : `${dir}/`
      for (const name of README_NAMES) {
        const bytes = contents.get(`package/${prefix}${name}`)
        if (bytes !== undefined) return Promise.resolve({ path: `${prefix}${name}`, bytes })
      }
      return Promise.resolve(undefined)
    },
  }
  const signal = new AbortController().signal
  const documents = new Map<string, string>()
  let english: string | undefined
  for (const language of DETAIL_LANGUAGES) {
    const document = await readPackageDocument(files, '', languageChain(language), DETAIL_LIMIT, signal)
    if (document === undefined) break
    if (english === undefined) english = document.path
    // A language that only reaches the English document, or a document with no text beside its images, adds nothing.
    if (document.path === english && language !== 'en') continue
    const text = withoutRelativeImages(document.markdown)
    if (text !== '') documents.set(language, text)
  }
  return documents.size === 0 ? undefined : Object.fromEntries(documents)
}

function checkPlatformDeclaration(manifest: Record<string, unknown>, bundle: Record<string, unknown>, approved: ApprovedPlugin): void {
  const declared = bundle.platforms === undefined ? undefined : platformList.parse(bundle.platforms).sort()
  if (JSON.stringify(declared) !== JSON.stringify(approved.platforms)) {
    throw new Error('package.json ocean.bundle.platforms does not match the approved platforms')
  }
  if (manifest.os === undefined) return
  const os = z.array(z.string().min(1)).parse(typeof manifest.os === 'string' ? [manifest.os] : manifest.os)
  if (os.length === 1 && os[0] === 'any') return
  const permits = os.filter(value => !value.startsWith('!'))
  for (const platform of approved.platforms ?? ['darwin', 'linux', 'win32']) {
    if (os.includes(`!${platform}`) || (permits.length > 0 && !permits.includes(platform))) {
      throw new Error(`package.json os excludes catalog platform ${platform}`)
    }
  }
}

async function inspectPlugin(approved: ApprovedPlugin, directory: string, schemaVersion: 1 | 2) {
  const { archive, sha256: expected, ...metadata } = approved
  const path = resolve(directory, archive)
  try {
    const bytes = boundedFile(path, ARCHIVE_LIMIT)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    if (sha256 !== expected) throw new Error('archive does not match the approved sha256')
    const { manifest, files, contents } = inspectArchive(bytes)
    if (manifest.name !== approved.name || manifest.version !== approved.version) {
      throw new Error('package.json name/version do not match the approved identity')
    }
    if (!isRecord(manifest.engines) || manifest.engines.ocean !== approved.ocean) {
      throw new Error('package.json engines.ocean does not match the approved range')
    }
    const bundle = isRecord(manifest.ocean) ? manifest.ocean.bundle : undefined
    const patches = isRecord(bundle) ? bundle.patch : undefined
    const patchPaths = z.array(z.string()).min(1).safeParse(typeof patches === 'string' ? [patches] : patches)
    if (!isRecord(bundle) || !patchPaths.success) throw new Error('package.json ocean.bundle.patch must name one or more files')
    for (const declared of patchPaths.data) {
      const path = declared.replace(/^\.\//u, '')
      if (!portablePath(path) || !files.has(`package/${path}`)) {
        throw new Error(`bundle patch ${JSON.stringify(declared)} must be a regular file in the archive`)
      }
    }
    checkPlatformDeclaration(manifest, bundle, approved)
    if (schemaVersion === 1) return { ...metadata, archive: `${RELEASE_URL}/plugin-${sha256}/plugin.tgz`, sha256 }
    const icon = iconDataUrl(manifest, files, contents)
    const detail = await detailText(contents)
    return {
      ...metadata,
      ...(icon === undefined ? {} : { icon }),
      ...(detail === undefined ? {} : { detail }),
      archive: `${RELEASE_URL}/plugin-${sha256}/plugin.tgz`,
      sha256,
    }
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause)
    throw failure('PLUGIN_CATALOG_INVALID_ARCHIVE', `${approved.name}@${approved.version} (${path}): ${reason}`, cause)
  }
}

/**
 * Read a reviewed `{ schemaVersion: 1, plugins: [...] }` inventory. Each entry supplies the catalog metadata,
 * a local `archive` path (relative to the inventory file or absolute), and its approved `sha256`.
 * @param inventoryPath - The JSON file to read; an explicit empty `plugins` list withdraws every row from the proposed catalog.
 * @param schemaVersion - Output index version: `2` adds each archive's icon and detail documents, `1` emits the
 *   metadata-only index that clients predating the artwork and long descriptions read.
 * @returns The complete catalog JSON with a trailing newline. No files or remote state are modified.
 * @throws If the inventory or any referenced archive is invalid; there is no partial catalog.
 */
export async function generatePluginCatalog(inventoryPath: string, schemaVersion: 1 | 2 = 2): Promise<string> {
  const path = resolve(inventoryPath)
  let inventory: z.infer<typeof inventorySchema>
  try {
    const raw: unknown = JSON.parse(utf8.decode(boundedFile(path, INVENTORY_LIMIT)))
    inventory = inventorySchema.parse(raw)
    const names = new Set<string>()
    for (const plugin of inventory.plugins) {
      if (names.has(plugin.name)) throw new Error(`duplicate approved plugin name ${plugin.name}`)
      if (!canSelectBundleVersion(plugin.name, plugin.version)) {
        throw new Error(`${plugin.name}@${plugin.version} is retired and cannot be selected by an Ocean profile`)
      }
      names.add(plugin.name)
      plugin.platforms?.sort()
    }
  } catch (cause) {
    const issue = cause instanceof z.ZodError ? cause.issues[0] : undefined
    const reason = issue !== undefined ? `${issue.path.join('.') || 'inventory'}: ${issue.message}`
      : cause instanceof Error ? cause.message : String(cause)
    throw failure('PLUGIN_CATALOG_INVALID_INVENTORY', `${path}: ${reason}`, cause)
  }
  const plugins = []
  for (const plugin of inventory.plugins) plugins.push(await inspectPlugin(plugin, dirname(path), schemaVersion))
  plugins.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  const json = `${JSON.stringify({ schemaVersion, plugins })}\n`
  if (Buffer.byteLength(json) > CATALOG_LIMIT) {
    throw failure('PLUGIN_CATALOG_INVALID_INVENTORY', `Catalog JSON must not exceed ${CATALOG_LIMIT} bytes`)
  }
  return json
}

async function main(args: string[]): Promise<void> {
  let inventories: string[] | undefined
  let schemaVersion: 1 | 2 = 2
  try {
    const { values } = parseArgs({
      args, options: {
        inventory: { type: 'string', multiple: true },
        'schema-version': { type: 'string' },
      },
    })
    inventories = values.inventory
    if (values['schema-version'] !== undefined) {
      if (values['schema-version'] !== '1' && values['schema-version'] !== '2') throw new Error('unknown schema version')
      schemaVersion = values['schema-version'] === '1' ? 1 : 2
    }
  } catch (cause) {
    throw failure('PLUGIN_CATALOG_USAGE', USAGE, cause)
  }
  const [inventoryPath] = inventories ?? []
  if (inventories?.length !== 1 || !inventoryPath?.trim()) throw failure('PLUGIN_CATALOG_USAGE', USAGE)
  process.stdout.write(await generatePluginCatalog(inventoryPath, schemaVersion))
}

if (import.meta.main) {
  try {
    await main(process.argv.slice(2))
  } catch (error) {
    if (!(error instanceof HarnessError)) throw error
    process.stderr.write(`${error.code}: ${error.message}\n`)
    process.exitCode = 1
  }
}
