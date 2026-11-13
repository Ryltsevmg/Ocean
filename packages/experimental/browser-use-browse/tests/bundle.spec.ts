import BrowserSetup from '../src/setup.ts'
/** Optional packaged activation must be discoverable without silently connecting a browser. */
import { readFileSync, existsSync } from 'node:fs'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import BrowserUse from '@ocean/ocean-browser-use'
import Tools from '@ocean/ocean-tools'
import SystemPrompt from '@ocean/ocean-system-prompt'
import Agents from '@ocean/ocean-agent'
import Projections from '@ocean/ocean-session-projection'
import { load } from 'js-yaml'
import { expect, it } from 'vitest'
import ts from 'typescript'
import { OPTIONAL_BUNDLES, EXPERIMENTAL_BUNDLES, PROFILE_TEMPLATES } from '@ocean/ocean-official-bundles'
import * as Provider from '../src/index.ts'

it('ships a discoverable optional bundle and setup details, but selects no default profile', () => {
  const meta = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { name: string; dsh: { bundle: { patch: string; platforms: string[] } } }
  expect(meta.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
  expect(meta.dsh?.bundle?.platforms).toEqual(['darwin', 'linux'])
  expect(OPTIONAL_BUNDLES).toContain(meta.name)
  expect(EXPERIMENTAL_BUNDLES.has(meta.name)).toBe(true)
  for (const profile of Object.values(PROFILE_TEMPLATES)) expect(profile.bundles).not.toContain(meta.name)
  for (const language of ['en', 'ru', 'zh']) {
    const locale = JSON.parse(readFileSync(new URL(`../locale/${language}.json`, import.meta.url), 'utf8')) as { meta: { title: string; detail: string } }
    expect(locale.meta.title).toBeTruthy()
    expect(existsSync(new URL(`../${locale.meta.detail}`, import.meta.url))).toBe(true)
  }
})

it('publishes setup and type companions and resolves browser subpaths from source', () => {
  const meta = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    files: string[]
    dependencies: Record<string, string>
    exports: Record<string, { default: string }>
  }
  for (const subpath of ['setup', 'types']) {
    expect(meta.exports[`./${subpath}`]?.default).toBe(`./lib/${subpath}.js`)
    expect(meta.files).toContain(`lib/${subpath}.js`)
  }
  expect(meta.dependencies['@ocean/ocean-browser-use']).toBe('workspace:*')
  const config = ts.parseConfigFileTextToJson('tsconfig.base.json', readFileSync(new URL('../../../../tsconfig.base.json', import.meta.url), 'utf8')).config as {
    compilerOptions: { paths: Record<string, string[]> }
  }
  for (const [subpath, source] of Object.entries({ client: 'client/index.ts', setup: 'setup.ts', types: 'remote-types.ts' })) {
    expect(config.compilerOptions.paths[`@ocean/ocean-browser-use-browse/${subpath}`])
      .toEqual([`./packages/experimental/browser-use-browse/src/${source}`])
  }
  const build = readFileSync(new URL('../tsdown.config.ts', import.meta.url), 'utf8')
  expect(build).toContain("setup: 'lib/types/setup.js'")
  expect(build).toContain("types: 'lib/types/remote-types.js'")
})

it('loads the packaged bundle without registering browser tools until separately configured', async () => {
  const patchFile = new URL('../cordis.patch.yml', import.meta.url)
  expect(existsSync(patchFile)).toBe(true)
  const patch = load(readFileSync(patchFile, 'utf8')) as { insert: { id: string; name: string; config?: Record<string, unknown> }[] }[]
  const ctx = new Context()
  try {
    await ctx.plugin(Loader)
    await ctx.plugin(Projections)
    await ctx.plugin(Agents)
    await ctx.plugin(Tools)
    await ctx.plugin(SystemPrompt)
    ctx.loader.builtins.browserSetup = BrowserSetup
    ctx.loader.builtins.browserRegistry = BrowserUse
    ctx.loader.builtins.browserProvider = Provider
    const names: Record<string, string> = {
      '@ocean/ocean-browser-use': 'cordis:browserRegistry',
      '@ocean/ocean-browser-use-browse/setup': 'cordis:browserSetup',
      '@ocean/ocean-browser-use-browse': 'cordis:browserProvider',
    }
    for (const row of patch[0]!.insert) {
      expect(names[row.name]).toBeDefined()
      await ctx.loader.create({ ...row, name: names[row.name]! })
    }
    await ctx.loader.await()
    expect(ctx.browserUse.providerName).toBeUndefined()
    expect(ctx.tools.get('ocean_browser_snapshot')).toBeUndefined()
    expect(ctx.tools.get('ocean_browser_navigate')).toBeUndefined()
  } finally { await ctx.fiber.dispose() }
})
