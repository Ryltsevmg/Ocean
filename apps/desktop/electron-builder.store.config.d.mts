/** Electron-builder fields of the Microsoft Store configuration asserted by the Desktop release tests. */
export interface DesktopStoreElectronBuilderConfig {
  readonly productName: string
  readonly directories: { readonly output: string }
  readonly artifactName: string
  readonly publish: null
  readonly win: {
    readonly target: readonly [{ readonly target: 'appx'; readonly arch: readonly ['x64'] }]
    readonly forceCodeSigning: boolean
    readonly signExecutable: boolean
  }
  readonly appx: {
    readonly identityName: string
    readonly publisher: string
    readonly publisherDisplayName: string
    readonly setBuildNumber: boolean
    readonly electronUpdaterAware: boolean
  }
}

declare const electronBuilderStoreConfig: DesktopStoreElectronBuilderConfig

export default electronBuilderStoreConfig
