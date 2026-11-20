/** Destination-resolution failure paths for the anonymous fetch provider. */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpFetchProvider } from '@ocean/ocean-web-fetch-http'
import type { HttpFetchLimits } from '@ocean/ocean-web-fetch-http'

const lookup = vi.hoisted(() => vi.fn())
vi.mock('node:dns/promises', () => ({ lookup }))

const limits: HttpFetchLimits = {
  maxResponseBytes: 5_000_000,
  maxBodyChars: 100_000,
  timeoutMs: 5_000,
  maxRedirects: 5,
  userAgent: 'test-agent/1.0',
}

beforeEach(() => { lookup.mockReset() })

describe('destination resolution', () => {
  it('reports a resolver failure as a provider error', async () => {
    lookup.mockRejectedValue(Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }))
    await expect(new HttpFetchProvider(limits).fetch({ url: 'http://missing.test/page' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_ERROR' }))
  })

  it('reports an empty resolution as a provider error', async () => {
    lookup.mockResolvedValue([])
    await expect(new HttpFetchProvider(limits).fetch({ url: 'http://empty.test/page' }))
      .rejects.toThrow(expect.objectContaining({ code: 'WEB_PROVIDER_ERROR' }))
  })
})
