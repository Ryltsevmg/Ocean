/** Behaviour of the pure card projection: what each state offers and why. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMarketView, cardFor, compareVersions, filterCards } from '../src/view.js'

/** Resolve catalogue strings the way the browser does: the active language, then English. */
const text = localized => localized.ru ?? localized.en

/** One catalogue entry with a stable shape. */
const entry = {
  name: '@local/pkg-a',
  version: '0.2.0',
  title: { en: 'Package A', ru: 'Пакет A' },
  summary: { en: 'Does A.', ru: 'Делает A.' },
  details: {
    about: { en: 'A does the A things well.', ru: 'Пакет A хорошо делает своё дело.' },
    points: [
      { en: 'Alpha capability', ru: 'Возможность альфа' },
      { en: 'Beta capability', ru: 'Возможность бета' },
    ],
  },
}

/** The Host's record for a selected, profile-installed bundle of the same package. */
const selected = {
  name: '@local/pkg-a',
  version: '0.2.0',
  enabled: true,
  installed: true,
  removable: true,
  optional: false,
  rows: [],
  overrides: [],
}

test('compareVersions orders releases, patches and prereleases', () => {
  assert.equal(compareVersions('0.3.1', '0.3.1'), 0)
  assert.equal(compareVersions('0.4.0', '0.3.9'), 1)
  assert.equal(compareVersions('0.3.9', '0.4.0'), -1)
  assert.equal(compareVersions('1.0.0', '1.0.0-rc.1'), 1)
  assert.equal(compareVersions('1.0.0-rc.2', '1.0.0-rc.1'), 1)
  assert.equal(compareVersions('1.0.0-beta.2', '1.0.0-beta.10'), -1)
  assert.equal(compareVersions('not-a-version', '1.0.0'), 0)
})

test('a package the build does not carry offers an install only with a spec', () => {
  const without = cardFor(entry, undefined, { text })
  assert.equal(without.state, 'unavailable')
  assert.deepEqual(without.actions, [])
  assert.equal(without.note, 'noteNotInBuild')
  assert.equal(without.version, '0.2.0')

  const withSpec = cardFor({ ...entry, spec: '@local/pkg-a' }, undefined, { text })
  assert.equal(withSpec.state, 'missing')
  assert.deepEqual(withSpec.actions, [{ kind: 'install', enabled: true }])
  assert.equal(withSpec.spec, '@local/pkg-a')
})

test('an unselected profile dependency offers enable, remove and open', () => {
  const card = cardFor(entry, { ...selected, enabled: false, installed: true, removable: true }, { text })
  assert.equal(card.state, 'off')
  assert.deepEqual(card.actions.map(action => action.kind), ['enable', 'remove', 'open'])
  assert.equal(card.note, undefined)
})

test('a build-carried bundle never offers removal and says it follows the build', () => {
  const card = cardFor(entry, {
    name: '@local/pkg-a', version: '0.1.0', enabled: false, installed: false, removable: false, optional: true,
    availability: 'installation',
  }, { text })
  assert.equal(card.state, 'off')
  assert.deepEqual(card.actions.map(action => action.kind), ['enable', 'open'])
  assert.equal(card.note, 'noteBuildCarried')
  assert.equal(card.optional, true)
})

test('a selected build-carried bundle with the expected version reports it is shipped', () => {
  const card = cardFor(entry, {
    name: '@local/pkg-a', version: '0.2.0', enabled: true, installed: false, removable: false, optional: true,
    availability: 'installation',
  }, { text })
  assert.equal(card.state, 'on')
  assert.deepEqual(card.actions.map(action => action.kind), ['disable', 'open'])
  assert.equal(card.note, 'noteShipped')
})

test('a registry bundle offers the exact version the catalogue curates', () => {
  const card = cardFor(entry, { ...selected, version: '0.1.0', update: 'registry' }, { text })
  assert.deepEqual(card.actions[0], { kind: 'update', enabled: true, version: '0.2.0' })
  assert.equal(card.updateKind, 'registry')
  assert.equal(card.note, undefined)
})

test('the catalogue never offers an update the installed version already satisfies', () => {
  const card = cardFor(entry, { ...selected, update: 'registry' }, { text })
  assert.equal(card.actions.some(action => action.kind === 'update'), false)
  assert.equal(card.note, undefined)
})

test('a newer curated version that the registry cannot replace is only a note', () => {
  const card = cardFor(entry, { ...selected, version: '0.1.0' }, { text })
  assert.equal(card.actions.some(action => action.kind === 'update'), false)
  assert.equal(card.note, 'noteSourceUpdate')
})

test('a git bundle says it updates from its source and offers none', () => {
  const card = cardFor(entry, { ...selected, version: '0.1.0', update: 'git' }, { text })
  assert.equal(card.note, 'noteGitUpdate')
  assert.equal(card.actions.some(action => action.kind === 'update'), false)
})

test('a load error is reported verbatim and overrides the hint', () => {
  const card = cardFor(entry, {
    ...selected, error: { code: 'not-bundle', diagnostic: 'no bundle patch' },
  }, { text })
  assert.equal(card.error, 'not-bundle: no bundle patch')
  assert.equal(card.note, 'noteError')
  assert.equal(card.badge, 'badgeOn')
})

test('the market itself carries no management actions', () => {
  const card = cardFor({ ...entry, self: true }, undefined, { text })
  assert.equal(card.state, 'self')
  assert.deepEqual(card.actions, [])
  assert.equal(card.badge, 'badgeSelf')
})

test('buildMarketView keeps catalogue order and counts installed and enabled cards', () => {
  const catalog = [entry, { ...entry, name: '@local/pkg-b', version: '1.0.0' }, { ...entry, name: '@local/pkg-c' }]
  const view = buildMarketView({
    catalog,
    bundles: [
      selected,
      { ...selected, name: '@local/pkg-b', version: '1.0.0', enabled: false, removable: false, installed: false },
    ],
    text,
  })
  assert.deepEqual(view.cards.map(card => card.name), ['@local/pkg-a', '@local/pkg-b', '@local/pkg-c'])
  assert.deepEqual(view.counts, { total: 3, installed: 2, enabled: 1 })
  assert.equal(view.cards[0].title, 'Пакет A')
})

test('a card carries its popup copy and one searchable haystack', () => {
  const card = cardFor(entry, undefined, { text })
  assert.equal(card.about, 'Пакет A хорошо делает своё дело.')
  assert.deepEqual(card.points, ['Возможность альфа', 'Возможность бета'])
  assert.ok(card.search.includes('возможность бета'))
  assert.ok(card.search.includes('@local/pkg-a'))
  assert.equal(card.search, card.search.toLowerCase())
})

test('filterCards matches title, summary, popup copy and package name in any case', () => {
  const catalog = [
    entry,
    { ...entry, name: '@local/pkg-b', title: { en: 'Beta tool', ru: 'Инструмент Бета' }, summary: { en: 'Does B.', ru: 'Делает Б.' }, details: { about: { en: 'B.', ru: 'Б.' }, points: [{ en: 'Gamma', ru: 'Гамма' }] } },
  ]
  const view = buildMarketView({ catalog, bundles: [], text })
  assert.deepEqual(filterCards(view.cards, '').length, 2)
  assert.deepEqual(filterCards(view.cards, '   ').length, 2)
  assert.deepEqual(filterCards(view.cards, 'пакет a').map(card => card.name), ['@local/pkg-a'])
  assert.deepEqual(filterCards(view.cards, 'гамма').map(card => card.name), ['@local/pkg-b'])
  assert.deepEqual(filterCards(view.cards, 'pkg-b').map(card => card.name), ['@local/pkg-b'])
  assert.deepEqual(filterCards(view.cards, 'nothing-here'), [])
})
