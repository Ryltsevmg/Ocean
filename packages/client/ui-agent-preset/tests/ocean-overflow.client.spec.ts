/** Preset action hints stay inside the last card instead of widening Settings. */
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('anchors action hints inward at the end of a preset card', () => {
  const css = readFileSync(new URL('../src/client/AgentPresetSection.module.css', import.meta.url), 'utf8')
  const hint = /\.iconButton::after \{([^}]+)\}/.exec(css)?.[1] ?? ''
  expect(hint).toContain('right: 0')
  expect(hint).not.toContain('left: 50%')
  expect(hint).not.toContain('translateX(-50%)')
})
