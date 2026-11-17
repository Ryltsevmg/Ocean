/** Exact-host DNS failure for real proxy-dispatch tests, without operating-system resolver work. */
import dns from 'node:dns'
import { vi } from 'vitest'

/**
 * Run a sequential case with one fixture hostname failing DNS asynchronously.
 * @param hostname - Exact test-owned host; every other lookup retains Node's implementation.
 * @param run - Requests and their awaited dispatcher teardown.
 * @returns The case result, after restoring the original lookup on success or failure.
 */
export async function withFixtureDnsFailure<T>(hostname: string, run: () => Promise<T>): Promise<T> {
  const original = dns.lookup
  const lookup = vi.spyOn(dns, 'lookup').mockImplementation(new Proxy(original, {
    apply(target, receiver, args: Parameters<typeof dns.lookup>) {
      if (args[0] !== hostname) { Reflect.apply(target, receiver, args); return }
      const callback = args.at(-1)
      if (typeof callback !== 'function') throw new Error('DNS fixture requires a lookup callback')
      const error = Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), {
        code: 'ENOTFOUND', syscall: 'getaddrinfo', hostname,
      })
      queueMicrotask(() => { Reflect.apply(callback, undefined, [error]) })
    },
  }))
  try { return await run() } finally { lookup.mockRestore() }
}
