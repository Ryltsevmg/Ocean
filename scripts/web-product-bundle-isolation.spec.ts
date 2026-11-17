/** Exercise real Vite build inputs, including files absent from ordinary chunk imports. */

import { existsSync, mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { browserDependencyAnalysis, productWebBundleIsolation } from '../apps/web/product-isolation.ts'
import { WebProductBundleIsolation } from './web-product-bundle-isolation.ts'
import { BundleInputIsolation } from './bundle-input-isolation.ts'

const filesystem = vi.hoisted(() => ({ missingRoot: false }))
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: (path: Parameters<typeof actual.existsSync>[0]) => !filesystem.missingRoot && actual.existsSync(path),
  }
})

// Vite is owned by the Web app rather than the repository's scripting dependencies.
const vite = createRequire(new URL('../apps/web/package.json', import.meta.url))('vite') as {
  build(config: Record<string, unknown>): Promise<unknown>
}

function fixture() {
  // Vite resolves inputs with native realpath, which expands Windows short names.
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ocean-web-bundle-isolation-')))
  const web = join(root, 'apps/web')
  onTestFinished(() => { rmSync(root, { recursive: true, force: true }) })
  const write = (path: string, content: string): void => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  write('package.json', '{"name":"isolation-fixture","type":"module"}')
  write('apps/web/package.json', '{"name":"@ocean/ocean-web-frontend","type":"module"}')
  write('apps/web/index.html', '<script type="module" src="/src/main.js"></script>')
  write('apps/web/src/main.js', 'globalThis.product = true')
  write('apps/web/src/secondary.js', 'globalThis.secondary = true')
  const run = (extra: Record<string, unknown> = {}): Promise<unknown> => vite.build({
    configFile: false,
    root: web,
    logLevel: 'silent',
    plugins: productWebBundleIsolation(root, web),
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: { index: join(web, 'index.html'), bootstrap: join(web, 'src/secondary.js') },
      },
    },
    ...extra,
  })
  return { root, web, write, run }
}

describe('default Web bundle input verification', () => {
  it('requires explicit analysis intent before allowing externalized inputs in a non-writing build', async () => {
    const test = fixture()
    test.write('apps/web/src/main.js', 'import "external-lib"; globalThis.product = true')
    const externalize = {
      name: 'fixture-external-analysis',
      resolveId(id: string) { return id === 'external-lib' ? { id, external: true } : null },
    }
    await expect(test.run({ plugins: [...productWebBundleIsolation(test.root, test.web), externalize] }))
      .rejects.toThrow(/external module external-lib has no bundled input proof/)
    await expect(test.run({ plugins: [
      ...productWebBundleIsolation(test.root, test.web), browserDependencyAnalysis(), externalize,
    ] })).resolves.toBeDefined()
    expect(existsSync(join(test.web, 'dist'))).toBe(false)
  })

  it('refuses output writing when dependency analysis bypasses the product check', async () => {
    const test = fixture()
    const output = join(test.root, 'analysis-output')
    await expect(test.run({
      plugins: [...productWebBundleIsolation(test.root, test.web), browserDependencyAnalysis()],
      build: { write: true, outDir: output },
    })).rejects.toThrow(/browser dependency analysis requires build.write: false/)
    expect(existsSync(output)).toBe(false)
  })

  it('builds the product and secondary entries with every recorded input present', async () => {
    const output: unknown = expect.arrayContaining([
      expect.objectContaining({ type: 'asset', fileName: 'index.html' }),
      expect.objectContaining({ type: 'chunk', name: 'bootstrap' }),
    ])
    await expect(fixture().run()).resolves.toMatchObject({ output })
  })

  it('rejects an emitted entry without its original HTML input', () => {
    const test = fixture()
    const inputs = new WebProductBundleIsolation(test.root, test.web)
    expect(() => { inputs.verify({}, () => null) }).toThrow(/index.html is missing its original HTML input/)
  })

  it('rejects a worker asset whose subbuild was not observed', () => {
    const test = fixture()
    const inputs = new WebProductBundleIsolation(test.root, test.web)
    inputs.assetReference('worker.js', 'index.html', 'asset')
    expect(() => { inputs.verify({
      'index.html': { type: 'asset', fileName: 'index.html', names: ['index.html'], originalFileNames: ['index.html'] },
      'worker.js': { type: 'asset', fileName: 'worker.js', names: [], originalFileNames: [] },
    }, () => null) }).toThrow(/worker.js has no recorded original files/)
  })
})

describe('bundler input verification', () => {
  it('refuses source-map paths whose filesystem root is unavailable', () => {
    const test = fixture()
    const ownership = new BundleInputIsolation(test.root, 'fixture')
    filesystem.missingRoot = true
    try {
      expect(() => { ownership.assertSourceMapInput(join(test.web, 'missing/source.js')) })
        .toThrow(/has no existing filesystem root/)
    } finally {
      filesystem.missingRoot = false
    }
  })

  it('distinguishes missing actual inputs from omitted upstream source-map files', () => {
    const test = fixture()
    const ownership = new BundleInputIsolation(test.root, 'fixture')
    const file = join(test.web, 'node_modules/upstream/src/omitted.js')
    test.write('apps/web/node_modules/upstream/package.json', '{"name":"upstream"}')
    expect(() => { ownership.assertInput(file) }).toThrow(/is missing/)
    expect(() => { ownership.assertSourceMapInput(file) }).not.toThrow()
  })
})
