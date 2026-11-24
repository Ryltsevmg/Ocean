/** Electron-builder fields the Microsoft Store packaging test asserts. */
export interface DesktopStoreElectronBuilderConfig {
  readonly productName: 'Ocean'
  readonly directories: { readonly output: string }
  readonly artifactName: string
  readonly publish: null
  readonly extraMetadata: { readonly description: string }
  readonly win: {
    readonly target: readonly [{ readonly target: 'appx', readonly arch: readonly ['x64'] }]
    readonly forceCodeSigning: false
    readonly signExecutable: false
  }
  readonly appx: {
    readonly identityName: 'RMGSoftware.oceanharness'
    readonly publisher: 'CN=78CF6652-2933-4046-9EE6-A0931E27E1CA'
    readonly publisherDisplayName: 'RMG Software'
    readonly setBuildNumber: false
    readonly electronUpdaterAware: false
  }
}

declare const desktopStoreElectronBuilderConfig: DesktopStoreElectronBuilderConfig

export default desktopStoreElectronBuilderConfig
