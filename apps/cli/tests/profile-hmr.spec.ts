/** Module-HMR ownership across the real shipped profile bundle layers. */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { describe, expect, it } from 'vitest'
import { composeEntries, loadOverlayPatches } from '@ocean/ocean-app-boot'
import type { PatchOptions } from '@deepseek-ai/cordis-plugin-include'

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url))

/** Load one shipped bundle patch through the same parser as profile boot. */
function bundle(name: 'acp-app' | 'base' | 'headless' | 'sdk-app' | 'sdk-minimal' | 'web-app'): PatchOptions[] {
  return loadOverlayPatches('profile-hmr test', join(REPOSITORY_ROOT, 'packages', 'bundle', name, 'cordis.patch.yml'))
}

/** Resolve the effective HMR row after the supplied layers. */
function hmr(layers: PatchOptions[][]) {
  const row = composeEntries(layers).find(entry => entry.id === 'hmr')
  if (row === undefined) throw new Error('the base bundle must insert the hmr row')
  return row
}

describe('YAML-owned profile HMR', () => {
  it.each([
    { profile: 'web', disabled: false },
    { profile: 'desktop', disabled: false },
    { profile: 'serve', disabled: true },
    { profile: 'remote-device', disabled: true },
    { profile: 'connect', disabled: true },
    { profile: undefined, disabled: true },
  ])('resolves watching for profile $profile to disabled=$disabled', async ({ profile, disabled }) => {
    const dir = await mkdtemp(join(tmpdir(), 'ocean-profile-hmr-'))
    const plugin = join(dir, 'watcher.mjs')
    await writeFile(plugin, 'export function apply() {}\n')
    const ctx = new Context()
    try {
      if (profile !== undefined) {
        ctx.provide('profileContext', {
          name: profile, dir, patchPath: join(dir, 'cordis.patch.yml'), installAnchor: join(dir, 'package.json'),
          cwd: dir, home: dir, startedBundles: [], overlays: [], telemetryDisabledEnv: undefined,
        })
      }
      await ctx.plugin(Loader)
      const id = await ctx.loader.create({ ...hmr([bundle('base'), bundle('web-app')]), name: pathToFileURL(plugin).href })
      await ctx.loader.await()
      const entry = [...ctx.loader.entries()].find(item => item.id === id)
      if (entry === undefined) throw new Error('the composed watcher entry is missing')
      expect(entry.disabled).toBe(disabled)
      expect(entry.fiber !== undefined).toBe(!disabled)
    } finally {
      await ctx.fiber.dispose()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('enables configuration watching in the base and web compositions', () => {
    expect(hmr([bundle('base'), bundle('web-app')])).toMatchObject({ config: { root: [] } })
    expect(hmr([bundle('base')]).disabled).not.toBe(true)
  })

  it.each(['headless', 'sdk-app', 'acp-app'] as const)('%s disables HMR with a bundle override', (mode) => {
    expect(hmr([bundle('base'), bundle(mode)])).toMatchObject({ disabled: true })
    expect(hmr([bundle('base'), bundle(mode), [{ id: 'hmr', disabled: false }]])).toMatchObject({
      disabled: false, config: { root: [] },
    })
  })

  it('selects module roots through a later YAML layer', () => {
    expect(hmr([bundle('base'), [{ id: 'hmr', config: { root: ['.'] } }]])).toMatchObject({
      config: { root: ['.'] },
    })
  })

  it('keeps the standalone sdk-minimal tree free of HMR', () => {
    expect(composeEntries([bundle('sdk-minimal')]).find(entry => entry.id === 'hmr')).toBeUndefined()
  })
})
