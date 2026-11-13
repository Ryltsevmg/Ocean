import { expect, it } from 'vitest'
import { join } from 'node:path'
import { desktopElectronExecutable, desktopPackagedPaths } from '../scripts/desktop-executable-paths.ts'

it.each([
  ['linux', 'electron'], ['win32', 'electron.exe'], ['darwin', join('Electron.app', 'Contents', 'MacOS', 'Electron')],
] as const)('locates downloaded Electron on %s', (platform, executable) => {
  expect(desktopElectronExecutable('/download', platform)).toBe(join('/download', executable))
})

it.each([
  ['linux-arm64', 'linux-arm64-unpacked'], ['linux-x64', 'linux-unpacked'],
] as const)('locates the complete packaged Linux runtime for %s', (target, directory) => {
  expect(desktopPackagedPaths('/artifacts', target)).toEqual({
    application: join('/artifacts', directory), resources: join('/artifacts', directory, 'resources'),
    executable: join('/artifacts', directory, 'ocean'),
  })
})

it('retains Windows/macOS layouts and rejects unsupported targets', () => {
  expect(desktopPackagedPaths('/out', 'win-x64').executable).toBe(join('/out', 'win-unpacked', 'Ocean-Chat.exe'))
  expect(desktopPackagedPaths('/out', 'mac-arm64').resources).toBe(join('/out', 'mac-arm64', 'Ocean-Chat.app', 'Contents', 'Resources'))
  expect(() => desktopPackagedPaths('/out', 'freebsd-x64')).toThrow(/unsupported/u)
  expect(() => desktopElectronExecutable('/out', 'freebsd')).toThrow(/unsupported/u)
})
