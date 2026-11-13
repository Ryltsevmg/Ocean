/** Release family discovery, publish order, tag naming, and the bump judgements. */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { officialClientBuildEnvironment, writeClientBuildRecord } from '../client-build-environment.ts'
import { ON_DEMAND_BUNDLES } from '../../packages/util/official-bundles/src/bundles.ts'
import { releaseFamily, type ReleaseMember } from './families.ts'
import { compareVersions, nextVendorVersion, planShared, reachesPayload } from './bump.ts'

/**
 * A release member standing in for a manifest on disk.
 * @param directory - repository-relative package directory.
 * @param name - package name.
 * @param manifest - manifest fields the subject reads.
 * @returns The member.
 */
function member(directory: string, name: string, manifest: Record<string, unknown> = {}): ReleaseMember {
  return { directory, name, version: '0.0.1', manifest }
}

const roots: string[] = []

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

function buildFixture(environment: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-release-build-'))
  roots.push(root)
  write(join(root, 'package.json'), `${JSON.stringify({ version: environment.DSH_CLIENT_VERSION ?? '0.0.1' })}\n`)
  write(join(root, 'apps/web/dist/index.html'), '<main></main>')
  write(join(root, 'packages/client/example/lib/client.js'), 'module.exports = {}\n')
  writeClientBuildRecord(root, environment)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  vi.unstubAllEnvs()
})

describe('release families', () => {
  it('publishes all current experimental packages', () => {
    const members = releaseFamily('dsh').members(resolve(import.meta.dirname, '../..'))

    expect(members
      .filter(member => member.directory.startsWith('packages/experimental/'))
      .map(member => member.name)).toEqual([
      '@ocean/ocean-action-cards',
      '@ocean/ocean-experimental-api-speech-to-text',
      '@ocean/ocean-experimental-auto-review',
      '@ocean/ocean-experimental-badge-skill-bundle',
      '@ocean/ocean-experimental-browser-use-chrome-devtools-mcp',
      '@ocean/ocean-experimental-browser-use-playwright-mcp',
      '@ocean/ocean-experimental-browser-use-runtime',
      '@ocean/ocean-experimental-browser-use-stagehand-native',
      '@ocean/ocean-experimental-claude-code-mods',
      '@ocean/ocean-client-ui-action-cards',
      '@ocean/ocean-experimental-client-ui-claude-code-mods',
      '@ocean/ocean-experimental-client-ui-cot-translation',
      '@ocean/ocean-client-ui-creation-recommendations',
      '@ocean/ocean-experimental-client-ui-forge',
      '@ocean/ocean-client-ui-plugin-recommendations',
      '@ocean/ocean-experimental-client-ui-stats',
      '@ocean/ocean-experimental-client-ui-voice-input',
      '@ocean/ocean-experimental-computer-use-cua-driver-mcp',
      '@ocean/ocean-experimental-computer-use-cua-driver-native',
      '@ocean/ocean-experimental-cot-translation-bundle',
      '@ocean/ocean-creation-recommendations',
      '@ocean/ocean-cua-bundle',
      '@ocean/ocean-experimental-cua-macos',
      '@ocean/ocean-cua-windows',
      '@ocean/ocean-cua',
      '@ocean/ocean-experimental-forge-bundle',
      '@ocean/ocean-experimental-forge-github',
      '@ocean/ocean-experimental-forge-session',
      '@ocean/ocean-experimental-forge',
      '@ocean/ocean-hook-protocol',
      '@ocean/ocean-hooks-claude-code',
      '@ocean/ocean-hooks-codex',
      '@ocean/ocean-experimental-inspector-profile',
      '@ocean/ocean-experimental-inspector',
      '@ocean/ocean-experimental-liveshare-protocol',
      '@ocean/ocean-experimental-liveshare',
      '@ocean/ocean-personalized-recommendations',
      '@ocean/ocean-experimental-plugin-market-bundle',
      '@ocean/ocean-plugin-recommendations',
      '@ocean/ocean-experimental-ptc-runtime-python',
      '@ocean/ocean-experimental-ralph-bundle',
      '@ocean/ocean-experimental-session-inspector',
      '@ocean/ocean-experimental-session-search',
      '@ocean/ocean-session-title-all-prompts-llm',
      '@ocean/ocean-experimental-session-titles-bundle',
      '@ocean/ocean-skill-badge',
      '@ocean/ocean-experimental-speech-to-text-sensevoice',
      '@ocean/ocean-experimental-speech-to-text',
      '@ocean/ocean-experimental-subagent-oar',
      '@ocean/ocean-experimental-terminal-bundle',
      '@ocean/ocean-terminal-panel',
      '@ocean/ocean-tool-ralph',
      '@ocean/ocean-tool-session-query',
      '@ocean/ocean-experimental-tool-subagent-oar',
      '@ocean/ocean-tool-terminal',
      '@ocean/ocean-experimental-tool-worktree',
      '@ocean/ocean-experimental-translator',
      '@ocean/ocean-experimental-voice-input-bundle',
      '@ocean/ocean-webhook-github',
      '@ocean/ocean-webhook',
      '@ocean/ocean-experimental-webworker-packer',
      '@ocean/ocean-experimental-webworker-runtime',
      '@ocean/ocean-experimental-worktree',
    ])
  })

  it('excludes private applications from the publish set', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-release-private-'))
    roots.push(root)
    write(join(root, 'apps/public/package.json'), '{"name":"@ocean/ocean-public","version":"0.0.1"}\n')
    write(join(root, 'apps/private/package.json'), '{"name":"@ocean/ocean-private","version":"0.0.1","private":true}\n')

    expect(releaseFamily('dsh').members(root).map(entry => entry.name)).toEqual(['@ocean/ocean-public'])
  })

  it('publishes unlisted experimental packages while retaining private exclusions', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-release-experimental-'))
    roots.push(root)
    write(join(root, 'packages/experimental/prototype/package.json'), JSON.stringify({
      name: '@ocean/ocean-experimental-prototype',
      version: '0.0.1',
      publishConfig: { access: 'public' },
    }))
    write(join(root, 'packages/experimental/inspector/package.json'), JSON.stringify({
      name: '@ocean/ocean-experimental-inspector',
      version: '0.0.1',
      private: true,
    }))

    expect(releaseFamily('dsh').members(root).map(entry => entry.name)).toEqual([
      '@ocean/ocean-experimental-prototype',
    ])
  })

  it('bumps private dsh workspaces without adding release tags', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-release-version-'))
    roots.push(root)
    write(join(root, 'package.json'), '{"version":"0.0.1"}\n')
    write(join(root, 'apps/desktop/package.json'), '{"version":"0.0.1","private":true}\n')
    write(join(root, 'packages/experimental/prototype/package.json'), '{"version":"0.0.1","private":true}\n')
    write(join(root, 'packages/core/unselected/package.json'), '{"version":"0.0.1"}\n')

    const dsh = releaseFamily('dsh')
    const published = member('packages/core/published', '@ocean/ocean-published')
    const { planned } = planShared(dsh, root, [published], '0.0.2')

    expect(planned.map(entry => ({ path: entry.manifestPath, tag: entry.tag }))).toEqual([
      { path: 'package.json', tag: undefined },
      { path: 'packages/core/published/package.json', tag: 'dsh-v0.0.2' },
      { path: 'apps/desktop/package.json', tag: undefined },
      { path: 'packages/experimental/prototype/package.json', tag: undefined },
    ])
  })

  it.each(['0.0.2-alpha.1', '0.0.2-canary.1', '0.0.2-rc.1'])(
    'accepts the explicit dsh prerelease version %s',
    (version) => {
      const root = mkdtempSync(join(tmpdir(), 'dsh-release-prerelease-'))
      roots.push(root)
      write(join(root, 'package.json'), '{"version":"0.0.1"}\n')

      const dsh = releaseFamily('dsh')
      const published = member('packages/core/published', '@ocean/ocean-published')
      const plan = planShared(dsh, root, [published], version)

      expect(plan.version).toBe(version)
      expect(plan.planned[1]?.tag).toBe(`dsh-v${version}`)
    },
  )

  it('names one tag for the whole dsh family and one per vendored package', () => {
    const dsh = releaseFamily('dsh')
    const vendor = releaseFamily('vendor')
    const cli = member('apps/cli', '@ocean/ocean')
    const cordis = { ...member('vendor/cordis', '@deepseek-ai/cordis'), version: '4.0.1' }

    expect(dsh.tagFor(cli)).toBe('dsh-v0.0.1')
    expect(vendor.tagFor(cordis)).toBe('vendor-cordis-v4.0.1')
    // The prefix is constructed, not recovered from a tag: a version with a
    // hyphen would defeat any suffix-stripping.
    expect(vendor.tagPrefixFor({ ...cordis, version: '4.0.0-rc.7' })).toBe('vendor-cordis-v')
    expect(vendor.tagFor({ ...cordis, version: '4.0.0-rc.7' })).toBe('vendor-cordis-v4.0.0-rc.7')
  })

  it('assigns alpha and canary dist-tags only to dsh releases', () => {
    const dsh = releaseFamily('dsh')
    const vendor = releaseFamily('vendor')

    expect(dsh.distTagForVersion('0.0.2-alpha.1')).toBe('alpha')
    expect(dsh.distTagForVersion('0.0.2-canary.1')).toBe('canary')
    expect(dsh.distTagForVersion('0.0.2-rc.1')).toBe('next')
    expect(dsh.distTagForVersion('0.0.2')).toBeUndefined()
    expect(vendor.distTagForVersion('4.0.1-alpha.1')).toBe('next')
    expect(vendor.distTagForVersion('4.0.1-canary.1')).toBe('next')
  })

  it('rejects a family whose members disagree on the shared version', () => {
    const dsh = releaseFamily('dsh')
    const members = [member('apps/cli', '@ocean/ocean'), { ...member('apps/web', '@ocean/ocean-web-frontend'), version: '0.0.2' }]

    expect(() => { dsh.verifyVersions(members) }).toThrow(/must share one version/)
    expect(() => { dsh.verifyVersions([members[0]!]) }).not.toThrow()
  })

  it('accepts independent vendored versions and rejects an unpublishable one', () => {
    const vendor = releaseFamily('vendor')
    const members = [
      { ...member('vendor/cordis', '@deepseek-ai/cordis'), version: '4.0.1' },
      { ...member('vendor/cosmokit', '@deepseek-ai/cosmokit'), version: '1.8.2' },
    ]

    expect(() => { vendor.verifyVersions(members) }).not.toThrow()
    expect(() => { vendor.verifyVersions([{ ...members[0]!, version: 'latest' }]) }).toThrow(/unpublishable version/)
  })

  it('requires a current official client build only for dsh artifacts', () => {
    const dsh = releaseFamily('dsh')
    const vendor = releaseFamily('vendor')
    const officialEnvironment = officialClientBuildEnvironment(resolve(import.meta.dirname, '../..'))
    vi.stubEnv('DSH_CLIENT_COMMIT_HASH', officialEnvironment.DSH_CLIENT_COMMIT_HASH)
    const official = buildFixture(officialEnvironment)
    const defaultBuild = buildFixture({})
    const missing = join(defaultBuild, 'missing')
    write(join(missing, 'package.json'), `${JSON.stringify({ version: officialEnvironment.DSH_CLIENT_VERSION })}\n`)

    expect(() => { dsh.verifyBuildArtifacts(official) }).not.toThrow()
    expect(() => { dsh.verifyBuildArtifacts(defaultBuild) }).toThrow(/DSH_CLIENT_TITLE/)
    expect(() => { dsh.verifyBuildArtifacts(missing) }).toThrow(/record.*missing/)
    expect(() => { vendor.verifyBuildArtifacts(missing) }).not.toThrow()

    write(join(official, 'packages/client/example/lib/client.js'), 'module.exports = { changed: true }\n')
    expect(() => { dsh.verifyBuildArtifacts(official) }).toThrow(/artifacts differ/)
  })

  it('publishes a dependency before its consumer, and orders ties by name', () => {
    const dsh = releaseFamily('dsh')
    const members = [
      member('packages/a/consumer', '@ocean/ocean-consumer', { dependencies: { '@ocean/ocean-library': 'workspace:^' } }),
      member('packages/a/library', '@ocean/ocean-library'),
      member('packages/a/zebra', '@ocean/ocean-zebra'),
    ]

    expect(dsh.publishOrder(members).order.map(entry => entry.name)).toEqual([
      '@ocean/ocean-library',
      '@ocean/ocean-consumer',
      '@ocean/ocean-zebra',
    ])
  })

  it('publishes on-demand catalog members before dsh without adding installed dependencies', () => {
    const dsh = member('apps/cli', '@ocean/ocean')
    const providers = ON_DEMAND_BUNDLES.map(name => member(`packages/subagent/${name}`, name))
    const plan = releaseFamily('dsh').publishOrder([dsh, ...providers])
    expect(plan.order.map(entry => entry.name)).toEqual([...ON_DEMAND_BUNDLES.toSorted(), dsh.name])
    expect(dsh.manifest).toEqual({})
    expect(plan.droppedPeerEdges).toEqual([])
  })

  it('rejects an advertised provider missing from the public release family', () => {
    expect(() => releaseFamily('dsh').publishOrder([member('apps/cli', '@ocean/ocean')]))
      .toThrow('Official catalog prerequisite')
  })

  it('keeps catalog prerequisites ahead of a dsh peer declaration', () => {
    const dsh = member('apps/cli', '@ocean/ocean')
    const providers = ON_DEMAND_BUNDLES.map(name => member(`packages/subagent/${name}`, name, {
      peerDependencies: { '@ocean/ocean': 'workspace:*' },
    }))
    const plan = releaseFamily('dsh').publishOrder([dsh, ...providers])
    expect(plan.order.map(entry => entry.name)).toEqual([...ON_DEMAND_BUNDLES.toSorted(), dsh.name])
    expect(plan.droppedPeerEdges).toEqual(ON_DEMAND_BUNDLES.toSorted().map(name => ({ consumer: name, peer: dsh.name })))
  })

  it.each(['dependencies', 'optionalDependencies', 'peerDependencies'])(
    'requires exact packed DSH %s while preserving external ranges', (section) => {
      const pkg = member('packages/example/provider', '@ocean/ocean-provider')
      const family = releaseFamily('dsh')
      const manifest = { name: pkg.name, version: pkg.version, [section]: { '@ocean/ocean-tools': pkg.version, external: '^4.0.0' } }
      expect(() => { family.validatePackedManifest(pkg, manifest) }).not.toThrow()
      for (const range of ['workspace:*', '^0.0.1', '~0.0.1', '0.0.2', '*']) {
        expect(() => { family.validatePackedManifest(pkg, { ...manifest, [section]: { '@ocean/ocean-tools': range } }) })
          .toThrow(`packed ${section}.@ocean/ocean-tools must equal`)
      }
    },
  )

  it('checks packed identities and preserves independent vendor versions', () => {
    const pkg = member('vendor/example', '@deepseek-ai/example')
    const family = releaseFamily('vendor')
    expect(() => { family.validatePackedManifest(pkg, { name: pkg.name, version: pkg.version, dependencies: { '@ocean/ocean-tools': '^4.0.0' } }) })
      .not.toThrow()
    expect(() => { family.validatePackedManifest(pkg, { name: '@deepseek-ai/other', version: pkg.version }) }).toThrow('packed identity')
    expect(() => { family.validatePackedManifest(pkg, { name: pkg.name, version: '0.0.2' }) }).toThrow('packed identity')
  })

  it('reports a runtime dependency cycle instead of emitting an arbitrary order', () => {
    const dsh = releaseFamily('dsh')
    const members = [
      member('packages/a/left', '@ocean/ocean-left', { dependencies: { '@ocean/ocean-right': 'workspace:^' } }),
      member('packages/a/right', '@ocean/ocean-right', { dependencies: { '@ocean/ocean-left': 'workspace:^' } }),
    ]

    expect(() => { dsh.publishOrder(members) }).toThrow(/dependency cycle/)
  })

  it('publishes a peer before its consumer', () => {
    const dsh = releaseFamily('dsh')
    const members = [
      member('packages/a/consumer', '@ocean/ocean-consumer', { peerDependencies: { '@ocean/ocean-zebra': 'workspace:^' } }),
      member('packages/a/zebra', '@ocean/ocean-zebra'),
    ]

    // Name order alone would place the consumer first; the peer edge moves it.
    expect(dsh.publishOrder(members).order.map(entry => entry.name)).toEqual([
      '@ocean/ocean-zebra',
      '@ocean/ocean-consumer',
    ])
  })

  it('orders around a peer cycle rather than refusing to publish, and reports the edge it dropped', () => {
    const dsh = releaseFamily('dsh')
    const members = [
      member('packages/a/left', '@ocean/ocean-left', { peerDependencies: { '@ocean/ocean-right': 'workspace:^' } }),
      member('packages/a/right', '@ocean/ocean-right', { peerDependencies: { '@ocean/ocean-left': 'workspace:^' } }),
    ]

    // Sibling packages declare each other as peers, and npm treats an unmet peer
    // as a warning, so this pair has to publish rather than fail the release.
    const plan = dsh.publishOrder(members)
    expect(plan.order.map(entry => entry.name)).toEqual([
      '@ocean/ocean-right',
      '@ocean/ocean-left',
    ])
    // One of the two edges has to give, and which one it is belongs in the log.
    expect(plan.droppedPeerEdges).toEqual([
      { consumer: '@ocean/ocean-right', peer: '@ocean/ocean-left' },
    ])
  })

  it('honours an install edge even when a peer cycle surrounds it', () => {
    const dsh = releaseFamily('dsh')
    const members = [
      member('packages/a/base', '@ocean/ocean-base', { peerDependencies: { '@ocean/ocean-consumer': 'workspace:^' } }),
      member('packages/a/consumer', '@ocean/ocean-consumer', {
        dependencies: { '@ocean/ocean-base': 'workspace:^' },
        peerDependencies: { '@ocean/ocean-base': 'workspace:^' },
      }),
    ]

    // The install edge is absolute: base publishes first, and the peer edge that
    // would reverse it is the one dropped.
    const plan = dsh.publishOrder(members)
    expect(plan.order.map(entry => entry.name)).toEqual([
      '@ocean/ocean-base',
      '@ocean/ocean-consumer',
    ])
    expect(plan.droppedPeerEdges).toEqual([
      { consumer: '@ocean/ocean-base', peer: '@ocean/ocean-consumer' },
    ])
  })

  it('refuses an order that would publish a consumer before a dependency it installs', () => {
    const dsh = releaseFamily('dsh')
    const members = [
      member('packages/a/alpha', '@ocean/ocean-alpha', { peerDependencies: { '@ocean/ocean-bravo': 'workspace:^' } }),
      member('packages/a/bravo', '@ocean/ocean-bravo', { peerDependencies: { '@ocean/ocean-charlie': 'workspace:^' } }),
      member('packages/a/charlie', '@ocean/ocean-charlie', { dependencies: { '@ocean/ocean-alpha': 'workspace:^' } }),
    ]

    // A cycle of two peer edges closed by one install edge: dropping a peer edge
    // would order this, and the traversal drops the install edge instead. That
    // order would publish charlie before the alpha it installs, so it is refused
    // here rather than published.
    expect(() => { dsh.publishOrder(members) }).toThrow(/no publish order honours @ocean\/ocean-charlie -> @ocean\/ocean-alpha/)
  })

  it('ignores devDependencies when ordering', () => {
    const dsh = releaseFamily('dsh')
    const members = [
      member('packages/a/alpha', '@ocean/ocean-alpha', { devDependencies: { '@ocean/ocean-zebra': 'workspace:^' } }),
      member('packages/a/zebra', '@ocean/ocean-zebra'),
    ]

    // A dev dependency is absent from the published package, so it must not move
    // the consumer behind it.
    expect(dsh.publishOrder(members).order.map(entry => entry.name)).toEqual([
      '@ocean/ocean-alpha',
      '@ocean/ocean-zebra',
    ])
  })

  it('accepts the harness payload and keeps upstream payloads for vendored packages', () => {
    const dsh = releaseFamily('dsh')
    const vendor = releaseFamily('vendor')
    const harness = member('packages/a/library', '@ocean/ocean-library')
    const vendored = member('vendor/cordis', '@deepseek-ai/cordis')

    expect(() => { dsh.validatePayload(harness, ['package/lib/index.js', 'package/lib/index.js.map', 'package/src/index.ts']) }).not.toThrow()
    expect(() => { vendor.validatePayload(vendored, ['package/lib/index.js', 'package/src/index.ts']) }).not.toThrow()
    expect(() => { vendor.validatePayload(vendored, []) }).toThrow(/empty tarball/)
  })

  it('requires the installed package payload the staging hook supplies', () => {
    const dsh = releaseFamily('dsh')
    const installed = member('apps/cli', '@ocean/ocean')

    expect(() => { dsh.validatePayload(installed, ['package/lib/index.js', 'package/src/bin.ts']) })
      .toThrow(/@ocean\/ocean packed no documentation/)
    expect(() => { dsh.validatePayload(installed, ['package/lib/index.js', 'package/docs/guide.md', 'package/src/bin.ts']) })
      .toThrow(/@ocean\/ocean packed no upgrade guide index/)
    const docs = ['package/docs/guide.md', 'package/docs/upgrade-guide/README.md']
    expect(() => { dsh.validatePayload(installed, ['package/lib/index.js', ...docs]) })
      .toThrow(/@ocean\/ocean packed no source/)
    expect(() => { dsh.validatePayload(installed, ['package/lib/index.js', ...docs, 'package/src/bin.ts']) })
      .not.toThrow()
  })

  it('drives the installed entry only for the family that publishes one', () => {
    expect(releaseFamily('dsh').installedEntry).toEqual({ packageName: '@ocean/ocean', binPath: 'lib/bin.js' })
    expect(releaseFamily('vendor').installedEntry).toBeUndefined()
  })

  it('rejects an unknown family identifier', () => {
    expect(() => { releaseFamily('native') }).toThrow(/unknown release family/)
  })
})

describe('vendored version baseline', () => {
  it('drops an upstream prerelease segment and increments the patch', () => {
    expect(nextVendorVersion('4.0.0-rc.7', undefined)).toBe('4.0.1')
    expect(nextVendorVersion('1.0.0-rc.5', undefined)).toBe('1.0.1')
    expect(nextVendorVersion('1.8.1', undefined)).toBe('1.8.2')
  })

  it('increments from the last published version when a re-sync restored a lower one', () => {
    // Upstream moved rc.7 -> rc.8 after this repository published 4.0.1;
    // incrementing the manifest alone would name 4.0.1 a second time.
    expect(nextVendorVersion('4.0.0-rc.8', '4.0.1')).toBe('4.0.2')
    expect(nextVendorVersion('4.1.0', '4.0.1')).toBe('4.1.1')
  })

  it('appends a rehearsal prerelease without consuming its release numbers', () => {
    // A rehearsal burns 4.0.1-rc.1 and leaves 4.0.1 free, so the stable release
    // that follows takes those same numbers instead of skipping to 4.0.2.
    expect(nextVendorVersion('4.0.0-rc.7', undefined, 'rc.1')).toBe('4.0.1-rc.1')
    expect(nextVendorVersion('4.0.0-rc.7', '4.0.1-rc.1', 'rc.2')).toBe('4.0.1-rc.2')
    expect(nextVendorVersion('4.0.0-rc.7', '4.0.1-rc.1')).toBe('4.0.1')
    expect(nextVendorVersion('4.0.0-rc.7', '4.0.1')).toBe('4.0.2')
  })
})

describe('version precedence', () => {
  it('orders alpha, canary, and release-candidate versions by semver precedence', () => {
    expect(compareVersions('4.0.1-alpha.1', '4.0.1-canary.1')).toBeLessThan(0)
    expect(compareVersions('4.0.1-canary.1', '4.0.1-rc.1')).toBeLessThan(0)
    expect(compareVersions('4.0.1-rc.1', '4.0.1')).toBeLessThan(0)
  })

  it('ranks a release above the prerelease it follows', () => {
    // git --sort=v:refname disagrees, placing 4.0.1-rc.1 above 4.0.1, which is
    // why the newest published version is chosen here rather than by git.
    expect(compareVersions('4.0.1', '4.0.1-rc.1')).toBeGreaterThan(0)
    expect(compareVersions('4.0.1-rc.1', '4.0.1')).toBeLessThan(0)
  })

  it('compares numeric prerelease fields numerically', () => {
    expect(compareVersions('4.0.1-rc.10', '4.0.1-rc.1')).toBeGreaterThan(0)
    expect(compareVersions('4.0.1-rc.2', '4.0.1-rc.10')).toBeLessThan(0)
  })

  it('ranks a numeric field below an alphanumeric one, and a shorter list below a longer', () => {
    expect(compareVersions('4.0.1-1', '4.0.1-alpha')).toBeLessThan(0)
    expect(compareVersions('4.0.1-rc', '4.0.1-rc.1')).toBeLessThan(0)
    expect(compareVersions('4.0.2', '4.0.1')).toBeGreaterThan(0)
    expect(compareVersions('4.0.1-rc.1', '4.0.1-rc.1')).toBe(0)
  })
})

describe('payload change judgement', () => {
  const sourceShipping = member('vendor/cosmokit', '@deepseek-ai/cosmokit', {
    files: ['lib/index.js', 'lib/types/**/*.d.ts', 'src'],
  })
  const buildOutputOnly = member('vendor/cordis', '@deepseek-ai/cordis', {
    files: ['lib/index.js', 'lib/types/**/*.d.ts', 'bin.js'],
  })

  it('counts the manifest and the files npm always publishes', () => {
    expect(reachesPayload(sourceShipping, 'vendor/cosmokit/package.json')).toBe(true)
    expect(reachesPayload(sourceShipping, 'vendor/cosmokit/README.md')).toBe(true)
    expect(reachesPayload(sourceShipping, 'vendor/cosmokit/src/index.ts')).toBe(true)
  })

  it('counts build inputs for a package whose payload is build output', () => {
    // cordis publishes lib/ only, and lib/ is not tracked: without this, a real
    // source change reads as "nothing changed" and the next publish fails on a
    // version whose bytes moved.
    expect(reachesPayload(buildOutputOnly, 'vendor/cordis/src/context.ts')).toBe(true)
    expect(reachesPayload(buildOutputOnly, 'vendor/cordis/tsconfig.json')).toBe(true)
  })

  it('ignores paths no tarball carries', () => {
    expect(reachesPayload(sourceShipping, 'vendor/cosmokit/tests/unit.spec.ts')).toBe(false)
    expect(reachesPayload(sourceShipping, 'vendor/cosmokit/CHANGELOG.md')).toBe(false)
    // The README pattern is deliberately loose: over-reporting a change costs one
    // unnecessary patch bump, while under-reporting fails the next publish on a
    // version whose bytes moved.
    expect(reachesPayload(sourceShipping, 'vendor/cosmokit/README.i18n.yaml')).toBe(true)
    expect(reachesPayload(member('packages/a/library', '@ocean/ocean-library', { files: ['lib/index.js'] }),
      'packages/a/library/tests/library.spec.ts')).toBe(false)
  })
})
