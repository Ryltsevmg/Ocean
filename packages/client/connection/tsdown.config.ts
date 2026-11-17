import { clientBundle } from '../tsdown.client.ts'

export default clientBundle(import.meta.dirname, ['lib/types/index.js', 'lib/types/device.js', 'lib/types/protocol.js'], {
  dualClient: true, hostPhase: true, independentLibEntries: true,
})
