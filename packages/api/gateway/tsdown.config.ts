import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(import.meta.dirname, ['lib/types/index.js', 'lib/types/device.js'], {
  dualClient: true, independentLibEntries: true,
})
