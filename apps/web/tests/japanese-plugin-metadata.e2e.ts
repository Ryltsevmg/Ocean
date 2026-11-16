/** Japanese package resources reach the real plugin manager through Host metadata and Client locale resolution. */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser } from 'playwright'
import { expect, it, onTestFailed, onTestFinished } from 'vitest'
import { captureStableAria, compareOrRefreshGolden, launchWebScaffold, watchConsole, webSnapshotMode, type WebScaffold } from './scaffold.ts'
import { saveFailureShot } from './support.ts'

it('displays Japanese plugin titles and descriptions from package metadata', async () => {
  const resources: { scaffold?: WebScaffold; browser?: Browser } = {}
  onTestFinished(async () => {
    try { await resources.browser?.close() } finally { await resources.scaffold?.close() }
  })
  const scaffold = await launchWebScaffold()
  resources.scaffold = scaffold
  const browser = await chromium.launch()
  resources.browser = browser
  const page = await browser.newPage({ locale: 'ja-JP', viewport: { width: 1440, height: 960 } })
  const tripwire = watchConsole(page)
  onTestFailed(() => saveFailureShot(page, 'japanese-plugin-metadata'))
  await page.goto(scaffold.authenticatedUrl)
  await page.getByRole('button', { name: 'プラグイン', exact: true }).click()
  const panel = page.locator('[data-plugin-panel]')
  // The held-back Codex bundle lists on the More page.
  await panel.getByRole('button', { name: 'その他', exact: true }).click()
  const title = panel.getByRole('button', { name: 'Codex サブエージェントを表示', exact: true })
  await title.waitFor()
  const card = title.locator('xpath=ancestor::li')
  const locale = JSON.parse(await readFile(
    fileURLToPath(new URL('../../../packages/subagent/subagent-codex/locale/ja.json', import.meta.url)), 'utf8',
  )) as { meta: { description: string } }
  await card.getByText(locale.meta.description, { exact: true }).waitFor()
  const expected = fileURLToPath(new URL('./expected/japanese-plugin-metadata/card.expected.md', import.meta.url))
  await compareOrRefreshGolden(expected,
    await captureStableAria(page, '[data-plugin-panel] li:has(button[aria-label="Codex サブエージェントを表示"])', scaffold.workspaceCwd), webSnapshotMode())
  expect(tripwire.warnings).toEqual([])
  expect(tripwire.pageErrors).toEqual([])
})
