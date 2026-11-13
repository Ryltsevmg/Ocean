import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
it('gives Wayland the desktop-file identity and a real PNG window icon', () => {
  expect(main).toContain("app.setDesktopName(app.isPackaged ? 'ocean.desktop' : 'Ocean-Chat.desktop')")
  expect(main).toContain("app.commandLine.appendSwitch('class', app.isPackaged ? 'ocean' : 'Ocean-Chat')")
  expect(main).toContain("join(app.getAppPath(), 'resources', 'icon.png')")
})
it('enables the existing tray lifecycle on Linux without replacing the quit path', () => {
  expect(main).toContain("if (process.platform === 'win32' || process.platform === 'linux')")
  expect(main).toContain("process.platform === 'linux' ? applicationIconPath : trayIconPath")
  expect(main).toContain('quit: () => { app.quit() }')
  expect(main).toContain('tray?.dispose()')
})

it('hides Linux menu chrome while retaining the application menu accelerators', () => {
  expect(main).toContain('autoHideMenuBar: true')
  expect(main).not.toContain('Menu.setApplicationMenu(null)')
})
