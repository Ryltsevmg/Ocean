/** Exercise the dry-run producer against synthetic npm-style tarballs and the real CLI. */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, truncate, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { create, Header } from 'tar'
import { describe, expect, it, onTestFinished } from 'vitest'
import { HarnessError } from '../../packages/util/error/src/index.ts'
import { generatePluginCatalog } from './plugin-catalog.ts'

const entry = {
  name: '@fixture/alpha', version: '1.2.3-rc.1+reviewed.2', title: { en: 'Alpha', ru: 'Альфа' },
  description: { en: 'Fixture bundle', ru: 'Фикстурный набор' }, ocean: '^1.0.0 || ^2.0.0',
}
const patch = 'cordis.patch.yml'
const manifest = {
  name: entry.name,
  version: entry.version,
  engines: { ocean: entry.ocean },
  ocean: { bundle: { patch: `./${patch}` } },
}
const script = fileURLToPath(new URL('./plugin-catalog.ts', import.meta.url))

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'ocean-plugin-catalog-'))
  onTestFinished(() => rm(root, { recursive: true, force: true }))
  const archive = join(root, 'artifacts', 'bundle.tgz')
  const inventory = join(root, 'approved.json')
  await mkdir(dirname(archive))
  async function writeInventory(plugins: unknown[]) {
    await writeFile(inventory, JSON.stringify({ schemaVersion: 1, plugins }))
  }
  async function pack(packageJson: object = manifest, files: string[] | Record<string, string> = [patch], path = archive) {
    const source = await mkdtemp(join(root, 'package-source-'))
    await mkdir(join(source, 'package'))
    await writeFile(join(source, 'package', 'package.json'), JSON.stringify(packageJson))
    for (const [file, text] of Array.isArray(files) ? files.map(name => [name, '[]\n'] as const) : Object.entries(files)) {
      const target = join(source, 'package', file)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, text)
    }
    await create({ file: path, cwd: source, gzip: true, portable: true }, ['package'])
    return digest(await readFile(path))
  }
  return { root, archive, inventory, pack, writeInventory }
}

function digest(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function tarEntry(path: string, text: string, type: 'File' | 'SymbolicLink' = 'File'): Buffer {
  const body = Buffer.from(text)
  const header = new Header({ path, type, size: body.length, ...(type === 'SymbolicLink' ? { linkpath: patch } : {}) })
  header.encode()
  return Buffer.concat([header.block ?? Buffer.alloc(0), body, Buffer.alloc((512 - body.length % 512) % 512)])
}

function runCli(root: string, args: string[]) {
  const result = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx/esm'), script, ...args], {
    cwd: root, encoding: 'utf8', timeout: 10_000,
  })
  expect(result.error).toBeUndefined()
  expect(result.signal).toBeNull()
  return result
}

const archive = 'artifacts/bundle.tgz'
const sha256 = '1'.repeat(64)
const approved = { ...entry, archive, sha256 }

async function expectFailure(inventory: string, code: 'INVALID_ARCHIVE' | 'INVALID_INVENTORY', message: RegExp): Promise<void> {
  try {
    await generatePluginCatalog(inventory)
  } catch (error) {
    if (!(error instanceof HarnessError)) throw error
    expect(error.code).toBe(`PLUGIN_CATALOG_${code}`)
    expect(error.message).toMatch(message)
    return
  }
  expect.unreachable('expected the producer to reject the input')
}

describe('plugin catalog dry run', () => {
  it('refuses an identity that profile startup would remove from the user’s selection', async () => {
    const test = await fixture()
    await test.writeInventory([{ ...approved, name: '@ocean/ocean-cua-bundle', version: '1.0.1' }])
    await expectFailure(test.inventory, 'INVALID_INVENTORY', /is retired and cannot be selected/u)
  })

  it('emits only approved archives with canonical URLs and stable ordering', async () => {
    const test = await fixture()
    const betaName = '@fixture/beta'
    const platforms = ['linux', 'darwin']
    const alphaDigest = await test.pack({
      ...manifest, os: platforms, ocean: { bundle: { patch: [`./${patch}`, 'layers/extra.yml'], platforms } },
    }, [patch, 'layers/extra.yml'])
    const betaPath = join(test.root, 'beta.tgz')
    const betaDigest = await test.pack({ ...manifest, name: betaName, private: true, os: 'any' }, [patch], betaPath)
    await writeFile(join(test.root, 'unapproved.tgz'), 'do not inspect this file')
    const alpha = { ...entry, archive, sha256: alphaDigest, platforms: ['darwin', 'linux'] }
    const beta = { ...entry, name: betaName, archive: betaPath, sha256: betaDigest }
    await test.writeInventory([beta, alpha])
    const output = await generatePluginCatalog(test.inventory, 1)
    expect(output.endsWith('\n')).toBe(true)
    expect(JSON.parse(output)).toEqual({ schemaVersion: 1, plugins: [
      { ...alpha, archive: `https://github.com/Ryltsevmg/Ocean/releases/download/plugin-${alphaDigest}/plugin.tgz` },
      { ...beta, archive: `https://github.com/Ryltsevmg/Ocean/releases/download/plugin-${betaDigest}/plugin.tgz` },
    ] })
    await test.writeInventory([{ ...alpha, platforms }, beta])
    expect(await generatePluginCatalog(test.inventory, 1)).toBe(output)
  })

  it('carries localized display text through unchanged and still accepts plain strings', async () => {
    const test = await fixture()
    const packedDigest = await test.pack()
    const emitted = { ...approved, sha256: packedDigest, archive: `https://github.com/Ryltsevmg/Ocean/releases/download/plugin-${packedDigest}/plugin.tgz` }
    await test.writeInventory([{ ...approved, sha256: packedDigest }])
    expect(JSON.parse(await generatePluginCatalog(test.inventory, 1))).toEqual({ schemaVersion: 1, plugins: [emitted] })
    await test.writeInventory([{ ...approved, sha256: packedDigest, title: 'Alpha', description: 'Fixture bundle' }])
    expect(JSON.parse(await generatePluginCatalog(test.inventory, 1))).toEqual({ schemaVersion: 1, plugins: [{ ...emitted, title: 'Alpha', description: 'Fixture bundle' }] })
  })

  it('carries each archive’s icon and detail documents in the version-2 index only', async () => {
    const test = await fixture()
    const icon = '<svg xmlns="http://www.w3.org/2000/svg"/>'
    const withArtwork = { ...manifest, icon: './icon.svg' }
    const packedDigest = await test.pack(withArtwork, {
      [patch]: '[]\n',
      'icon.svg': icon,
      'locale/en.json': JSON.stringify({ meta: { title: 'Alpha', detail: 'docs/DETAIL.md' } }),
      'locale/ru.json': JSON.stringify({ meta: { title: 'Альфа', detail: 'docs/DETAIL.ru.md' } }),
      'locale/de.json': JSON.stringify({ meta: { title: 'Alpha' } }),
      'docs/DETAIL.md': '---\ndescription: meta\n---\n\n# Alpha\n',
      'docs/DETAIL.ru.md': '# Альфа\n',
      'README.md': '# Readme\n',
    })
    await test.writeInventory([{ ...approved, sha256: packedDigest }])
    const archiveUrl = `https://github.com/Ryltsevmg/Ocean/releases/download/plugin-${packedDigest}/plugin.tgz`
    const metadata = { ...entry, archive: archiveUrl, sha256: packedDigest }
    expect(JSON.parse(await generatePluginCatalog(test.inventory))).toEqual({
      schemaVersion: 2,
      plugins: [{
        ...metadata,
        icon: `data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}`,
        // German declares no detail of its own, so its fallback to English stores no second copy.
        // The front matter block is file metadata, not description text.
        detail: { en: '# Alpha', ru: '# Альфа' },
      }],
    })
    expect(JSON.parse(await generatePluginCatalog(test.inventory, 1))).toEqual({ schemaVersion: 1, plugins: [metadata] })
  })

  it('reads artwork exported as ./icon too, which is how a source package declares it', async () => {
    const test = await fixture()
    const icon = '<svg xmlns="http://www.w3.org/2000/svg"/>'
    const exported = { ...manifest, exports: { '.': './index.js', './icon': './icon.svg' } }
    const packedDigest = await test.pack(exported, { [patch]: '[]\n', 'icon.svg': icon })
    await test.writeInventory([{ ...approved, sha256: packedDigest }])
    const plugins = (JSON.parse(await generatePluginCatalog(test.inventory)) as {
      plugins: { icon?: string }[]
    }).plugins
    expect(plugins[0]?.icon).toBe(`data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}`)
  })

  it('drops images the catalogue cannot serve and keeps a document that still has text', async () => {
    const test = await fixture()
    const packedDigest = await test.pack(manifest, {
      [patch]: '[]\n',
      'locale/en.json': JSON.stringify({ meta: { detail: 'docs/DETAIL.md' } }),
      'docs/DETAIL.md': '![A preview inside the package](preview.svg)\n\n# Alpha\n\n![Remote](https://example.test/x.png)\n\nBody.\n',
    })
    await test.writeInventory([{ ...approved, sha256: packedDigest }])
    const { plugins } = JSON.parse(await generatePluginCatalog(test.inventory)) as { plugins: { detail?: Record<string, string> }[] }
    expect(plugins[0]?.detail).toEqual({ en: '# Alpha\n\n![Remote](https://example.test/x.png)\n\nBody.' })
  })

  it('publishes no detail for a document that is only a package image', async () => {
    const test = await fixture()
    const packedDigest = await test.pack(manifest, {
      [patch]: '[]\n',
      'locale/en.json': JSON.stringify({ meta: { detail: 'docs/DETAIL.md' } }),
      'docs/DETAIL.md': '![A diagram](preview.svg)\n',
    })
    await test.writeInventory([{ ...approved, sha256: packedDigest }])
    const { plugins } = JSON.parse(await generatePluginCatalog(test.inventory)) as { plugins: object[] }
    expect(plugins[0]).not.toHaveProperty('detail')
  })

  it('falls back to the README and omits artwork and detail a package does not provide', async () => {
    const test = await fixture()
    const readmeDigest = await test.pack(manifest, { [patch]: '[]\n', 'README.md': '# Alpha readme\n' })
    const bareDigest = await test.pack({ ...manifest, name: '@fixture/beta' }, { [patch]: '[]\n' }, join(test.root, 'bare.tgz'))
    await test.writeInventory([{ ...approved, sha256: readmeDigest }, { ...approved, name: '@fixture/beta', archive: 'bare.tgz', sha256: bareDigest }])
    const { plugins } = JSON.parse(await generatePluginCatalog(test.inventory)) as { plugins: object[] }
    const [readme, bare] = plugins
    expect(readme).toMatchObject({ detail: { en: '# Alpha readme' } })
    expect(readme).not.toHaveProperty('icon')
    expect(bare).not.toHaveProperty('detail')
    expect(bare).not.toHaveProperty('icon')
  })

  it.each([
    [{ icon: './missing.svg' }, {}, /icon \.\/missing\.svg is not a regular file/u],
    [{ icon: './icon.bmp' }, { 'icon.bmp': 'BM' }, /must be PNG, JPEG, SVG or WebP/u],
    [{ icon: './icon.svg' }, { 'icon.svg': 'x'.repeat(256 * 1024 + 1) }, /icon exceeds 262144 bytes/u],
    [{ icon: './locale/en.json' }, { 'locale/en.json': '{}' }, /must be PNG, JPEG, SVG or WebP/u],
  ] as const)('refuses artwork that cannot be served (%j)', async (change, files, message) => {
    const test = await fixture()
    const packedDigest = await test.pack({ ...manifest, ...change }, { [patch]: '[]\n', ...files })
    await test.writeInventory([{ ...approved, sha256: packedDigest }])
    await expectFailure(test.inventory, 'INVALID_ARCHIVE', message)
  })

  it('requires an explicit inventory and accepts an explicit empty list through the CLI', async () => {
    const test = await fixture()
    await test.writeInventory([])
    const success = runCli(test.root, ['--inventory', test.inventory])
    expect(success).toMatchObject({ status: 0, stdout: '{"schemaVersion":2,"plugins":[]}\n', stderr: '' })
    expect(runCli(test.root, ['--inventory', test.inventory, '--schema-version', '1']))
      .toMatchObject({ status: 0, stdout: '{"schemaVersion":1,"plugins":[]}\n', stderr: '' })
    for (const args of [[], ['--inventory', test.inventory, '--inventory', test.inventory], ['--publish'], ['--inventory', test.inventory, '--schema-version', '3']]) {
      const rejected = runCli(test.root, args)
      expect(rejected).toMatchObject({ status: 1, stdout: '' })
      expect(rejected.stderr).toContain('PLUGIN_CATALOG_USAGE')
    }
  })

  it('writes no partial catalog to stdout if a later archive fails', async () => {
    const test = await fixture()
    const approvedDigest = await test.pack()
    const second = { ...approved, name: '@fixture/beta', archive: 'missing.tgz' }
    await test.writeInventory([{ ...approved, sha256: approvedDigest }, second])
    const result = runCli(test.root, ['--inventory', test.inventory])
    expect(result).toMatchObject({ status: 1, stdout: '' })
    expect(result.stderr).toMatch(/PLUGIN_CATALOG_INVALID_ARCHIVE: @fixture\/beta@.*missing\.tgz/u)
  })

  it.each([
    [undefined, /plugins/u],
    [{ version: '^1.2.3' }, /plugins\.0\.version/u],
    [{ version: 'v1.2.3' }, /plugins\.0\.version/u],
    [{ ocean: 'workspace:*' }, /plugins\.0\.ocean/u],
    [{ ocean: '  ' }, /plugins\.0\.ocean/u],
    [{ name: 'alpha@latest' }, /plugins\.0\.name/u],
    [{ name: 'npm:@fixture/alpha' }, /plugins\.0\.name/u],
    [{ name: '@fixture/Invalid' }, /plugins\.0\.name/u],
    [{ title: '  ' }, /plugins\.0\.title/u],
    [{ title: { ru: 'Альфа' } }, /plugins\.0\.title/u],
    [{ title: { en: 'Alpha', ru: '  ' } }, /plugins\.0\.title/u],
    [{ title: { en: 'x'.repeat(121) } }, /plugins\.0\.title/u],
    [{ description: 'x'.repeat(2049) }, /plugins\.0\.description/u],
    [{ description: { ru: 'Фикстурный набор' } }, /plugins\.0\.description/u],
    [{ description: { en: 'x'.repeat(2049) } }, /plugins\.0\.description/u],
    [{ platforms: [] }, /plugins\.0\.platforms/u],
    [{ platforms: ['linux', 'linux'] }, /plugins\.0\.platforms/u],
    [{ platforms: ['wsl'] }, /plugins\.0\.platforms/u],
    [{ archive: 'https://example.invalid/bundle.tgz' }, /plugins\.0\.archive/u],
    [{ archive: '\\\\server\\share\\bundle.tgz' }, /plugins\.0\.archive/u],
    [{ sha256: undefined }, /plugins\.0\.sha256/u],
    [{ sha256: 'A'.repeat(64) }, /plugins\.0\.sha256/u],
    [{ approvedBy: 'reviewer' }, /approvedBy/u],
  ] as const)('rejects a malformed inventory row %j before opening archives', async (change, message) => {
    const test = await fixture()
    if (change === undefined) await writeFile(test.inventory, '{"schemaVersion":1}')
    else await test.writeInventory([{ ...approved, ...change }])
    await expectFailure(test.inventory, 'INVALID_INVENTORY', message)
  })

  it('rejects duplicate names and limits inventory entries and bytes', async () => {
    const test = await fixture()
    await test.writeInventory([approved, { ...approved, version: '3.0.0' }])
    await expectFailure(test.inventory, 'INVALID_INVENTORY', /duplicate approved plugin name/u)
    await test.writeInventory(Array.from({ length: 129 }, (_, i) => ({ ...approved, name: `fixture-${i}` })))
    await expectFailure(test.inventory, 'INVALID_INVENTORY', /128/u)
    await truncate(test.inventory, 512 * 1024 + 1)
    await expectFailure(test.inventory, 'INVALID_INVENTORY', /524288 bytes/u)
  })

  it('checks the approved digest and refuses an archive over the compressed byte limit', async () => {
    const test = await fixture()
    await test.pack()
    await test.writeInventory([approved])
    await expectFailure(test.inventory, 'INVALID_ARCHIVE', /does not match the approved sha256/u)
    await truncate(test.archive, 64 * 1024 * 1024 + 1)
    await expectFailure(test.inventory, 'INVALID_ARCHIVE', /67108864 bytes/u)
  })

  it.each([
    [{ name: '@fixture/wrong' }, {}, [patch], /name\/version/u],
    [{ version: '1.2.3' }, {}, [patch], /name\/version/u],
    [{ engines: {} }, {}, [patch], /engines\.ocean/u],
    [{ engines: { ocean: '*' } }, {}, [patch], /engines\.ocean/u],
    [{ ocean: {} }, {}, [patch], /ocean\.bundle\.patch/u],
    [{ ocean: { bundle: { patch: [] } } }, {}, [patch], /ocean\.bundle\.patch/u],
    [{ ocean: { bundle: { patch: '../cordis.patch.yml' } } }, {}, [patch], /must be a regular file/u],
    [{ ocean: { bundle: { patch: [patch, 'missing.yml'] } } }, {}, [patch], /missing\.yml/u],
    [{}, {}, ['not-the-patch.yml'], /must be a regular file/u],
    [{ ocean: { bundle: { patch, platforms: ['linux'] } } }, {}, [patch], /ocean\.bundle\.platforms/u],
    [{}, { platforms: ['linux'] }, [patch], /ocean\.bundle\.platforms/u],
    [{ os: ['!win32'] }, {}, [patch], /os excludes catalog platform win32/u],
  ] as const)('rejects archives that disagree with the approved release (%j, %j, %j)', async (change, row, files, message) => {
    const test = await fixture()
    const packedDigest = await test.pack({ ...manifest, ...change }, [...files])
    await test.writeInventory([{ ...approved, ...row, sha256: packedDigest }])
    await expectFailure(test.inventory, 'INVALID_ARCHIVE', message)
  })

  it.each([
    ['plain input', Buffer.from('not gzip'), /header check/u],
    ['no manifest', gzipSync(Buffer.concat([tarEntry(`package/${patch}`, '[]'), Buffer.alloc(1024)])), /no regular package\/package\.json/u],
    ['duplicate manifest', gzipSync(Buffer.concat([
      tarEntry('package/package.json', JSON.stringify(manifest)), tarEntry('package/package.json', '{}'), Buffer.alloc(1024),
    ])), /duplicate archive entry/u],
    ['linked patch', gzipSync(Buffer.concat([
      tarEntry('package/package.json', JSON.stringify(manifest)), tarEntry(`package/${patch}`, '', 'SymbolicLink'), Buffer.alloc(1024),
    ])), /invalid archive entry.*SymbolicLink/u],
    ['escaping entry', gzipSync(Buffer.concat([tarEntry('package/../unapproved.txt', 'x'), Buffer.alloc(1024)])), /invalid archive entry/u],
    ['Windows device path', gzipSync(Buffer.concat([tarEntry('package/con.txt', 'x'), Buffer.alloc(1024)])), /invalid archive entry/u],
    ['case-conflicting directory', gzipSync(Buffer.concat([
      tarEntry('package/package.json', JSON.stringify(manifest)), tarEntry('package/Lib/a.js', ''),
      tarEntry('package/lib/b.js', ''), Buffer.alloc(1024),
    ])), /conflicting archive path/u],
    ['truncated tar', gzipSync(tarEntry('package/package.json', JSON.stringify(manifest))), /missing its end marker/u],
    ['entry past the end marker', gzipSync(Buffer.concat([
      tarEntry('package/package.json', JSON.stringify(manifest)), tarEntry(`package/${patch}`, '[]'), Buffer.alloc(1024),
      tarEntry('package/package.json', '{}'), Buffer.alloc(1024),
    ])), /data after its end marker/u],
    ['oversize manifest', gzipSync(Buffer.concat([
      tarEntry('package/package.json', ' '.repeat(1024 * 1024 + 1)), Buffer.alloc(1024),
    ])), /package\.json must not exceed/u],
  ] as const)('rejects %s even if its digest is approved', async (_label, bytes, message) => {
    const test = await fixture()
    await writeFile(test.archive, bytes)
    await test.writeInventory([{ ...approved, sha256: digest(bytes) }])
    await expectFailure(test.inventory, 'INVALID_ARCHIVE', message)
  })
})
