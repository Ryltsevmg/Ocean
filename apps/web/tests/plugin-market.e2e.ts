import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readProfileManifest } from '@ocean/ocean-app-boot'
import { chromium, type Page } from 'playwright'
import { create as createTar } from 'tar'
import { expect, it, onTestFinished } from 'vitest'
import { compareOrRefreshGolden, launchWebScaffold, watchConsole, webSnapshotMode } from './scaffold.ts'
import { newEnglishPage } from './support.ts'

const EXPECTED = fileURLToPath(new URL('./expected/plugin-market/', import.meta.url))
const INDEX = '/v1/current.json'
const EMPTY = 'No plugins have been published.'
const NAME = 'e2e-published-catalog-bundle'
const PRIVATE_NAME = 'e2e-private-catalog-bundle'
const VERSION = '1.2.3'
const TITLE = 'Approved fixture plugin'
const DESCRIPTION = 'A public install offer for the test catalogue.'
const DETAIL = '# Approved fixture plugin\n\nThe long description the catalogue details view renders.'
const ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzNiIgaGVpZ2h0PSIzNiI+PHJlY3Qgd2lkdGg9IjM2IiBoZWlnaHQ9IjM2IiBmaWxsPSIjNjc5RUZFIi8+PC9zdmc+'

async function bundle(dir: string, name: string, version: string, entry = false): Promise<void> {
  await mkdir(dir)
  await writeFile(join(dir, 'package.json'), JSON.stringify({
    name, version, ocean: { bundle: { patch: './cordis.patch.yml' } },
    ...entry ? { type: 'module', main: './index.js' } : {},
  }))
  await writeFile(join(dir, 'cordis.patch.yml'), entry ? `- insert:\n    - id: ${name}\n      name: ${name}\n` : '[]\n')
  if (entry) await writeFile(join(dir, 'index.js'), `export const name = ${JSON.stringify(name)}\nexport function apply() {}\n`)
}

async function catalogueFixture() {
  const scratch = await mkdtemp(join(tmpdir(), 'ocean-web-plugin-catalog-'))
  onTestFinished(() => rm(scratch, { recursive: true, force: true }))
  await bundle(join(scratch, 'package'), NAME, VERSION, true)
  const archiveFile = join(scratch, 'fixture.tgz')
  await createTar({ cwd: scratch, file: archiveFile, gzip: true, portable: true, noMtime: true }, ['package'])
  const bytes = await readFile(archiveFile)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const wrongDigest = `${sha256[0] === '0' ? '1' : '0'}${sha256.slice(1)}`
  const archivePath = (digest: string) => `/archives/${digest}/plugin.tgz`
  const archiveRequests: string[] = []
  let indexRequests = 0
  let index: { schemaVersion: 1; plugins: ReturnType<typeof offer>[] } | undefined = { schemaVersion: 1, plugins: [] }
  const server = createServer((request, response) => {
    if (request.method === 'GET' && request.url === INDEX) {
      indexRequests++
      if (index === undefined) {
        response.writeHead(503).end()
      } else {
        response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(index))
      }
    } else if (request.method === 'GET' && request.url?.startsWith('/archives/')) {
      archiveRequests.push(request.url)
      if (request.url === archivePath(sha256) || request.url === archivePath(wrongDigest)) {
        response.writeHead(200, { 'content-type': 'application/gzip' }).end(bytes)
      } else {
        response.writeHead(404).end()
      }
    } else {
      response.writeHead(404).end()
    }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  onTestFinished(() => server[Symbol.asyncDispose]())
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('The test catalogue has no TCP listener')
  const origin = `http://127.0.0.1:${address.port}`
  function offer(digest = sha256) {
    return {
      name: NAME, version: VERSION, title: TITLE, description: DESCRIPTION, icon: ICON, detail: { en: DETAIL },
      ocean: '*', archive: origin + archivePath(digest), sha256: digest,
    }
  }

  const overlay = join(scratch, 'catalogue.overlay.yml')
  const privateBundle = join(scratch, 'private-bundle')
  await writeFile(overlay, `- id: plugin-manager\n  config:\n    publishedCatalogUrl: ${origin}${INDEX}\n`)
  await bundle(privateBundle, PRIVATE_NAME, VERSION)
  const scaffold = await launchWebScaffold({
    extraOverlayPath: overlay,
    profile: {
      packages: [{ dir: privateBundle }],
      packageManager: {
        command: 'pnpm', args: [],
        env: {
          pnpm_config_store_dir: join(scratch, 'pnpm-store'),
          pnpm_config_cache_dir: join(scratch, 'pnpm-cache'),
          pnpm_config_offline: 'true',
        },
      },
    },
  })
  onTestFinished(() => scaffold.close())
  const browser = await chromium.launch()
  onTestFinished(() => browser.close())
  const page = await newEnglishPage(browser)
  const consoleWatch = watchConsole(page)
  await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
  await page.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name: 'Plugins', exact: true }).click()
  const panel = page.locator('[data-plugin-panel]')
  // Installed leads by default; these scenarios exercise the Catalogue tab.
  await panel.getByRole('tab', { name: 'Catalogue', exact: true }).click()
  const catalogue = panel.getByRole('tabpanel', { name: 'Catalogue', exact: true })
  const installed = panel.getByRole('tabpanel', { name: 'Installed', exact: true })
  const profileDir = join(scaffold.harnessHome, 'profiles', 'scaffold')
  return {
    page, consoleWatch, catalogue, installed, profileDir, bytes, archivePath, sha256, wrongDigest, archiveRequests,
    indexRequests: () => indexRequests,
    publish(plugins: ReturnType<typeof offer>[]) { index = { schemaVersion: 1, plugins } },
    takeOffline() { index = undefined },
    offer,
    openTab: async (name: 'Catalogue' | 'Installed') => panel.getByRole('tab', { name, exact: true }).click(),
    refresh: async () => catalogue.getByRole('button', { name: 'Refresh', exact: true }).click(),
  }
}

async function refusal(page: Page, reason: string): Promise<string[]> {
  const dialog = page.getByRole('dialog', { name: 'The plugin could not be installed', exact: true })
  const message = dialog.getByText(reason, { exact: true })
  await message.waitFor()
  expect(await dialog.getByRole('textbox', { name: 'Package name or address', exact: true }).count()).toBe(0)
  const snapshot = [await message.innerText(), await dialog.getByRole('button', { name: 'Retry', exact: true }).ariaSnapshot()]
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  return snapshot
}

it('installs only a published offer and leaves it installed after withdrawal', async () => {
  const f = await catalogueFixture()
  await f.openTab('Installed')
  const privateCard = f.installed.locator(`[data-plugin-package="${PRIVATE_NAME}"]`)
  await privateCard.waitFor()

  await f.openTab('Catalogue')
  const empty = f.catalogue.getByText(EMPTY, { exact: true })
  await empty.waitFor()
  expect(await f.catalogue.getByRole('article').count()).toBe(0)
  const emptyBeforePublication = await empty.innerText()
  const initialReads = f.indexRequests()
  expect(initialReads).toBeGreaterThan(0)

  f.publish([f.offer()])
  await f.refresh()
  const card = f.catalogue.getByRole('article')
  const heading = card.getByRole('heading', { name: TITLE, exact: true })
  await heading.waitFor()
  expect(await card.count()).toBe(1)
  expect(f.indexRequests()).toBeGreaterThan(initialReads)
  await card.getByText(DESCRIPTION, { exact: true }).waitFor()
  // The card carries the published artwork and the details view the long description.
  expect(await card.locator('img').first().getAttribute('src')).toBe(ICON)
  await card.getByRole('button', { name: 'Details', exact: true }).click()
  const details = f.page.getByRole('dialog', { name: TITLE, exact: true })
  await details.getByText('The long description the catalogue details view renders.').waitFor()
  await details.getByRole('button', { name: 'Close', exact: true }).click()
  await details.waitFor({ state: 'hidden' })
  const install = card.getByRole('button', { name: 'Install', exact: true })
  const offerAria = [await heading.ariaSnapshot(), await install.ariaSnapshot()]
  await install.click()
  const done = f.page.getByRole('dialog', { name: 'Installed', exact: true })
  const dismiss = done.getByRole('button', { name: 'Done', exact: true })
  await dismiss.waitFor({ timeout: 60_000 })
  expect(await done.getByRole('textbox', { name: 'Package name or address', exact: true }).count()).toBe(0)
  const doneAria = await dismiss.ariaSnapshot()
  await dismiss.click()
  await done.waitFor({ state: 'hidden' })
  expect(f.archiveRequests).toEqual([f.archivePath(f.sha256)])

  const manifestPath = join(f.profileDir, 'package.json')
  const installedPath = join(f.profileDir, 'node_modules', NAME, 'package.json')
  const approvedArchive = join(f.profileDir, 'published-plugins', f.sha256, 'plugin.tgz')
  const savedProfile = await readFile(manifestPath, 'utf8')
  const profile = readProfileManifest('web catalog test', f.profileDir)
  const spec = profile.dependencies?.[NAME]
  if (spec === undefined || !spec.startsWith('file:')) throw new Error(`Expected a local archive dependency, got ${String(spec)}`)
  expect(resolve(f.profileDir, spec.slice('file:'.length))).toBe(approvedArchive)
  expect(profile.ocean?.profile?.bundles).toContain(NAME)
  expect(await readFile(approvedArchive)).toEqual(f.bytes)
  const savedPackage = await readFile(installedPath, 'utf8')
  expect(JSON.parse(savedPackage)).toMatchObject({ name: NAME, version: VERSION, ocean: { bundle: { patch: './cordis.patch.yml' } } })
  const lockfile = join(f.profileDir, 'pnpm-lock.yaml')
  const savedLockfile = await readFile(lockfile, 'utf8')

  await f.openTab('Installed')
  const installedCard = f.installed.locator(`[data-plugin-package="${NAME}"]`)
  const enabled = installedCard.getByRole('switch', { checked: true })
  await enabled.waitFor()
  const installedAria = await enabled.ariaSnapshot()
  await f.openTab('Catalogue')
  await heading.waitFor()
  f.publish([])
  await f.refresh()
  await empty.waitFor()
  expect(await card.count()).toBe(0)
  const emptyAfterWithdrawal = await empty.innerText()

  await f.openTab('Installed')
  await enabled.waitFor()
  await privateCard.waitFor()
  expect(await readFile(manifestPath, 'utf8')).toBe(savedProfile)
  expect(await readFile(lockfile, 'utf8')).toBe(savedLockfile)
  expect(await readFile(installedPath, 'utf8')).toBe(savedPackage)
  expect(await readFile(approvedArchive)).toEqual(f.bytes)
  expect(f.consoleWatch.pageErrors).toEqual([])
  await compareOrRefreshGolden(join(EXPECTED, 'live-details.expected.md'), [
    'Before publication:', emptyBeforePublication,
    'After publication and refresh:', ...offerAria,
    'After installation:', doneAria, installedAria,
    'After withdrawal and refresh:', emptyAfterWithdrawal, await enabled.ariaSnapshot(),
  ].join('\n'), webSnapshotMode())
})

it('does not install a stale or withdrawn offer or an archive with the wrong digest', async () => {
  const f = await catalogueFixture()
  const manifest = join(f.profileDir, 'package.json')
  const before = await readFile(manifest, 'utf8')
  const card = f.catalogue.getByRole('article').filter({ has: f.page.getByRole('heading', { name: TITLE, exact: true }) })
  const install = card.getByRole('button', { name: 'Install', exact: true })

  await f.catalogue.getByText(EMPTY, { exact: true }).waitFor()
  f.publish([f.offer()])
  await f.refresh()
  await install.waitFor()
  f.takeOffline()
  await f.refresh()
  const stale = f.catalogue.getByText('Showing the last published list. Refresh to check for new installations.', { exact: true })
  await stale.waitFor()
  expect(await card.isVisible()).toBe(true)
  expect(await install.count()).toBe(0)
  expect(f.archiveRequests).toEqual([])
  const staleText = await stale.innerText()

  f.publish([f.offer()])
  await f.refresh()
  await install.waitFor()
  // The card was fresh when rendered, but the Host must check publication again at the install click.
  f.publish([])
  await install.click()
  const withdrawnAria = await refusal(f.page, 'This plugin version is not available from the verified channel. Check the catalog for an available version.')
  expect(f.archiveRequests).toEqual([])
  expect(await readFile(manifest, 'utf8')).toBe(before)
  // Let the Catalogue observe an empty result before replacing the withdrawn offer with the digest-mismatch fixture.
  await f.refresh()
  await f.catalogue.getByText(EMPTY, { exact: true }).waitFor()
  expect(await install.count()).toBe(0)

  f.publish([f.offer(f.wrongDigest)])
  await f.refresh()
  await install.click()
  const mismatchAria = await refusal(f.page, 'The downloaded archive does not match the verified release. Check the catalog before trying again.')
  expect(f.archiveRequests).toEqual([f.archivePath(f.wrongDigest)])
  await expect(readFile(join(f.profileDir, 'published-plugins', f.wrongDigest, 'plugin.tgz'))).rejects.toMatchObject({ code: 'ENOENT' })
  await expect(readFile(join(f.profileDir, 'pnpm-lock.yaml'))).rejects.toMatchObject({ code: 'ENOENT' })
  expect(await readFile(manifest, 'utf8')).toBe(before)
  expect(f.consoleWatch.pageErrors).toEqual([])
  await compareOrRefreshGolden(join(EXPECTED, 'source-form.expected.md'), [
    'Cached catalogue:', staleText,
    'After withdrawal before installation:', ...withdrawnAria,
    'After archive verification fails:', ...mismatchAria,
  ].join('\n'), webSnapshotMode())
})
