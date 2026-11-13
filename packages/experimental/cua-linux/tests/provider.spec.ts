/** Provider setup does not probe applications or grant access. */
import { expect, it, vi } from 'vitest'
import type { CuaBackend } from '@ocean/ocean-cua'
import type { Context } from '@deepseek-ai/cordis'
const install = vi.hoisted(() => vi.fn())
vi.mock('@ocean/ocean-cua', async original => ({ ...await original<Record<string, unknown>>(), installCua: install }))
import { apply, CAPABILITIES, Config } from '../src/index.ts'

it('uses the shared application authorization path with a private helper and semantic-only tools', () => {
  install.mockClear()
  const config = Config({})
  const ctx = {} as Context
  apply(ctx, config)
  const args = install.mock.calls[0] as [Context, Config, CuaBackend]
  expect(args[0]).toBe(ctx)
  expect(args[1]).toBe(config)
  expect(args[2].helperPath).toMatch(/cua-linux\/native\/helper\.py$/)
  expect(args[2].capabilities).toBe(CAPABILITIES)
  expect(CAPABILITIES.keyboard).toEqual([])
  expect(CAPABILITIES.methods).not.toContain('screenshot')
  expect(CAPABILITIES.methods).not.toContain('pressKey')
  expect(CAPABILITIES.methods).not.toContain('click')
})
it('rejects a relative helper instead of resolving it through user-controlled cwd', () => {
  expect(() => { apply({} as Context, Config({ helperPath: 'helper.py' })) }).toThrow('absolute paths')
})

it('rejects malformed session IDs before spawning any helper', () => {
  for (const sessionId of ['', '../2', '2;sh', 'a'.repeat(65)])
    expect(() => { apply({} as Context, { ...Config({}), sessionId }) }).toThrow('session ID')
  expect(Config({}).sessionId).toBeUndefined()
})
