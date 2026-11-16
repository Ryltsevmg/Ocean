/** Baseline package selection through Node's real filesystem glob implementation. */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it, onTestFinished } from 'vitest'
import { discoverNpmBaselineManifests } from './npm-baseline-packages.ts'

function fixture(manifests: readonly string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-baseline-discovery-'))
  onTestFinished(() => { rmSync(root, { recursive: true, force: true }) })
  for (const manifest of manifests) {
    const file = join(root, manifest)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, '{}\n')
  }
  return root
}

describe('npm baseline package discovery', () => {
  it('discovers every published package root', () => {
    const expected = [
      'apps/cli/package.json',
      'packages/core/session/package.json',
      'packages/subagent/subagent-codex/package.json',
      'packages/team/agent-team/package.json',
      'vendor/cordis/package.json',
    ]
    const root = fixture([
      ...expected,
      'package.json',
      'packages/subagent/subagent-codex/nested/package.json',
      'website/package.json',
    ])

    expect(discoverNpmBaselineManifests(root)).toEqual(expected)
  })

  it('leaves an empty package set for the baseline caller to reject', () => {
    expect(discoverNpmBaselineManifests(fixture([]))).toEqual([])
  })
})
