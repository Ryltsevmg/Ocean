/** Restricted transport for the documented ChatGPT plan endpoints. */

const ENDPOINTS = new Map([
  ['https://auth.openai.com/api/accounts/oauth/revoke', { area: 'oauth', method: 'POST', host: 'auth.openai.com' }],
  ['https://auth.openai.com/api/accounts/oauth/token', { area: 'oauth', method: 'POST', host: 'auth.openai.com' }],
  ['https://auth.openai.com/.well-known/jwks.json', { area: 'oauth', method: 'GET', host: 'auth.openai.com' }],
  ['https://api.openai.com/v1/responses', { area: 'model', method: 'POST', host: 'api.openai.com' }],
  ['https://api.openai.com/v1/models', { area: 'catalog', method: 'GET', host: 'api.openai.com' }],
])

/** Restrict plan requests before handing them to Ocean's proxy-aware transport. @param {object} transport - Existing network owner. @returns {object} Restricted fetch interface. */
export function createPlanNetwork(transport) {
  return Object.freeze({
    async fetch(input, init = {}) {
      const url = input instanceof URL ? input.href : input
      const endpoint = typeof url === 'string' ? ENDPOINTS.get(url) : undefined
      const method = (init.method ?? 'GET').toUpperCase()
      if (!endpoint || method !== endpoint.method) throw new Error('ChatGPT plan network target is unavailable')
      return transport.fetch(endpoint.area, url, { ...init, redirect: 'error' }, { hosts: new Set([endpoint.host]), standardHttps: true })
    },
  })
}
