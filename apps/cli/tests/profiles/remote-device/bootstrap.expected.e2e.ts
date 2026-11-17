/** Local device issuance and restart-safe inventory through the shipped profile. */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveExampleLaunch } from '@ocean/ocean-loader-smoke'
import { execa } from 'execa'
import { expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url))

it('persists device metadata and rejects empty remote tokens without starting Web services', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ocean-device-bootstrap-'))
  async function run(args: string[]): Promise<unknown> {
    const launch = resolveExampleLaunch({
      srcBin: join(repoRoot, 'apps/cli/src/bin.ts'),
      tsconfigPath: join(repoRoot, 'tsconfig.json'),
      sourceImport: 'tsx/esm',
      configArgs: ['remote-device', '--bootstrap', ...args],
      env: {
        OCEAN_HOME: join(root, 'home'),
        OCEAN_AGENTS_HOME: join(root, 'agents'),
        OCEAN_TELEMETRY_DISABLED: '1',
        DEEPSEEK_API_KEY: undefined,
        NODE_NO_WARNINGS: '1',
      },
    })
    const result = await execa(launch.command, launch.args, {
      cwd: root, env: launch.env, input: '', timeout: 30_000, killSignal: 'SIGKILL', reject: false,
    })
    // Keep stdout private until the administrative response is narrowed; create prints a bearer.
    expect({ exitCode: result.exitCode, timedOut: result.timedOut, stderr: result.stderr }).toEqual({
      exitCode: 0, timedOut: false, stderr: '',
    })
    const value: unknown = JSON.parse(result.stdout)
    return value
  }
  try {
    expect(await run(['list'])).toEqual([])
    const created = await run(['create', 'Windows laptop'])
    if (typeof created !== 'object' || created === null || !('id' in created) || !('token' in created)) {
      throw new Error('device bootstrap did not return its identifier and token')
    }
    if (typeof created.id !== 'string' || typeof created.token !== 'string') {
      throw new Error('device bootstrap returned invalid credential fields')
    }
    expect(created.token.startsWith(`${created.id}.`) && created.token.length === 80).toBe(true)
    const inventory = await run(['list'])
    expect(inventory).toEqual([{ id: created.id, label: 'Windows laptop', revoked: false }])
    expect(JSON.stringify(inventory).includes(created.token)).toBe(false)

    // The token-reader failure requires a committed startup, but no network request.
    const launch = resolveExampleLaunch({
      srcBin: join(repoRoot, 'apps/cli/src/bin.ts'), tsconfigPath: join(repoRoot, 'tsconfig.json'), sourceImport: 'tsx/esm',
      configArgs: ['connect', '--url', 'https://host.invalid', '--token-stdin', 'list'],
      env: { OCEAN_HOME: join(root, 'home'), OCEAN_AGENTS_HOME: join(root, 'agents'), OCEAN_TELEMETRY_DISABLED: '1', NODE_NO_WARNINGS: '1' },
    })
    const result = await execa(launch.command, launch.args, {
      cwd: root, env: launch.env, input: '', timeout: 30_000, killSignal: 'SIGKILL', reject: false,
    })
    expect({ exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr }).toEqual({
      exitCode: 1, stdout: '', stderr: 'ocean connect: could not read a device token from standard input.',
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
