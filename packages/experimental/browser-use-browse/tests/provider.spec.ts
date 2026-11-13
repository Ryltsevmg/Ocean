import BrowserSetup from '../src/setup.ts'
import { Context } from '@deepseek-ai/cordis'
import BrowserUse from '@ocean/ocean-browser-use'
import Tools from '@ocean/ocean-tools'
import SystemPrompt from '@ocean/ocean-system-prompt'
import Agents from '@ocean/ocean-agent'
import Projections from '@ocean/ocean-session-projection'
import { expect, it } from 'vitest'
import * as Provider from '../src/index.ts'
it('is inert until explicitly enabled and removes contributions on unload', async () => {
  const ctx = new Context()
  try {
    await ctx.plugin(BrowserSetup)
    await ctx.plugin(Projections)
    await ctx.plugin(Agents)
    await ctx.plugin(BrowserUse)
    await ctx.plugin(Tools)
    await ctx.plugin(SystemPrompt)
    const disabled = ctx.plugin(Provider, Provider.Config({})); await disabled
    expect(ctx.tools.get('ocean_browser_snapshot')).toBeUndefined()
    await disabled.dispose()
    const enabled = ctx.plugin(Provider, Provider.Config({ enabled: true, endpoint: 'http://127.0.0.1:19988', tokenFile: '/not-read-until-call', browser: 'test', allowedOrigins: ['https://example.com'] })); await enabled
    expect(ctx.tools.get('ocean_browser_snapshot')).toBeDefined()
    expect(ctx.tools.get('ocean_browser_execute')).toBeUndefined()
    expect(ctx.browserUse.providerName).toBe('ocean-browse')
    await enabled.dispose()
    expect(ctx.tools.get('ocean_browser_snapshot')).toBeUndefined()
    expect(ctx.browserUse.providerName).toBeUndefined()
  } finally { await ctx.fiber.dispose() }
})
it('retains cleanup failure across full setup disable and re-enable in the same Host', async () => {
  const ctx = new Context()
  const first = ctx.plugin(BrowserSetup); await first
  ctx.browserSetup.lifecycle.attach(async () => { throw new Error('uncertain cleanup') })
  await expect(ctx.browserSetup.lifecycle.release({} as never)).resolves.toBeUndefined()
  await expect(ctx.browserSetup.lifecycle.dispose()).rejects.toThrow('cleanup failed')
  // Cordis may report disposal errors rather than reject; the setup hook still records the latch.
  await first.dispose().catch(() => {})
  const next = ctx.plugin(BrowserSetup); await next
  expect(ctx.browserSetup.status().blocked).toBe(true)
  expect(() => ctx.browserSetup.lifecycle.attach(async () => {})).toThrow('cleanup failed')
  await ctx.fiber.dispose().catch(() => {})
})
