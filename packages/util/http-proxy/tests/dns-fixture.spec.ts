/** DNS interception stays inside one exact-host, sequential proxy test. */
import dns from 'node:dns'
import { expect, it } from 'vitest'
import { withFixtureDnsFailure } from './dns-fixture.ts'

it.each([false, true])('forwards other lookups and restores DNS when the case throws: %s', async (fails) => {
  const original = dns.lookup
  const failure = new Error('case failed')
  const outcome = withFixtureDnsFailure('probe.invalid', async () => {
    let completed = false
    const lookup = new Promise<NodeJS.ErrnoException | null>((resolve) => {
      dns.lookup('probe.invalid', (error) => { completed = true; resolve(error) })
    })
    expect(completed).toBe(false)
    await expect(lookup).resolves.toMatchObject({ code: 'ENOTFOUND', hostname: 'probe.invalid' })
    const addresses = new Promise<dns.LookupAddress[]>((resolve, reject) => {
      dns.lookup('127.0.0.1', { all: true }, (error, values) => {
        if (error) reject(error)
        else resolve(values)
      })
    })
    await expect(addresses).resolves.toEqual([{ address: '127.0.0.1', family: 4 }])
    if (fails) throw failure
  })
  if (fails) await expect(outcome).rejects.toBe(failure)
  else await expect(outcome).resolves.toBeUndefined()
  expect(dns.lookup).toBe(original)
})
