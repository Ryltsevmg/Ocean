/** Credential-home Host identity persists across launches while the epoch follows the root. */
import { Context } from '@deepseek-ai/cordis'
import { expect, it, vi } from 'vitest'
import { loadDeviceHostIdentity } from '../src/device-host-identity.ts'
import { provideBrowserCredentials } from './browser-credentials.ts'

it('initializes the identity once and reuses it with a new epoch on another launch', async () => {
  const first = new Context()
  provideBrowserCredentials(first)
  const second = new Context()
  second.provide('credentials', first.credentials)
  try {
    const initialized = await loadDeviceHostIdentity(first.credentials, first)
    expect(initialized.hostId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u)
    expect(await loadDeviceHostIdentity(first.credentials, first)).toEqual(initialized)
    const relaunched = await loadDeviceHostIdentity(second.credentials, second)
    expect(relaunched.hostId).toBe(initialized.hostId)
    expect(relaunched.epoch).not.toBe(initialized.epoch)
  } finally {
    await Promise.all([first.fiber.dispose(), second.fiber.dispose()])
  }
})

it('fails closed when the provider cannot produce a grant record', async () => {
  const ctx = new Context()
  provideBrowserCredentials(ctx)
  const modify = vi.spyOn(ctx.credentials, 'modifyRecord')
  try {
    modify.mockResolvedValueOnce(undefined)
    await expect(loadDeviceHostIdentity(ctx.credentials, ctx))
      .rejects.toThrow('missing or invalid device Host identity')
    modify.mockResolvedValueOnce({ kind: 'api-key', key: 'foreign credential' })
    await expect(loadDeviceHostIdentity(ctx.credentials, ctx))
      .rejects.toThrow('missing or invalid device Host identity')
  } finally {
    modify.mockRestore()
    await ctx.fiber.dispose()
  }
})
