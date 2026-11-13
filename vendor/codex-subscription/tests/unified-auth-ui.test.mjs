import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('primary ChatGPT sign-in is before the explicit legacy disclosure', async () => {
  const source = await readFile(new URL('../src/client-section.jsx', import.meta.url), 'utf8')
  assert.ok(source.indexOf('<ChatGPTPlanCard') < source.indexOf('<AccountCard'))
  assert.match(source, /<details className="codexLegacyConnection"/u)
  assert.match(source, /t\('legacyConnectionHint'\)/u)
})

test('plan card uses grouped visible actions and optional label', async () => {
  const source = await readFile(new URL('../src/client-chatgpt-plan.jsx', import.meta.url), 'utf8')
  assert.match(source, /codexPlanActions/u)
  assert.match(source, /variant="primary"/u)
  assert.doesNotMatch(source, /disabled=\{busy \|\| !label.trim\(\)\}/u)
  assert.match(source, /label.trim\(\) \|\| t\('planDefaultLabel'\)/u)
  assert.match(source, /role="status"/u)
})

import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import vm from 'node:vm'
const require = createRequire(import.meta.resolve('tsdown'))
const { rolldown } = await import(pathToFileURL(require.resolve('rolldown')).href)
const element = (type, props) => ({ type, props })
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : value && typeof value === 'object' ? [value, ...nodes(value.props?.children)] : []
async function fixture({ status, models, adding = false, confirmation } = {}) {
  const source = await readFile(new URL('../src/client-chatgpt-plan.jsx', import.meta.url), 'utf8')
  const bundle = await rolldown({ input: 'plan', transform: { jsx: { runtime: 'automatic' } }, plugins: [{ name: 'fixture', resolveId(id, importer) { return importer ? { id, external: true } : '\0plan' }, load() { return { code: source, moduleType: 'jsx' } } }] })
  let code
  try { code = (await bundle.generate({ format: 'cjs' })).output[0].code } finally { await bundle.close() }
  const states = [status, '', models, false, false, confirmation, false, adding]
  const calls = []
  const effects = [], updates = []
  let index = 0
  const module = { exports: {} }
  new vm.Script(code).runInNewContext({ module, exports: module.exports, require: id => id === 'react' ? { useState: () => { const slot = index++; return [states.shift(), value => updates.push([slot, value])] }, useEffect: effect => effects.push(effect) } : id === 'react/jsx-runtime' ? { jsx: element, jsxs: element } : id === './client-recovery.js' ? { recoveryCall: async (_rpc, endpoint, payload) => { calls.push([endpoint, payload]); return status } } : new Proxy({}, { get: (_t, key) => String(key) }) })
  return { all: nodes(module.exports.ChatGPTPlanCard({ rpc: {}, t: key => key, active: true })), calls, effects, updates }
}

test('empty account label permits primary sign-in with a safe default label', async () => {
  const { all, calls } = await fixture({ status: { accounts: [] } })
  const button = all.find(node => node.props?.children === 'planSignIn')
  assert.equal(button.props.disabled, false)
  button.props.onClick()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(calls[0][0], 'plan/login/start')
  assert.equal(calls[0][1].label, 'planDefaultLabel')
})

test('connected state has grouped model actions but no second sign-in form', async () => {
  const { all } = await fixture({ status: { activeId: 'one', accounts: [{ id: 'one', label: 'One' }] } })
  assert.ok(all.some(node => node.props?.children === 'planConnected'))
  assert.equal(all.some(node => node.props?.children === 'planSignIn'), false)
  assert.equal(all.find(node => node.props?.children === 'planLoadModels').props.disabled, false)
})

test('catalog from another account is not shown and unusable accounts cannot load models', async () => {
  const { all } = await fixture({ status: { activeId: 'two', accounts: [{ id: 'two', label: 'Two', reauthorizationRequired: true }] }, models: { accountId: 'one', items: [{ id: 'model', name: 'Secret old model' }] } })
  assert.equal(all.some(node => node.props?.children === 'Secret old model'), false)
  assert.equal(all.find(node => node.props?.children === 'planLoadModels').props.disabled, true)
})


test('changing selected account clears pending sign-out confirmation', async () => {
  const { effects, updates } = await fixture({ status: { activeId: 'two', accounts: [{ id: 'two', label: 'Two' }] }, confirmation: 'one' })
  effects[1]()
  assert.ok(updates.some(([slot, value]) => slot === 5 && value === undefined))
})

test('external sign-out hides catalog even when selected account id is unchanged', async () => {
  const { all } = await fixture({ status: { activeId: 'one', accounts: [{ id: 'one', label: 'One', signedOut: true }] }, models: { accountId: 'one', items: [{ id: 'model', name: 'Old catalog' }] } })
  assert.equal(all.some(node => node.props?.children === 'Old catalog'), false)
  assert.ok(all.some(node => node.props?.children === 'planDisconnected'))
})
