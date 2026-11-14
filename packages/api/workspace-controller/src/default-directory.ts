/** Resolve the Host account's Documents directory for first-use Workspace creation. */

import { stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { posix, win32 } from 'node:path'
import { runNativeCommand, type NativeCommandRunner } from '@ocean/ocean-native-command'
import { RemoteError } from '@ocean/ocean-typert-protocol'
import type {} from './types.ts'
import { DEFAULT_WORKSPACE_DIRECTORY } from './default-workspace.ts'

/** Platform observations replaceable in directory-resolution tests. */
interface DocumentsDirectoryInternals {
  readonly platform?: NodeJS.Platform
  readonly home?: string
  readonly run?: NativeCommandRunner
  readonly directoryExists?: (path: string) => Promise<boolean>
}

/** Inspect candidates without creating, moving, or replacing user data. */
async function directoryExists(path: string): Promise<boolean> {
  try {
    const entry = await stat(path)
    if (!entry.isDirectory()) throw new Error(`Workspace path is not a directory: '${path}'`)
    return true
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false
    throw error
  }
}

/**
 * Validate a configured or OS-returned Documents path without resolving it against cwd.
 * @param directory - fully qualified directory spelling.
 * @param platform - Host platform.
 * @returns the normalized directory.
 */
export function validateDocumentsDirectory(directory: string, platform: NodeJS.Platform = process.platform): string {
  const paths = platform === 'win32' ? win32 : posix
  const root = paths.parse(directory).root
  if (!paths.isAbsolute(directory) || (platform === 'win32' && (root === '\\' || root === '/'))) {
    throw new Error(`Documents directory must be fully qualified: '${directory}'`)
  }
  return paths.normalize(directory)
}

/**
 * Resolve the first-use directory on the Host without creating files.
 * Prefer Ocean; if absent, reuse an existing legacy directory in place.
 * Registered Workspaces bypass this resolver and keep their stored paths.
 * @param documentsDirectory - explicit deployment override for the system Documents directory.
 * @param signal - caller lifetime and lookup deadline.
 * @param internals - platform facts, native command runner, and directory inspection.
 * @returns the absolute candidate path.
 */
export async function defaultWorkspaceDirectory(
  documentsDirectory: string | undefined,
  signal: AbortSignal,
  internals: DocumentsDirectoryInternals = {},
): Promise<string> {
  const platform = internals.platform ?? process.platform
  const paths = platform === 'win32' ? win32 : posix
  signal.throwIfAborted()
  let directory = documentsDirectory
  if (directory === undefined) {
    const run = internals.run ?? runNativeCommand
    const lookup = async (command: string, args: string[]): Promise<string> => {
      try {
        return (await run(command, args, signal, 'hidden')).stdout
      } catch (error) {
        signal.throwIfAborted()
        if (!(error instanceof Error) || !('code' in error) || (typeof error.code !== 'string' && typeof error.code !== 'number')) throw error
        throw new RemoteError('workspace/default-directory-unavailable', 'system Documents directory lookup failed', {}, { cause: error })
      }
    }
    let stdout: string
    switch (platform) {
      case 'darwin':
        stdout = await lookup('osascript', [
          '-e', 'POSIX path of (path to documents folder from user domain without folder creation)',
        ])
        break
      case 'win32':
        stdout = await lookup('powershell.exe', [
          '-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
          '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); '
          + '[Environment]::GetFolderPath([Environment+SpecialFolder]::MyDocuments, '
          + '[Environment+SpecialFolderOption]::DoNotVerify)',
        ])
        break
      case 'linux':
        stdout = await lookup('xdg-user-dir', ['DOCUMENTS'])
        break
      default:
        throw new RemoteError('workspace/default-directory-unavailable', `system Documents directory is unavailable on ${platform}`, {})
    }
    signal.throwIfAborted()
    directory = stdout.replace(/[\r\n]+$/, '')
    if (directory === '') {
      throw new RemoteError('workspace/default-directory-unavailable', 'system Documents directory is unavailable', {})
    }
  }
  directory = validateDocumentsDirectory(directory, platform)
  // XDG reports HOME, with or without a trailing separator, when Documents is disabled.
  if (documentsDirectory === undefined && platform === 'linux' && paths.relative(internals.home ?? homedir(), directory) === '') {
    throw new RemoteError('workspace/default-directory-unavailable', 'system Documents directory is unavailable', {})
  }
  signal.throwIfAborted()
  const ocean = paths.join(directory, 'Ocean', DEFAULT_WORKSPACE_DIRECTORY)
  const legacy = paths.join(directory, 'deepseek-harness', DEFAULT_WORKSPACE_DIRECTORY)
  const exists = internals.directoryExists ?? directoryExists
  const oceanExists = await exists(ocean)
  signal.throwIfAborted()
  if (oceanExists) return ocean
  const legacyExists = await exists(legacy)
  signal.throwIfAborted()
  return legacyExists ? legacy : ocean
}
