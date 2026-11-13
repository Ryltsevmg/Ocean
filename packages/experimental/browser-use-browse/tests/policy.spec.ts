import { expect, it } from 'vitest'
import { operation, resolveConnection } from '../src/policy.ts'

const config = { endpoint: 'http://127.0.0.1:19988', tokenFile: '/private/relay-token', browser: 'chrome-test', allowedOrigins: ['https://example.com'], timeoutMs: 1000, handoffTimeoutMs: 5000, maxResponseBytes: 10000 }
it('accepts only an explicit local relay and non-empty exact origins', () => {
  expect(resolveConnection(config).allowedOrigins).toEqual(['https://example.com'])
  for (const endpoint of ['http://example.com', 'http://localhost:19988', 'http://127.0.0.1:1/path', 'http://user@127.0.0.1:1', 'http://127.0.0.1:1/?x=1']) {
    expect(() => resolveConnection({ ...config, endpoint })).toThrow()
  }
  for (const allowedOrigins of [[], ['*'], ['https://example.com/path'], ['http://127.0.0.1'], ['file:///tmp']]) {
    expect(() => resolveConnection({ ...config, allowedOrigins })).toThrow()
  }
})
it('refuses model supplied sessions, JS and non-allowlisted navigation', () => {
  expect(() => operation('navigate', { url: 'https://evil.test' }, config.allowedOrigins)).toThrow()
  expect(() => operation('snapshot', { session: 'foreign' }, config.allowedOrigins)).toThrow()
  expect(() => operation('execute', { code: 'process.exit()' }, config.allowedOrigins)).toThrow()
  expect(() => operation('click', { ref: 'e1"); evil(); //' }, config.allowedOrigins)).toThrow()
})
it('serializes text as data in fixed source and checks password fields', () => {
  const text = '"); globalThis.pwned = true; //'
  const source = operation('fill', { ref: 'e12', text }, config.allowedOrigins)
  expect(source).toContain(JSON.stringify(text))
  expect(source).toContain('password')
  expect(operation('navigate', { url: 'https://example.com/a' }, config.allowedOrigins)).toContain('page.goto("https://example.com/a")')
})
