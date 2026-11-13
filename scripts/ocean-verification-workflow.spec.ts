import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../.github/workflows/ocean-verify.yml', import.meta.url), 'utf8')
const workflow = yaml.load(source) as {
  on: Record<string, { branches?: string[] } | null>
  permissions: Record<string, string>
  concurrency: { 'cancel-in-progress': boolean }
  jobs: Record<string, {
    'runs-on': string
    'timeout-minutes': number
    steps: Array<{ uses?: string; run?: string; with?: Record<string, unknown> }>
  }>
}

describe('Ocean automatic verification policy', () => {
  it('checks PRs and main pushes without privileged PR execution', () => {
    expect(Object.keys(workflow.on).sort()).toEqual(['pull_request', 'push', 'workflow_dispatch'])
    expect(workflow.on.push?.branches).toEqual(['main'])
    expect(workflow.on.pull_request?.branches).toEqual(['main'])
    expect(workflow.permissions).toEqual({ contents: 'read' })
    expect(source).not.toContain('secrets.')
  })
  it('uses ephemeral runners, bounded serial work and pinned actions', () => {
    expect(workflow.concurrency['cancel-in-progress']).toBe(true)
    for (const job of Object.values(workflow.jobs)) {
      expect(job['runs-on']).toBe('ubuntu-24.04')
      expect(job['timeout-minutes']).toBeLessThanOrEqual(90)
      for (const step of job.steps) if (step.uses) expect(step.uses).toMatch(/@[a-f0-9]{40}$/u)
      expect(job.steps.find(step => step.uses?.startsWith('actions/checkout@'))?.with?.['persist-credentials']).toBe(false)
      expect(job.steps.some(step => step.run === 'pnpm run build --serial')).toBe(true)
      expect(job.steps.filter(step => step.run?.includes('vitest')).every(step => step.run?.includes('--maxWorkers=1'))).toBe(true)
    }
  })
})
