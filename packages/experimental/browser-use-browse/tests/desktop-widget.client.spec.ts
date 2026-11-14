import type { Context } from '@deepseek-ai/cordis'
import { expect, it, vi } from 'vitest'
import { apply } from '../src/client/index.ts'

// The branch under test returns before constructing any remote client.
vi.mock('@ocean/ocean-browser-use-browse/remote', () => ({ default: {} }))

it('does not mount the legacy Browse UI or its transport in Ocean Desktop', async () => {
  const touched = new Error('legacy Browse setup was reached')
  const context = new Proxy({} as Context, { get() { throw touched } })
  vi.stubGlobal('dshDesktop', { protocolVersion: 1 })
  try {
    const dispose = await apply(context)
    await expect(dispose()).resolves.toBeUndefined()
  } finally {
    vi.unstubAllGlobals()
  }
  await expect(apply(context)).rejects.toBe(touched)
})
