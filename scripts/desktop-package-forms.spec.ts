/** The Ocean packaging form selects a native, unsigned Linux target. */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { expect, it } from 'vitest'

const workflow = yaml.load(readFileSync(new URL('../.github/workflows/ocean-package-linux.yml', import.meta.url), 'utf8')) as {
  on: { workflow_dispatch: { inputs: Record<string, unknown> } }
  jobs: { package: { env: Record<string, string>; steps: Array<{ run?: string; name?: string }> } }
}
const manifest = JSON.parse(readFileSync(new URL('../apps/desktop/package.json', import.meta.url), 'utf8')) as {
  scripts: Record<string, string>
}

it('offers only the two native Linux architectures and dispatches the unsigned package scripts', () => {
  expect(workflow.on.workflow_dispatch.inputs).toEqual({ architecture: {
    description: 'Native hosted runner architecture', type: 'choice', required: true, default: 'x64', options: ['x64', 'arm64'],
  } })
  expect(workflow.jobs.package.env.OCEAN_ARCH).toBe('${{ inputs.architecture }}')
  for (const arch of ['x64', 'arm64']) {
    expect(manifest.scripts[`package:linux:${arch}`]).toBe(`tsx scripts/package-target.ts linux-${arch} --unsigned`)
    expect(manifest.scripts[`package:linux:${arch}:dir`]).toBe(`tsx scripts/package-target.ts linux-${arch} --unsigned --dir`)
  }
  for (const target of ['mac:arm64', 'mac:x64', 'win:x64']) {
    const native = target.replaceAll(':', '-')
    expect(manifest.scripts[`package:${target}:unsigned`]).toBe(`tsx scripts/package-target.ts ${native} --unsigned`)
    expect(manifest.scripts[`package:${target}:dir`]).toBe(`tsx scripts/package-target.ts ${native} --dir`)
  }
})

// The shipped workflow executes Bash on native Linux; Windows has no required Bash installation.
it.skipIf(process.platform === 'win32').each([
  ['x64', 'x64', true], ['arm64', 'arm64', true],
  ['x64', 'arm64', false], ['arm64', 'x64', false], ['unknown', 'x64', false], ['x64; echo injected', 'x64', false],
] as const)('checks target %s against native host %s before packaging', (target, host, accepted) => {
  const script = workflow.jobs.package.steps.find(step => step.name === 'Package unsigned native Linux archive')!.run!
  const child = spawnSync('bash', ['-e', '-u', '-o', 'pipefail', '-c',
    'node() { printf "%s" "$TEST_HOST_ARCH"; }; pnpm() { printf "%s\\n" "$@"; }; ' + script], {
    env: { PATH: process.env.PATH, OCEAN_ARCH: target, TEST_HOST_ARCH: host }, encoding: 'utf8', timeout: 10_000,
  })
  expect(child.error).toBeUndefined()
  expect(child.signal).toBeNull()
  if (accepted) {
    expect(child.status, child.stderr).toBe(0)
    expect(child.stdout).toBe(`--filter\n@ocean/ocean-desktop\nrun\npackage:linux:${target}\n`)
  } else {
    expect(child.status).not.toBe(0)
    expect(child.stdout).toBe('')
  }
})
