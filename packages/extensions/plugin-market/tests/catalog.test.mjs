/** Published list receipt and URL-free install intent. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { installTarget, readPublishedCatalog } from '../src/catalog.js'

const release = {
  name: '@ocean/approved', version: '1.0.0', title: { en: 'Approved', ru: 'Одобрено' },
  description: { en: 'An approved release.', ru: 'Одобренный выпуск.' }, sha256: '1'.repeat(64), compatible: true,
}
/** Resolve offer text as the named active locale would, falling back to English. */
const resolver = locale => text => typeof text === 'string' ? text : text[locale] ?? text.en

test('fresh and cached Host lists retain their distinct statuses, including an empty cached list', () => {
  const ready = { status: 'ready', plugins: [release] }
  const stale = { status: 'stale', plugins: [] }
  assert.deepEqual(readPublishedCatalog(ready), ready)
  assert.deepEqual(readPublishedCatalog(stale), stale)
})

test('an unavailable or unknown response cannot become a usable list', () => {
  for (const value of [undefined, { status: 'unavailable', plugins: [release] }, { status: 'ready' }, { status: 'other', plugins: [release] }]) {
    assert.deepEqual(readPublishedCatalog(value), { status: 'unavailable' })
  }
})

test('a published install passes only the exact identity and the active-language display title', () => {
  const { name, version, sha256 } = release
  assert.deepEqual(installTarget({ ...release, url: 'https://example.test/archive.tgz' }, resolver('en')), { name, version, title: 'Approved', sha256 })
  assert.deepEqual(installTarget(release, resolver('ru')), { name, version, title: 'Одобрено', sha256 })
})

test('a plain-string title stays verbatim and a missing translation falls back to English', () => {
  const { name, version, sha256 } = release
  assert.deepEqual(installTarget({ ...release, title: 'Literal title' }, resolver('ru')), { name, version, title: 'Literal title', sha256 })
  assert.deepEqual(installTarget(release, resolver('zh')), { name, version, title: 'Approved', sha256 })
})
