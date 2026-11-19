/** Publication membership, exact matching and management actions in the catalogue projection. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMarketView, cardFor, filterCards } from '../src/view.js'

const plugin = {
  name: '@ocean/approved', version: '2.0.0', title: 'Approved plugin', description: 'Ищется по описанию.',
  sha256: '2'.repeat(64), compatible: true,
}
const bundle = { name: plugin.name, version: '1.0.0', availability: 'profile', enabled: true, installed: true, update: 'registry' }
const ready = { fresh: true, inventoryReady: true }

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
  const { name, version, title, sha256 } = plugin
  const card = cardFor(plugin, { name, official: true, availability: 'missing', installTarget: { spec: `${name}@latest` } }, ready)
  assert.equal(card.badge, 'badgeMissing')
  assert.equal(card.publishedVersion, version)
  assert.deepEqual(card.actions, [{ kind: 'install', target: { name, version, title, sha256 } }])
})

test('incompatible releases and offers with unknown local inventory do not install', () => {
  const incompatible = cardFor({ ...plugin, compatible: false }, undefined, ready)
  assert.equal(incompatible.badge, 'badgeIncompatible')
  assert.deepEqual(incompatible.actions, [])
  const unknown = cardFor(plugin, undefined, { fresh: true, inventoryReady: false })
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
  const card = cardFor({ ...plugin, compatible: false }, { ...bundle, enabled: false }, { fresh: false, inventoryReady: true })
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

test('search uses the published title, description and name without rewriting the Host copy', () => {
  const { cards } = buildMarketView({ plugins: [plugin], bundles: [], ...ready })
  for (const query of ['  ', 'Approved Plugin', 'ОПИСАНИЮ', '@ocean/approved']) assert.deepEqual(filterCards(cards, query), cards)
  assert.equal(cards[0].description, plugin.description)
  assert.deepEqual(filterCards(cards, 'third-party'), [])
})
