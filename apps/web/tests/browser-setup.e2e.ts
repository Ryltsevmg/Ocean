/** Isolated profile: real RPC/config/HMR, no paired browser, relay, tokens or model calls. */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { expect, it, onTestFinished } from 'vitest'
import { launchWebScaffold, watchConsole } from './scaffold.ts'
import { newEnglishPage, openSettings } from './support.ts'

it('reviews, cancels and repeatedly saves disabled browser setup through Settings', async () => {
  const scaffold = await launchWebScaffold({ profile: { packages: [], bundles: ['@ocean/ocean-browser-use-browse'] } })
  onTestFinished(() => scaffold.close())
  const browser = await chromium.launch()
  onTestFinished(() => browser.close())
  const page = await newEnglishPage(browser)
  const console = watchConsole(page)
  const settingsPath = join(scaffold.harnessHome, 'profiles/scaffold/cordis.patch.yml')
  const persisted = () => readFile(settingsPath, 'utf8')
  await page.goto(scaffold.authenticatedUrl)
  await openSettings(page, 'en')
  await page.getByRole('button', { name: 'Plugins', exact: true }).click()
  const card = page.locator('[data-plugin-package="@ocean/ocean-browser-use-browse"]')
  await card.getByRole('button', { name: 'View Browser control (browse)', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Browser setup', exact: true })
  await panel.waitFor()
  const toggle = panel.getByRole('checkbox', { name: 'Allow browser tools', exact: true })
  expect(await toggle.isChecked()).toBe(false)
  expect(await panel.getByRole('status').textContent()).toContain('not tested')
  const before = await persisted()
  await panel.getByLabel('Local relay address', { exact: true }).fill('http://127.0.0.1:19989')
  await panel.getByRole('button', { name: 'Review changes', exact: true }).click()
  const confirmation = panel.getByRole('alertdialog', { name: 'Save these settings?', exact: true })
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(await persisted()).toBe(before)
  for (const port of [19989, 19990]) {
    await panel.getByLabel('Local relay address', { exact: true }).fill(`http://127.0.0.1:${port}`)
    await panel.getByRole('button', { name: 'Review changes', exact: true }).click()
    await confirmation.getByRole('button', { name: 'Save and apply', exact: true }).click()
    await expect.poll(() => persisted()).toContain(`http://127.0.0.1:${port}`)
    await expect.poll(() => panel.getByRole('status').textContent()).toContain('Configuration saved. Connection not tested.')
    await panel.getByRole('button', { name: 'Reload saved configuration', exact: true }).click()
    await expect.poll(() => panel.getByLabel('Local relay address', { exact: true }).inputValue()).toBe(`http://127.0.0.1:${port}`)
    expect(await toggle.isChecked()).toBe(false)
  }
  expect(console.pageErrors).toEqual([])
}, 120_000)
