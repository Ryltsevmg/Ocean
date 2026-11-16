// Web e2e scenario: the current-session permission pickers and the locale-aware,
// in-page risk confirmation that gates Full access. Zero model calls: the
// scenario boots the shipped Web composition and exercises the real process
// catalog, permission projection, client command path, HTTP RPC, and pushed
// update.
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import {
  assertFixtureInventory, captureStableAria, compareOrRefreshGolden,
  launchWebScaffold, watchConsole, webSnapshotMode, type WebScaffold,
} from './scaffold.ts'
import {
  ZH_BROWSER_LOCALE, assertWarningDialogLayout, connectFreshWorkspaceZh, saveFailureShot, writeComposerDraft,
} from './support.ts'

const SNAPSHOT_DIR = fileURLToPath(new URL('./expected/access-confirmation', import.meta.url))
const UI_EXPECTED = join(SNAPSHOT_DIR, 'ui.expected.md')
const MODE = webSnapshotMode()

describe('web e2e: Full access confirmation', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    scaffold = await launchWebScaffold()
    // CI uses Playwright's pinned browser. A developer may point this one
    // scenario at an installed Chromium when the matching browser download
    // is temporarily unavailable.
    const executablePath = process.env.DSH_PLAYWRIGHT_EXECUTABLE_PATH
    browser = await chromium.launch(executablePath === undefined ? {} : { executablePath })
    // Keep the Chinese surface via {@link ZH_BROWSER_LOCALE}: the golden pins
    // the actual registered dictionary rather than a test-local translation
    // callback.
    page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, locale: ZH_BROWSER_LOCALE, colorScheme: 'light' })
    tripwire = watchConsole(page)
    await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
    await connectFreshWorkspaceZh(page, scaffold.workspaceCwd)
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('requires acknowledgement before the composer picker can enable Full access', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-full-access-confirmation'))
    const access = page.locator('button[aria-label^="访问模式"]').first()
    await access.waitFor({ timeout: 10_000 })

    expect(await access.getAttribute('aria-label')).toBe('访问模式，当前：工作区内修改')

    await access.click()
    await page.getByRole('menuitem', { name: '完全权限' }).click()
    const dialog = page.getByRole('dialog', { name: '确认启用完全权限？' })
    await dialog.waitFor({ timeout: 10_000 })
    await assertWarningDialogLayout(dialog)
    const enable = dialog.getByRole('button', { name: '启用完全权限' })
    expect(await enable.isDisabled()).toBe(true)

    // The modal is in this page's body (not a native/new window) and escapes
    // the sticky composer's stacking context.
    expect(await dialog.evaluate(node => node.parentElement?.parentElement === document.body)).toBe(true)
    const snapshot = await captureStableAria(page, '[role="dialog"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(UI_EXPECTED, snapshot, MODE)

    const acknowledgement = dialog.getByRole('checkbox', { name: '我已了解风险，并愿意继续' })
    expect(await acknowledgement.evaluate((input) => {
      const label = input.closest('label')!
      const textStyle = getComputedStyle(label)
      const inputStyle = getComputedStyle(input)
      return {
        focused: document.activeElement === input,
        fontSize: textStyle.fontSize, lineHeight: textStyle.lineHeight, weight: textStyle.fontWeight,
        gap: textStyle.gap, width: inputStyle.width, height: inputStyle.height,
      }
    })).toEqual({ focused: true, fontSize: '14px', lineHeight: '20px', weight: '400', gap: '6px', width: '14px', height: '14px' })
    await dialog.getByText('我已了解风险，并愿意继续', { exact: true }).click()
    expect(await enable.isEnabled()).toBe(true)
    await enable.click()
    await expect.poll(() => access.getAttribute('aria-label'), { timeout: 10_000 })
      .toBe('访问模式，当前：完全权限')
    expect(await dialog.count()).toBe(0)
    expect(tripwire.pageErrors).toEqual([])
  }, 60_000)

  it('keeps all permission names readable with a collapsed narrow trigger', async () => {
    await page.setViewportSize({ width: 420, height: 1000 })
    const access = page.locator('button[aria-label^="访问模式"]').first()
    const composer = page.locator('[data-composer-card]').first()
    await expect.poll(async () => (await composer.boundingBox())!.width).toBeLessThanOrEqual(460)
    await expect.poll(async () => (await access.boundingBox())!.width).toBeLessThan(60)

    await access.click()
    const menu = page.getByRole('menu')
    await menu.waitFor()
    const menuBox = (await menu.boundingBox())!
    expect(menuBox.width).toBeGreaterThanOrEqual(144)
    expect(menuBox.width).toBeLessThanOrEqual(360)
    expect(menuBox.x).toBeGreaterThanOrEqual(0)
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(420)
    for (const name of ['仅可查看', '工作区内修改', '完全权限']) {
      expect(await menu.getByText(name, { exact: true }).evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    }
    await page.keyboard.press('Escape')

    const input = page.locator('[data-composer-input]').first()
    await writeComposerDraft(page, input, '/permission')
    await input.press('Escape')
    await input.press('Enter')
    const slash = page.locator('[aria-label="/permission 选项"]')
    await slash.waitFor()
    const slashBox = (await slash.boundingBox())!
    expect(slashBox.width).toBeGreaterThanOrEqual(220)
    expect(slashBox.x).toBeGreaterThanOrEqual(0)
    expect(slashBox.x + slashBox.width).toBeLessThanOrEqual(420)
    expect(await slash.evaluate(node => getComputedStyle(node).minWidth)).toBe('min(220px, 100%)')
    expect(await slash.evaluate(node => getComputedStyle(node).maxWidth)).toBe('100%')
    for (const name of ['仅可查看', '工作区内修改', '完全权限']) {
      expect(await slash.getByText(name, { exact: true }).evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    }
    await page.keyboard.press('Escape')
    await writeComposerDraft(page, input, '/permission danger-full-access')
    await input.press('Enter')
    await expect.poll(() => access.getAttribute('aria-label')).toBe('访问模式，当前：完全权限')
    expect(tripwire.pageErrors).toEqual([])
  })

  it('offers only the three standard modes in both pickers', async () => {
    const access = page.locator('button[aria-label^="访问模式"]').first()
    await access.click()
    await expect.poll(() => page.getByRole('menuitem').allTextContents())
      .toEqual(['仅可查看', '工作区内修改', '完全权限'])
    await page.keyboard.press('Escape')
    const input = page.locator('[data-composer-input]').first()
    await writeComposerDraft(page, input, '/permission')
    await input.press('Escape')
    await input.press('Enter')
    const slash = page.locator('[aria-label="/permission 选项"]')
    await slash.waitFor()
    expect(await slash.getByRole('option').count()).toBe(3)
    await page.keyboard.press('Escape')
    expect(tripwire.pageErrors).toEqual([])
  })

  it('keeps its snapshot inventory closed', async () => {
    expect(tripwire.warnings).toEqual([])
    await assertFixtureInventory(SNAPSHOT_DIR, ['ui.expected.md'])
  })
})
