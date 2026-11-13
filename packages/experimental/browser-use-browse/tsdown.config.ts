import { clientBundle } from '../../client/tsdown.client.ts'
export default clientBundle(import.meta.dirname, ['lib/types/index.js'], { hostPhase: true, companions: [{ entry: { setup: 'lib/types/setup.js', types: 'lib/types/remote-types.js' }, outDir: 'lib', format: ['esm'], platform: 'node', target: 'es2024', fixedExtension: false, dts: false, clean: false }] })
