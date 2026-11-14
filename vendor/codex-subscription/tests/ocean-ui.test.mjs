import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { pathToFileURL } from 'node:url'
import { dictionaries } from '../src/client-languages.js'
import { PROJECT_URL } from '../src/client-shared.js'

const require = createRequire(import.meta.resolve('tsdown'))
const { rolldown } = await import(pathToFileURL(require.resolve('rolldown')).href)
const element = (type, props) => ({ type, props })
function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes)
  if (!value || typeof value !== 'object') return []
  return [value, ...nodes(value.props?.children)]
}

test('Ocean settings render only account/quota and models tabs', async () => {
  const source = await readFile(new URL('../src/client-section.jsx', import.meta.url), 'utf8')
  const bundle = await rolldown({ input: 'section', transform: { jsx: { runtime: 'automatic' } }, plugins: [{
    name: 'ocean-component-fixture',
    resolveId(id, importer) { return importer ? { id, external: true } : '\0section' },
    load() { return { code: source, moduleType: 'jsx' } },
  }] })
  let code
  try { code = (await bundle.generate({ format: 'cjs' })).output[0].code } finally { await bundle.close() }
  const hooks = { useState: value => [typeof value === 'function' ? value() : value, () => {}], useRef: () => ({ current: null }), useId: () => 'ocean', useEffect() {}, useLayoutEffect() {} }
  const shared = { usePreferenceSnapshot: () => ({}), useAccountStatusSnapshot: () => ({ status: 'ready', account: { authenticated: false } }) }
  const module = { exports: {} }
  new vm.Script(code).runInNewContext({ module, exports: module.exports, require: id => id === 'react' ? hooks : id === 'react/jsx-runtime' ? { jsx: element, jsxs: element } : id === './client-shared.js' ? shared : new Proxy({}, { get: (_target, key) => String(key) }) })
  const tree = module.exports.CodexSection({ preference: {}, rpc: {}, accountStatus: {}, t: key => key })
  const all = nodes(tree)
  assert.deepEqual(all.filter(node => node.props?.role === 'tab').map(node => node.props.children), ['settingsTab_start', 'settingsTab_models'])
  assert.equal(all.some(node => node.type === 'FeatureOverview'), false)
  assert.ok(all.some(node => node.props?.children === 'oceanScopeNotice'))
})

test('every supported dictionary identifies Ocean and explains the restricted integration', () => {
  for (const dictionary of Object.values(dictionaries)) {
    assert.equal(dictionary.title, 'Ocean Codex')
    assert.equal(dictionary.nav, 'Ocean Codex')
    assert.ok(dictionary.oceanScopeNotice.includes('OpenAI'))
  }
  assert.equal(PROJECT_URL, 'https://github.com/Ryltsevmg/Ocean-Chat')
})

test('Desktop RC does not register legacy Codex settings, composer quota or other contributions', async () => {
  const source = await readFile(new URL('../src/client.jsx', import.meta.url), 'utf8')
  const bundle = await rolldown({ input: 'client', transform: { jsx: { runtime: 'automatic' } }, plugins: [{
    name: 'ocean-desktop-widget-fixture',
    resolveId(id, importer) { return importer ? { id, external: true } : '\0client' },
    load() { return { code: source, moduleType: 'jsx' } },
  }] })
  let code
  try { code = (await bundle.generate({ format: 'cjs' })).output[0].code } finally { await bundle.close() }
  const contextTouched = new Error('client registration reached')
  const ctx = new Proxy({}, { get() { throw contextTouched } })
  for (const desktop of [true, false]) {
    const module = { exports: {} }
    const externals = { createHostDiagnostics: () => ({}) }
    new vm.Script(code).runInNewContext({ module, exports: module.exports, require: () => externals,
      ...(desktop ? { dshDesktop: { protocolVersion: 1 } } : {}) })
    if (desktop) assert.doesNotThrow(() => module.exports.apply(ctx))
    else assert.throws(() => module.exports.apply(ctx), error => error === contextTouched)
  }
})

test('Ocean client does not mount voice or prediction launchers or credit spending controls', async () => {
  const entry = await readFile(new URL('../src/client.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(entry, /<VoiceCallButton|codex-subscription-prediction|searchParams.has\('codexVoiceSession'\)/u)
  const usage = await readFile(new URL('../src/client-usage.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(usage, /<ResetCreditList/u)
})


test('Ocean model defaults and every supported UI dictionary use Ocean product labels', () => {
  assert.equal(dictionaries.ru.defaultModelFollow, 'Следовать настройке Ocean по умолчанию')
  for (const [language, dictionary] of Object.entries(dictionaries)) {
    assert.match(dictionary.defaultModelFollow, /Ocean/u, language)
    assert.match(dictionary.defaultModelFollowHint, /\{value\}/u, language)
    for (const [key, value] of Object.entries(dictionary)) {
      if (typeof value === 'string') assert.doesNotMatch(value, /(?<![A-Za-z0-9_])DSH(?![A-Za-z0-9_])/u, `${language}.${key}`)
    }
    // Stored source selectors stay compatible; only their display names change.
    assert.equal(dictionary.searchSource_dsh, 'Ocean')
  }
})

test('ChatGPT plan recovery UI offers confirmation and never renews retired registrations', async () => {
  const source = await readFile(new URL('../src/client-chatgpt-plan.jsx', import.meta.url), 'utf8')
  const bundle = await rolldown({ input: 'plan', transform: { jsx: { runtime: 'automatic' } }, plugins: [{ name: 'plan-fixture', resolveId(id, importer) { return importer ? { id, external: true } : '\0plan' }, load() { return { code: source, moduleType: 'jsx' } } }] })
  let code
  try { code = (await bundle.generate({ format: 'cjs' })).output[0].code } finally { await bundle.close() }
  const render = (account, confirmation) => {
    const states = [{ activeId: account.id, accounts: [account] }, '', undefined, false, false, confirmation, false]
    const module = { exports: {} }
    new vm.Script(code).runInNewContext({ module, exports: module.exports, require: id => id === 'react' ? { useState: () => [states.shift(), () => {}], useEffect() {} } : id === 'react/jsx-runtime' ? { jsx: element, jsxs: element } : new Proxy({}, { get: (_target, key) => String(key) }) })
    return nodes(module.exports.ChatGPTPlanCard({ rpc: {}, t: key => key, active: true }))
  }
  const pending = { id: 'account-one', label: 'One', revocationPending: true, reauthorizationRequired: true }
  const first = render(pending)
  assert.ok(first.some(node => node.props?.children === 'planRecover'))
  assert.equal(first.some(node => node.props?.children === 'planRecoveryConfirm'), false)
  assert.equal(first.some(node => node.props?.children === 'planRenew'), false)
  const confirmed = render(pending, pending.id)
  assert.ok(confirmed.some(node => node.props?.children === 'planRecoveryConfirm'))
  assert.ok(confirmed.some(node => node.props?.children === 'planCancel'))
  const retired = render({ ...pending, revocationPending: false, retired: true, signedOut: true, revocationUnconfirmed: true })
  assert.equal(retired.some(node => node.props?.children === 'planRenew'), false)
  assert.ok(retired.some(node => node.props?.children === 'planRetired'))
  assert.ok(retired.some(node => node.props?.role === 'alert' && node.props.children === 'planRevocationUnconfirmed'))
})
