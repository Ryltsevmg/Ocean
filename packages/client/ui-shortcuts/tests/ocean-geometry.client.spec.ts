/** Ocean modal geometry follows the approved Pen while retaining viewport clearance. */
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('fits the 660px Ocean shortcuts dialog into narrow and short viewports', () => {
  const sheet = readFileSync(new URL('../src/client/Reference.module.css', import.meta.url), 'utf8')
  const dialog = /\.dialog \{([^}]+)\}/.exec(sheet)?.[1] ?? ''
  expect(dialog).toContain('width: min(660px, 100%)')
  expect(dialog).toContain('border-radius: var(--dsw-radius-panel)')
  expect(dialog).toContain('max-height: calc(100dvh - 48px)')
  expect(dialog).not.toContain('translateY')
})
