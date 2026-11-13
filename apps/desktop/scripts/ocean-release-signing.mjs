/** Offline operator signing. No download, installation, key generation or publication. */
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto'
import { constants } from 'node:fs'
import { mkdir, open, readFile, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { prepareReleaseManifest, verifyReleaseManifest } from './ocean-release-manifest.mjs'

export const OCEAN_RELEASE_KEY_ID = 'ocean-electron-release-v1'
export const OCEAN_RELEASE_PUBLIC_KEY_SHA256 = '91f3e2aeb0880fa5ec0550ad5a76d99bec1496a92ff4b440fd449eaf39d7289f'

export async function loadOceanReleasePublicKey() {
  const pem = await readFile(new URL('./ocean-release-public-key.pem', import.meta.url))
  const key = createPublicKey(pem)
  const fingerprint = createHash('sha256').update(key.export({ type: 'spki', format: 'der' })).digest('hex')
  if (key.asymmetricKeyType !== 'ed25519' || fingerprint !== OCEAN_RELEASE_PUBLIC_KEY_SHA256) throw new Error('Ocean release trust pin mismatch')
  return { key, pem, fingerprint }
}

/** Production wrapper: callers cannot supply a replacement publisher key. */
export async function verifyOceanRelease(options, now = Date.now()) {
  const { pem } = await loadOceanReleasePublicKey()
  return verifyReleaseManifest({ ...options, publicKey: pem }, now)
}

async function readPrivateKey(path) {
  if (!isAbsolute(path)) throw new Error('Private key path must be absolute')
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  let bytes
  try {
    const stat = await file.stat()
    if (!stat.isFile() || stat.nlink !== 1 || stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0) throw new Error('Unsafe private key ownership or permissions')
    if (stat.size < 1 || stat.size > 16384) throw new Error('Invalid private key file size')
    bytes = Buffer.alloc(stat.size + 1)
    let used = 0
    while (used < bytes.length) {
      const { bytesRead } = await file.read(bytes, used, bytes.length - used, null)
      if (!bytesRead) break
      used += bytesRead
    }
    if (used !== stat.size) throw new Error('Private key file changed')
    const key = createPrivateKey(bytes.subarray(0, used))
    if (key.asymmetricKeyType !== 'ed25519') throw new Error('Expected Ed25519 private key')
    return key
  } finally {
    bytes?.fill(0)
    await file.close()
  }
}

/** Generic testable signer; the CLI always supplies the fixed Ocean public pin.
 * Writes only public metadata/signature to a NEW output directory. A partial output
 * after an I/O failure is not a release; no caller uploads or activates it here.
 */
export async function signLocalRelease(options, trustedPublicKey, now = Date.now()) {
  if (!isAbsolute(options.artifactPath) || !isAbsolute(options.outputDirectory)) throw new Error('Artifact and output paths must be absolute')
  const key = await readPrivateKey(options.privateKeyPath)
  const expected = createPublicKey(trustedPublicKey).export({ type: 'spki', format: 'der' })
  const actual = createPublicKey(key).export({ type: 'spki', format: 'der' })
  if (!actual.equals(expected)) throw new Error('Private key does not match the trusted publisher')
  const bytes = await prepareReleaseManifest({ ...options, artifact: basename(options.artifactPath) }, now)
  const signature = sign(null, bytes, key)
  const verified = await verifyReleaseManifest({ bytes, signature, publicKey: trustedPublicKey, artifactPath: options.artifactPath, target: options.target, channel: options.channel, minimumSequence: options.sequence }, now)
  await mkdir(options.outputDirectory, { mode: 0o700 })
  await writeFile(join(options.outputDirectory, 'manifest.json'), bytes, { flag: 'wx', mode: 0o600 })
  await writeFile(join(options.outputDirectory, 'manifest.sig'), signature, { flag: 'wx', mode: 0o600 })
  return verified
}

async function main() {
  const args = process.argv.slice(2)
  const allowed = new Set(['artifact', 'private-key', 'output', 'version', 'sequence', 'channel', 'target', 'created-at', 'expires-at'])
  const values = {}
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i]?.startsWith('--') ? args[i].slice(2) : ''
    const value = args[i + 1]
    if (!allowed.has(flag) || Object.hasOwn(values, flag) || !value || value.startsWith('--')) throw new Error('Invalid arguments')
    values[flag] = value
  }
  if (Object.keys(values).length !== allowed.size || !/^[1-9]\d*$/.test(values.sequence)) throw new Error('Missing or invalid arguments')
  const { pem } = await loadOceanReleasePublicKey()
  const result = await signLocalRelease({ artifactPath: values.artifact, privateKeyPath: values['private-key'], outputDirectory: values.output, version: values.version, sequence: Number(values.sequence), channel: values.channel, target: values.target, createdAt: values['created-at'], expiresAt: values['expires-at'] }, pem)
  console.log(JSON.stringify({ signed: true, keyId: OCEAN_RELEASE_KEY_ID, publicKeySha256: OCEAN_RELEASE_PUBLIC_KEY_SHA256, version: result.version, target: result.target, sequence: result.sequence, published: false }))
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(() => {
    // Do not log parser/crypto errors, key bytes, arguments or filesystem contents.
    console.error('Signing refused. Check arguments, key ownership, trusted key, artifact and new output directory.')
    process.exitCode = 1
  })
}
