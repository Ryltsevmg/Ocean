/** Platform-owned paths for downloaded Electron and packaged Ocean-Chat executables. */
import { join } from 'node:path'

/**
 * Locate the executable within an extracted Electron distribution.
 * @param root Directory containing the extracted Electron release.
 * @param platform Operating system of that release.
 * @returns Absolute executable path.
 */
export function desktopElectronExecutable(root: string, platform: NodeJS.Platform): string {
  if (platform === 'linux') return join(root, 'electron')
  if (platform === 'win32') return join(root, 'electron.exe')
  if (platform === 'darwin') return join(root, 'Electron.app', 'Contents', 'MacOS', 'Electron')
  throw new Error(`desktop runtime: unsupported Electron platform ${platform}`)
}

/**
 * Locate a built application's executable and resource directory.
 * @param artifacts Artifact output directory selected by the packaging mode.
 * @param target Validated platform/architecture name.
 * @returns Paths matching electron-builder's output and Ocean executable names.
 */
export function desktopPackagedPaths(artifacts: string, target: string): { application: string; resources: string; executable: string } {
  if (target === 'linux-arm64' || target === 'linux-x64') {
    const application = join(artifacts, target === 'linux-arm64' ? 'linux-arm64-unpacked' : 'linux-unpacked')
    return { application, resources: join(application, 'resources'), executable: join(application, 'ocean') }
  }
  if (target === 'win-x64') {
    const application = join(artifacts, 'win-unpacked')
    return { application, resources: join(application, 'resources'), executable: join(application, 'Ocean-Chat.exe') }
  }
  if (target === 'mac-arm64' || target === 'mac-x64') {
    const application = join(artifacts, target === 'mac-arm64' ? 'mac-arm64' : 'mac', 'Ocean-Chat.app', 'Contents')
    return { application, resources: join(application, 'Resources'), executable: join(application, 'MacOS', 'Ocean-Chat') }
  }
  throw new Error(`desktop runtime: unsupported packaged target ${target}`)
}
