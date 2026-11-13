import { Context } from '@deepseek-ai/cordis'
import { expect, it } from 'vitest'
import BrowserSetup from '../src/setup.ts'

it('retains the root-owned latch across successful setup replacement and withdraws it with the Host', async () => {
  const ctx = new Context()
  try {
    const first = ctx.plugin(BrowserSetup); await first
    const state = ctx.get('browseCleanupState')
    expect(state).toBeDefined()
    ctx.browserSetup.lifecycle.attach(async () => {})
    await first.dispose()
    expect(ctx.get('browseCleanupState')).toBe(state)
    const next = ctx.plugin(BrowserSetup); await next
    expect(ctx.browserSetup.status().blocked).toBe(false)
    ctx.browserSetup.lifecycle.attach(async () => {})
  } finally { await ctx.fiber.dispose() }
  expect(ctx.get('browseCleanupState', false)).toBeUndefined()
})

it('retains failed cleanup for replacement without blocking an independent Host', async () => {
  const failed = new Context(), independent = new Context()
  try {
    const first = failed.plugin(BrowserSetup); await first
    failed.browserSetup.lifecycle.attach(async () => { throw new Error('uncertain cleanup') })
    await first.dispose()
    expect(failed.get('browseCleanupState')?.blocked).toBe(true)
    const next = failed.plugin(BrowserSetup); await next
    expect(failed.browserSetup.status().blocked).toBe(true)
    expect(() => failed.browserSetup.lifecycle.attach(async () => {})).toThrow('cleanup failed')
    await independent.plugin(BrowserSetup)
    expect(independent.browserSetup.status().blocked).toBe(false)
    independent.browserSetup.lifecycle.attach(async () => {})
  } finally { await Promise.all([failed.fiber.dispose(), independent.fiber.dispose()]) }
})

it('waits for deferred cleanup before a replacement observes its failure', async () => {
  const ctx = new Context()
  const entered = Promise.withResolvers<undefined>(), finish = Promise.withResolvers<undefined>()
  try {
    const first = ctx.plugin(BrowserSetup); await first
    ctx.browserSetup.lifecycle.attach(async () => {
      entered.resolve(undefined)
      await finish.promise
      throw new Error('uncertain cleanup')
    })
    let disposed = false
    const disposal = first.dispose().then(() => { disposed = true })
    await entered.promise
    expect(disposed).toBe(false)
    expect(ctx.get('browseCleanupState')?.blocked).toBe(false)
    finish.resolve(undefined)
    await disposal
    expect(ctx.get('browseCleanupState')?.blocked).toBe(true)
    const next = ctx.plugin(BrowserSetup); await next
    expect(ctx.browserSetup.status().blocked).toBe(true)
  } finally {
    finish.resolve(undefined)
    await ctx.fiber.dispose()
  }
})

it('joins setup cleanup during root teardown and retains failure after service withdrawal', async () => {
  const ctx = new Context()
  const entered = Promise.withResolvers<undefined>(), finish = Promise.withResolvers<undefined>()
  try {
    await ctx.plugin(BrowserSetup)
    const state = ctx.get('browseCleanupState')
    expect(state).toBeDefined()
    ctx.browserSetup.lifecycle.attach(async () => {
      entered.resolve(undefined)
      await finish.promise
      throw new Error('uncertain cleanup')
    })
    let disposed = false
    const disposal = ctx.fiber.dispose().then(() => { disposed = true })
    await entered.promise
    expect(disposed).toBe(false)
    expect(ctx.get('browseCleanupState', false)).toBeUndefined()
    expect(state?.blocked).toBe(false)
    finish.resolve(undefined)
    await disposal
    expect(state?.blocked).toBe(true)
    expect(ctx.get('browseCleanupState', false)).toBeUndefined()
    const fresh = new Context()
    try {
      await fresh.plugin(BrowserSetup)
      expect(fresh.browserSetup.status().blocked).toBe(false)
    } finally { await fresh.fiber.dispose() }
  } finally {
    finish.resolve(undefined)
    await ctx.fiber.dispose()
  }
})
