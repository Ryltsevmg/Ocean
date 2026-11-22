import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import store from '../electron-builder.store.config.mjs'
import { createElectronBuilderConfig } from '../scripts/electron-builder-config.mjs'

const windows = {
  OCEAN_DESKTOP_APP_ID: 'app.ocean.chat',
  OCEAN_DESKTOP_TARGET_PLATFORM: 'win32',
  OCEAN_DESKTOP_TARGET_ARCH: 'x64',
  OCEAN_DESKTOP_UNSIGNED: '1',
}

describe('Microsoft Store packaging', () => {
  it('uses the reserved package identity and produces only an x64 AppX', () => {
    expect(store.appx).toMatchObject({
      identityName: 'RMGSoftware.oceanharness',
      publisher: 'CN=78CF6652-2933-4046-9EE6-A0931E27E1CA',
      publisherDisplayName: 'RMG Software',
      setBuildNumber: false,
      electronUpdaterAware: false,
    })
    expect(store.win.target).toEqual([{ target: 'appx', arch: ['x64'] }])
    expect(store.win.forceCodeSigning).toBe(false)
    expect(store.win.signExecutable).toBe(false)
    expect(store.publish).toBeNull()
  })

  it.each([
    ['StoreLogo', 50, 50],
    ['Square150x150Logo', 150, 150],
    ['Square44x44Logo', 44, 44],
    ['Wide310x150Logo', 310, 150],
  ] as const)('ships an Ocean %s at the AppX template size', async (name, width, height) => {
    const path = fileURLToPath(new URL(`../build/appx/${name}.png`, import.meta.url))
    expect(await sharp(path).metadata()).toMatchObject({ format: 'png', width, height })
  })

  it('describes the product in the package metadata rather than the shell internals', () => {
    expect(store.extraMetadata.description).toBe('A desktop workspace for AI agents, conversations, and tools')
  })

  it('keeps the unpacked unsigned Windows input free of release update configuration', () => {
    const input = createElectronBuilderConfig(windows, 'win32', 'x64')
    expect(input.win.target).toEqual(['nsis'])
    expect(input.publish).toBeNull()
    expect(input.extraMetadata).not.toHaveProperty('oceanMandatoryUpdatePolicy')
  })
})
