/** Select isolated qualification inputs without weakening the ordinary Windows installer or signing hooks. */
import { join } from 'node:path'
import { createElectronBuilderConfig } from './electron-builder-config.mjs'
import { installedUpdateDestination, readInstalledUpdateRun } from './installed-update-qualification.ts'
import { verifyInstalledUpdateApplication } from './prepare-installed-update-application.ts'
import { verifyDesktopRuntime } from '../src/runtime-tree.ts'

/**
 * Validate one version and construct its signed-only, test-only builder configuration.
 * @param manifest Original run.json with prepared runtime and application files.
 * @param version One of the run's two versions.
 * @param environment File-owned .env.windows settings loaded by a supervised caller; never logged here.
 * @returns Configuration only. Calling builder hooks requires separate hardware authorization and supervision.
 */
export async function createInstalledUpdateBuilderConfig(manifest: string, version: string, environment: NodeJS.ProcessEnv) {
  const run = await readInstalledUpdateRun(manifest, environment)
  const destination = installedUpdateDestination(environment)
  if (!run.versions.includes(version)) throw new Error('installed update: package version is outside the qualification run')
  if (environment.OCEAN_DESKTOP_AUTO_UPDATE_ENV !== 'test' || environment.OCEAN_DESKTOP_UNSIGNED === '1'
    || destination.origin !== run.origin || destination.bucket !== run.bucket) {
    throw new Error('installed update: signed ordinary-update qualification requires matching test deployment settings')
  }
  const application = await verifyInstalledUpdateApplication(run.root)
  const ocean = join(run.root, version, 'ocean')
  await verifyDesktopRuntime(ocean, version, { platform: 'win32', arch: 'x64' })
  const config = createElectronBuilderConfig({ ...environment, OCEAN_DESKTOP_APP_ID: run.appId,
    OCEAN_DESKTOP_TARGET_PLATFORM: 'win32', OCEAN_DESKTOP_TARGET_ARCH: 'x64', OCEAN_DESKTOP_UNSIGNED: '0' }, 'win32', 'x64', ocean, version)
  return { ...config,
    productName: run.productName,
    directories: { ...config.directories, output: join(run.root, version, 'installer') },
    extraMetadata: { ...config.extraMetadata, name: `ocean-update-test-${run.id}`, version, main: 'qualification-bootstrap.mjs' },
    files: [
      { from: application, to: '.', filter: ['lib/*.js', 'lib/*.cjs', 'lib/welcome/design-platform.css', 'renderer/**/*', 'qualification-bootstrap.mjs', 'installed-update-identity.mjs'] },
      'package.json',
      ...config.files.filter((file): file is string => typeof file === 'string' && file.startsWith('!')),
      { from: ocean, to: 'ocean', filter: ['**/*'] },
      { from: join(ocean, 'node_modules'), to: 'ocean/node_modules', filter: ['**/*'] },
    ],
    publish: [{ provider: 'generic' as const, url: `${run.origin}/${run.feedKey.slice(0, -'nightly.yml'.length)}`, channel: 'nightly' }],
  }
}
