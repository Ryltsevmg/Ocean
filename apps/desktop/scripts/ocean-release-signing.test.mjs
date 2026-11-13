import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { generateKeyPairSync, createHash } from 'node:crypto'
import { mkdtemp, writeFile, readFile, chmod, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { signLocalRelease, loadOceanReleasePublicKey, verifyOceanRelease } from './ocean-release-signing.mjs'
import { verifyReleaseManifest } from './ocean-release-manifest.mjs'

async function fixture(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'ocean-signing-test-'))
  const pair = generateKeyPairSync('ed25519')
  const privateKeyPath = join(dir, 'key.pem')
  const artifactPath = join(dir, 'ocean-test.tar.gz')
  const publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' })
  await writeFile(privateKeyPath, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })
  await writeFile(artifactPath, 'Synthetic artifact; never a release')
  const now = Date.now()
  const options = { privateKeyPath, artifactPath, outputDirectory: join(dir, 'signed'), version: '1.0.0-test', sequence: 1, channel: 'nightly', target: 'linux-x64', createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 60000).toISOString() }
  try { await fn({ dir, publicKey, options, now }) } finally { await rm(dir, { recursive: true, force: true }) }
}

test('public pin is Ed25519 and has the expected fingerprint', async () => {
  const { key, fingerprint } = await loadOceanReleasePublicKey()
  assert.equal(key.asymmetricKeyType, 'ed25519')
  assert.equal(fingerprint, createHash('sha256').update(key.export({ type: 'spki', format: 'der' })).digest('hex'))
})
test('sign and verify a synthetic release; reject modified bytes', () => fixture(async ({ publicKey, options, now }) => {
  await signLocalRelease(options, publicKey, now)
  const bytes = await readFile(join(options.outputDirectory, 'manifest.json'))
  const signature = await readFile(join(options.outputDirectory, 'manifest.sig'))
  const check = { bytes, signature, publicKey, artifactPath: options.artifactPath, target: options.target, channel: options.channel, minimumSequence: 1 }
  assert.equal((await verifyReleaseManifest(check, now)).version, options.version)
  await assert.rejects(verifyOceanRelease(check, now), /Invalid release signature/)
  await assert.rejects(verifyReleaseManifest({ ...check, bytes: Buffer.concat([bytes, Buffer.from(' ')]) }, now))
  await writeFile(options.artifactPath, 'Tampered payload')
  await assert.rejects(verifyReleaseManifest(check, now))
}))
test('refuses wrong key, loose permissions, symlink and existing output', () => fixture(async ({ dir, publicKey, options, now }) => {
  const wrong = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' })
  await assert.rejects(signLocalRelease(options, wrong, now), /does not match/)
  await chmod(options.privateKeyPath, 0o644)
  await assert.rejects(signLocalRelease(options, publicKey, now), /permissions/)
  await chmod(options.privateKeyPath, 0o600)
  const link = join(dir, 'link.pem'); await symlink(options.privateKeyPath, link)
  await assert.rejects(signLocalRelease({ ...options, privateKeyPath: link }, publicKey, now))
  await signLocalRelease(options, publicKey, now)
  const before = await readFile(join(options.outputDirectory, 'manifest.json'))
  await assert.rejects(signLocalRelease(options, publicKey, now))
  assert.deepEqual(await readFile(join(options.outputDirectory, 'manifest.json')), before)
}))

test('CLI refusal never logs key path or contents', () => fixture(async ({ options }) => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./ocean-release-signing.mjs', import.meta.url)),
    '--artifact', options.artifactPath, '--private-key', options.privateKeyPath,
    '--output', options.outputDirectory, '--version', options.version,
    '--sequence', String(options.sequence), '--channel', options.channel, '--target', options.target,
    '--created-at', options.createdAt, '--expires-at', options.expiresAt], { encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /^Signing refused\./)
  assert.equal(result.stderr.includes(options.privateKeyPath), false)
  assert.equal(result.stderr.includes('PRIVATE KEY'), false)
}))
