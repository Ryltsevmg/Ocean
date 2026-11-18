/** Default-loaded entry controls activate through the real Web profile and Loader. */
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import { launchWebScaffold, watchConsole, type WebScaffold, type WebConsoleTripwire } from './scaffold.ts'
import { newEnglishPage, saveFailureShot } from './support.ts'

describe('default navigation entry customization', () => {
  let scaffold: WebScaffold | undefined
  let browser: Browser | undefined
  let page: Page
  let tripwire: WebConsoleTripwire

  beforeAll(async () => {
    scaffold = await launchWebScaffold({
      extraOverlayPath: fileURLToPath(new URL('./pin-browse-picker.overlay.yml', import.meta.url)),
    })
    browser = await chromium.launch()
    page = await newEnglishPage(browser)
    tripwire = watchConsole(page)
    await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
  })

  afterAll(async () => {
    try { await browser?.close() } finally { await scaffold?.close() }
  })

  it('keeps plugin discovery and creation on the Plugins page after reload', async () => {
    onTestFailed(() => saveFailureShot(page, 'entry-customization'))
    const nav = page.getByRole('navigation', { name: 'Tools' })
    const tasks = nav.getByRole('button', { name: 'Automation tasks', exact: true })
    const plugins = nav.getByRole('button', { name: 'Plugins', exact: true })
    await tasks.waitFor()
    await tasks.click()
    await page.getByRole('heading', { name: 'Automation tasks', exact: true }).waitFor()
    for (const reload of [false, true]) {
      if (reload) {
        await page.reload({ waitUntil: 'load' })
        await tasks.click()
        await page.getByRole('heading', { name: 'Automation tasks', exact: true }).waitFor()
      }
      expect(await nav.getByRole('button', { name: 'More', exact: true }).count()).toBe(0)
      await plugins.click()
      const panel = page.locator('[data-plugin-panel]')
      await panel.getByRole('button', { name: 'Browse other plugins', exact: true }).click()
      await panel.getByRole('heading', { name: 'Optional plugins', exact: true }).waitFor()
      expect(await plugins.getAttribute('aria-current')).toBe('page')
      await tasks.click()
      await page.getByRole('heading', { name: 'Automation tasks', exact: true }).waitFor()
    }
    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
  })
})
