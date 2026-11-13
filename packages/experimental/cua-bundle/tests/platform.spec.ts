/** Explicit patch overlays bypass bundle admission and must not import an absent native provider. */
import { readFile } from 'node:fs/promises'
import { Context } from '@deepseek-ai/cordis'
import Loader, { interpolate, type EntryOptions } from '@deepseek-ai/cordis-plugin-loader'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'
import { load } from 'js-yaml'
import { expect, it, vi } from 'vitest'

it.each(['darwin', 'win32', 'linux'])('loads the exported patch directly on %s and selects its native provider', async (platform) => {
  const patch = load(await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8'), {
    schema: entryListSchema,
  }) as { insert: EntryOptions[] }[]
  const ctx = new Context()
  await ctx.plugin(Loader)
  if (!ctx.loader.internal) throw new Error('Loader module importer is unavailable')
  const imported = vi.spyOn(ctx.loader.internal, 'import').mockImplementation(async (name: string) => {
    if (platform !== 'darwin' && name === '@ocean/ocean-experimental-cua-macos') {
      throw new Error('native provider is absent from this installation')
    }
    return { name, apply: () => {} }
  })
  try {
    for (const row of patch[0]!.insert) {
      await ctx.loader.create({ ...row, disabled: Boolean(interpolate({ process: { platform } }, row.disabled)) })
    }
    await ctx.loader.await()
    const imports = imported.mock.calls.map(call => call[0])
    expect(imports).toContain('@ocean/ocean-cua')
    expect(imports).toContain('@ocean/ocean-computer-use')
    expect(imports.includes('@ocean/ocean-experimental-cua-macos')).toBe(platform === 'darwin')
    expect(imports.includes('@ocean/ocean-cua-windows')).toBe(platform === 'win32')
    expect(imports.includes('@ocean/ocean-cua-linux')).toBe(platform === 'linux')
  } finally {
    await ctx.fiber.dispose()
    imported.mockRestore()
  }
})

it.each(['en', 'zh', 'ru', 'de', 'es', 'fr', 'ja', 'pt'])('describes the shipped Linux capability in the %s catalog entry', async (locale) => {
  const metadata = JSON.parse(await readFile(new URL(`../locale/${locale}.json`, import.meta.url), 'utf8')) as { meta: { description: string } }
  expect(metadata.meta.description).toContain('Linux')
  expect(metadata.meta.description).toContain('AT-SPI')
})
