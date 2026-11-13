/** Offline Linux release metadata. This module never downloads, installs, or restarts Ocean. */
import { createHash, createPublicKey, verify } from 'node:crypto'
import { constants } from 'node:fs'
import { open } from 'node:fs/promises'

const MAX_MANIFEST_BYTES = 16_384
const MAX_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000
const fields = ['format', 'product', 'version', 'sequence', 'channel', 'target', 'createdAt', 'expiresAt', 'artifact', 'size', 'sha256']

function validate(manifest, now) {
  if (!Number.isFinite(now) || now < 0) throw new Error('Invalid validation time')
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Invalid manifest')
  if (Object.keys(manifest).length !== fields.length || fields.some(key => !Object.hasOwn(manifest, key))) throw new Error('Unexpected manifest fields')
  if (manifest.format !== 1 || manifest.product !== 'Ocean') throw new Error('Wrong product or format')
  if (typeof manifest.version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(manifest.version)) throw new Error('Invalid version')
  if (!Number.isSafeInteger(manifest.sequence) || manifest.sequence < 1) throw new Error('Invalid sequence')
  if (!['stable', 'nightly'].includes(manifest.channel)) throw new Error('Invalid channel')
  if (!['linux-x64', 'linux-arm64'].includes(manifest.target)) throw new Error('Invalid target')
  if (typeof manifest.artifact !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.tar\.gz$/.test(manifest.artifact)) throw new Error('Invalid artifact basename')
  if (!Number.isSafeInteger(manifest.size) || manifest.size < 1) throw new Error('Invalid artifact size')
  if (typeof manifest.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.sha256)) throw new Error('Invalid SHA-256')
  const created = Date.parse(manifest.createdAt)
  const expires = Date.parse(manifest.expiresAt)
  if (typeof manifest.createdAt !== 'string' || typeof manifest.expiresAt !== 'string' || !Number.isFinite(created) || !Number.isFinite(expires) || new Date(created).toISOString() !== manifest.createdAt || new Date(expires).toISOString() !== manifest.expiresAt) throw new Error('Invalid timestamps')
  if (expires <= created || expires - created > MAX_LIFETIME_MS || created > now || expires <= now) throw new Error('Expired or future manifest')
}

/** Hash an already opened, regular artifact without following its final symlink.
 * @param {string} path Local artifact path.
 * @param {number | undefined} expectedSize Signed byte count, when verifying.
 * @returns {Promise<{size: number, sha256: string}>} Observed byte count and digest, not an installation authorization.
 */
export async function hashReleaseArtifact(path, expectedSize = undefined) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const stat = await file.stat()
    if (!stat.isFile() || stat.size < 1) throw new Error('Artifact must be a nonempty regular file')
    if (expectedSize !== undefined && stat.size !== expectedSize) throw new Error('Artifact integrity mismatch: size')
    const hash = createHash('sha256')
    let size = 0
    for await (const chunk of file.createReadStream({ autoClose: false })) {
      size += chunk.length
      if (size > stat.size) throw new Error('Artifact grew while hashing')
      hash.update(chunk)
    }
    if (size !== stat.size) throw new Error('Artifact changed while hashing')
    return { size, sha256: hash.digest('hex') }
  } finally { await file.close() }
}

/** Create canonical unsigned metadata for separate offline signing.
 * @param {object} options Release fields excluding format/product/size/digest, plus artifactPath.
 * @param {number} now Validation time in milliseconds.
 * @returns {Promise<Buffer>} Exact bytes to sign with Ed25519, not a signed release.
 */
export async function prepareReleaseManifest(options, now = Date.now()) {
  const { artifactPath, version, sequence, channel, target, createdAt, expiresAt, artifact } = options
  const digest = await hashReleaseArtifact(artifactPath)
  const manifest = { format: 1, product: 'Ocean', version, sequence, channel, target, createdAt, expiresAt, artifact, ...digest }
  validate(manifest, now)
  const bytes = Buffer.from(JSON.stringify(manifest))
  if (bytes.length > MAX_MANIFEST_BYTES) throw new Error('Manifest exceeds byte limit')
  return bytes
}

/** Verify a signed manifest and local archive against independently trusted deployment settings.
 * @param {object} options Exact manifest bytes, detached signature bytes, trusted publicKey, artifactPath, target, channel, and minimumSequence (last accepted sequence plus one).
 * @param {number} now Validation time in milliseconds.
 * @returns {Promise<object>} Authenticated metadata only; callers must reverify at installation and protect profile compatibility separately.
 */
export async function verifyReleaseManifest(options, now = Date.now()) {
  const { bytes, signature, publicKey, artifactPath, target, channel, minimumSequence } = options
  if (!Buffer.isBuffer(bytes) || bytes.length > MAX_MANIFEST_BYTES || !Buffer.isBuffer(signature) || signature.length !== 64) throw new Error('Invalid signed envelope')
  const key = createPublicKey(publicKey)
  if (key.asymmetricKeyType !== 'ed25519' || !verify(null, bytes, key, signature)) throw new Error('Invalid release signature')
  const manifest = JSON.parse(bytes.toString('utf8'))
  if (JSON.stringify(manifest) !== bytes.toString('utf8')) throw new Error('Noncanonical manifest')
  validate(manifest, now)
  if (!Number.isSafeInteger(minimumSequence) || minimumSequence < 1 || manifest.sequence < minimumSequence) throw new Error('Release replay or invalid minimum sequence')
  if (manifest.target !== target || manifest.channel !== channel) throw new Error('Wrong release target or channel')
  const digest = await hashReleaseArtifact(artifactPath, manifest.size)
  if (digest.size !== manifest.size || digest.sha256 !== manifest.sha256) throw new Error('Artifact integrity mismatch')
  return manifest
}
