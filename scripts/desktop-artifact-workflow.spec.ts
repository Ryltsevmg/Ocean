/** Manual Ocean Desktop builds retain review artifacts without publishing releases. */
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import yaml from 'js-yaml'
import { expect, it } from 'vitest'

const source = readFileSync(new URL('../.github/workflows/ocean-package-linux.yml', import.meta.url), 'utf8')
const workflow = yaml.load(source) as {
  on: Record<string, unknown>
  jobs: { package: {
    if: string
    env: Record<string, string>
    steps: Array<{ name?: string; run?: string; uses?: string; with?: Record<string, unknown> }>
  } }
}

it.each([
  ['workflow_dispatch', 'Ryltsevmg/Ocean', 'refs/heads/main', true],
  ['push', 'Ryltsevmg/Ocean', 'refs/heads/main', false],
  ['pull_request', 'Ryltsevmg/Ocean', 'refs/heads/main', false],
  ['workflow_dispatch', 'outsider/fork', 'refs/heads/main', false],
  ['workflow_dispatch', 'Ryltsevmg/Ocean', 'refs/heads/topic', false],
  ['workflow_dispatch', 'Ryltsevmg/Ocean', 'refs/tags/v1.0.0', false],
] as const)('schedules %s in %s at %s only for manual main builds', (event, repository, ref, accepted) => {
  // These canonical string fixtures share JavaScript and Actions comparison semantics.
  expect(runInNewContext(workflow.jobs.package.if, { github: { event_name: event, repository, ref } }, { timeout: 1000 }))
    .toBe(accepted)
})

it('retains only the unsigned archive, checksum and build metadata for review', () => {
  expect(Object.keys(workflow.on).sort()).toEqual(['push', 'workflow_dispatch'])
  expect(workflow.on.push).toEqual({ branches: ['main'], paths: ['.github/workflows/ocean-package-linux.yml'] })
  const steps = workflow.jobs.package.steps
  const packageIndex = steps.findIndex(step => step.name === 'Package unsigned native Linux archive')
  const checksumIndex = steps.findIndex(step => step.name === 'Calculate archive checksums')
  const artifactIndex = steps.findIndex(step => step.uses?.startsWith('actions/upload-artifact@'))
  expect(packageIndex).toBeGreaterThan(-1)
  expect(checksumIndex).toBeGreaterThan(packageIndex)
  expect(artifactIndex).toBeGreaterThan(checksumIndex)
  expect(steps[checksumIndex]!.run).toContain('sha256sum *.tar.gz > SHA256SUMS')
  expect(steps[checksumIndex]!.run).toContain('signed: false')
  expect(steps[artifactIndex]!.with).toMatchObject({
    name: 'ocean-linux-${{ inputs.architecture }}-unsigned-${{ github.sha }}',
    'include-hidden-files': true, 'if-no-files-found': 'error', 'retention-days': 7,
  })
  expect(String(steps[artifactIndex]!.with!.path).trim().split('\n')).toEqual([
    'apps/desktop/.desktop-build/targets/linux-${{ inputs.architecture }}/unsigned-artifacts/*.tar.gz',
    'apps/desktop/.desktop-build/targets/linux-${{ inputs.architecture }}/unsigned-artifacts/SHA256SUMS',
    'apps/desktop/.desktop-build/targets/linux-${{ inputs.architecture }}/unsigned-artifacts/build-evidence.json',
  ])
  expect(workflow.jobs.package.env.CSC_IDENTITY_AUTO_DISCOVERY).toBe('false')
  expect(source).not.toMatch(/secrets\.|release:publish|npm publish|gh release|upload:latest|purge:latest/u)
})
