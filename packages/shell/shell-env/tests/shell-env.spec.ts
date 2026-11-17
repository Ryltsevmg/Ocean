/**
 * Registry tests for `@ocean/ocean-shell-env`: built-in facts, contributor
 * ownership and validation, collection ordering, effect-scoped disposal, and
 * the explicit disposer contract.
 */

import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { ToolCallId } from '@ocean/ocean-llm'
import type { Agent } from '@ocean/ocean-agent'
import { SESSION_FORMAT_VERSION } from '@ocean/ocean-session'
import type { ToolExecution } from '@ocean/ocean-tools'
import { ShellEnvRegistry } from '@ocean/ocean-shell-env'
import * as BashEnvPlugin from '@ocean/ocean-shell-env'

const testToolSignal = new AbortController().signal

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

function execution(sessionId?: string): ToolExecution {
  return {
    signal: testToolSignal,
    token: Symbol('bash-env-test') as ToolExecution['token'],
    callId: ToolCallId('bash-env-call'),
    rootCallId: ToolCallId('bash-env-call'),
    name: 'bash',
    arguments: { command: 'true' },
    ...(sessionId === undefined
      ? {}
      : {
        agent: {
          session: {
            header: { version: SESSION_FORMAT_VERSION, id: sessionId, createdAt: 0, isSeeded: false },
          },
        } as unknown as Agent,
      }),
  }
}

describe('ShellEnvRegistry', () => {
  it('collects unconditional shell facts and the current agent session id', () => {
    const ctx = new Context()
    const registry = new ShellEnvRegistry(ctx, { oceanHome: './test-ocean-home' })

    expect(registry.collect(execution())).toEqual({
      DSH_HOME: resolve('./test-ocean-home'),
      DSH_NODE_EXECUTABLE: process.execPath,
      DSH_SHELL: '1',
      OCEAN_HOME: resolve('./test-ocean-home'),
      OCEAN_NODE_EXECUTABLE: process.execPath,
      OCEAN_SHELL: '1',
    })
    expect(registry.collect(execution('session-a'))).toEqual({
      DSH_HOME: resolve('./test-ocean-home'),
      DSH_NODE_EXECUTABLE: process.execPath,
      DSH_SHELL: '1',
      OCEAN_HOME: resolve('./test-ocean-home'),
      OCEAN_NODE_EXECUTABLE: process.execPath,
      DSH_SESSION_ID: 'session-a',
      OCEAN_SESSION_ID: 'session-a',
      OCEAN_SHELL: '1',
    })
  })

  it('omits the Node executable inside a single-executable application', () => {
    vi.spyOn(process, 'getBuiltinModule').mockReturnValue({ isSea: () => true })
    expect(new ShellEnvRegistry(new Context()).collect(execution())).not.toHaveProperty('OCEAN_NODE_EXECUTABLE')
  })

  it('keeps the Node executable where the runtime answers no single-executable module', () => {
    vi.spyOn(process, 'getBuiltinModule').mockReturnValue(undefined)
    expect(new ShellEnvRegistry(new Context()).collect(execution()).OCEAN_NODE_EXECUTABLE).toBe(process.execPath)
  })

  it('collects the launcher-provided profile name, directory, and installation directory when a profile context exists', () => {
    const ctx = new Context()
    ctx.provide('profileContext', {
      name: 'web', dir: '/profiles/web', patchPath: '/profiles/web/cordis.patch.yml', installAnchor: '/ocean/package.json',
      cwd: '/work', home: '/home', startedBundles: [], overlays: [], telemetryDisabledEnv: undefined,
    })
    const registry = new ShellEnvRegistry(ctx, { oceanHome: './test-ocean-home' })
    expect(registry.collect(execution())).toMatchObject({
      OCEAN_INSTALL_DIR: '/ocean', OCEAN_PROFILE: 'web', OCEAN_PROFILE_DIR: '/profiles/web',
    })
    for (const key of ['OCEAN_PROFILE', 'OCEAN_INSTALL_DIR', 'OCEAN_NODE_EXECUTABLE']) {
      expect(() => registry.register({
        name: `${key}-claimer`,
        variables: { [key]: { description: 'Reserved key.' } },
        resolve: () => ({}),
      })).toThrow(new RegExp(`reserved key "${key}"`))
    }
  })

  it('resolves OCEAN_HOME from the ambient override or the user-home default', () => {
    vi.stubEnv('OCEAN_HOME', './ambient-ocean-home')
    const fromEnvironment = new ShellEnvRegistry(new Context())
    expect(fromEnvironment.collect(execution()).OCEAN_HOME).toBe(resolve('./ambient-ocean-home'))

    vi.stubEnv('OCEAN_HOME', undefined)
    const fromDefault = new ShellEnvRegistry(new Context())
    expect(fromDefault.collect(execution()).OCEAN_HOME).toBe(join(homedir(), '.ocean'))
  })

  it('collects declared contributor variables and omits unavailable values', () => {
    const ctx = new Context()
    const registry = new ShellEnvRegistry(ctx, { oceanHome: './test-ocean-home' })
    registry.register({
      name: 'optional-session-fact',
      variables: {
        OCEAN_SESSION_OPTIONAL: { description: 'Optional session-scoped test fact.' },
      },
      resolve: exec => exec.agent === undefined ? {} : { OCEAN_SESSION_OPTIONAL: exec.agent.session.header.id },
    })
    registry.register({
      name: 'always-available-fact',
      variables: {
        OCEAN_ALWAYS_AVAILABLE: { description: 'Always-available test fact.' },
      },
      resolve: () => ({ OCEAN_ALWAYS_AVAILABLE: 'yes' }),
    })

    expect(registry.collect(execution())).not.toHaveProperty('OCEAN_SESSION_OPTIONAL')
    expect(registry.collect(execution()).OCEAN_ALWAYS_AVAILABLE).toBe('yes')
    expect(registry.collect(execution('session-b')).OCEAN_SESSION_OPTIONAL).toBe('session-b')
    expect(registry.list()).toEqual([
      {
        contributor: 'always-available-fact',
        description: 'Always-available test fact.',
        key: 'OCEAN_ALWAYS_AVAILABLE',
      },
      {
        contributor: 'optional-session-fact',
        description: 'Optional session-scoped test fact.',
        key: 'OCEAN_SESSION_OPTIONAL',
      },
    ])
  })

  it('rejects duplicate variable ownership at registration time', () => {
    const ctx = new Context()
    const registry = new ShellEnvRegistry(ctx, { oceanHome: './test-ocean-home' })
    registry.register({
      name: 'first',
      variables: { OCEAN_SHARED: { description: 'First owner.' } },
      resolve: () => ({ OCEAN_SHARED: 'first' }),
    })

    expect(() => registry.register({
      name: 'second',
      variables: { OCEAN_SHARED: { description: 'Second owner.' } },
      resolve: () => ({ OCEAN_SHARED: 'second' }),
    })).toThrow(/OCEAN_SHARED.*first.*second|OCEAN_SHARED.*second.*first/)
  })

  it('rejects duplicate contributor names and malformed declarations', () => {
    const registry = new ShellEnvRegistry(new Context(), { oceanHome: './test-ocean-home' })
    registry.register({
      name: 'declared',
      variables: { OCEAN_DECLARED: { description: 'Declared fact.' } },
      resolve: () => ({}),
    })

    expect(() => registry.register({
      name: 'declared',
      variables: { OCEAN_ANOTHER: { description: 'Another fact.' } },
      resolve: () => ({}),
    })).toThrow(/already registered/)
    expect(() => registry.register({
      name: ' ',
      variables: { OCEAN_BLANK_NAME: { description: 'Blank owner.' } },
      resolve: () => ({}),
    })).toThrow(/name must be non-empty/)
    expect(() => registry.register({
      name: 'invalid-key',
      variables: { ocean_invalid: { description: 'Invalid key.' } } as unknown as Record<'OCEAN_INVALID', { description: string }>,
      resolve: () => ({}),
    })).toThrow(/invalid key/)
    expect(() => registry.register({
      name: 'reserved-key',
      variables: { OCEAN_HOME: { description: 'Reserved key.' } },
      resolve: () => ({}),
    })).toThrow(/reserved key/)
    expect(() => registry.register({
      name: 'blank-description',
      variables: { OCEAN_BLANK_DESCRIPTION: { description: ' ' } },
      resolve: () => ({}),
    })).toThrow(/must describe/)
  })

  it('rejects undeclared variables returned by a contributor', () => {
    const ctx = new Context()
    const registry = new ShellEnvRegistry(ctx, { oceanHome: './test-ocean-home' })
    registry.register({
      name: 'drifted-provider',
      variables: { OCEAN_DECLARED: { description: 'Declared fact.' } },
      resolve: () => ({ OCEAN_UNDECLARED: 'bad' }),
    })

    expect(() => registry.collect(execution())).toThrow(/drifted-provider.*OCEAN_UNDECLARED/)
    expect(() => registry.collect(execution())).toThrow(expect.objectContaining({ name: 'ShellEnvError', code: 'SHELL_ENV_CONTRIBUTION_INVALID' }))
  })

  it('rejects non-string values returned by a contributor', () => {
    const registry = new ShellEnvRegistry(new Context(), { oceanHome: './test-ocean-home' })
    registry.register({
      name: 'wrong-value-type',
      variables: { OCEAN_STRING: { description: 'String fact.' } },
      resolve: () => ({ OCEAN_STRING: 42 }) as unknown as Record<'OCEAN_STRING', string>,
    })

    expect(() => registry.collect(execution())).toThrow(/wrong-value-type.*non-string.*OCEAN_STRING/)
    expect(() => registry.collect(execution())).toThrow(expect.objectContaining({ name: 'ShellEnvError', code: 'SHELL_ENV_CONTRIBUTION_INVALID' }))
  })

  it('removes an effect-scoped contributor when its plugin is disposed', async () => {
    const ctx = new Context()
    const registry = new ShellEnvRegistry(ctx, { oceanHome: './test-ocean-home' })
    const fiber = await ctx.plugin({
      inject: ['shellEnv'],
      apply(inner: Context) {
        inner.shellEnv.register({
          name: 'temporary',
          variables: { OCEAN_TEMPORARY: { description: 'Temporary fact.' } },
          resolve: () => ({ OCEAN_TEMPORARY: 'present' }),
        })
      },
    })

    expect(registry.collect(execution()).OCEAN_TEMPORARY).toBe('present')
    await fiber.dispose()
    expect(registry.collect(execution())).not.toHaveProperty('OCEAN_TEMPORARY')
  })

  it('returns an explicit contributor disposer', () => {
    const registry = new ShellEnvRegistry(new Context(), { oceanHome: './test-ocean-home' })
    const dispose = registry.register({
      name: 'explicit-disposal',
      variables: { OCEAN_EXPLICIT_DISPOSAL: { description: 'Explicitly disposed fact.' } },
      resolve: () => ({ OCEAN_EXPLICIT_DISPOSAL: 'present' }),
    })

    expect(registry.collect(execution()).OCEAN_EXPLICIT_DISPOSAL).toBe('present')
    dispose()
    expect(registry.collect(execution())).not.toHaveProperty('OCEAN_EXPLICIT_DISPOSAL')
  })

  it('the plugin registers the service with no contributors on load', async () => {
    const ctx = new Context()
    await ctx.plugin(BashEnvPlugin)
    expect(ctx.shellEnv).toBeInstanceOf(ShellEnvRegistry)
    expect(ctx.shellEnv.list()).toEqual([])
  })
})
