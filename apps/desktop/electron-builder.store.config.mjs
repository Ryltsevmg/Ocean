/** Package the verified, unpacked Windows x64 runtime for Microsoft Store without the NSIS updater. */

export default {
  productName: 'Ocean',
  directories: { output: '.desktop-build/store-artifacts' },
  artifactName: 'ocean-${version}-store-${arch}.${ext}',
  publish: null,
  win: {
    target: [{ target: 'appx', arch: ['x64'] }],
    forceCodeSigning: false,
    signExecutable: false,
  },
  appx: {
    identityName: 'RMGSoftware.oceanharness',
    publisher: 'CN=78CF6652-2933-4046-9EE6-A0931E27E1CA',
    publisherDisplayName: 'RMG Software',
    setBuildNumber: false,
    electronUpdaterAware: false,
  },
}
