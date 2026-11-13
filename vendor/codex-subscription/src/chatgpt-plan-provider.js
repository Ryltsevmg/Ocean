// Metadata from @earendil-works/pi-ai 1.5.2, used until the pinned provider includes this model.
const additionalModels = [{
  id: 'gpt-6.1-terra', name: 'GPT-6.1 Terra', api: 'openai-responses', provider: 'openai',
  baseUrl: 'https://api.openai.com/v1', reasoning: true, input: ['text', 'image'],
  cost: { input: 1, output: 5, cacheRead: 0.05, cacheWrite: 1.25, tiers: [{ inputTokensAbove: 272000, input: 2, output: 7.5, cacheRead: 0.1, cacheWrite: 2.5 }] },
  contextWindow: 272000, maxTokens: 128000,
  thinkingLevelMap: { off: 'none', minimal: null, low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
  compat: { supportsStrictMode: true },
}]

/** Create a separate Responses route using only account-advertised, supported models. */
export function createPlanProvider({ base, fetch: request }) {
  let models = []
  const update = catalog => {
    const available = new Map([...additionalModels, ...base.getModels().filter(model => model.api === 'openai-responses')].map(model => [model.id, model]))
    models = catalog.flatMap(item => {
      const known = available.get(item.id)
      return known === undefined ? [] : [{ ...known, provider: 'ocean-chatgpt-plan', name: item.name, baseUrl: 'https://api.openai.com/v1', compat: { ...known.compat, supportsMidConvoEffort: false } }]
    })
  }
  const secureOptions = options => ({
    ...options,
    fetch: request,
    async onPayload(payload, model) {
      const prepared = await options?.onPayload?.(payload, model) ?? payload
      const { max_output_tokens, temperature, prompt_cache_retention, prompt_cache_options, ...accepted } = prepared
      return { ...accepted, store: false, stream: true }
    },
  })
  const provider = {
    id: 'ocean-chatgpt-plan', name: 'ChatGPT plan', baseUrl: 'https://api.openai.com/v1',
    auth: { apiKey: { name: 'Ocean ChatGPT plan', async resolve({ credential }) { return credential?.type === 'api_key' && credential.key ? { auth: { apiKey: credential.key }, source: 'Ocean ChatGPT plan' } : undefined } } },
    getModels: () => models,
    stream: (model, context, options) => base.stream(model, context, secureOptions(options)),
    streamSimple: (model, context, options) => base.streamSimple(model, context, secureOptions(options)),
  }
  return { provider, update, clear: () => { models = [] } }
}
