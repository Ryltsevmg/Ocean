/** The delivered Web composition's Schedule rows, the optional bundles it ships switched off, and their display metadata. */

import { globSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it, onTestFinished } from 'vitest'
import type { EntryOptions } from '@deepseek-ai/cordis-plugin-loader'
import { loadOverlayPatches } from '../packages/boot/app-boot/src/index.ts'
import { readPluginMeta } from '../packages/boot/app-boot/src/package-meta.ts'
import { bundlePatchPaths, composeEntries, initProfile, readProfileManifest } from '../packages/boot/app-boot/src/profile.ts'
import { OPTIONAL_BUNDLES, PROFILE_TEMPLATES } from '../packages/util/official-bundles/src/bundles.ts'
import type { DshBundleManifest } from '../packages/util/package-manifest/src/types.ts'
import { createPluginProfile } from '../apps/desktop/src/project-manager.ts'

const root = resolve(import.meta.dirname, '..')

interface Manifest {
  name: string
  dsh?: { bundle?: DshBundleManifest }
}

const bundles = new Map(globSync('packages/*/*/package.json', { cwd: root }).map((path) => {
  const manifest = JSON.parse(readFileSync(resolve(root, path), 'utf8')) as Manifest
  return [manifest.name, { dir: dirname(resolve(root, path)), manifest }]
}))

function bundle(name: string): { dir: string; patches: ReturnType<typeof loadOverlayPatches> } {
  const entry = bundles.get(name)
  if (entry?.manifest.dsh?.bundle === undefined) throw new Error(`${name} is not a workspace bundle`)
  return { dir: entry.dir, patches: bundlePatchPaths(entry.dir, entry.manifest.dsh.bundle).flatMap(path => loadOverlayPatches('test', path)) }
}

function flattenRows(entries: EntryOptions[]): EntryOptions[] {
  return entries.flatMap(entry => [entry, ...entry.group && Array.isArray(entry.config) ? flattenRows(entry.config as EntryOptions[]) : []])
}

function profileLayers(surface: 'web' | 'desktop'): ReturnType<typeof loadOverlayPatches>[] {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-bundle-compatibility-'))
  onTestFinished(() => { rmSync(directory, { recursive: true, force: true }) })
  if (surface === 'desktop') createPluginProfile(directory)
  else initProfile(directory, PROFILE_TEMPLATES.web!.bundles)
  const names = readProfileManifest('test', directory).dsh?.profile?.bundles
  if (names === undefined) throw new Error(`${surface} profile has no bundle list`)
  return names.map(name => bundle(name).patches)
}

describe.each(['web', 'desktop'] as const)('%s optional bundle overrides', (surface) => {
  const selectedNames = ['@ocean/ocean-subagent-codex']

  it('keeps established selectors for later configuration and disabled overrides', () => {
    const shipped = profileLayers(surface)
    const config = { maxDepth: 2 }
    const warnings: string[] = []
    const entries = composeEntries([...shipped, ...selectedNames.map(name => bundle(name).patches), [
      { id: 'subagent-codex', disabled: true },
      { id: 'tool-subagent-codex', config, disabled: true },
    ]], warning => warnings.push(warning))
    expect(warnings).toEqual([])
    expect(entries.find(row => row.id === 'subagent-codex')).toMatchObject({ name: '@ocean/ocean-subagent-codex', disabled: true })
    expect(flattenRows(entries).find(row => row.id === 'tool-subagent-codex'))
      .toMatchObject({ name: '@ocean/ocean-tool-subagent', config, disabled: true })
  })

  it('does not select absent bundles through enable-only row overrides', () => {
    const warnings: string[] = []
    const entries = composeEntries([...profileLayers(surface), [
      { id: 'skill-badge', disabled: false },
      { id: 'optional-ralph', disabled: false },
    ]], warning => warnings.push(warning))
    expect(warnings).toHaveLength(2)
    expect(warnings.some(warning => warning.includes('skill-badge'))).toBe(true)
    expect(warnings.some(warning => warning.includes('optional-ralph'))).toBe(true)
    expect(entries.some(row => row.id === 'skill-badge')).toBe(false)
    expect(flattenRows(entries).some(row => row.id === 'optional-ralph')).toBe(false)
  })
})

describe('optional bundles', () => {
  const shipped = ['@ocean/ocean-base', '@ocean/ocean-web-app'].map(name => bundle(name).patches)

  it('ships at least one bundle switched off', () => {
    expect(OPTIONAL_BUNDLES.length).toBeGreaterThan(0)
  })

  it.each(OPTIONAL_BUNDLES)('%s composes over the Web profile without a skipped patch', (name) => {
    const { patches } = bundle(name)
    const warnings: string[] = []
    const composed = composeEntries([...shipped, patches], message => warnings.push(message))
    expect(warnings).toEqual([])
    // Inserted ids remain addressable in the composed profile tree.
    const ids = new Set(flattenRows(composed).map(entry => entry.id))
    for (const patch of patches) {
      for (const row of patch.insert ?? []) {
        expect(typeof row.id).toBe('string')
        expect(ids.has(row.id)).toBe(true)
      }
    }
    // One top-level row per id: a duplicate declaration leaves the Loader with the last one, silently
    // replacing the layer that declared the id first.
    const topLevelIds = composed.flatMap(entry => typeof entry.id === 'string' ? [entry.id] : [])
    expect(topLevelIds).toHaveLength(new Set(topLevelIds).size)
    // An id-targeted patch reaches a row another layer inserted: the id resolves to exactly one top-level
    // row, and the override keeps the package the shipped layer declared on it.
    const shippedComposed = composeEntries([...shipped])
    for (const patch of patches) {
      if (patch.insert !== undefined || typeof patch.id !== 'string') continue
      const matches = composed.filter(entry => entry.id === patch.id)
      expect(matches).toHaveLength(1)
      expect(matches[0]?.name).toBe(shippedComposed.find(entry => entry.id === patch.id)?.name)
    }
  })

  it('delivers the Schedule service and task page without a Host clock row', () => {
    const composed = composeEntries(shipped)
    // The delivered composition carries the Host Schedule service and its task
    // page enabled; the clock stays preset-level, so no Host row declares it.
    for (const row of [
      { id: 'schedule', name: '@ocean/ocean-schedule' },
      { id: 'ui-schedule', name: '@ocean/ocean-client-ui-schedule' },
    ]) {
      expect(composed.filter(entry => entry.id === row.id && entry.name === row.name && entry.disabled !== true))
        .toHaveLength(1)
    }
    expect(composed.some(entry => entry.id === 'time-context')).toBe(false)
  })

  it('keeps the clock and the reminder tools on the presets that declare them', () => {
    const composed = composeEntries(shipped)
    type PresetRow = { id?: string; name?: string; disabled?: boolean; config?: unknown }
    const presetPlugins = (id: string): PresetRow[] => {
      const row = composed.find(entry => entry.id === id)
      if (row === undefined) throw new Error(`missing delivered preset row ${id}`)
      const flat: PresetRow[] = []
      // A `cordis:group` row nests its children in its own `config` array.
      const walk = (rows: PresetRow[]): void => {
        for (const entry of rows) {
          flat.push(entry)
          if (Array.isArray(entry.config)) walk(entry.config as PresetRow[])
        }
      }
      walk((row.config as { plugins: PresetRow[] }).plugins)
      return flat
    }
    for (const id of ['preset-standard', 'preset-cordis', 'preset-ptc']) {
      const plugins = presetPlugins(id)
      for (const plugin of [
        { id: 'time-context', name: '@ocean/ocean-time-context' },
        { id: 'tool-schedule', name: '@ocean/ocean-tool-schedule' },
      ]) {
        const matches = plugins.filter(row => row.id === plugin.id && row.name === plugin.name)
        expect(matches).toHaveLength(1)
        expect(matches[0]?.disabled).not.toBe(true)
      }
    }
    for (const id of ['preset-standard', 'preset-cordis', 'preset-ptc']) {
      for (const rowId of ['tool-subagent', 'tool-subagent-fork']) {
        expect(presetPlugins(id).find(plugin => plugin.id === rowId)?.config).not.toHaveProperty('toolFilter')
      }
    }
    // `minimal` declares neither, so it composes no clock reading and no reminder tool.
    expect(presetPlugins('preset-minimal').some(row => row.name === '@ocean/ocean-time-context'
      || row.name === '@ocean/ocean-tool-schedule')).toBe(false)
  })

  it.each(OPTIONAL_BUNDLES)('%s resolves a title, description, and icon in both shipped languages', (name) => {
    const meta = readPluginMeta(name, pathToFileURL(`${bundle(name).dir}/package.json`).href)
    expect(meta?.error).toBeUndefined()
    for (const field of [meta?.title, meta?.description]) {
      expect(typeof field).toBe('object')
      for (const language of ['en', 'zh']) expect((field as Record<string, string>)[language]).toMatch(/\S/)
    }
    expect(meta?.icon).toMatch(/^data:image\//)
  })
})
