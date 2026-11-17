/** Installed-product verification walks resolved runtime edges of the installed tree. */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { verifyInstalledProductIsolation } from './installed-product-isolation.ts'

const roots: string[] = []

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'ocean-installed-isolation-'))
  roots.push(root)
  return root
}

function writePackage(root: string, key: string, manifest: Record<string, unknown>): string {
  const directory = join(root, 'node_modules', key)
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, 'package.json'), `${JSON.stringify({ name: key, ...manifest })}\n`)
  return directory
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('installed default-product graph', () => {
  it('ignores development dependencies and packages outside the runtime graph', () => {
    const root = fixture()
    const entry = writePackage(root, '@ocean/ocean', {
      dependencies: { core: '1.0.0' },
      devDependencies: { unrelated: '1.0.0' },
    })
    writePackage(root, 'core', { peerDependencies: { '@ocean/ocean': '1.0.0' } })
    writePackage(root, 'unrelated', {})

    expect(verifyInstalledProductIsolation(entry)).toBe(2)
  })

  it('requires the entry package\'s optional bundles to be installed', () => {
    const root = fixture()
    const entry = writePackage(root, '@ocean/ocean', { dependencies: { core: '1.0.0', offered: '1.0.0' } })
    writePackage(root, 'core', {})
    writePackage(root, 'offered', {})
    expect(verifyInstalledProductIsolation(entry, ['offered'])).toBe(2)

    const missing = writePackage(root, '@ocean/ocean-missing', { dependencies: { absent: '1.0.0' } })
    expect(() => verifyInstalledProductIsolation(missing, ['absent'])).toThrow('optional bundle is missing: @ocean/ocean-missing -> absent')
  })

  it('permits missing optional packages and optional peers but rejects missing dependencies', () => {
    const root = fixture()
    const entry = writePackage(root, '@ocean/ocean', {
      dependencies: { optional: '1.0.0' },
      optionalDependencies: { optional: '1.0.0' },
      peerDependencies: { peer: '1.0.0' },
      peerDependenciesMeta: { peer: { optional: true } },
    })
    expect(verifyInstalledProductIsolation(entry)).toBe(1)
    writePackage(root, '@ocean/ocean', { dependencies: { missing: '1.0.0' } })
    expect(() => verifyInstalledProductIsolation(entry)).toThrow('dependency is missing')
  })

  it('follows nested installations rather than an unrelated hoisted package', () => {
    const root = fixture()
    const entry = writePackage(root, '@ocean/ocean', { dependencies: { core: '1.0.0' } })
    const hoisted = writePackage(root, 'core', {})
    const nested = writePackage(entry, 'core', { dependencies: { deep: '1.0.0' } })
    writePackage(nested, 'deep', {})

    expect(verifyInstalledProductIsolation(entry)).toBe(3)
    expect(hoisted).not.toBe(nested)
  })
})
