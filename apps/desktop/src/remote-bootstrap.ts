/** Release compatibility before remote bootstrap rows reach the packaged renderer. */
import { HarnessError } from '@ocean/ocean-error'
import type { DesktopClientRelease } from './client-metadata.ts'

/** The Host release is missing, invalid, or has a different version from the packaged shell. */
export class RemoteBootstrapCompatibilityError extends HarnessError {
  /**
   * @param hostVersion - Version the Host reported, when its release was readable.
   * @param clientVersion - Version fixed into the packaged shell.
   */
  constructor(readonly hostVersion?: string, readonly clientVersion?: string) {
    super('The remote Host and Desktop require the same Ocean version.', 'DESKTOP_REMOTE_VERSION_INCOMPATIBLE')
  }
}

/**
 * Require one boot graph whose release has the same version as the packaged shell.
 * The source commit is reported to the caller, not required to match: builds of one version can
 * differ in commit, and only a difference in version separates incompatible release lines.
 * @param rows - Untrusted JSON injections returned by the authenticated Host.
 * @param expected - Release fixed into the local packaged shell.
 * @returns The Host's release, so the caller can report a commit difference.
 * @throws {RemoteBootstrapCompatibilityError} Before any injection executes when the release is absent, malformed, or another version.
 */
export function assertRemoteBootstrapRelease(rows: readonly unknown[], expected: DesktopClientRelease): DesktopClientRelease {
  const graphs = rows.filter(row => typeof row === 'object' && row !== null
    && 'kind' in row && row.kind === 'global' && 'name' in row && row.name === '__OCEAN_BOOT__')
  const graph = graphs[0]
  if (graphs.length !== 1 || typeof graph !== 'object' || graph === null || !('value' in graph)) {
    throw new RemoteBootstrapCompatibilityError(undefined, expected.version)
  }
  const value = graph.value
  if (typeof value !== 'object' || value === null || !('release' in value)) {
    throw new RemoteBootstrapCompatibilityError(undefined, expected.version)
  }
  const release = value.release
  if (typeof release !== 'object' || release === null || !('version' in release) || typeof release.version !== 'string') {
    throw new RemoteBootstrapCompatibilityError(undefined, expected.version)
  }
  const commit = 'commit' in release ? release.commit : undefined
  if (commit !== undefined && (typeof commit !== 'string' || commit.length === 0)) {
    throw new RemoteBootstrapCompatibilityError(undefined, expected.version)
  }
  if (release.version !== expected.version) throw new RemoteBootstrapCompatibilityError(release.version, expected.version)
  return commit === undefined ? { version: release.version } : { version: release.version, commit }
}
