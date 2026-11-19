/** Published list receipt and URL-free install intent. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { installTarget, readPublishedCatalog } from '../src/catalog.js'

const release = { name: '@ocean/approved', version: '1.0.0', title: 'Approved', description: 'An approved release.', sha256: '1'.repeat(64), compatible: true }

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

test('a published install passes only the exact identity and display title', () => {
  const { name, version, title, sha256 } = release
  assert.deepEqual(installTarget({ ...release, url: 'https://example.test/archive.tgz' }), { name, version, title, sha256 })
})
