/** The preview card keeps Ocean metadata readable without changing plan behavior. */
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('uses the Ocean 12px metadata scale for plan descriptions', () => {
  const sheet = readFileSync(new URL('../src/client/PlanPreview.module.css', import.meta.url), 'utf8')
  expect(/\.cardDescription \{([^}]+)\}/.exec(sheet)?.[1]).toContain('font-size: 12px')
})
