/**
 * Real-Loader boot of the web-startup provider for the device CLI profiles.
 * The fixture row delegates to the source-plane provider, so each invocation
 * parses and runs through the same Loader path the shipped profiles use.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { internals, provideCmdline, type AppReady } from '@ocean/ocean-cmdline'
import { apply } from '../src/startup.ts'

/** One booted device CLI invocation and its observed process effects. */
export interface DeviceBoot {
  ctx: Context
  /** Exit codes the invocation requested, in request order. */
  exits: number[]
  /** Commander output captured through the launcher adapters. */
  observed: { out: string; err: string }
  /** Run the startup-commit listeners the launcher held back. */
  commit: () => void
  dispose: () => Promise<void>
}

/**
 * Boot the connect or remote-device profile through the real Loader.
 * @param profile - device CLI profile to mount.
 * @param args - the invocation's inner arguments.
 * @param options - readiness control and extra root services.
 * @returns the booted tree and its observed output and exit requests.
 */
export async function bootDeviceProfile(
  profile: 'connect' | 'remote-device',
  args: string[],
  options: { holdReady?: boolean; provide?: (ctx: Context) => unknown } = {},
): Promise<DeviceBoot> {
  const dir = mkdtempSync(join(tmpdir(), 'ocean-device-cli-'))
  const exits: number[] = []
  const observed = { out: '', err: '' }
  const listeners = new Set<() => void>()
  const ready: AppReady = {
    onReady(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
  const commit = (): void => {
    for (const listener of [...listeners]) {
      listeners.delete(listener)
      listener()
    }
  }
  // Node imports the fixture row outside Vite's source resolver, so delegate
  // to the source-plane plugin already imported by this test.
  writeFileSync(join(dir, 'provider.mjs'), `
export const name = 'web-startup'
export const inject = ['cmdlineArgs']
export const apply = ctx => globalThis.__deviceCliApply(ctx)
`)
  writeFileSync(join(dir, 'cordis.yml'), [
    '- id: provider',
    `  name: ${pathToFileURL(join(dir, 'provider.mjs')).href}`,
    '',
  ].join('\n'))
  internals.stdout = { write: (chunk: string) => { observed.out += chunk; return true } }
  internals.stderr = { write: (chunk: string) => { observed.err += chunk; return true } }
  const globals = globalThis as typeof globalThis & { __deviceCliApply?: typeof apply }
  globals.__deviceCliApply = apply
  const ctx = new Context()
  ctx.provide('profileContext', {
    name: profile, dir, patchPath: join(dir, 'cordis.patch.yml'), installAnchor: join(dir, 'package.json'),
    cwd: dir, home: dir, startedBundles: [], overlays: [], telemetryDisabledEnv: undefined,
  })
  const dispose = async (): Promise<void> => {
    await ctx.fiber.dispose()
    rmSync(dir, { recursive: true, force: true })
  }
  try {
    await ctx.plugin(Loader)
    ctx.loader.builtins.include = Include
    provideCmdline(ctx, { args, exit: code => void exits.push(code), ready })
    await options.provide?.(ctx)
    await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(join(dir, 'cordis.yml')).href } })
    await ctx.loader.await()
    if (options.holdReady !== true) commit()
    return { ctx, exits, observed, commit, dispose }
  } catch (error) {
    await dispose()
    throw error
  }
}
