/** Workspace dependency ranges and package publication constraints. */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, onTestFinished } from 'vitest'
import {
  checkOceanFamilyVersion,
  checkWorkspaceManifest,
  checkWorkspaceProtocol,
  detailDocumentFiles,
  expectedOceanPackageFiles,
  readWorkspaceManifests,
  type WorkspaceManifest,
} from './check-workspace-constraints.ts'

describe('workspace dependency ranges', () => {
  const dependency = { dir: 'packages/core/runtime', manifest: { name: '@ocean/ocean-runtime' } }
  const cli = { dir: 'apps/cli', manifest: { name: '@ocean/ocean' } }
  const vendor = { dir: 'vendor/cordis', manifest: { name: '@deepseek-ai/cordis' } }
  const native = { dir: 'native/system', manifest: { name: '@deepseek-ai/node-addon-system' } }
  const platform = { dir: 'native/system/packages/darwin-arm64', manifest: { name: '@deepseek-ai/node-addon-system-darwin-arm64' } }
  const unrelated = { dir: 'tools/helper', manifest: { name: '@other/helper' } }

  describe.each([
    '.', 'packages/core/probe', 'packages/util/probe', 'apps/cli', 'apps/web',
    'apps/desktop', 'apps/desktop-host', 'benchmarks', 'website', 'python/sdk-runtime', 'tools/probe',
    'vendor/loader', 'native/system', 'native/system/packages/entry',
  ])('consumer %s', (dir) => {
    it.each(['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const)(
      'requires exact OCEAN and tilde vendor/native %s independently of the consumer name',
      (section) => {
        const consumer = (name: string, range: string): WorkspaceManifest => ({
          dir, manifest: { name: 'consumer', [section]: { [name]: range } },
        })
        const check = (name: string, range: string): string[] =>
          checkWorkspaceProtocol([dependency, cli, vendor, native, platform, unrelated, consumer(name, range)])
        for (const name of ['@ocean/ocean', '@ocean/ocean-runtime']) {
          expect(check(name, 'workspace:*')).toEqual([])
          for (const range of ['workspace:^', 'workspace:~', 'workspace:^0.1.7', '^0.1.7', '*']) {
            expect(check(name, range)).toEqual([
              `consumer: ${section}.${name} must use workspace:*, got ${range}`,
            ])
          }
        }
        for (const name of ['@deepseek-ai/cordis', '@deepseek-ai/node-addon-system', '@deepseek-ai/node-addon-system-darwin-arm64']) {
          expect(check(name, 'workspace:~')).toEqual([])
          for (const range of ['workspace:*', 'workspace:^', '^4.0.3', '~4.0.3']) {
            expect(check(name, range)).toEqual([
              `consumer: ${section}.${name} must use workspace:~, got ${range}`,
            ])
          }
        }
        for (const range of ['workspace:*', 'workspace:^']) {
          expect(check('@other/helper', range)).toEqual([])
        }
        expect(check('@other/helper', '^0.1.0')).toEqual([
          `consumer: ${section}.@other/helper must use the workspace: protocol, got ^0.1.0`,
        ])
        expect(check('external', '^1.2.3')).toEqual([])
      },
    )
  })
})

describe('workspace manifest discovery', () => {
  it('checks root, app, runtime, tooling, and newly declared members while honoring exclusions', () => {
    const root = mkdtempSync(join(tmpdir(), 'ocean-workspace-ranges-'))
    onTestFinished(() => { rmSync(root, { recursive: true, force: true }) })
    const consumers = ['.', 'apps/cli', 'apps/web', 'apps/desktop', 'apps/desktop-host', 'benchmarks', 'website', 'python/sdk-runtime', 'tools/probe']
    writeFileSync(join(root, 'pnpm-workspace.yaml'), [
      'packages:', '  - packages/*/*', '  - apps/*', '  - apps/cli', '  - benchmarks',
      '  - website', '  - python/sdk-runtime', '  - tools/*', '  - "!tools/excluded"',
    ].join('\n'))
    for (const dir of [...consumers, 'tools/excluded', 'unlisted/probe', 'packages/core/runtime']) {
      mkdirSync(join(root, dir), { recursive: true })
      writeFileSync(join(root, dir, 'package.json'), JSON.stringify(dir === 'packages/core/runtime'
        ? { name: '@ocean/ocean-runtime' }
        : { dependencies: { '@ocean/ocean-runtime': 'workspace:^' } }))
    }
    const manifests = readWorkspaceManifests(root)
    expect(manifests.map(entry => entry.dir).sort()).toEqual([...consumers, 'packages/core/runtime'].sort())
    expect(checkWorkspaceProtocol(manifests).sort()).toEqual(consumers.map(dir =>
      `${dir}: dependencies.@ocean/ocean-runtime must use workspace:*, got workspace:^`).sort())
  })

  it.each(['', 'null', '{}', 'packages: []', 'packages: [false]', 'packages: [""]', 'packages: wrong'])(
    'rejects an invalid workspace declaration: %s', (contents) => {
      const root = mkdtempSync(join(tmpdir(), 'ocean-workspace-ranges-'))
      onTestFinished(() => { rmSync(root, { recursive: true, force: true }) })
      writeFileSync(join(root, 'pnpm-workspace.yaml'), contents)
      expect(() => readWorkspaceManifests(root)).toThrow('packages must be a non-empty list of workspace patterns')
    },
  )

  it('rejects a declaration that matches no workspace members', () => {
    const root = mkdtempSync(join(tmpdir(), 'ocean-workspace-ranges-'))
    onTestFinished(() => { rmSync(root, { recursive: true, force: true }) })
    writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages: [missing/*]')
    expect(() => readWorkspaceManifests(root)).toThrow('packages matched no workspace manifests')
  })
})

describe('ocean family version coherence', () => {
  it('rejects a package carrying a stale shared version', () => {
    expect(checkOceanFamilyVersion(
      { name: '@ocean/ocean-http-proxy', version: '0.1.2-alpha.5' },
      '0.1.2-rc.1',
    )).toBe('@ocean/ocean-http-proxy: package.json version must match root version 0.1.2-rc.1')
  })

  it('rejects the root-named CLI app on a stale shared version', () => {
    expect(checkOceanFamilyVersion(
      { name: '@ocean/ocean', version: '0.1.2-alpha.5' },
      '0.1.2-rc.1',
    )).toBe('@ocean/ocean: package.json version must match root version 0.1.2-rc.1')
  })

  it('accepts a manifest carrying the shared version', () => {
    expect(checkOceanFamilyVersion(
      { name: '@ocean/ocean-http-proxy', version: '0.1.2-rc.1' },
      '0.1.2-rc.1',
    )).toBeUndefined()
  })

  it('leaves other sequences to their own version lines', () => {
    expect(checkOceanFamilyVersion({ name: '@deepseek-ai/cordis', version: '4.0.1' }, '0.1.2-rc.1')).toBeUndefined()
    expect(checkOceanFamilyVersion(
      { name: '@deepseek-ai/node-addon-system', version: '0.1.1' },
      '0.1.2-rc.1',
    )).toBeUndefined()
    expect(checkOceanFamilyVersion({ version: '0.1.2-alpha.5' }, '0.1.2-rc.1')).toBeUndefined()
  })
})

describe('package payload constraints', () => {
  it.each([
    ['./art/icon.svg', ['art/icon.svg']],
    [{ import: './art/icon.svg', default: './art/fallback.svg' }, ['art/icon.svg', 'art/fallback.svg']],
    [['./art/icon.svg', './art/icon.svg'], ['art/icon.svg']],
  ] as const)('includes exported icon targets in the canonical payload: %j', (icon, expected) => {
    expect(expectedOceanPackageFiles({ exports: { './icon': icon } })).toEqual([...expected, 'lib/index.js', 'lib/types/**/*.d.ts', 'lib/types/**/*.d.ts.map', 'lib/**/*.js.map', 'src'])
  })

  it.each(['icon.svg', './icon.svg'])('includes and deduplicates manifest icon %s', (icon) => {
    expect(expectedOceanPackageFiles({ icon, exports: { './icon': './icon.svg' } })).toEqual(['icon.svg', 'lib/index.js', 'lib/types/**/*.d.ts', 'lib/types/**/*.d.ts.map', 'lib/**/*.js.map', 'src'])
  })

  it('includes manifest, root, and subpath icon targets', () => {
    expect(expectedOceanPackageFiles({ icon: './legacy.svg', exports: { './icon': './fallback.svg', './search/icon': './search.svg' } })).toEqual([
      'legacy.svg', 'fallback.svg', 'search.svg', 'lib/index.js', 'lib/types/**/*.d.ts', 'lib/types/**/*.d.ts.map', 'lib/**/*.js.map', 'src',
    ])
  })

  it('accepts the Codex subagent icon payload and rejects its omission', () => {
    const dir = 'packages/subagent/subagent-codex'
    const manifest = JSON.parse(readFileSync(new URL(`../${dir}/package.json`, import.meta.url), 'utf8')) as WorkspaceManifest['manifest']
    expect(checkWorkspaceManifest({ dir, manifest })).toEqual([])
    expect(checkWorkspaceManifest({ dir, manifest: { ...manifest, files: manifest.files!.filter(file => file !== 'icon.svg') } }))
      .toEqual([expect.stringContaining('package.json files must be')])
  })

  it.each([
    { exports: { './locale/*.json': './locale/*.json' }, resources: ['locale/*.json'] },
    { exports: { './search/locale/*.json': './resources/search/*.json' }, resources: ['resources/search/*.json'] },
    { exports: { './locale/en.json': './locale/en.json', './locale/zh.json': './locale/zh.json' }, resources: ['locale/en.json', 'locale/zh.json'] },
    { exports: { './locale/*.json': { default: './locale/*.json' } }, resources: ['locale/*.json'] },
    { exports: { './locale/*.json': './locale/*.json', './search/locale/*.json': './locale/*.json' }, resources: ['locale/*.json'] },
    { exports: { './search/locale/*.json': './z/*.json', './locale/*.json': './a/*.json' }, resources: ['a/*.json', 'z/*.json'] },
  ])('includes declared locale resources in the canonical payload: $exports', ({ exports, resources }) => {
    expect(expectedOceanPackageFiles({ name: '@ocean/ocean-localized', exports })).toEqual([
      ...resources, 'lib/index.js', 'lib/types/**/*.d.ts', 'lib/types/**/*.d.ts.map', 'lib/**/*.js.map', 'src',
    ])
  })

  it('publishes tools entry points and shared runtime chunks', () => {
    const dir = 'packages/core/tools'
    const manifest = JSON.parse(readFileSync(new URL(`../${dir}/package.json`, import.meta.url), 'utf8')) as WorkspaceManifest['manifest']
    expect(checkWorkspaceManifest({ dir, manifest })).toEqual([])
    for (const omitted of ['lib/pipeline.js', 'lib/shared-*.js']) {
      expect(checkWorkspaceManifest({ dir, manifest: {
        ...manifest, files: manifest.files!.filter(file => file !== omitted),
      } })).toEqual([expect.stringContaining('package.json files must be')])
    }
    expect(checkWorkspaceManifest({ dir, manifest: {
      ...manifest,
      exports: {
        ...manifest.exports,
        './pipeline': { types: './lib/types/pipeline.d.ts', default: './lib/index.js' },
      },
    } })).toContainEqual(expect.stringContaining('exports["./pipeline"] must expose'))
  })

  it('publishes the reusable program factory and its shared implementation', () => {
    const dir = 'packages/core/tool-executor-ptc'
    const manifest = JSON.parse(readFileSync(new URL(`../${dir}/package.json`, import.meta.url), 'utf8')) as WorkspaceManifest['manifest']
    expect(checkWorkspaceManifest({ dir, manifest })).toEqual([])
    for (const omitted of ['lib/run-code.js', 'lib/_chunks/*.js']) {
      expect(checkWorkspaceManifest({ dir, manifest: {
        ...manifest, files: manifest.files!.filter(file => file !== omitted),
      } })).toContainEqual(expect.stringContaining('package.json files must be'))
    }
    expect(checkWorkspaceManifest({ dir, manifest: {
      ...manifest, exports: {
        ...manifest.exports,
        './run-code': { types: './lib/types/run-code.d.ts', default: './lib/index.js' },
      },
    } })).toContainEqual(expect.stringContaining('exports["./run-code"] must expose'))
  })

  it('publishes the directory of each locale detail document after the locale resources', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ocean-detail-files-'))
    onTestFinished(() => { rmSync(dir, { recursive: true, force: true }) })
    mkdirSync(join(dir, 'docs/guide'), { recursive: true })
    mkdirSync(join(dir, 'locale'))
    writeFileSync(join(dir, 'docs/DETAIL.md'), '')
    writeFileSync(join(dir, 'docs/guide/DETAIL.zh.md'), '')
    writeFileSync(join(dir, 'docs/DETAIL.fr.md'), '')
    writeFileSync(join(dir, 'locale/en.json'), JSON.stringify({ meta: { title: 'T', detail: 'docs/DETAIL.md' } }))
    writeFileSync(join(dir, 'locale/zh.json'), JSON.stringify({ meta: { title: 'T', detail: 'docs/guide/DETAIL.zh.md' } }))
    writeFileSync(join(dir, 'locale/fr.json'), JSON.stringify({ meta: { title: 'T', detail: 'docs/DETAIL.fr.md' } }))
    writeFileSync(join(dir, 'locale/de.json'), JSON.stringify({ meta: { title: 'T' } }))
    writeFileSync(join(dir, 'locale/ja.json'), '{')
    const detailFiles = detailDocumentFiles(dir)
    expect(detailFiles).toEqual(['docs'])
    expect(expectedOceanPackageFiles({ exports: { './locale/*.json': './locale/*.json' } }, detailFiles)).toEqual([
      'locale/*.json', 'docs', 'lib/index.js', 'lib/types/**/*.d.ts', 'lib/types/**/*.d.ts.map', 'lib/**/*.js.map', 'src',
    ])
  })

  it('rejects a detail document that is missing, outside the package, or at the package root', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ocean-detail-invalid-'))
    onTestFinished(() => { rmSync(dir, { recursive: true, force: true }) })
    mkdirSync(join(dir, 'locale'))
    const declare = (detail: unknown): void => {
      writeFileSync(join(dir, 'locale/en.json'), JSON.stringify({ meta: { detail } }))
    }
    declare('docs/DETAIL.md')
    expect(() => detailDocumentFiles(dir)).toThrow(/DETAIL\.md.*does not exist/)
    mkdirSync(join(dir, 'docs'))
    writeFileSync(join(dir, 'docs/DETAIL.md'), '')
    expect(detailDocumentFiles(dir)).toEqual(['docs'])
    declare('DETAIL.md')
    expect(() => detailDocumentFiles(dir)).toThrow(/must name a file in a subdirectory/)
    declare('../DETAIL.md')
    expect(() => detailDocumentFiles(dir)).toThrow(/must be a relative path inside the package/)
    writeFileSync(join(dir, 'locale/en.json'), 'null')
    expect(detailDocumentFiles(dir)).toEqual([])
  })

  it('does not infer locale payloads from unrelated or non-JSON exports', () => {
    expect(expectedOceanPackageFiles({
      exports: {
        './config.json': './config.json',
        './locale/README.md': './locale/README.md',
        './locale/en.json': './metadata.js',
        './locale/zh.json': null,
        './locale/fr.json': { types: './locale/fr.d.ts' },
      },
    })).toEqual(['lib/index.js', 'lib/types/**/*.d.ts', 'lib/types/**/*.d.ts.map', 'lib/**/*.js.map', 'src'])
  })

  it.each(['team/agent-team', 'subagent/subagent-codex', 'client/ui-agent-team', 'team/tool-agent-team'])(
    'accepts the published locale files for %s and rejects their omission', (name) => {
      const dir = `packages/${name}`
      const manifest = JSON.parse(readFileSync(new URL(`../${dir}/package.json`, import.meta.url), 'utf8')) as WorkspaceManifest['manifest']
      expect(checkWorkspaceManifest({ dir, manifest })).toEqual([])
      expect(checkWorkspaceManifest({ dir, manifest: {
        ...manifest, files: manifest.files!.filter(file => file !== 'locale/*.json'),
      } })).toEqual([expect.stringContaining('package.json files must be')])
    },
  )

  it('rejects locale publication entries without their resource exports', () => {
    const dir = 'packages/team/agent-team'
    const manifest = JSON.parse(readFileSync(new URL(`../${dir}/package.json`, import.meta.url), 'utf8')) as WorkspaceManifest['manifest']
    const exports = { ...manifest.exports }
    delete exports['./locale/*.json']
    expect(checkWorkspaceManifest({ dir, manifest: { ...manifest, exports } }))
      .toEqual([expect.stringContaining('package.json files must be')])
  })

  it('includes a declared profile patch without a package-name allowlist', () => {
    expect(expectedOceanPackageFiles({
      name: '@ocean/ocean-private-profile',
      ocean: { bundle: { patch: './cordis.patch.yml' } },
    })).toEqual([
      'lib/index.js',
      'cordis.patch.yml',
      'lib/types/**/*.d.ts',
      'lib/types/**/*.d.ts.map',
      'lib/**/*.js.map',
      'src',
    ])
    expect(expectedOceanPackageFiles({
      name: '@ocean/ocean-private-profile',
      ocean: { bundle: { patch: ['./cordis.patch.yml', './layers/web.patch.yml'] } },
    })).toEqual([
      'lib/index.js',
      'cordis.patch.yml',
      'layers/web.patch.yml',
      'lib/types/**/*.d.ts',
      'lib/types/**/*.d.ts.map',
      'lib/**/*.js.map',
      'src',
    ])
  })

  it.each([
    'packages/client/ui-sidebar-documentpreview',
    'packages/client/ui-sidebar-terminal',
  ])('accepts package-local Client chunks from %s', (dir) => {
    const manifest = JSON.parse(readFileSync(new URL(`../${dir}/package.json`, import.meta.url), 'utf8')) as WorkspaceManifest['manifest']
    expect(checkWorkspaceManifest({ dir, manifest })).toEqual([])
  })

  it.each([
    { './assets/*': './lib/assets/*' },
    { './assets/*': { default: './lib/assets/*' } },
  ])('publishes built package assets after the browser Client entries: %j', (assets) => {
    expect(expectedOceanPackageFiles({
      exports: {
        './client': { types: './lib/types/client/index.d.ts', node: './lib/client.node.js', default: './lib/client.js' },
        './loader': './lib/loader.js',
        ...assets,
      },
    })).toEqual([
      'lib/index.js', 'lib/client.js', 'lib/client.node.js', 'lib/assets', 'lib/loader.js', 'lib/types/**/*.d.ts',
      'lib/types/**/*.d.ts.map', 'lib/**/*.js.map', 'src',
    ])
  })

  it.each([
    {},
    { './assets/*': './assets/*' },
    { './assets/*': { types: './lib/assets/*' } },
    { './assets/extra': './lib/assets/*' },
  ])('does not publish package assets without the exact asset export target: %j', (assets) => {
    expect(expectedOceanPackageFiles({ exports: { './client': './lib/client.js', ...assets } }))
      .toEqual(['lib/index.js', 'lib/client.js', 'lib/types/**/*.d.ts', 'lib/types/**/*.d.ts.map', 'lib/**/*.js.map', 'src'])
  })

  it('rejects a package-asset export whose payload omits the built assets', () => {
    const dir = 'packages/client/probe'
    const manifest = {
      name: '@ocean/ocean-client-probe',
      type: 'module',
      main: 'lib/index.js',
      types: 'lib/types/index.d.ts',
      exports: {
        '.': { types: './lib/types/index.d.ts', default: './lib/index.js' },
        './client': { types: './lib/types/client/index.d.ts', default: './lib/client.js' },
        './assets/*': './lib/assets/*',
      },
      files: ['lib/index.js', 'lib/client.js', 'lib/assets', 'lib/types/**/*.d.ts', 'lib/types/**/*.d.ts.map', 'lib/**/*.js.map', 'src'],
      peerDependencies: { '@deepseek-ai/cordis': 'workspace:~' },
      devDependencies: { '@deepseek-ai/cordis': 'workspace:~' },
    } satisfies WorkspaceManifest['manifest']
    const payloadErrors = (candidate: WorkspaceManifest['manifest']): string[] =>
      checkWorkspaceManifest({ dir, manifest: candidate }).filter(error => error.includes('package.json files must be'))
    expect(payloadErrors(manifest)).toEqual([])
    expect(payloadErrors({ ...manifest, files: manifest.files.filter(file => file !== 'lib/assets') })).toEqual([
      expect.stringContaining('@ocean/ocean-client-probe: package.json files must be '
        + '["lib/index.js","lib/client.js","lib/assets","lib/types/**/*.d.ts","lib/types/**/*.d.ts.map","lib/**/*.js.map","src"]'),
    ])
  })

  it.each(['ui-chat', 'ui-settings-account'])(
    'accepts the published package assets for %s and rejects their omission', (name) => {
      const dir = `packages/client/${name}`
      const manifest = JSON.parse(readFileSync(new URL(`../${dir}/package.json`, import.meta.url), 'utf8')) as WorkspaceManifest['manifest']
      expect(checkWorkspaceManifest({ dir, manifest })).toEqual([])
      expect(checkWorkspaceManifest({ dir, manifest: {
        ...manifest, files: manifest.files!.filter(file => file !== 'lib/assets'),
      } })).toEqual([expect.stringContaining('package.json files must be')])
    },
  )
})

it('publishes CLI runtime declarations and rejects a payload that omits them', () => {
  const manifest = JSON.parse(readFileSync(new URL('../apps/cli/package.json', import.meta.url), 'utf8')) as WorkspaceManifest['manifest']
  expect(checkWorkspaceManifest({ dir: 'apps/cli', manifest })).toEqual([])
  expect(checkWorkspaceManifest({ dir: 'apps/cli', manifest: { ...manifest, files: ['lib/*.js'] } }))
    .toEqual([expect.stringContaining('@ocean/ocean: package.json files must be ["lib/*.js","lib/*.js.map","lib/types/*.d.ts","lib/types/*.d.ts.map","docs","src"]')])
})

it('requires the shared Web injection entry in the published payload', () => {
  const manifest = JSON.parse(readFileSync(new URL('../packages/client/web/package.json', import.meta.url), 'utf8')) as WorkspaceManifest['manifest']
  expect(checkWorkspaceManifest({ dir: 'packages/client/web', manifest })).toEqual([])
  expect(checkWorkspaceManifest({ dir: 'packages/client/web', manifest: {
    ...manifest, files: ['lib/index.js', 'lib/**/*.css', 'lib/types/**/*.d.ts'],
  } })).toEqual([expect.stringContaining('package.json files must be')])
})

it('requires Office skill bodies and helpers in the published payload', () => {
  const manifest = JSON.parse(readFileSync(new URL('../packages/skill/skill-office/package.json', import.meta.url), 'utf8')) as WorkspaceManifest['manifest']
  expect(checkWorkspaceManifest({ dir: 'packages/skill/skill-office', manifest })).toEqual([])
  expect(checkWorkspaceManifest({ dir: 'packages/skill/skill-office', manifest: {
    ...manifest, files: ['lib/index.js', 'lib/types/**/*.d.ts'],
  } })).toEqual([expect.stringContaining('package.json files must be')])
})

it('requires Node profile configuration and both execution bootstraps in the published payload', () => {
  const dir = 'packages/ptc-runtime/ptc-runtime-node'
  const manifest = JSON.parse(readFileSync(new URL(`../${dir}/package.json`, import.meta.url), 'utf8')) as WorkspaceManifest['manifest']
  expect(checkWorkspaceManifest({ dir, manifest })).toEqual([])
  for (const omitted of ['lib/configuration.js', 'lib/process.js', 'lib/persistent-process.js']) {
    const files = expectedOceanPackageFiles(manifest).filter(file => file !== omitted)
    expect(checkWorkspaceManifest({ dir, manifest: { ...manifest, files } }))
      .toEqual([expect.stringContaining('package.json files must be')])
  }
})

it('requires both physical Client entries only for opted-in packages', () => {
  for (const dir of ['packages/client/connection', 'packages/api/gateway', 'packages/typert/registry']) {
    const manifest = JSON.parse(readFileSync(new URL(`../${dir}/package.json`, import.meta.url), 'utf8')) as WorkspaceManifest['manifest']
    expect(checkWorkspaceManifest({ dir, manifest })).toEqual([])
    for (const omitted of ['lib/client.node.js', 'lib/client.browser.js']) {
      const files = manifest.files!.filter(file => file !== omitted)
      expect(checkWorkspaceManifest({ dir, manifest: { ...manifest, files } }))
        .toEqual([expect.stringContaining('package.json files must be')])
    }
  }
})

it('requires the standalone shortcut protocol and rejects unrelated runtime files', () => {
  const dir = 'packages/client/shortcuts'
  const manifest = JSON.parse(readFileSync(new URL(`../${dir}/package.json`, import.meta.url), 'utf8')) as WorkspaceManifest['manifest']
  expect(checkWorkspaceManifest({ dir, manifest })).toEqual([])
  for (const files of [
    ['lib/index.js', 'lib/client.js', 'lib/types/**/*.d.ts'],
    ['lib/index.js', 'lib/client.js', 'lib/protocol.js', 'lib/extra.js', 'lib/types/**/*.d.ts'],
  ]) {
    expect(checkWorkspaceManifest({ dir, manifest: { ...manifest, files } }))
      .toEqual([expect.stringContaining('package.json files must be')])
  }
})

it('requires Ocean source metadata and preserves the exact package directory', () => {
  const dir = 'packages/core/agent'
  const manifest = JSON.parse(readFileSync(join(import.meta.dirname, '..', dir, 'package.json'), 'utf8')) as WorkspaceManifest['manifest']
  const ocean = { ...manifest, repository: { type: 'git', url: 'git+https://github.com/Ryltsevmg/Ocean.git', directory: dir } }
  expect(checkWorkspaceManifest({ dir, manifest: ocean })).toEqual([])
  expect(checkWorkspaceManifest({ dir, manifest: { ...ocean, repository: { ...ocean.repository, url: 'git+https://github.com/deepseek-ai/deepseek-harness.git' } } }))
    .toEqual([expect.stringContaining('release member repository must use')])
})
