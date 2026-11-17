/**
 * Resolve the public SDK launch configuration to one ocean subprocess.
 * @module @ocean/ocean-sdk-client/launch
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { HarnessClientOptions } from './types.ts'

/** Default bound for a profile to answer the SDK initialize handshake. */
export const DEFAULT_INITIALIZE_TIMEOUT_MS = 10_000

/** Internal generic process launch used by the transport and fake-runtime tests. */
export interface RuntimeProcessOptions {
  command: string
  args: string[]
  cwd?: string
  /** Materialize the complete child environment when the client starts its subprocess. */
  environment: () => NodeJS.ProcessEnv
  description: string
  initializeTimeoutMs: number
  requestTimeoutMs?: number
  shutdownTimeoutMs?: number
  disposeEofGraceMs?: number
  disposeGraceMs?: number
}

/** Node argv plus internal profile patches required by one resolved ocean entry. */
export interface OceanNodeLaunch {
  /** Arguments before the profile selector. */
  nodeArgs: string[]
  /** Internal patches applied below caller-supplied patches. */
  patches: string[]
  /** Environment values required by the resolved entry mode. */
  environment: NodeJS.ProcessEnv
}

interface PackageManifest {
  version?: unknown
  bin?: unknown
}

/** Read a package manifest from one resolved package.json URL. */
function manifest(url: string): PackageManifest {
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as PackageManifest
}

/**
 * Resolve and version-check an ocean executable from package manifests.
 * @param oceanManifestUrl - resolved URL of the ocean package manifest.
 * @param clientManifestUrl - resolved URL of the SDK client manifest.
 * @returns the absolute ocean executable path.
 */
export function resolveOceanBinFromManifests(oceanManifestUrl: string, clientManifestUrl: string): string {
  const oceanManifest = manifest(oceanManifestUrl)
  const clientManifest = manifest(clientManifestUrl)
  if (typeof oceanManifest.version !== 'string' || oceanManifest.version !== clientManifest.version) {
    throw new Error(`ocean SDK client ${String(clientManifest.version)} requires the same ocean version, got ${String(oceanManifest.version)}`)
  }
  const bin = typeof oceanManifest.bin === 'object' && oceanManifest.bin !== null
    ? (oceanManifest.bin as Record<string, unknown>).ocean
    : oceanManifest.bin
  if (typeof bin !== 'string' || bin === '') throw new Error('@ocean/ocean declares no ocean executable')
  return resolve(dirname(fileURLToPath(oceanManifestUrl)), bin)
}

/**
 * Resolve and version-check the built ocean executable installed with this SDK.
 * @returns the absolute built executable path, whether or not it exists in a source checkout.
 */
export function installedOceanBin(): string {
  return resolveOceanBinFromManifests(
    import.meta.resolve('@ocean/ocean/package.json'),
    new URL('../package.json', import.meta.url).href,
  )
}

/**
 * Resolve the Node launch for one same-version ocean package.
 * @param oceanManifestUrl - resolved URL of the ocean package manifest.
 * @param clientManifestUrl - resolved URL of the SDK client manifest.
 * @param sourceLoaderUrl - optional absolute tsx loader URL for deterministic tests.
 * @returns built output, or the source entry plus its compatibility patch and tsx environment.
 */
export function resolveOceanNodeLaunchFromManifests(
  oceanManifestUrl: string,
  clientManifestUrl: string,
  sourceLoaderUrl?: string,
): OceanNodeLaunch {
  const bin = resolveOceanBinFromManifests(oceanManifestUrl, clientManifestUrl)
  if (existsSync(bin)) return { nodeArgs: [bin], patches: [], environment: {} }

  const packageDir = dirname(fileURLToPath(oceanManifestUrl))
  const sourceBin = resolve(packageDir, 'src/bin.ts')
  const sourcePatch = resolve(packageDir, 'src/sdk-source.cordis.patch.yml')
  const sourceTsconfig = resolve(packageDir, 'tsconfig.json')
  if (!existsSync(sourceBin) || !existsSync(sourcePatch) || !existsSync(sourceTsconfig)) {
    throw new Error(
      `@ocean/ocean is missing its built executable ${bin} and complete source launch files ${sourceBin}, ${sourcePatch}, ${sourceTsconfig}`,
    )
  }
  const loader = sourceLoaderUrl ?? import.meta.resolve('tsx/esm')
  return {
    nodeArgs: ['--import', loader, sourceBin],
    patches: [sourcePatch],
    environment: { TSX_TSCONFIG_PATH: sourceTsconfig },
  }
}

/**
 * Resolve the installed ocean package to a built or source Node launch.
 * @returns the launch descriptor for the current checkout or installed package.
 */
function installedOceanNodeLaunch(): OceanNodeLaunch {
  return resolveOceanNodeLaunchFromManifests(
    import.meta.resolve('@ocean/ocean/package.json'),
    new URL('../package.json', import.meta.url).href,
  )
}

/**
 * Resolve caller-relative filesystem inputs and construct canonical ocean argv.
 * @param options - public SDK launch options.
 * @param callerCwd - parent-process directory used for lexical resolution.
 * @returns one generic subprocess spec for the JSON-RPC transport.
 */
export function resolveOceanLaunch(
  options: HarnessClientOptions = {},
  callerCwd: string = process.cwd(),
): RuntimeProcessOptions {
  const profile = options.profile ?? 'sdk'
  const bin = options.oceanBin ?? options.dshBin
  const home = options.oceanHome ?? options.dshHome
  const oceanLaunch = bin === undefined
    ? installedOceanNodeLaunch()
    : { nodeArgs: [resolve(callerCwd, bin)], patches: [], environment: {} }
  const patches = [
    ...oceanLaunch.patches,
    ...(options.patches ?? []).map(path => resolve(callerCwd, path)),
  ]
  const oceanHome = home === undefined ? undefined : resolve(callerCwd, home)
  return {
    command: process.execPath,
    args: [...oceanLaunch.nodeArgs, '--profile', profile, ...patches.flatMap(path => ['--patch', path])],
    ...options.processCwd === undefined ? {} : { cwd: resolve(callerCwd, options.processCwd) },
    environment: () => ({
      ...(options.env ?? process.env),
      ...oceanLaunch.environment,
      ...oceanHome === undefined ? {} : { OCEAN_HOME: oceanHome },
    }),
    description: `ocean profile ${JSON.stringify(profile)}`,
    initializeTimeoutMs: options.initializeTimeoutMs ?? DEFAULT_INITIALIZE_TIMEOUT_MS,
    ...options.requestTimeoutMs === undefined ? {} : { requestTimeoutMs: options.requestTimeoutMs },
    ...options.shutdownTimeoutMs === undefined ? {} : { shutdownTimeoutMs: options.shutdownTimeoutMs },
    ...options.disposeEofGraceMs === undefined ? {} : { disposeEofGraceMs: options.disposeEofGraceMs },
    ...options.disposeGraceMs === undefined ? {} : { disposeGraceMs: options.disposeGraceMs },
  }
}
