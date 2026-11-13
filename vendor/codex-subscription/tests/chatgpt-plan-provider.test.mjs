import assert from 'node:assert/strict'
import test from 'node:test'
import { createPlanProvider } from '../src/chatgpt-plan-provider.js'

test('offers GPT-6.1 Terra only when the account catalog includes it', () => {
  const catalog = createPlanProvider({ base: { getModels: () => [] }, fetch: () => {} })
  catalog.update([])
  assert.deepEqual(catalog.provider.getModels(), [])
  catalog.update([{ id: 'gpt-6.1-terra', name: 'GPT-6.1 Terra' }, { id: 'unknown', name: 'Unknown' }])
  const [model] = catalog.provider.getModels()
  assert.equal(catalog.provider.getModels().length, 1)
  assert.equal(model.id, 'gpt-6.1-terra')
  assert.equal(model.api, 'openai-responses')
  assert.deepEqual(model.input, ['text', 'image'])
  assert.equal(model.maxTokens, 128000)
  catalog.update([])
  assert.deepEqual(catalog.provider.getModels(), [])
})

test('prefers a newer installed provider descriptor over the bundled model metadata', () => {
  const base = { getModels: () => [{ id: 'gpt-6.1-terra', api: 'openai-responses', contextWindow: 123456 }] }
  const catalog = createPlanProvider({ base, fetch: () => {} })
  catalog.update([{ id: 'gpt-6.1-terra', name: 'Terra' }])
  assert.equal(catalog.provider.getModels()[0].contextWindow, 123456)
})

test('advertises only known Responses models present in the selected account catalog', async () => {
  let captured
  const base = { getModels: () => [{ id: 'known', api: 'openai-responses', provider: 'openai', input: ['text'], contextWindow: 1000 }, { id: 'other', api: 'openai-decisions' }], streamSimple: (model, context, options) => { captured = { model, options }; return 'stream' } }
  const fetch = () => {}
  const catalog = createPlanProvider({ base, fetch })
  catalog.update([{ id: 'unknown', name: 'Unknown' }, { id: 'known', name: 'Known model' }, { id: 'other', name: 'Other' }])
  assert.deepEqual(catalog.provider.getModels().map(m => [m.id, m.name, m.provider]), [['known', 'Known model', 'ocean-chatgpt-plan']])
  assert.equal(catalog.provider.streamSimple(catalog.provider.getModels()[0], {}, { onPayload: () => ({ store: true, stream: false, input: [] }) }), 'stream')
  assert.equal(captured.options.fetch, fetch)
  assert.deepEqual(await captured.options.onPayload({}, {}), { store: false, stream: true, input: [] })
  catalog.clear()
  assert.deepEqual(catalog.provider.getModels(), [])
})

test('real Responses implementation sends streaming requests to the restricted fetch', async () => {
  const { openaiProvider } = await import('@earendil-works/pi-ai/providers/openai')
  const { normalizeContext } = await import('@earendil-works/pi-ai/utils/transcript')
  const base = openaiProvider()
  let captured
  const network = createPlanProvider({ base, fetch: async (input, init) => {
    captured = { input: String(input), init }
    const frame = { type: 'response.completed', response: { id: 'resp_test', status: 'completed', output: [], usage: { input_tokens: 1, output_tokens: 0, total_tokens: 1 } } }
    return new Response(`data: ${JSON.stringify(frame)}\n\ndata: [DONE]\n\n`, { status: 200, headers: { 'content-type': 'text/event-stream' } })
  } })
  network.update([{ id: 'gpt-6.1-terra', name: 'GPT-6.1 Terra' }])
  const context = normalizeContext({ messages: [{ role: 'user', content: 'hi', timestamp: 0 }] })
  const events = network.provider.streamSimple(network.provider.getModels()[0], context, { apiKey: 'synthetic-token', maxTokens: 200, temperature: 0.5 })
  const types = []
  for await (const event of events) { types.push(event.type); if (event.type === 'error') throw new Error(event.error.errorMessage) }
  assert.ok(types.includes('done'))
  assert.equal(captured.input, 'https://api.openai.com/v1/responses')
  const body = JSON.parse(captured.init.body)
  assert.equal(body.model, 'gpt-6.1-terra')
  assert.equal(body.stream, true)
  assert.equal(body.store, false)
  assert.equal(body.temperature, undefined)
  assert.equal(body.max_output_tokens, undefined)
  assert.equal(new Headers(captured.init.headers).get('authorization'), 'Bearer synthetic-token')
})

test('Ocean PiAiAdapter streams a text response through the separate ChatGPT plan route', async () => {
  const { openaiProvider } = await import('@earendil-works/pi-ai/providers/openai')
  const { PiAiAdapter } = await import('@ocean/ocean-llm-pi-ai')
  const base = openaiProvider(), known = base.getModels().find(model => model.api === 'openai-responses')
  let observed
  const item = { type: 'message', id: 'msg_1', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'ok', annotations: [] }] }
  const frames = [
    { type: 'response.created', response: { id: 'resp_1' } },
    { type: 'response.output_item.added', output_index: 0, item: { ...item, content: [] } },
    { type: 'response.output_text.delta', output_index: 0, content_index: 0, delta: 'ok' },
    { type: 'response.output_item.done', output_index: 0, item },
    { type: 'response.completed', response: { id: 'resp_1', status: 'completed', output: [item], usage: { input_tokens: 2, output_tokens: 1, total_tokens: 3 } } },
  ]
  const plan = createPlanProvider({ base, fetch: async (url, init) => { observed = { url: String(url), init }; return new Response(frames.map(frame => `data: ${JSON.stringify(frame)}\n\n`).join('') + 'data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } }) } })
  plan.update([{ id: known.id, name: known.name }])
  const profiles = new Map([['ocean-chatgpt-plan', { provider: 'ocean-chatgpt-plan', displayName: 'ChatGPT plan', piProvider: plan.provider, configuredMaxTokens: new Map(), modelErrors: new Map(), transport: 'sse', streamIdleTimeoutMs: 10000 }]])
  const adapter = new PiAiAdapter({ profiles: () => profiles, resolveApiKey: async () => 'synthetic-token', auth: { credentials: { read: async () => undefined }, authContext: { env: async () => undefined, fileExists: async () => false } } })
  let output = ''
  for await (const chunk of adapter.stream({ provider: 'ocean-chatgpt-plan', model: known.id, messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }] })) if (chunk.type === 'text-delta') output += chunk.text
  assert.equal(output, 'ok')
  assert.equal(observed.url, 'https://api.openai.com/v1/responses')
  assert.equal(JSON.parse(observed.init.body).store, false)
})
