import { test } from 'node:test'
import { execFileSync, spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { createPrivateKey, createPublicKey, sign } from 'node:crypto'
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prepareReleaseManifest, verifyReleaseManifest, hashReleaseArtifact } from './ocean-release-manifest.mjs'

// Public RFC 8032 test vector. Never a production signing key or persistent credential.
const key = createPrivateKey({ key: Buffer.from('302e020100300506032b6570042204209d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60', 'hex'), format: 'der', type: 'pkcs8' })
const publicKey = createPublicKey(key).export({ format: 'pem', type: 'spki' })
const now = Date.parse('2026-11-12T12:00:00.000Z')

test('offline release verification rejects tampering, replay and incompatible destinations', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'ocean-release-test-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const artifactPath = join(dir, 'Ocean.tar.gz')
  await writeFile(artifactPath, 'test fixture, not a real archive')
  const metadata = { artifactPath, artifact: 'Ocean.tar.gz', version: '0.2.2-rc.2', sequence: 4, channel: 'nightly', target: 'linux-arm64', createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 60000).toISOString() }
  await assert.rejects(prepareReleaseManifest({ ...metadata, version: '1.2.3+' + 'a'.repeat(16384) }, now), /byte limit/)
  const bytes = await prepareReleaseManifest(metadata, now)
  const options = { bytes, signature: sign(null, bytes, key), publicKey, artifactPath, target: metadata.target, channel: metadata.channel, minimumSequence: 4 }
  assert.equal((await verifyReleaseManifest(options, now)).sequence, 4)
  for (const patch of [{ target: 'linux-x64' }, { channel: 'stable' }, { minimumSequence: 5 }, { minimumSequence: 0 }, { signature: Buffer.alloc(64) }, { bytes: Buffer.from(bytes.toString().replace('Ocean', 'Other')) }]) {
    await assert.rejects(verifyReleaseManifest({ ...options, ...patch }, now))
  }
  await assert.rejects(verifyReleaseManifest(options, NaN), /validation time/)
  await assert.rejects(verifyReleaseManifest(options, now + 60000), /Expired/)
  await assert.rejects(verifyReleaseManifest(options, now - 1), /future/)
  for (const patch of [{ artifact: '../Ocean.tar.gz' }, { expiresAt: new Date(now + 8 * 86400000).toISOString() }, { sequence: 0 }, { target: 'win-x64' }]) await assert.rejects(prepareReleaseManifest({ ...metadata, ...patch }, now))
  const noncanonical = Buffer.from(JSON.stringify(JSON.parse(bytes), null, 2))
  await assert.rejects(verifyReleaseManifest({ ...options, bytes: noncanonical, signature: sign(null, noncanonical, key) }, now), /Noncanonical/)
  for (const patch of [{ version: '01.2.3' }, { version: '1.2.3-..' }, { product: 'Other' }, { format: 2 }, { extra: true }, { size: -1 }, { sha256: 'a' }, { createdAt: 'invalid' }]) {
    const invalid = Buffer.from(JSON.stringify({ ...JSON.parse(bytes), ...patch }))
    await assert.rejects(verifyReleaseManifest({ ...options, bytes: invalid, signature: sign(null, invalid, key) }, now))
  }
  await assert.rejects(verifyReleaseManifest({ ...options, bytes: Buffer.alloc(16385) }, now), /envelope/)
  await writeFile(artifactPath, 'Test fixture, not a real archive')
  await assert.rejects(verifyReleaseManifest(options, now), /^Error: Artifact integrity mismatch$/)
  await writeFile(artifactPath, 'tampered')
  await assert.rejects(verifyReleaseManifest(options, now), /integrity/)
  const link = join(dir, 'link.tar.gz')
  await symlink(artifactPath, link)
  await assert.rejects(hashReleaseArtifact(link))
  await assert.rejects(hashReleaseArtifact(dir))
  if (process.platform === 'linux') {
    const fifo = join(dir, 'fifo.tar.gz')
    execFileSync('mkfifo', [fifo])
    const moduleUrl = new URL('./ocean-release-manifest.mjs', import.meta.url).href
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', `import { hashReleaseArtifact } from ${JSON.stringify(moduleUrl)}; try { await hashReleaseArtifact(${JSON.stringify(fifo)}); process.exitCode = 1 } catch { process.exitCode = 0 }`], { timeout: 2000 })
    assert.ifError(child.error)
    assert.equal(child.status, 0, 'FIFO is rejected without waiting for a writer')
  }
})
