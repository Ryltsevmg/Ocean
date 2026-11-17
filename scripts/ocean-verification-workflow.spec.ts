/** Ocean CI coverage, isolated execution, and manual unsigned packaging policy. */
import { readFileSync, readdirSync } from 'node:fs'
import yaml from 'js-yaml'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { COVERAGE_EXEMPT_ENV, coverageExemptHeavySuites } from './coverage-exempt.ts'
import { BUILD_BACKED_NODE_COMPAT_VERSION, ciWorkerEnvironment, gatesForMode } from './run-gates.ts'

interface Step {
  name?: string
  uses?: string
  run?: string
  with?: Record<string, unknown>
}

interface Job {
  if: string
  'runs-on': string
  'timeout-minutes': number
  env?: Record<string, string>
  permissions?: Record<string, string>
  steps: Step[]
}

interface Workflow {
  on: Record<string, { branches?: string[] } | null>
  permissions: Record<string, string>
  concurrency: { 'cancel-in-progress': boolean }
  env?: Record<string, string>
  jobs: Record<string, Job>
}

const directory = new URL('../.github/workflows/', import.meta.url)
const names = readdirSync(directory).filter(name => /\.ya?ml$/u.test(name)).sort()
const workflow = yaml.load(readFileSync(new URL('ocean-verify.yml', directory), 'utf8')) as Workflow
const packaging = yaml.load(readFileSync(new URL('ocean-package-linux.yml', directory), 'utf8')) as Workflow
const packagingRunner = "${{ inputs.architecture == 'arm64' && 'ubuntu-24.04-arm' || 'ubuntu-24.04' }}"

function commands(job: Job): string[] {
  return job.steps.flatMap(step => step.run === undefined ? [] : [step.run])
}

function assertIsolated(candidate: Workflow): void {
  expect(candidate.permissions).toEqual({ contents: 'read' })
  expect(candidate.on).not.toHaveProperty('pull_request_target')
  const source = JSON.stringify(candidate)
  expect(source).not.toMatch(/secrets\.|release:publish|npm publish|gh release|self-hosted/u)
  for (const job of Object.values(candidate.jobs)) {
    expect(job.if).toContain("github.repository == 'Ryltsevmg/Ocean'")
    expect(['ubuntu-24.04', packagingRunner]).toContain(job['runs-on'])
    expect(Number.isInteger(job['timeout-minutes'])).toBe(true)
    expect(job['timeout-minutes']).toBeGreaterThan(0)
    expect(job['timeout-minutes']).toBeLessThanOrEqual(240)
    if (job.permissions !== undefined) expect(job.permissions).toEqual({ contents: 'read' })
    for (const step of job.steps) if (step.uses) expect(step.uses).toMatch(/@[a-f0-9]{40}$/u)
    expect(job.steps.find(step => step.uses?.startsWith('actions/checkout@'))?.with?.['persist-credentials']).toBe(false)
    expect(commands(job)).toContain('npm install --global pnpm@11.28.5')
    expect(commands(job)).toContain('pnpm install --frozen-lockfile --ignore-scripts')
  }
}

afterEach(() => { vi.unstubAllEnvs() })

describe('Ocean workflow isolation', () => {
  it('contains only verification and manual unsigned packaging definitions', () => {
    expect(names).toEqual(['ocean-package-linux.yml', 'ocean-verify.yml'])
    assertIsolated(workflow)
    assertIsolated(packaging)
  })

  it.each([
    ['write permission', (copy: Workflow) => { copy.permissions.contents = 'write' }],
    ['privileged trigger', (copy: Workflow) => { copy.on.pull_request_target = null }],
    ['untrusted runner', (copy: Workflow) => { copy.jobs.static!['runs-on'] = 'self-hosted' }],
    ['persistent credentials', (copy: Workflow) => { copy.jobs.static!.steps[0]!.with!['persist-credentials'] = true }],
    ['mutable action tag', (copy: Workflow) => { copy.jobs.static!.steps[0]!.uses = 'actions/checkout@main' }],
    ['secret input', (copy: Workflow) => { copy.jobs.static!.env = { TOKEN: '${{ secrets.DEPLOY_TOKEN }}' } }],
    ['publication', (copy: Workflow) => { copy.jobs.static!.steps.push({ run: 'pnpm run release:publish' }) }],
    ['unbounded execution', (copy: Workflow) => { copy.jobs.static!['timeout-minutes'] = 0 }],
  ] as const)('rejects %s', (_name, mutate) => {
    const copy = structuredClone(workflow)
    mutate(copy)
    expect(() => { assertIsolated(copy) }).toThrow()
  })

  it('checks PRs and main pushes and cancels superseded verification', () => {
    expect(Object.keys(workflow.on).sort()).toEqual(['pull_request', 'push', 'workflow_dispatch'])
    expect(workflow.on.push?.branches).toEqual(['main'])
    expect(workflow.on.pull_request?.branches).toEqual(['main'])
    expect(workflow.concurrency['cancel-in-progress']).toBe(true)
  })

  it('keeps packaging manual on main and retains unsigned artifacts without publication', () => {
    const job = packaging.jobs.package!
    expect(job.if).toBe("github.event_name == 'workflow_dispatch' && github.repository == 'Ryltsevmg/Ocean' && github.ref == 'refs/heads/main'")
    expect(job['runs-on']).toBe(packagingRunner)
    expect(job.env?.CSC_IDENTITY_AUTO_DISCOVERY).toBe('false')
    expect(packaging.concurrency['cancel-in-progress']).toBe(false)
    const artifact = job.steps.find(step => step.uses?.startsWith('actions/upload-artifact@'))!
    expect(artifact.with?.['retention-days']).toBe(7)
    expect(artifact.with?.['if-no-files-found']).toBe('error')
  })
})

describe('Ocean verification inventory', () => {
  it('keeps the supported Node minimum consistent for repository and installed CLI consumers', () => {
    for (const manifest of ['../package.json', '../apps/cli/package.json']) {
      const pkg = JSON.parse(readFileSync(new URL(manifest, import.meta.url), 'utf8')) as { engines: { node: string } }
      expect(pkg.engines.node).toBe(`>=${BUILD_BACKED_NODE_COMPAT_VERSION}.0`)
    }
  })

  it('runs lint, duplication, documentation, localization and offline release policies', () => {
    const runs = commands(workflow.jobs.static!)
    for (const script of ['lint', 'duplication', 'doc-sync', 'check:i18n']) expect(runs).toContain(`pnpm run ${script}`)
    expect(runs.some(run => run.startsWith('node --test apps/desktop/scripts/ocean-release-signing.test.mjs'))).toBe(true)
  })

  it('executes thresholded unit coverage and its disjoint heavy suite inventory with bounded workers', () => {
    const job = workflow.jobs['unit-coverage']!
    const runs = commands(job)
    const build = runs.indexOf('pnpm run build:artifacts --serial')
    expect(build).toBeGreaterThan(-1)
    expect(runs.indexOf('pnpm run check:ci:coverage')).toBeGreaterThan(build)
    expect(job.env?.OCEAN_EXAMPLE_MODE).toBe('lib')
    expect(runs.some(run => run.startsWith('pwsh '))).toBe(true)
    expect(workflow.env?.OCEAN_GATE_CONCURRENCY).toBe('1')
    expect(workflow.env?.OCEAN_COVERAGE_MAX_WORKERS).toBe('1')
    for (const [name, value] of Object.entries(workflow.env!)) vi.stubEnv(name, value)
    vi.stubEnv('npm_execpath', '/test/pnpm.cjs')
    vi.stubEnv('OCEAN_COVERAGE_PARTITIONS', undefined)
    expect(ciWorkerEnvironment('ci-coverage', workflow.env!).OCEAN_COVERAGE_PARTITIONS).toBeUndefined()
    const gates = gatesForMode('ci-coverage')
    const instrumented = gates.find(gate => gate.id === 'coverage')!
    const heavy = gates.find(gate => gate.id === 'coverage-exempt-heavy')!
    expect(instrumented.env?.[COVERAGE_EXEMPT_ENV]).toBe('1')
    expect(instrumented.displayCommand).toContain('vitest run --coverage --maxWorkers=1')
    expect(heavy.displayCommand).toContain('--maxWorkers=1')
    for (const suite of coverageExemptHeavySuites) expect(heavy.args).toContain(suite.filter)
    expect(heavy.env?.[COVERAGE_EXEMPT_ENV]).toBeUndefined()
    expect(gates.filter(gate => gate.id === 'coverage')).toHaveLength(1)
  })

  it('builds before CLI, recorded-session, Python and browser comparisons', () => {
    const job = workflow.jobs.integration!
    const runs = commands(job)
    const build = runs.indexOf('pnpm run build --serial')
    expect(build).toBeGreaterThan(-1)
    for (const command of ['pnpm run test:expected --maxWorkers=1', 'pnpm run test:snapshot', 'pnpm run test:web:ci']) {
      expect(runs.indexOf(command)).toBeGreaterThan(build)
    }
    const pythonInstall = runs.findIndex(run => run.includes('sync --locked --project python/sdk --group test'))
    const python = runs.findIndex(run => run.includes('run --no-sync --directory python/sdk pytest'))
    expect(pythonInstall).toBeGreaterThan(build)
    expect(python).toBeGreaterThan(pythonInstall)
    expect(runs).toContain('pnpm --dir apps/web exec playwright install --with-deps chromium webkit')
    expect(runs.at(-1)).toBe('pnpm run test:web:ci')
    expect(job.env).toMatchObject({
      OCEAN_EXAMPLE_MODE: 'lib', OCEAN_SNAPSHOT: 'replay',
      OCEAN_SNAPSHOT_MAX_WORKERS: '1', OCEAN_SNAPSHOT_MAX_CONCURRENCY: '1', OCEAN_WEB_SNAPSHOT_WORKERS: '1',
    })
  })
})
