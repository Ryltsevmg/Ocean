import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  collectPackageAliases,
  collectPackageNames,
  handWrittenSpecifiers,
  mappedSpecifiers,
  renderAliases,
  uncoveredPackages,
  writeRegion,
} from './gen-tsconfig-paths.ts'

const root = resolve(import.meta.dirname, '..')

describe('generated tsconfig package aliases', () => {
  it('maps each package to its own source directory', () => {
    const aliases = collectPackageAliases()
    expect(aliases.length).toBeGreaterThan(100)
    const session = aliases.find(alias => alias.specifier === '@ocean/ocean-session')
    expect(session).toEqual({
      specifier: '@ocean/ocean-session',
      source: './packages/core/session/src',
    })
    // Sorted, so a package added anywhere lands in a stable spot in the diff.
    expect([...aliases].sort((a, b) => a.specifier.localeCompare(b.specifier))).toEqual(aliases)
    // Only packages named after their directory: the rest carry hand-written
    // aliases, because the removed wildcards could never have resolved them.
    expect(aliases.some(alias => alias.specifier === '@ocean/ocean-typert-protocol')).toBe(false)
  })

  it('yields to a hand-written alias and closes without a trailing comma', () => {
    const aliases = [
      { specifier: '@ocean/ocean-a', source: './packages/g/a/src' },
      { specifier: '@ocean/ocean-b', source: './packages/g/b/src' },
      { specifier: '@ocean/ocean-c', source: './packages/g/c/src' },
    ]
    const body = renderAliases(aliases, new Set(['@ocean/ocean-a']))

    expect(body).toBe([
      '      "@ocean/ocean-b": ["./packages/g/b/src"]',
      '      "@ocean/ocean-c": ["./packages/g/c/src"]',
    ].join(',\n'))
    expect(body.endsWith(',')).toBe(false)
  })

  it('retains handwritten Ocean and vendor aliases without generating duplicates', () => {
    const text = [
      '{ "compilerOptions": { "paths": {',
      '      "@ocean/ocean-a": ["./custom/a"],',
      '      "@deepseek-ai/cordis": ["./vendor/cordis/src"],',
      '      // BEGIN generated package aliases — pnpm run gen-tsconfig-paths',
      '      "@ocean/ocean-b": ["./stale/b"]',
      '      // END generated package aliases',
      '} } }',
    ].join('\n')
    const aliases = [
      { specifier: '@ocean/ocean-a', source: './packages/g/a/src' },
      { specifier: '@ocean/ocean-b', source: './packages/g/b/src' },
    ]
    const handwritten = handWrittenSpecifiers(text)
    expect(handwritten).toEqual(new Set(['@ocean/ocean-a', '@deepseek-ai/cordis']))
    const next = writeRegion(text, renderAliases(aliases, handwritten))
    expect(next.match(/"@ocean\/ocean-a":/g)).toHaveLength(1)
    expect(next).toContain('"@ocean/ocean-a": ["./custom/a"]')
    expect(next).toContain('"@deepseek-ai/cordis": ["./vendor/cordis/src"]')
    expect(next).toContain('"@ocean/ocean-b": ["./packages/g/b/src"]')
    expect(writeRegion(next, renderAliases(aliases, handWrittenSpecifiers(next)))).toBe(next)
  })

  it('preserves committed Browse subpaths through idempotent package generation', () => {
    const config = readFileSync(resolve(root, 'tsconfig.base.json'), 'utf8')
    const aliases = collectPackageAliases()
    const next = writeRegion(config, renderAliases(aliases, handWrittenSpecifiers(config)))
    for (const [subpath, source] of Object.entries({ client: 'client/index.ts', setup: 'setup.ts', types: 'remote-types.ts' })) {
      const mapping = `"@ocean/ocean-browser-use-browse/${subpath}": ["./packages/experimental/browser-use-browse/src/${source}"]`
      expect(next.includes(mapping), mapping).toBe(true)
      expect(next.split(mapping)).toHaveLength(2)
    }
    expect(writeRegion(next, renderAliases(aliases, handWrittenSpecifiers(next)))).toBe(next)
  })

  it('replaces only the marked region', () => {
    const text = [
      '{ "before": 1,',
      '      // BEGIN generated package aliases — pnpm run gen-tsconfig-paths',
      '      "stale": ["gone"]',
      '      // END generated package aliases',
      '  "after": 2 }',
    ].join('\n')

    const next = writeRegion(text, '      "fresh": ["kept"]')

    expect(next).toContain('{ "before": 1,')
    expect(next).toContain('  "after": 2 }')
    expect(next).toContain('"fresh": ["kept"]')
    expect(next).not.toContain('stale')
  })

  it('refuses a config without the region markers', () => {
    expect(() => writeRegion('{}', '')).toThrow('missing the generated-region markers')
  })

  it('names a package that no alias covers', () => {
    // Deleting the group wildcards removed the fallback that used to resolve a
    // package nobody had aliased. A package whose name does not match its
    // directory is skipped by the generator, so without this check it would
    // resolve through the workspace symlink to built lib/types instead.
    expect(uncoveredPackages(
      ['@ocean/ocean-a', '@ocean/ocean-b'],
      new Set(['@ocean/ocean-a']),
    )).toEqual(['@ocean/ocean-b'])

    expect(uncoveredPackages(['@ocean/ocean-a'], new Set(['@ocean/ocean-a']))).toEqual([])
  })

  it('covers every workspace package in the committed config', () => {
    const config = readFileSync(resolve(root, 'tsconfig.base.json'), 'utf8')
    // Includes the packages the generator skips because their name does not
    // match their directory: those carry hand-written aliases.
    const names = collectPackageNames()
    expect(names).toContain('@ocean/ocean-typert-protocol')
    expect(uncoveredPackages(names, mappedSpecifiers(config))).toEqual([])
  })

  it('leaves no wildcard that probes every package group', () => {
    const config = readFileSync(resolve(root, 'tsconfig.base.json'), 'utf8')
    // A wildcard lists one candidate per group, so resolving a package late in
    // the list costs a filesystem probe — and under tsx a decorated module
    // error — for every group before it.
    expect(config).not.toContain('"@ocean/ocean-*":')
  })
})
