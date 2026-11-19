import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Locator, Page } from 'playwright'
import { chromium } from 'playwright'
import { expect, it, vi } from 'vitest'
import { compareOrRefreshGolden, launchWebScaffold, watchConsole, webSnapshotMode, type WebScaffold } from './scaffold.ts'
import { newEnglishPage, PLUGIN_TOGGLE_SETTLE_MS } from './support.ts'

const MODE = webSnapshotMode()
const EXPECTED = fileURLToPath(new URL('./expected/plugin-market/', import.meta.url))
const FIXTURE_BUNDLE = fileURLToPath(new URL('./fixtures/plugins/fixture-bundle/', import.meta.url))
const MISSING = '@fixture/missing-bundle'

async function withCatalogue(run: (page: Page, catalogue: Locator, scaffold: WebScaffold) => Promise<void>): Promise<void> {
  const scaffold = await launchWebScaffold({ profile: { packages: [{ dir: FIXTURE_BUNDLE }], bundles: [MISSING] } })
  try {
    const browser = await chromium.launch()
    try {
      const page = await newEnglishPage(browser)
      const consoleWatch = watchConsole(page)
      await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
      await page.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name: 'Plugins', exact: true }).click()
      const tab = page.locator('[data-plugin-panel]').getByRole('tab', { name: 'Catalogue', exact: true })
      await tab.click()
      const catalogue = page.getByRole('tabpanel', { name: 'Catalogue', exact: true })
      await catalogue.getByRole('searchbox', { name: 'Search', exact: true }).waitFor()
      await run(page, catalogue, scaffold)
      expect(consoleWatch.pageErrors).toEqual([])
    } finally {
      await browser.close()
    }
  } finally {
    await scaffold.close()
  }
}

async function saveGolden(name: string, lines: string[]): Promise<void> {
  if (MODE === 'refresh') await mkdir(EXPECTED, { recursive: true })
  await compareOrRefreshGolden(join(EXPECTED, `${name}.expected.md`), lines.join('\n'), MODE)
}

it('offers an editable source for an unpublished catalogue entry without starting an installation', async () => {
  await withCatalogue(async (page, catalogue, scaffold) => {
    const manager = scaffold.ctx.pluginManager
    const manifest = join(scaffold.harnessHome, 'profiles', 'scaffold', 'package.json')
    const before = await readFile(manifest, 'utf8')
    // Do not let a regression contact a registry or run a real installer.
    const registries = vi.spyOn(manager, 'registries').mockResolvedValue({ registry: null, fallbackRegistries: [], resolved: null })
    const inspect = vi.spyOn(manager, 'inspect').mockRejectedValue(new Error('Unexpected plugin inspection'))
    const install = vi.spyOn(manager, 'installBundle').mockRejectedValue(new Error('Unexpected plugin installation'))
    try {
      const title = 'Agent Developer Patterns'
      const search = catalogue.getByRole('searchbox', { name: 'Search', exact: true })
      await search.fill(title)
      await expect.poll(() => catalogue.getByRole('article').count()).toBe(1)
      const card = catalogue.getByRole('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
      await card.getByText('Not installed', { exact: true }).waitFor()
      const trigger = card.getByRole('button', { name: 'Details', exact: true })
      await trigger.focus()
      await page.keyboard.press('Enter')
      const details = page.getByRole('dialog', { name: title, exact: true })
      await details.getByText('No install source is listed. Enter a package name, Git URL, tarball, or local directory.', { exact: true }).waitFor()
      const focusedInDetails = () => details.evaluate(dialog => dialog.contains(document.activeElement))
      await expect.poll(focusedInDetails).toBe(true)
      await page.keyboard.press('Shift+Tab')
      expect(await focusedInDetails()).toBe(true)
      await page.keyboard.press('Tab')
      expect(await focusedInDetails()).toBe(true)
      const detailsAria = await details.ariaSnapshot()
      await page.setViewportSize({ width: 590, height: 310 })
      const detailsBounds = await details.boundingBox()
      if (detailsBounds === null) throw new Error('The details dialog has no layout box')
      expect(detailsBounds.y).toBeGreaterThanOrEqual(0)
      expect(detailsBounds.y + detailsBounds.height).toBeLessThanOrEqual(310)

      await details.getByRole('button', { name: 'Install from source', exact: true }).click()
      await page.setViewportSize({ width: 1440, height: 900 })
      const form = page.getByRole('dialog', { name: 'Add plugin', exact: true })
      const source = form.getByRole('textbox', { name: 'Package name or address', exact: true })
      await source.waitFor()
      await details.waitFor({ state: 'hidden' })
      await expect.poll(() => source.evaluate(field => document.activeElement === field)).toBe(true)
      expect(await source.inputValue()).toBe('@local/ocean-adp')
      expect(await source.isEditable()).toBe(true)
      const fieldAria = await source.ariaSnapshot()
      await source.fill('https://example.test/my-plugin.tgz')
      expect(await source.inputValue()).toBe('https://example.test/my-plugin.tgz')

      await page.keyboard.press('Escape')
      await form.waitFor({ state: 'hidden' })
      await expect.poll(() => catalogue.evaluate(panel => panel.contains(document.activeElement))).toBe(true)
      await trigger.click()
      await details.waitFor()
      await page.keyboard.press('Escape')
      await details.waitFor({ state: 'hidden' })
      await expect.poll(() => trigger.evaluate(button => document.activeElement === button)).toBe(true)
      expect(await search.inputValue()).toBe(title)
      expect(inspect).not.toHaveBeenCalled()
      expect(install).not.toHaveBeenCalled()
      expect(await readFile(manifest, 'utf8')).toBe(before)
      await saveGolden('source-form', [detailsAria, fieldAria, 'The field accepts a replacement source. Escape returns to the catalogue without inspecting, installing, or changing the profile.'])
    } finally {
      registries.mockRestore()
      inspect.mockRestore()
      install.mockRestore()
    }
  })
})

it('keeps catalogue details in sync with Host selection and exposes missing selected bundles', async () => {
  await withCatalogue(async (page, catalogue, scaffold) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect.poll(() => page.locator('body').evaluate(body => body.hasAttribute('data-ds-dark-theme'))).toBe(true)

    const name = '@fixture/bundle'
    const search = catalogue.getByRole('searchbox', { name: 'Search', exact: true })
    await search.fill(name)
    const card = catalogue.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) })
    await card.getByRole('button', { name: 'Details', exact: true }).click()
    const details = page.getByRole('dialog', { name, exact: true })
    await details.getByText('Off', { exact: true }).waitFor()
    const turnOn = details.getByRole('button', { name: 'Turn on', exact: true })
    await turnOn.focus()
    await page.keyboard.press('Enter')
    const bundles = () => scaffold.ctx.pluginManager.listBundles()
    await expect.poll(async () => (await bundles()).find(bundle => bundle.name === name)?.enabled, {
      timeout: PLUGIN_TOGGLE_SETTLE_MS,
    }).toBe(true)
    const badge = details.getByText('On', { exact: true })
    const turnOff = details.getByRole('button', { name: 'Turn off', exact: true })
    await badge.waitFor()
    await expect.poll(() => turnOff.isEnabled()).toBe(true)
    await expect.poll(() => turnOff.evaluate(button => document.activeElement === button)).toBe(true)
    const liveAria = [await badge.textContent(), await turnOff.ariaSnapshot()].join('\n')
    const bounds = await details.boundingBox()
    if (bounds === null) throw new Error('The details dialog has no layout box')
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
    await page.keyboard.press('Escape')
    await details.waitFor({ state: 'hidden' })
    await card.getByText('On', { exact: true }).waitFor()

    await search.fill(MISSING)
    const broken = catalogue.getByRole('article').filter({ has: page.getByRole('heading', { name: MISSING, exact: true }) })
    await broken.getByText('Files missing', { exact: true }).waitFor()
    const note = broken.getByText('The profile still references this plugin, but its files are missing.', { exact: true })
    await note.waitFor()
    const brokenTurnOff = broken.getByRole('button', { name: 'Turn off', exact: true })
    const remove = broken.getByRole('button', { name: 'Remove', exact: true })
    await brokenTurnOff.waitFor()
    await remove.focus()
    await page.keyboard.press('Enter')
    const cancel = broken.getByRole('button', { name: 'Cancel', exact: true })
    await expect.poll(() => cancel.evaluate(button => document.activeElement === button)).toBe(true)
    await page.keyboard.press('Enter')
    await expect.poll(() => remove.evaluate(button => document.activeElement === button)).toBe(true)
    expect((await bundles()).find(bundle => bundle.name === MISSING)).toMatchObject({ availability: 'missing', enabled: true, removable: true })
    await saveGolden('live-details', [
      '390 px / dark — open details after enabling:',
      liveAria,
      'Selected bundle with missing files:',
      await note.ariaSnapshot(),
      await brokenTurnOff.ariaSnapshot(),
      await remove.ariaSnapshot(),
    ])
  })
})
