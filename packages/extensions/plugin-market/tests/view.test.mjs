/** Publication membership, exact matching and management actions in the catalogue projection. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMarketView, cardFor, filterCards } from '../src/view.js'

const plugin = {
  name: '@ocean/approved', version: '2.0.0', title: { en: 'Approved plugin', ru: 'Одобренный плагин' },
  description: { en: 'Searchable by description.', ru: 'Ищется по описанию.' },
  sha256: '2'.repeat(64), compatible: true,
}
const bundle = { name: plugin.name, version: '1.0.0', availability: 'profile', enabled: true, installed: true, update: 'registry' }
/** Resolve offer text as the named active locale would, falling back to English. */
const resolver = locale => text => typeof text === 'string' ? text : text[locale] ?? text.en
const ready = { fresh: true, inventoryReady: true, resolveText: resolver('en') }

test('only published names are shown, in published order; unrelated inventory cannot add products', () => {
  const next = { ...plugin, name: '@ocean/another' }
  const bundles = [bundle, { ...bundle, name: '@other/third-party' }, {
    name: '@ocean/optional', official: true, availability: 'installation', optional: true,
  }]
  const view = buildMarketView({ plugins: [next, plugin], bundles, ...ready })
  assert.deepEqual(view.cards.map(card => card.name), [next.name, plugin.name])
  assert.deepEqual(view.counts, { total: 2, installed: 1, enabled: 1 })
  assert.deepEqual(buildMarketView({ plugins: [], bundles, ...ready }).cards, [])
})

test('a compatible fresh release installs by exact identity, never by the inventory registry target', () => {
  const { name, version, sha256 } = plugin
  const card = cardFor(plugin, { name, official: true, availability: 'missing', installTarget: { spec: `${name}@latest` } }, ready)
  assert.equal(card.badge, 'badgeMissing')
  assert.equal(card.publishedVersion, version)
  assert.deepEqual(card.actions, [{ kind: 'install', target: { name, version, title: 'Approved plugin', sha256 } }])
})

test('a ru offer resolves its card text and install title to Russian', () => {
  const { name, version, sha256 } = plugin
  const card = cardFor(plugin, undefined, { ...ready, resolveText: resolver('ru') })
  assert.equal(card.title, 'Одобренный плагин')
  assert.equal(card.description, 'Ищется по описанию.')
  assert.deepEqual(card.actions, [{ kind: 'install', target: { name, version, title: 'Одобренный плагин', sha256 } }])
})

test('incompatible releases and offers with unknown local inventory do not install', () => {
  const incompatible = cardFor({ ...plugin, compatible: false }, undefined, ready)
  assert.equal(incompatible.badge, 'badgeIncompatible')
  assert.deepEqual(incompatible.actions, [])
  const unknown = cardFor(plugin, undefined, { fresh: true, inventoryReady: false, resolveText: resolver('en') })
  assert.equal(unknown.badge, 'badgeUnknown')
  assert.deepEqual(unknown.actions, [])
})

test('a newer published version does not add a registry update for an installed copy', () => {
  const card = cardFor(plugin, bundle, ready)
  assert.equal(card.badge, 'badgeOn')
  assert.equal(card.version, '1.0.0')
  assert.equal(card.publishedVersion, '2.0.0')
  assert.deepEqual(card.actions, [{ kind: 'disable' }, { kind: 'open' }])
})

test('cached and incompatible releases can still be switched on if their existing local copies are available', () => {
  const card = cardFor({ ...plugin, compatible: false }, { ...bundle, enabled: false }, { fresh: false, inventoryReady: true, resolveText: resolver('en') })
  assert.equal(card.badge, 'badgeOff')
  assert.equal(card.compatible, false)
  assert.deepEqual(card.actions, [{ kind: 'enable' }, { kind: 'open' }])
})

test('a broken dependency opens Installed but never gets a new install over the existing dependency', () => {
  const card = cardFor(plugin, { ...bundle, availability: 'missing', error: { code: 'not-bundle' } }, ready)
  assert.equal(card.badge, 'badgeBroken')
  assert.equal(card.error, 'not-bundle')
  assert.equal(card.note, 'noteBroken')
  assert.deepEqual(card.actions, [{ kind: 'disable' }, { kind: 'open' }])
})

test('read-only and failed local bundles do not get an enable action', () => {
  for (const patch of [{ readOnlyReason: 'installation' }, { error: { code: 'unsupported-platform' } }]) {
    assert.deepEqual(cardFor(plugin, { ...bundle, enabled: false, ...patch }, ready).actions, [{ kind: 'open' }])
  }
})

const holder = {
  name: '@ocean/holder', version: '0.2.2', availability: 'profile', installed: true, enabled: true,
  rows: [{ rowId: 'holder-row', moduleName: plugin.name }],
}

test('a package an installed bundle mounts is contained by it instead of missing an install', () => {
  const view = buildMarketView({ plugins: [plugin], bundles: [holder], ...ready })
  const [card] = view.cards
  assert.equal(card.badge, 'badgeContained')
  assert.equal(card.note, 'noteContained')
  assert.equal(card.containedBy, holder.name)
  assert.equal(card.containedVersion, holder.version)
  assert.equal(card.installed, true)
  assert.equal(card.enabled, true)
  assert.deepEqual(card.actions, [{ kind: 'open', name: holder.name }])
  assert.deepEqual(view.counts, { total: 1, installed: 1, enabled: 1 })
})

test('a disabled holder still contains the package, reported installed but off', () => {
  const [card] = buildMarketView({ plugins: [plugin], bundles: [{ ...holder, enabled: false }], ...ready }).cards
  assert.equal(card.badge, 'badgeContained')
  assert.equal(card.enabled, false)
  assert.deepEqual(card.actions, [{ kind: 'open', name: holder.name }])
})

test('an unreadable or unselected bundle cannot claim the package it would mount', () => {
  const { name, version, sha256 } = plugin
  for (const bundles of [[{ ...holder, availability: 'missing' }], [{ ...holder, installed: false, enabled: false }]]) {
    const [card] = buildMarketView({ plugins: [plugin], bundles, ...ready }).cards
    assert.equal(card.badge, 'badgeMissing')
    assert.equal(card.containedBy, undefined)
    assert.deepEqual(card.actions, [{ kind: 'install', target: { name, version, title: 'Approved plugin', sha256 } }])
  }
})

test('an enabled holder wins over a disabled one, and an own bundle entry wins over every holder', () => {
  const disabled = { ...holder, name: '@ocean/disabled', enabled: false }
  const [contained] = buildMarketView({ plugins: [plugin], bundles: [disabled, holder], ...ready }).cards
  assert.equal(contained.containedBy, holder.name)
  const [own] = buildMarketView({ plugins: [plugin], bundles: [holder, bundle], ...ready }).cards
  assert.equal(own.badge, 'badgeOn')
  assert.equal(own.containedBy, undefined)
})

test('search uses the resolved title, description and name in the active language', () => {
  const { cards } = buildMarketView({ plugins: [plugin], bundles: [], ...ready })
  for (const query of ['  ', 'Approved Plugin', 'by description', '@ocean/approved']) assert.deepEqual(filterCards(cards, query), cards)
  assert.equal(cards[0].description, 'Searchable by description.')
  assert.deepEqual(filterCards(cards, 'third-party'), [])
  assert.deepEqual(filterCards(cards, 'ОПИСАНИЮ'), [])
  const ru = buildMarketView({ plugins: [plugin], bundles: [], ...ready, resolveText: resolver('ru') }).cards
  for (const query of ['ОПИСАНИЮ', 'Одобренный Плагин', '@ocean/approved']) assert.deepEqual(filterCards(ru, query), ru)
  assert.deepEqual(filterCards(ru, 'by description'), [])
})
