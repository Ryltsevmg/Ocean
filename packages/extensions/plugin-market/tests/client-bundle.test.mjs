/** The committed browser bundle is generated from the sources and never hand-edited. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { MODULES, renderClientBundle, stripExports } from '../scripts/build-client.mjs'

test('client.js matches what the sources generate', async () => {
  const committed = await readFile(new URL('../client.js', import.meta.url), 'utf8')
  assert.equal(committed, await renderClientBundle(), 'run: node scripts/build-client.mjs')
})

test('the generated bundle keeps no top-level exports and is one loader factory', async () => {
  const bundle = await renderClientBundle()
  assert.equal(/^export /mu.test(bundle), false)
  assert.match(bundle, /window\.__ModuleLoader__\.load\(/u)
  assert.match(bundle, /id: '@ocean\/ocean-plugin-market'/u)
  assert.match(bundle, /return createMarket\(React\)/u)
  assert.match(bundle, /name: 'plugins\.tab'/u)
  for (const module of MODULES) assert.ok(bundle.includes(`// ---- ${module} ----`), `missing ${module}`)
})

test('stripExports only touches top-level export keywords', () => {
  assert.equal(stripExports('export const a = 1\n  export const b = 2'), 'const a = 1\n  export const b = 2')
  assert.equal(stripExports('export function f() {}'), 'function f() {}')
  assert.equal(stripExports('const s = "export const a"'), 'const s = "export const a"')
})
