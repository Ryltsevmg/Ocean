/**
 * The interactive bundle restates the permission rows it overrides. A patch
 * entry replaces the whole `config` of its target, so the preset table here is
 * a copy of the base table: a preset added to the base layer would otherwise
 * disappear from every interactive profile without a load error.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as yaml from 'js-yaml'
import { entryListSchema, type PatchOptions } from '@deepseek-ai/cordis-plugin-include'
import { loadOverlayPatches } from '@ocean/ocean-app-boot'

interface PresetRow {
  sandbox: string
  approval: string
}

/** Preset table of one `permission` row, keyed by preset name. */
function presetTable(config: unknown): Record<string, PresetRow> {
  const presets = (config as { presets?: Record<string, PresetRow> } | undefined)?.presets
  expect(presets).toBeDefined()
  return presets!
}

/** The base layer is one insert list over the empty profile root. */
function baseRows(): PatchOptions[] {
  const parsed = yaml.load(
    readFileSync(fileURLToPath(new URL('../../base/cordis.patch.yml', import.meta.url)), 'utf8'),
    { schema: entryListSchema },
  ) as PatchOptions[]
  return parsed.flatMap(patch => patch.insert ?? [])
}

function interactivePatch(): PatchOptions[] {
  return loadOverlayPatches('web-app-permission', fileURLToPath(new URL('../cordis.patch.yml', import.meta.url)))
}

describe('web-app permission overrides', () => {
  it('keeps the ask policy, so a confirmation-gated action reaches the person', () => {
    const approval = interactivePatch().find(patch => patch.id === 'approval')
    expect(approval?.config).toEqual({ policy: 'ask' })
  })

  it('restates every base preset with its base sandbox and the ask approval policy', () => {
    const base = presetTable(baseRows().find(row => row.id === 'permission')?.config)
    const interactive = presetTable(interactivePatch().find(patch => patch.id === 'permission')?.config)
    expect(Object.keys(interactive)).toEqual(Object.keys(base))
    for (const [name, spec] of Object.entries(base)) {
      expect(interactive[name]).toEqual({ ...spec, approval: 'ask' })
    }
  })

  it('overrides the base pair rather than restating it', () => {
    const baseApproval = baseRows().find(row => row.id === 'permission')?.config as
      { presets: Record<string, PresetRow> } | undefined
    expect(baseApproval?.presets['danger-full-access']?.approval).toBe('never')
  })
})
