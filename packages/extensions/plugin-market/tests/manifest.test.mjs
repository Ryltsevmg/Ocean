/** The bundle manifest matches what Ocean reads: patch row, client face, locales, icons. */
import assert from 'node:assert/strict'
import { access, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const metadataLanguages = ['de', 'en', 'es', 'fr', 'ja', 'pt', 'ru', 'zh']

/** Resolve one export target inside the package. */
async function exists(path) {
  try {
    await access(join(root, path))
    return true
  } catch {
    return false
  }
}

test('the manifest names the bundle row and the patch that mounts it', async () => {
  assert.equal(pkg.name, '@ocean/ocean-plugin-market')
  assert.equal(pkg.private, undefined)
  assert.equal(pkg.publishConfig.access, 'public')
  assert.equal(pkg.type, 'module')
  for (const key of ['ocean']) {
    assert.equal(pkg[key].bundle.patch, './cordis.patch.yml', `${key}.bundle.patch`)
    assert.equal(pkg[key].client.platform, 'web', `${key}.client.platform`)
    assert.ok(pkg[key].client.inject.includes('@ocean/ocean-api-remotes'), `${key}.client.inject needs api-remotes`)
    assert.ok(pkg[key].client.inject.includes('@ocean/ocean-client-ui-plugin-manager'), `${key}.client.inject needs the manager`)
  }
  assert.ok(await exists('./cordis.patch.yml'))
  const patch = await readFile(join(root, 'cordis.patch.yml'), 'utf8')
  assert.match(patch, /- id: ocean-plugin-market/u)
  assert.ok(patch.includes(`name: '${pkg.name}'`), 'the patch row must name this package')
})

test('the manifest requires the shipped Ocean runtime', async () => {
  // A release bump raises this range to the repository's line; a stale pin disables the bundle at startup.
  const root = JSON.parse(await readFile(new URL('../../../../package.json', import.meta.url), 'utf8'))
  const { satisfies } = await import('semver')
  assert.equal(satisfies(root.version, pkg.engines.ocean), true, `${root.version} must satisfy ${pkg.engines.ocean}`)
})

test('every source export target exists', async () => {
  const targets = []
  for (const [subpath, target] of Object.entries(pkg.exports)) {
    if (subpath.includes('*')) continue
    targets.push(typeof target === 'string' ? target : target.default)
  }
  for (const target of targets.filter(target => !target.startsWith('./lib/'))) assert.ok(await exists(target), `missing export target ${target}`)
  const locales = await readdir(join(root, 'locale'))
  assert.deepEqual(locales.filter(name => name.endsWith('.json')).sort(), metadataLanguages.map(language => `${language}.json`))
})

test('the packaged files include the generated browser half and the catalogue', () => {
  for (const entry of ['lib/index.js', 'lib/client.js', 'src', 'cordis.patch.yml', 'icon.svg', 'docs']) {
    assert.ok(pkg.files.includes(entry), `files must ship ${entry}`)
  }
})

test('each locale describes the bundle and links an existing detail document', async () => {
  for (const language of metadataLanguages) {
    const locale = JSON.parse(await readFile(join(root, 'locale', `${language}.json`), 'utf8'))
    assert.ok(locale.meta.title.length > 0)
    assert.ok(locale.meta.description.length > 0)
    assert.ok(await exists(locale.meta.detail), `${language} detail ${locale.meta.detail} must exist`)
  }
})
