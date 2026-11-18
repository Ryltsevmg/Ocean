/** Shape of the curated catalogue: only our bundles, localized, and one self entry. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { CATALOG } from '../src/catalog.js'

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

/** Bundles this market is expected to show, in catalogue order. */
const EXPECTED = [
  '@ocean/ocean-super-agent',
  '@ocean/ocean-remotion-studio',
  '@local/ocean-adp',
  '@ocean/ocean-browser-control',
  '@ocean/ocean-cua-bundle',
  '@local/ocean-theme-abyss',
  '@local/ocean-theme-one-dark',
  '@local/ocean-theme-dracula',
  '@local/ocean-theme-github',
  '@local/ocean-theme-solarized',
  '@local/ocean-theme-nord',
  '@local/ocean-theme-tokyo-night',
  '@local/ocean-theme-ayu',
  '@local/ocean-theme-catppuccin',
  '@local/ocean-theme-cobalt2',
  '@local/ocean-theme-darcula',
  '@local/ocean-theme-everforest',
  '@local/ocean-theme-flexoki',
  '@local/ocean-theme-gruvbox',
  '@local/ocean-theme-horizon',
  '@local/ocean-theme-jellybeans',
  '@local/ocean-theme-kanagawa',
  '@local/ocean-theme-mariana',
  '@local/ocean-theme-material',
  '@local/ocean-theme-modus',
  '@local/ocean-theme-monokai',
  '@local/ocean-theme-night-owl',
  '@local/ocean-theme-oxocarbon',
  '@local/ocean-theme-papercolor',
  '@local/ocean-theme-rose-pine',
  '@local/ocean-theme-seoul256',
  '@local/ocean-theme-synthwave',
  '@ocean/ocean-plugin-market',
]

test('the catalogue lists exactly our bundles in display order', () => {
  assert.deepEqual(CATALOG.map(entry => entry.name), EXPECTED)
})

test('every entry is a localized, versioned package record', () => {
  assert.ok(Array.isArray(CATALOG))
  const names = new Set()
  for (const entry of CATALOG) {
    assert.match(entry.name, /^@[a-z0-9-]+\/[a-z0-9-]+$/u, `bad package name: ${entry.name}`)
    assert.equal(names.has(entry.name), false, `duplicate entry: ${entry.name}`)
    names.add(entry.name)
    assert.match(entry.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u, `bad version: ${entry.name}`)
    for (const field of ['title', 'summary']) {
      const localized = entry[field]
      assert.equal(typeof localized, 'object', `${entry.name}.${field} must be localized`)
      assert.ok(localized.en.length > 0, `${entry.name}.${field} needs English`)
      assert.ok(localized.ru.length > 0, `${entry.name}.${field} needs Russian`)
      assert.equal(Object.keys(localized).sort().join(','), 'en,ru', `${entry.name}.${field} carries unexpected languages`)
    }
    if (entry.spec !== undefined) assert.equal(typeof entry.spec, 'string')
    const { details } = entry
    assert.equal(typeof details, 'object', `${entry.name}.details must exist for the popup`)
    for (const language of ['en', 'ru']) {
      assert.ok(details.about[language].length > 0, `${entry.name}.details.about needs ${language}`)
      assert.ok(details.points.length > 0, `${entry.name}.details.points must not be empty`)
    }
    for (const point of details.points) {
      assert.equal(Object.keys(point).sort().join(','), 'en,ru', `${entry.name}: every point is bilingual`)
      assert.ok(point.en.length > 0 && point.ru.length > 0)
    }
  }
})

test('exactly the market itself is marked self, under this package name', () => {
  const selves = CATALOG.filter(entry => entry.self === true)
  assert.equal(selves.length, 1)
  assert.equal(selves[0].name, pkg.name)
})
