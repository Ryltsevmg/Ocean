import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const root = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'))
test('Ocean-scoped vendored package follows the shared packed runtime version', () => {
  assert.equal(manifest.version, root.version)
  assert.equal(manifest.oceanUpstream.version, '3.2.13')
  assert.equal(manifest.oceanUpstream.commit, 'fb37c50a128aed84b230c520bf934cded97d851b')
  assert.equal(manifest.oceanUpstream.repository, 'https://github.com/WSL043/dsh-codex-subscription')
})
