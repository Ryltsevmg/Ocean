/** Behaviour of the pure card projection: what each state offers and why. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMarketView, cardFor, compareVersions, filterCards } from '../src/view.js'

/** Resolve catalogue strings the way the browser does: the active language, then English. */
const text = localized => typeof localized === 'string' ? localized : localized.ru ?? localized.en

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
  availability: 'profile',
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
  assert.equal(compareVersions('2.0.0', '1.9.0+build.3'), 1)
  assert.equal(compareVersions('1.0.0-1', '1.0.0-0beta'), -1)
  assert.equal(compareVersions('not-a-version', '1.0.0'), 0)
})

test('a curated description cannot supply an automatic install target', () => {
  const card = cardFor({ ...entry, spec: 'link:/someone-elses-checkout' }, undefined, { text })
  assert.equal(card.state, 'missing')
  assert.deepEqual(card.actions, [{ kind: 'installForm', spec: entry.name }])
  assert.equal(card.note, 'noteNoSource')
  assert.equal(card.version, undefined)
})

const onDemand = {
  name: entry.name, enabled: false, installed: false, official: true, removable: false, optional: false,
  availability: 'missing', installTarget: { spec: '@local/pkg-a@0.3.0', version: '0.3.0' }, rows: [], overrides: [],
}

test('a supported official on-demand bundle uses the exact target from the Host', () => {
  const card = cardFor(entry, onDemand, { text })
  assert.equal(card.state, 'missing')
  assert.deepEqual(card.actions, [{ kind: 'installOfficial' }])
  assert.equal(card.version, '0.3.0')
})

test('a Host refusal does not offer another way to install an unsupported bundle', () => {
  const card = cardFor(entry, { ...onDemand, error: { code: 'unsupported-platform' } }, { text })
  assert.deepEqual(card.actions, [])
  assert.equal(card.error, 'unsupported-platform')
})

test('a broken selected dependency retains its diagnostic and recovery actions', () => {
  const card = cardFor(entry, {
    ...selected, availability: 'missing', version: undefined, source: 'link:/packages/pkg-a',
    error: { code: 'operation-error', diagnostic: 'package directory is missing' },
  }, { text })
  assert.equal(card.state, 'broken')
  assert.equal(card.version, undefined)
  assert.deepEqual(card.actions, [{ kind: 'disable' }, { kind: 'remove' }, { kind: 'open' }])
  assert.equal(card.error, 'operation-error: package directory is missing')
  assert.equal(card.note, 'noteBroken')
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
  assert.deepEqual(card.actions[0], { kind: 'update', version: '0.2.0' })
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
  assert.equal(card.badge, 'badgeBlocked')
  assert.equal(card.enabled, false)
  assert.deepEqual(card.actions.map(action => action.kind), ['disable', 'remove', 'open'])
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

test('buildMarketView appends installed bundles the catalogue does not name', () => {
  const view = buildMarketView({
    catalog: [entry],
    bundles: [
      selected,
      {
        name: '@acme/ocean-sidebar', listedByDefault: false, version: '1.0.0', enabled: true, installed: true, official: false,
        availability: 'profile', removable: true, optional: false, rows: [], overrides: [],
        meta: { title: { en: 'Acme sidebar', ru: 'Боковая панель Acme' }, description: { en: 'Adds a sidebar.', ru: 'Добавляет боковую панель.' } },
      },
    ],
    text,
  })
  assert.deepEqual(view.cards.map(card => card.name), ['@local/pkg-a', '@acme/ocean-sidebar'])
  assert.equal(view.cards[1].title, 'Боковая панель Acme')
  assert.equal(view.cards[1].summary, 'Добавляет боковую панель.')
  assert.equal(view.cards[1].state, 'on')
  assert.deepEqual(view.counts, { total: 2, installed: 2, enabled: 2 })
})

test('buildMarketView adds an official optional bundle the catalogue does not name', () => {
  const view = buildMarketView({
    catalog: [entry],
    bundles: [{
      name: '@ocean/ocean-subagent-other', version: '1.0.0', enabled: false, installed: false, official: true,
      availability: 'installation', removable: false, optional: true, rows: [], overrides: [],
      meta: { title: { en: 'Other subagent', ru: 'Другой субагент' } },
    }],
    text,
  })
  assert.deepEqual(view.cards.map(card => card.name), ['@local/pkg-a', '@ocean/ocean-subagent-other'])
  assert.equal(view.cards[1].state, 'off')
  assert.deepEqual(view.cards[1].actions.map(action => action.kind), ['enable', 'open'])
  assert.equal(view.cards[1].note, 'noteShipped')
})

test('the two official native subagents stay out of this catalogue', () => {
  const subagent = {
    version: '1.0.0', enabled: true, installed: true, official: true, availability: 'installation',
    removable: false, optional: true, rows: [], overrides: [],
  }
  const view = buildMarketView({
    catalog: [entry],
    bundles: [selected, { ...subagent, name: '@ocean/ocean-subagent-codex' }, { ...subagent, name: '@ocean/ocean-subagent-claude-code' }],
    text,
  })
  assert.deepEqual(view.cards.map(card => card.name), ['@local/pkg-a'])
})

test('an entry matches a provided bundle name and acts on it', () => {
  const view = buildMarketView({
    catalog: [{ ...entry, aliases: ['@local/pkg-a-alt'] }],
    bundles: [{ ...selected, name: '@local/pkg-a-alt' }],
    text,
  })
  assert.equal(view.cards[0].id, '@local/pkg-a')
  assert.equal(view.cards[0].name, '@local/pkg-a-alt')
  assert.equal(view.cards[0].state, 'on')
  assert.equal(view.cards[0].version, '0.2.0')
})

test('a theme palette never becomes a card of its own', () => {
  const view = buildMarketView({
    catalog: [entry],
    bundles: [
      selected,
      {
        name: '@local/ocean-theme-dracula', version: '1.0.0', enabled: true, installed: true, official: true,
        availability: 'profile', removable: true, optional: false, rows: [], overrides: [],
      },
    ],
    text,
  })
  assert.deepEqual(view.cards.map(card => card.name), ['@local/pkg-a'])
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


test('a usable alternate wins over a selected, unreadable primary without changing card identity', () => {
  const { cards, counts } = buildMarketView({
    catalog: [{ ...entry, aliases: ['@local/pkg-a-alt'] }],
    bundles: [
      { ...selected, availability: 'missing', error: { code: 'operation-error' } },
      { ...selected, name: '@local/pkg-a-alt', enabled: false, version: undefined },
    ],
    text,
  })
  assert.deepEqual(cards.map(({ id, name, state }) => [id, name, state]), [[entry.name, '@local/pkg-a-alt', 'off']])
  assert.deepEqual(cards[0].actions.map(action => action.kind), ['enable', 'remove', 'open'])
  assert.deepEqual(counts, { total: 1, installed: 1, enabled: 0 })
})

test('selected missing dependencies remain visible without adding internal components or the base profile', () => {
  const broken = { ...selected, availability: 'missing', installed: false, version: undefined, error: { code: 'not-bundle' } }
  const { cards } = buildMarketView({
    catalog: [],
    bundles: [broken, { ...selected, name: '@ocean/ocean-experimental-tool-worktree' },
      { ...selected, name: '@ocean/ocean-base', availability: 'installation', installed: false, removable: false }],
    text,
  })
  assert.deepEqual(cards.map(({ name, state, version }) => [name, state, version]), [[entry.name, 'broken', undefined]])
})
