/** Keyless real-profile checks for the default official-home mark and native input isolation. */
import { mkdir, mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Page } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { launchWebScaffold, watchConsole, type WebScaffold } from './scaffold.ts'
import { ZH_BROWSER_LOCALE } from './support.ts'

const artifacts = fileURLToPath(new URL('../../../.artifacts/home-whale/', import.meta.url))
const MARK = '[class*="fishHitbox"] svg'

describe('official home mark in the default web profile', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let consoleState: ReturnType<typeof watchConsole>
  let captureDir: string

  beforeAll(async () => {
    await mkdir(artifacts, { recursive: true })
    captureDir = await mkdtemp(join(artifacts, 'run-'))
    scaffold = await launchWebScaffold({ firstUse: true })
    browser = await chromium.launch()
    page = await browser.newPage({ viewport: { width: 1440, height: 960 }, locale: ZH_BROWSER_LOCALE })
    consoleState = watchConsole(page)
    await page.goto(scaffold.authenticatedUrl)
    await page.locator(MARK).waitFor()
    await page.locator('[data-composer-input]').waitFor()
  }, 120_000)

  afterAll(async () => {
    try {
      await browser?.close()
    } finally {
      await scaffold?.close()
    }
  })

  it('ships the static Ocean mark instead of the retired whale canvas', async () => {
    const hitbox = page.locator('[class*="fishHitbox"]')
    const mark = page.locator(MARK)
    expect(await page.locator('[data-home-whale]').count()).toBe(0)
    expect(await mark.getAttribute('aria-hidden')).toBe('true')
    expect(await mark.evaluate(node => getComputedStyle(node).animationName)).toBe('none')
    // The mark keeps its headline's ink so the two read as one title group.
    expect(await mark.evaluate(node => getComputedStyle(node).color))
      .toBe(await page.locator('[class*="titleGroup"] > span').first().evaluate(node => getComputedStyle(node).color))
    await hitbox.hover()
    expect(await mark.evaluate(node => getComputedStyle(node).animationName)).toBe('none')
    await page.screenshot({ path: `${captureDir}/idle.png` })
  })

  it('keeps native draft editing independent of the decoration', async () => {
    const input = page.locator('[data-composer-input]')
    await input.fill('保留这个试用草稿')
    const mark = page.locator(MARK)
    await input.click()
    // Observe several normal animation frames while focus stays in the composer.
    await page.waitForTimeout(300)
    expect(await mark.evaluate(node => getComputedStyle(node).animationName)).toBe('none')
    expect(await input.innerText()).toBe('保留这个试用草稿')
    await input.press('ControlOrMeta+A')
    await input.press('Backspace')
  })

  it('loads from the default composition without a separately enabled bundle', async () => {
    await page.reload()
    await page.locator(MARK).waitFor()
    const facts = await page.locator(MARK).evaluate(node => ({
      count: document.querySelectorAll('[class*="fishHitbox"] svg').length,
      hiddenFromAssistiveTech: node.getAttribute('aria-hidden'),
      animationName: getComputedStyle(node).animationName,
      nativeComposer: document.querySelectorAll('[data-composer-seat]').length,
    }))
    expect(facts).toEqual({
      count: 1,
      hiddenFromAssistiveTech: 'true',
      animationName: 'none',
      nativeComposer: 1,
    })
    expect(consoleState.pageErrors).toEqual([])
    expect(consoleState.warnings).toEqual([])
  })

  it('keeps the mark inked in both themes and fits a narrow home', async () => {
    const settings = scaffold.ctx.get('settings')!
    const mark = page.locator(MARK)
    await settings.update('ui-theme', { preference: 'light' })
    await expect.poll(() => page.locator('body').getAttribute('data-ds-dark-theme')).toBeNull()
    const lightInk = await mark.evaluate(node => getComputedStyle(node).color)
    try {
      await settings.update('ui-theme', { preference: 'dark' })
      await expect.poll(() => page.locator('body').getAttribute('data-ds-dark-theme')).toBe('')
      await expect.poll(() => mark.evaluate(node => getComputedStyle(node).color)).not.toBe(lightInk)
      await page.screenshot({ path: `${captureDir}/dark.png` })
      await page.setViewportSize({ width: 390, height: 844 })
      const box = (await mark.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(390)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    } finally {
      await page.setViewportSize({ width: 1440, height: 960 })
      await settings.update('ui-theme', { preference: 'light' })
    }
  })
})
