/** Ocean ships subscription sign-in, model selection and quota, not donor integrations. */
export const OCEAN_LOCKED_SETTINGS = Object.freeze({
  remoteControl: 'off', voiceCall: 'off', composerPredictions: 'off', connectors: 'off',
  subagentBackend: 'dsh', searchProvider: 'dsh', fetchProvider: 'dsh', otherModels: 'off',
  imageGeneration: false, imageShortcut: false, imageEditing: false, imageViewer: false,
  imageAnnotations: false, imageSketch: false, imageSketchAgent: false,
  compactionMode: 'dsh', reasoningCache: 'off', connectionMode: 'sse',
  autoQuotaRetry: false,
})

/** Persisted donor settings cannot enable a capability absent from this Ocean build. */
export function oceanSettings(value) { return { ...value, ...OCEAN_LOCKED_SETTINGS } }

/** Reject enabling patches before any settings write; never silently claim success. */
export function assertOceanSettingsPatch(patch) {
  for (const [field, value] of Object.entries(patch)) {
    if (Object.hasOwn(OCEAN_LOCKED_SETTINGS, field) && value !== OCEAN_LOCKED_SETTINGS[field]) {
      throw new Error(`Ocean subscription capability is unavailable: ${field}`)
    }
  }
}

const RPC = new Set([
  'plan/status', 'plan/login/start', 'plan/login/cancel', 'plan/account/select', 'plan/account/sign-out', 'plan/account/recover-sign-out', 'plan/models',
  'status', 'login/start', 'login/status', 'login/submit', 'login/cancel', 'logout',
  'account/select', 'account/remove', 'usage', 'usage/accounts', 'usage/history', 'usage/profile',
  'diagnostics', 'preferences/status', 'preferences/models', 'preferences/update',
  'default-model/status', 'default-model/select', 'default-model/reset',
  'storage/status', 'storage/clear-forecast',
])

/** Deny advanced and unknown RPCs before handlers can touch credentials, devices or the network. */
export function withOceanRpcPolicy(handler) {
  return (endpoint, payload, signal) => {
    if (!RPC.has(endpoint)) return Promise.resolve({ ok: false, error: {
      code: 'unavailable', message: 'This capability is not available in the Ocean subscription build', details: { issues: [] },
    } })
    return handler(endpoint, payload, signal)
  }
}

const NETWORK_AREAS = new Set(['login', 'oauth', 'model', 'quota', 'catalog'])

/** Defense in depth for registered providers and future donor paths outside the RPC bridge. */
export function withOceanNetworkPolicy(network) {
  const check = area => {
    if (!NETWORK_AREAS.has(area)) throw new Error(`Ocean subscription network capability is unavailable: ${area}`)
  }
  return Object.freeze({
    ...network,
    run(area, ...args) { check(area); return network.run(area, ...args) },
    fetch(area, ...args) { check(area); return network.fetch(area, ...args) },
  })
}
