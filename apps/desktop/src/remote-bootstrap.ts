/** Release compatibility before remote bootstrap rows reach the packaged renderer. */
import { HarnessError } from '@ocean/ocean-error'
import type { DesktopClientRelease } from './client-metadata.ts'

/** The Host release is missing, invalid, or differs from the packaged shell. */
export class RemoteBootstrapCompatibilityError extends HarnessError {
  constructor() {
    super('The remote Host and Desktop require the same Ocean release.', 'DESKTOP_REMOTE_VERSION_INCOMPATIBLE')
  }
}

/**
 * Require one boot graph with the same version and available source commit.
 * @param rows - Untrusted JSON injections returned by the authenticated Host.
 * @param expected - Release fixed into the local packaged shell.
 * @throws {RemoteBootstrapCompatibilityError} Before any injection executes when release fields cannot establish compatibility.
 */
export function assertRemoteBootstrapRelease(rows: readonly unknown[], expected: DesktopClientRelease): void {
  const graphs = rows.filter(row => typeof row === 'object' && row !== null
    && 'kind' in row && row.kind === 'global' && 'name' in row && row.name === '__OCEAN_BOOT__')
  const graph = graphs[0]
  if (graphs.length !== 1 || typeof graph !== 'object' || graph === null || !('value' in graph)) {
    throw new RemoteBootstrapCompatibilityError()
  }
  const value = graph.value
  if (typeof value !== 'object' || value === null || !('release' in value)) throw new RemoteBootstrapCompatibilityError()
  const release = value.release
  if (typeof release !== 'object' || release === null || !('version' in release)
    || typeof release.version !== 'string' || release.version !== expected.version) throw new RemoteBootstrapCompatibilityError()
  const commit = 'commit' in release ? release.commit : undefined
  if ((commit !== undefined && (typeof commit !== 'string' || commit.length === 0)) || commit !== expected.commit) {
    throw new RemoteBootstrapCompatibilityError()
  }
}
