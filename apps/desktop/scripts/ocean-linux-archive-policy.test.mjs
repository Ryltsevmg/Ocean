import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planLinuxArchive } from './ocean-linux-archive-policy.mjs'

const bin = 'resources/runtime/primary-runtime/dependencies/python/bin/'
const file = (path, size = 1) => ({ path, type: 'file', size })
const link = (path, linkpath) => ({ path, type: 'symlink', size: 0, linkpath })
const limits = { maxEntries: 100, maxExpandedBytes: 1024 }
const payload = () => [file('ocean'), file(`${bin}python3.12`, 8), link(`${bin}python`, 'python3.12'), link(`${bin}python3`, 'python3.12')]

test('Python aliases are delayed until their regular interpreter is materialized', () => {
  const entries = payload().reverse()
  const before = structuredClone(entries)
  const plan = planLinuxArchive(entries, limits)
  assert.equal(plan.expandedBytes, 9)
  assert.equal(plan.links.length, 2)
  assert.ok(plan.links.every(entry => entry.target === `${bin}python3.12`))
  assert.equal(plan.files.length, 2)
  assert.deepEqual(entries, before)
})

test('archive paths cannot address absolute profiles, traverse parents or alias existing paths', () => {
  for (const path of ['../profile', '/home/user/.config/Ocean', 'a/../../profile', 'a/./b', 'a//b', 'a\\b', 'C:profile', '', 'a\0b', 'a\nb', 'a/']) {
    assert.throws(() => planLinuxArchive([file(path)], limits), /path/)
  }
  assert.throws(() => planLinuxArchive([file('a'), file('a')], limits), /Duplicate/)
  assert.throws(() => planLinuxArchive([file('a/b'), file('a')], limits), /ancestor/)
})

test('only exact runtime aliases to an included regular interpreter are accepted', () => {
  for (const target of ['/usr/bin/python3', '../../outside', 'python', 'python3', 'python3.12/child', 'python3.12\0']) {
    assert.throws(() => planLinuxArchive([file(`${bin}python3.12`), link(`${bin}python`, target)], limits))
  }
  assert.throws(() => planLinuxArchive([link(`${bin}python`, 'python3.12')], limits), /regular/)
  assert.throws(() => planLinuxArchive([file(`${bin}python3.12`), link('elsewhere/python', 'python3.12')], limits), /alias/)
  assert.throws(() => planLinuxArchive([...payload(), file(`${bin}python/child`)], limits), /ancestor/)
  assert.throws(() => planLinuxArchive([link(`${bin}python`, 'python3.12'), link(`${bin}python3.12`, 'python')], limits))
})

test('hardlinks, special entries, duplicate directories and expansion overflow fail closed', () => {
  for (const type of ['hardlink', 'fifo', 'character-device', 'block-device', 'socket', 'unknown']) {
    assert.throws(() => planLinuxArchive([{ path: 'a', type, size: 0, linkpath: 'ocean' }], limits))
  }
  assert.throws(() => planLinuxArchive([file('a', 1025)], limits), /limit/)
  assert.throws(() => planLinuxArchive([file('a', 700), file('b', 700)], limits), /limit/)
  assert.throws(() => planLinuxArchive([file('a')], { ...limits, maxEntries: 0 }), /limit/)
  assert.throws(() => planLinuxArchive([file('a'), file('b')], { ...limits, maxEntries: 1 }), /limit/)
  for (const size of [-1, NaN, 0.5, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => planLinuxArchive([file('a', size)], limits))
  assert.throws(() => planLinuxArchive([{ path: 'a', type: 'directory', size: 1 }], limits))
  assert.throws(() => planLinuxArchive([{ path: 'a/', type: 'directory', size: 0 }, { path: 'a', type: 'directory', size: 0 }], limits), /Duplicate/)
})

test('runtime aliases cannot select different interpreter versions', () => {
  assert.throws(() => planLinuxArchive([file(`${bin}python3.12`), file(`${bin}python3.13`), link(`${bin}python`, 'python3.12'), link(`${bin}python3`, 'python3.13')], limits), /share/)
  assert.throws(() => planLinuxArchive([file(`${bin}python3.12`, 0), link(`${bin}python`, 'python3.12')], limits), /regular/)
})

test('malformed Unicode cannot alias distinct metadata paths on Linux', () => {
  for (const path of ['a\ud800', 'a\ud801', 'a\udc00']) {
    assert.throws(() => planLinuxArchive([file(path)], limits), /path/)
  }
  assert.equal(planLinuxArchive([file('valid-😀')], limits).files[0].path, 'valid-😀')
})

test('entry limit includes inferred parent directories without double counting explicit parents', () => {
  assert.throws(() => planLinuxArchive([file('a/b/c')], { ...limits, maxEntries: 2 }), /limit/)
  assert.equal(planLinuxArchive([file('a/b/c')], { ...limits, maxEntries: 3 }).directories.length, 2)
  assert.equal(planLinuxArchive([{ path: 'a', type: 'directory', size: 0 }, file('a/b')], { ...limits, maxEntries: 2 }).directories.length, 1)
})
