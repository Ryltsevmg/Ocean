/** The approved Ocean Pen palette is shared by controls and native panes. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseRules } from './stylesheet-scan.ts'
const css = readFileSync(new URL('../src/styles/ocean-native.css', import.meta.url), 'utf8')
const base = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8')
describe('Ocean native visual foundation', () => {
  it('maps the approved dark palette to shared semantic roles', () => {
    const dark = parseRules(css).find(rule => rule.selectors.length === 1 && rule.selectors.includes('body[data-ds-dark-theme]'))!
    for (const pair of [
      ['--dsw-alias-bg-base', '#0b111c'],
      ['--dsw-alias-bg-sidebar', '#101925'],
      ['--dsw-alias-bg-field', '#152233'],
      ['--dsw-alias-bg-selected', '#243648'],
      ['--dsw-alias-label-primary', '#eff4f8'],
    ]) expect(dark.declarations).toContainEqual(pair)
  })
  it('keeps primary actions blue in both modes rather than inheriting the upstream inverted fill', () => {
    const shared = parseRules(css).find(rule => rule.selectors.includes('body'))!
    expect(shared.selectors).toContain('body[data-ds-dark-theme]')
    expect(shared.declarations).toContainEqual(['--dsw-alias-button-primary-fill', '#1766bc'])
  })
  it('keeps Ocean font order and compact native radii', () => {
    expect(base).toContain("--dsh-font-family-text-default: 'Inter'")
    expect(base).toContain("--dsh-font-family-code-default: 'JetBrains Mono'")
    for (const size of ['sm', 'md', 'lg', 'xl', 'panel']) expect(base).toContain(`--dsw-radius-${size}: 8px`)
  })
  it('preserves a light palette and distinguishes disabled actions', () => {
    const body = parseRules(css).find(rule => rule.selectors.includes('body'))!
    expect(body.declarations).toContainEqual(['--dsw-alias-bg-sidebar', '#edf2f7'])
    expect(body.declarations).toContainEqual(['--dsw-alias-label-disabled', '#667787'])
    expect(css).toContain('--dsw-mask-blur: none')
  })
})
