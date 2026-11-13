/** Fit-width rasterization and the painted PDF page gutters share one geometry. */
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('reserves both PDF body gutters when calculating fit-width rasterization', () => {
  const css = readFileSync(new URL('../src/client/pdf/PdfBody.module.css', import.meta.url), 'utf8')
  const body = /\.body \{([^}]+)\}/.exec(css)?.[1] ?? ''
  const padding = Number(/padding: (\d+)px/.exec(body)?.[1])
  const source = readFileSync(new URL('../src/client/pdf/pdf.tsx', import.meta.url), 'utf8')
  const inset = Number(/horizontalInset=\{(\d+)\}/.exec(source)?.[1])
  expect(padding).toBe(22)
  expect(inset).toBe(padding * 2)
})
