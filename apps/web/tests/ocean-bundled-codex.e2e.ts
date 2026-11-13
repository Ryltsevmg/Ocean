/** Keyless real UI regression: shipped Codex toggles locally, never an install flow. */
import { chromium } from 'playwright'
import { expect, it } from 'vitest'
import { launchWebScaffold } from './scaffold.ts'
import { newEnglishPage, openSettings } from './support.ts'

it('enables and disables bundled Codex through the real plugin UI without installation', async () => {
  const scaffold = await launchWebScaffold()
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await newEnglishPage(browser)
    await page.goto(scaffold.authenticatedUrl)
    await page.waitForSelector('[class*="frame"]')
    await openSettings(page, 'en')
    await page.getByRole('button', { name: 'Plugins', exact: true }).click()
    const panel = page.locator('[data-plugin-panel]')
    await panel.waitFor()
    await panel.getByRole('button', { name: 'More', exact: true }).click()
    const name = '@ocean/ocean-subagent-codex'
    const card = panel.locator(`[data-plugin-package="${name}"]`)
    await card.waitFor()
    expect((await scaffold.ctx.pluginManager.listBundles()).find(bundle => bundle.name === name))
      .toMatchObject({ availability: 'installation', enabled: false })
    expect(await card.getByText('Not installed', { exact: true }).count()).toBe(0)
    const toggle = card.getByRole('switch')
    await toggle.click()
    await expect.poll(async () => (await scaffold.ctx.pluginManager.listBundles()).find(bundle => bundle.name === name)?.enabled).toBe(true)
    expect(await page.getByText('Failed to install plugin', { exact: true }).count()).toBe(0)
    await expect.poll(() => toggle.getAttribute('aria-checked')).toBe('true')
    await toggle.click()
    await expect.poll(async () =>
      (await scaffold.ctx.pluginManager.listBundles()).find(bundle => bundle.name === name)?.enabled).toBe(false)
  } finally {
    await browser.close()
    await scaffold.close()
  }
})
