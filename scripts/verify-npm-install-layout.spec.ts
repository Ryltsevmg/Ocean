import { describe, expect, it } from 'vitest'
import type { NpmPackageLock, RegistryIndex } from './benchmark-npm-resolution.ts'
import {
  assertDualOceanInstallLayout,
  assertResolutionWorkBudget,
  buildDualOceanRegistry,
  MAX_RESOLUTION_WORK_UNITS,
} from './verify-npm-install-layout.ts'

function validLayout(): NpmPackageLock {
  return {
    lockfileVersion: 3,
    packages: {
      '': { dependencies: { '@ocean/ocean': '0.2.0', 'ocean-previous': 'npm:@ocean/ocean@0.1.0' } },
      'node_modules/@deepseek-ai/cordis': { version: '4.0.1' },
      'node_modules/@ocean/ocean': {
        version: '0.2.0',
        dependencies: { '@ocean/ocean-child': '^0.2.0' },
        peerDependencies: { '@deepseek-ai/cordis': '^4.0.1' },
      },
      'node_modules/@ocean/ocean-child': {
        version: '0.2.0',
        dependencies: { '@ocean/ocean-leaf': '^0.2.0' },
      },
      'node_modules/@ocean/ocean-leaf': { version: '0.2.0' },
      'node_modules/ocean-previous': {
        name: '@ocean/ocean',
        version: '0.1.0',
        dependencies: { '@ocean/ocean-child': '^0.1.0' },
        peerDependencies: { '@deepseek-ai/cordis': '^4.0.1' },
      },
      'node_modules/ocean-previous/node_modules/@ocean/ocean-child': {
        version: '0.1.0',
        dependencies: { '@ocean/ocean-leaf': '^0.1.0' },
      },
      'node_modules/ocean-previous/node_modules/@ocean/ocean-leaf': { version: '0.1.0' },
    },
  }
}

describe('npm install layout verifier', () => {
  it('creates two incompatible versions of every OCEAN package', () => {
    const index: RegistryIndex = new Map([
      ['@ocean/ocean', new Map([['0.1.1-rc.2', {
        name: '@ocean/ocean',
        version: '0.1.1-rc.2',
        dependencies: { '@ocean/ocean-child': '^0.1.1-rc.2' },
        peerDependencies: { '@deepseek-ai/cordis': '^4.0.1' },
      }]])],
      ['@ocean/ocean-child', new Map([['0.1.1-rc.2', {
        name: '@ocean/ocean-child',
        version: '0.1.1-rc.2',
      }]])],
      ['@deepseek-ai/cordis', new Map([['4.0.1', {
        name: '@deepseek-ai/cordis',
        version: '4.0.1',
      }]])],
    ])

    const dual = buildDualOceanRegistry(index, '0.1.1-rc.2')

    expect([...dual.get('@ocean/ocean')?.keys() ?? []]).toEqual(['0.1.0', '0.2.0'])
    expect(dual.get('@ocean/ocean')?.get('0.1.0')).toMatchObject({
      version: '0.1.0',
      dependencies: { '@ocean/ocean-child': '^0.1.0' },
      peerDependencies: { '@deepseek-ai/cordis': '^4.0.1' },
    })
    expect(dual.get('@ocean/ocean')?.get('0.2.0')).toMatchObject({
      version: '0.2.0',
      dependencies: { '@ocean/ocean-child': '^0.2.0' },
    })
    expect(dual.get('@deepseek-ai/cordis')).toBe(index.get('@deepseek-ai/cordis'))
  })

  it('accepts isolated OCEAN releases with one shared Cordis installation', () => {
    expect(assertDualOceanInstallLayout(validLayout())).toEqual({
      oceanPackagesPerVersion: 3,
      checkedOceanEdges: 4,
    })
  })

  it.each([
    ['react', 'node_modules/react'],
    ['react-dom', 'node_modules/react-dom'],
    ['react', 'node_modules/ocean-previous/node_modules/react'],
    ['react-dom', 'node_modules/ocean-previous/node_modules/react-dom'],
  ])('rejects browser runtime %s installed at %s in the OCEAN-only consumer', (name, path) => {
    const layout = validLayout()
    const packages = { ...layout.packages, [path]: { version: '18.3.1' } }
    expect(() => assertDualOceanInstallLayout({ ...layout, packages })).toThrow(
      `${path}: ${name} is a browser build input`,
    )
  })

  it('rejects an internal edge that crosses release versions', () => {
    const layout = validLayout()
    const packages = { ...layout.packages }
    Reflect.deleteProperty(packages, 'node_modules/ocean-previous/node_modules/@ocean/ocean-leaf')

    expect(() => assertDualOceanInstallLayout({ ...layout, packages })).toThrow(
      'node_modules/ocean-previous/node_modules/@ocean/ocean-child: dependencies '
      + '@ocean/ocean-leaf resolves to node_modules/@ocean/ocean-leaf@0.2.0, expected 0.1.0',
    )
  })

  it('rejects a second Cordis installation', () => {
    const layout = validLayout()
    const packages = {
      ...layout.packages,
      'node_modules/ocean-previous/node_modules/@deepseek-ai/cordis': { version: '4.0.1' },
    }

    expect(() => assertDualOceanInstallLayout({ ...layout, packages })).toThrow(
      'expected one shared @deepseek-ai/cordis',
    )
  })
})

describe('resolution work budget', () => {
  it.each([
    [277, 2524, 699_148],
    [316, 2780, 878_480],
    [316, 2786, 880_376],
    [317, 2786, 883_162],
    [320, 2836, 907_520],
  ])('accepts the measured dual-release graph with %i packages and %i edges', (packages, edges, units) => {
    expect(assertResolutionWorkBudget({ oceanPackagesPerVersion: packages, checkedOceanEdges: edges }))
      .toBe(units)
  })

  it('accepts a graph exactly at the budget and rejects one internal edge above it', () => {
    const packages = 320
    const edgesAtBudget = Math.floor(MAX_RESOLUTION_WORK_UNITS / packages)

    expect(packages * edgesAtBudget).toBe(MAX_RESOLUTION_WORK_UNITS)
    expect(assertResolutionWorkBudget({ oceanPackagesPerVersion: packages, checkedOceanEdges: edgesAtBudget }))
      .toBe(MAX_RESOLUTION_WORK_UNITS)
    expect(() => assertResolutionWorkBudget({
      oceanPackagesPerVersion: packages,
      checkedOceanEdges: edgesAtBudget + 1,
    })).toThrow(`= ${String(MAX_RESOLUTION_WORK_UNITS + packages)} unit(s), budget ${String(MAX_RESOLUTION_WORK_UNITS)} unit(s)`)
  })

  it('accepts the headroom and rejects a runaway graph with its own measured counts', () => {
    expect(assertResolutionWorkBudget({ oceanPackagesPerVersion: 350, checkedOceanEdges: 3200 }))
      .toBe(1_120_000)
    expect(() => assertResolutionWorkBudget({ oceanPackagesPerVersion: 400, checkedOceanEdges: 3000 }))
      .toThrow(`400 package(s) per release x 3000 internal edge(s) = 1200000 unit(s), budget ${String(MAX_RESOLUTION_WORK_UNITS)} unit(s)`)
  })
})
