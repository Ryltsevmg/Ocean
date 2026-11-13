import { restorePlanCatalog } from './chatgpt-plan-startup.js'
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai'
import { createPlanProvider } from './chatgpt-plan-provider.js'
import { createPlanVault } from './chatgpt-plan-vault.js'
import { createPlanNetwork } from './chatgpt-plan-network.js'
import { createPlanService } from './chatgpt-plan-service.js'
import { createPlanRpcHandler } from './chatgpt-plan-rpc.js'
import { oceanSettings, assertOceanSettingsPatch, withOceanRpcPolicy, withOceanNetworkPolicy } from './ocean-policy.js'
import { createSettingsAdapter } from './settings-adapter.js'
import { observeAdapter } from './request-observer.js'
import { createHiddenModelDirectory } from './hidden-model-directory.js'
import { createDefaultModelController } from './default-model.js'
import { withDefaultReasoningEffort } from './default-reasoning-effort.js'
import { DEFAULT_REASONING_EFFORT_FIELD, normalizeDefaultReasoningEffort } from './settings-contract.js'
import { PREFERENCE_FIELDS, normalizeReasoningCache } from './preference-fields.js'
import { createSubscriptionPreferencesTool } from './subscription-preferences-tool.js'
import { createSubscriptionConnection } from './subscription-connection.js'
import { createCompactionBridge } from './subscription-compaction.js'
import { createReasoningBridge } from './subscription-reasoning.js'
import { registerSubscriptionTransport } from './subscription-transport.js'
import { createSubagentDefaults, normalizeSubagentModel, normalizeSubagentEffort } from './subagent-defaults.js'
import { inspectSubagentRuntime } from './subagent-runtime.js'
import { createSubagentCli } from './subagent-cli.js'
import { createRuntimeManagement } from './runtime-management.js'
import { createSketchAgentBridge } from './sketch-agent-bridge.js'
import { createSketchAgentTool } from './sketch-agent-tool.js'
import * as dshCredentials from '@ocean/ocean-credentials'
import WebSocket from 'ws'
import { hostname } from 'node:os'
import { readSubscriptionCredentials } from './subscription-credentials.js'
import { USER_AGENT } from './version.js'
import { createRemoteControl } from './remote-control.js'
import { createDshRemoteControl } from './remote-control-dsh.js'
import { createVoiceHangupClassifier } from './voice-hangup.js'
import { createRemoteHistorySource } from './remote-history-source.js'
import { createUltraExecutionPreset } from './ultra-execution.js'
import { createRemoteImageAssets } from './remote-image-assets.js'
import { dshHomePath } from '@ocean/ocean-home-paths'
import * as dshLlm from '@ocean/ocean-llm'
import { retryPolicyFor } from './retry-policy.js'
import { PiAiAdapter } from '@ocean/ocean-llm-pi-ai'
import { createRequire } from 'node:module'

// Match the settings host's volatile protocol, not a stale profile-local peer.
const z = createRequire(import.meta.resolve('@ocean/ocean-settings'))('@deepseek-ai/schemastery')

import { createCodexAuthService, DshOAuthCredentialStore } from './credential-store.js'
import { DshOAuthAccountVault } from './account-vault.js'
import { openCodexAuthUrl } from './external-url.js'
import { CodexLoginCoordinator, createCodexRpcHandler } from './login-coordinator.js'
import { createCodexNetworkTransport, resolveCodexOAuthProxy } from './oauth-network.js'
import { createModels, openaiCodexProvider, openaiCodexSubscriptionProvider } from './pi-ai-runtime.js'
import { createOfficialModelCatalog, withModelCatalogReady } from './model-catalog.js'
import { readCapabilitySettings, normalizeSearchDomains, CUSTOM_CONTEXT_OVERRIDES_FIELD, SEARCH_MODE_FIELD, SEARCH_MODES, SEARCH_DOMAINS_FIELD, QUOTA_ALERTS_FIELD, QUOTA_ALERT_MODES, QUOTA_THRESHOLD_FIELDS, MAX_CONTEXT_BUDGET } from './capability-settings.js'
import { DSH_SEARCH_PROVIDER_ID, createDshSearchProvider } from './dsh-search.js'
import { createSearchRouter, gateSearchProvider } from './search-router.js'
import { CODEX_AUTO_SEARCH_PROVIDER_ID, CODEX_SEARCH_PROVIDER_ID, createCodexAutoSearchProvider, createCodexSearchProvider } from './codex-search.js'
import { createCodexFetchProvider, createCodexFetchRouter, configuredFetchProviderId } from './codex-fetch.js'
import { FETCH_PROVIDER_FIELD, FETCH_PROVIDER_CODEX, normalizeFetchProvider } from './settings-contract.js'
import { createCodexImageTool } from './codex-images.js'
import { IMAGE_FEATURE_DEFAULTS } from './image-features.js'
import { watchImageTool } from './image-tool-registration.js'
import { IMAGE_MODELS, DEFAULT_IMAGE_MODEL } from './image-models.js'
import { OriginalImageStore } from './image-original-store.js'
import { inheritedOriginalImageRef } from './image-original-contract.js'
import { createSubscriptionDiagnostics } from './diagnostics.js'
import { diagnosticLog } from './diagnostic-log.js'
import { setAuthFailureLogger } from './http-failure.js'
import { PACKAGE_VERSION } from './version.js'
import { hostDshVersion } from './subagent-runtime.js'
import { createDiagnosticOperations } from './diagnostic-operations.js'
import { VOICE_CALL_FIELD, VOICE_VOICE_FIELD, VOICE_LANGUAGE_FIELD, normalizeVoiceCall, normalizeVoiceVoice, normalizeVoiceLanguage, AUTO_QUOTA_RETRY_FIELD, CONNECTORS_FIELD, normalizeConnectorMode, CONTEXT_MODE_FIELD, contextModelGroups, CUSTOM_CONTEXT_MODEL_CAPS, CUSTOM_CONTEXT_MODEL_DEFAULTS, CUSTOM_CONTEXT_MODEL_FIELDS, CUSTOM_CONTEXT_WINDOW_FIELD, DEFAULT_AUTO_QUOTA_RETRY, DEFAULT_CUSTOM_CONTEXT_WINDOW, DISABLED_MODELS_FIELD, INPUT_IMAGE_DETAIL_FIELD, REASONING_SUMMARY_FIELD, normalizeReasoningSummary, RETRY_POLICY_FIELD, normalizeRetryPolicy, STREAM_IDLE_TIMEOUT_MINUTES_FIELD, LEGACY_QUICK_QUOTA_FIELD, normalizeAutoQuotaRetry, normalizeDisabledModels, normalizeInputImageDetail, normalizeQuickQuotaMode, normalizeOutputVerbosity, normalizeStreamIdleTimeoutMinutes, QUICK_QUOTA_MODE_FORECAST, QUICK_QUOTA_MODE_FIELD, OUTPUT_VERBOSITY_FIELD, SEARCH_PROVIDER_AUTO, SEARCH_PROVIDER_CODEX, SEARCH_PROVIDER_DSH, SEARCH_PROVIDER_FIELD, SPEED_MODE_FIELD, normalizeComposerModelPicker, normalizeContextMode, normalizeCustomContextWindow, supportsCodexFastMode } from './settings-contract.js'
import { createCodexUsageReader } from './usage.js'
import { createAccountUsageReader } from './account-usage.js'
import { createPlanHistoryReader } from './plan-history.js'
import { createUsageProfileReader } from './usage-profile.js'
import { createConnectorsClient, createConnectorTools } from './connectors.js'
import { catalogModelsReady, createCodexQuotaRetryHandler } from './quota-retry.js'
import { createQuotaForecastReader } from './quota-forecast.js'
import { QuotaForecastStateStore } from './quota-forecast-store.js'
import { createCodexResetCreditService } from './reset-credits.js'

export const name = 'codex-subscription'
export const inject = ['llm', 'credentials', 'settings', 'web', 'loader', 'tools', 'attachments']

const PROVIDER = 'openai-codex'
const OAUTH_EXPIRY_SKEW_MS = 60_000
const CREDENTIAL_REF = dshCredentials.credentialRef('OCEAN_CODEX_SUBSCRIPTION_OAUTH')
const ACCOUNT_VAULT_KEY = dshCredentials.credentialKey('ocean-codex-subscription', 'accounts')
const WEB_ENTRY_ID = 'web'
const DSH_SEARCH_PROVIDER_FALLBACK = 'deepseek-official'
const SUBSCRIPTION_SEARCH_PROVIDER_IDS = new Set([CODEX_SEARCH_PROVIDER_ID, CODEX_AUTO_SEARCH_PROVIDER_ID, DSH_SEARCH_PROVIDER_ID])
const MAX_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024
const REQUEST_IMAGE_PIXEL_BUDGET = 2048 * 2048
const REQUEST_IMAGE_MAX_BYTES = 1024 * 1024

import { createSubscriptionRpcHandler } from './subscription-rpc.js'
import { createVoicePreview } from './voice-preview.js'
import { createComposerPredictions } from './composer-predictions.js'
import { withEndCallTool } from './voice-tools.js'
import { createNativeVoiceHost } from './voice-native-host.js'
export { createSubscriptionRpcHandler } from './subscription-rpc.js'

export function createSearchProviderSwitcher(loader) {
  const webEntry = () => [...loader.entries()].find(entry => entry.options?.id === WEB_ENTRY_ID)
  // Cordis 4.1 separates active validated config from raw input.
  const current = () => {
    const fiber = webEntry()?.fiber
    const value = (fiber?.effectiveConfig ?? fiber?.config)?.searchProvider
    return typeof value === 'string' ? value : value?.get?.()
  }
  const dshProviderId = () => {
    const active = current()
    const saved = webEntry()?.options?.config?.searchProvider
    return [active, saved].find(id => typeof id === 'string' && id.length > 0 && !SUBSCRIPTION_SEARCH_PROVIDER_IDS.has(id))
      ?? DSH_SEARCH_PROVIDER_FALLBACK
  }
  const writeProvider = async provider => {
    const entry = webEntry()
    const fiber = entry?.fiber
    if (entry === undefined || fiber === undefined || typeof fiber.update !== 'function') {
      throw new Error('DSH web runtime is unavailable')
    }
    if (current() === provider) return
    // Fiber.update takes the raw config and restarts web with it (noSave: the user's settings are untouched).
    // The restart reloads this plugin, which then finds the provider already selected.
    await fiber.update({ ...(entry.options?.config ?? {}), searchProvider: provider }, true)
  }
  // "dsh" uses only the provider the host has configured.
  const select = selection => writeProvider(selection === SEARCH_PROVIDER_CODEX
    ? CODEX_SEARCH_PROVIDER_ID
    : selection === SEARCH_PROVIDER_AUTO ? CODEX_AUTO_SEARCH_PROVIDER_ID : DSH_SEARCH_PROVIDER_ID)
  return Object.freeze({
    dshProviderId,
    current,
    select,
  })
}

const settingsFields = {
  [DISABLED_MODELS_FIELD]: z.transform(z.array(z.string()).max(100), normalizeDisabledModels).default([]),
  [AUTO_QUOTA_RETRY_FIELD]: z.boolean().default(DEFAULT_AUTO_QUOTA_RETRY),
  subagentDefaultModel: z.transform(z.string().max(80), normalizeSubagentModel).default(''),
  ...Object.fromEntries(Object.entries(PREFERENCE_FIELDS).map(([field, rule]) => [field, rule.default === undefined ? z.union(rule.choices) : z.union(rule.choices).default(rule.default)])),
  imageModel: z.union(Object.keys(IMAGE_MODELS)).default(DEFAULT_IMAGE_MODEL),
  imageQuality: z.union(['auto','low','medium','high','xhigh','max']).default('auto'),
  ...Object.fromEntries(Object.entries(IMAGE_FEATURE_DEFAULTS).map(([key, value]) => [key, z.boolean().default(value)])),
  [CUSTOM_CONTEXT_OVERRIDES_FIELD]: z.dict(z.number().step(1).min(1).max(MAX_CONTEXT_BUDGET)).default({}),
  [SEARCH_MODE_FIELD]: z.union(SEARCH_MODES).default('live'),
  [SEARCH_DOMAINS_FIELD]: z.transform(z.array(z.string()).max(20), normalizeSearchDomains).default([]),
  ...Object.fromEntries(QUOTA_THRESHOLD_FIELDS.map(key => [key, z.number().step(1).min(1).max(100).default(20)])),
  [QUOTA_ALERTS_FIELD]: z.union(QUOTA_ALERT_MODES).default('important'),
  [LEGACY_QUICK_QUOTA_FIELD]: z.boolean(),
  [CUSTOM_CONTEXT_WINDOW_FIELD]: z.number().step(1).min(128_000).max(1_000_000).default(DEFAULT_CUSTOM_CONTEXT_WINDOW),
  ...Object.fromEntries(Object.entries(CUSTOM_CONTEXT_MODEL_FIELDS).map(([modelKey, field]) => [field, z.number().step(1).min(128_000).max(CUSTOM_CONTEXT_MODEL_CAPS[modelKey]).default(CUSTOM_CONTEXT_MODEL_DEFAULTS[modelKey])])),
}
// Keep the metadata API usable by older hosts; the host-matched Schemastery
// above also creates the runtime references required by newer volatile loaders.
export const Config = z.object({ ...Object.fromEntries(Object.entries(settingsFields).map(([key, field]) => [key, field.extra('volatile', true)])), planLoginTimeoutMs: z.number().step(1).min(10000).max(600000).default(120000), planRevocationTimeoutMs: z.number().step(1).min(1000).max(60000).default(10000), planRevocationAttempts: z.number().step(1).min(1).max(3).default(2), planRevocationRetryDelayMs: z.number().step(1).min(0).max(10000).default(500) })

export function apply(ctx, config = {}) {
  const settings = createSettingsAdapter(ctx, config, { read: oceanSettings, validate: assertOceanSettingsPatch })
  // Diagnostics remain in memory; support export requires an explicit user action.
  diagnosticLog.info('plugin', `loaded ${PACKAGE_VERSION}`, `DSH ${hostDshVersion() ?? 'unknown'}, node ${process.version}, ${process.platform}`)
  setAuthFailureLogger((message, detail) => diagnosticLog.error('auth', message, detail))
  const network = withOceanNetworkPolicy(createCodexNetworkTransport())
  const planVault = createPlanVault({ credentials: ctx.credentials, key: dshCredentials.credentialKey('ocean-codex-subscription', 'chatgpt-plan') })
  const planNetwork = createPlanNetwork(network)
  const planProvider = createPlanProvider({ base: openaiProvider(), fetch: planNetwork.fetch })
  let planRevision = 0, planCatalogAccountId
  let planEpoch = new AbortController()
  const planUpdated = () => { planRevision++; ctx.llm.emitAdaptersUpdated?.() }
  const planService = createPlanService({ vault: planVault, timeoutMs: config.planLoginTimeoutMs ?? 120000, revocationTimeoutMs: config.planRevocationTimeoutMs ?? 10000, revocationAttempts: config.planRevocationAttempts ?? 2, revocationRetryDelayMs: config.planRevocationRetryDelayMs ?? 500, fetch: planNetwork.fetch, onAccountChanged: () => { planEpoch.abort(); planEpoch = new AbortController(); planCatalogAccountId = undefined; planProvider.clear(); planUpdated() }, onCatalog: (models, id) => { planCatalogAccountId = id; planProvider.update(models); planUpdated(); return planProvider.provider.getModels().map(({ id, name }) => ({ id, name })) } })
  const planHandler = createPlanRpcHandler({ service: planService, openExternal: openCodexAuthUrl })
  ctx.effect(() => () => { planEpoch.abort(); return planService.cancel() })
  const diagnosticOperations = createDiagnosticOperations()
  ctx.effect(() => ctx.on?.('tools/result', (exec, result) => diagnosticOperations.tool(exec, result)), 'codex-subscription: operation evidence')
  const originalImages = new OriginalImageStore()
  const accountVault = new DshOAuthAccountVault(ctx.credentials, {
    key: ACCOUNT_VAULT_KEY,
    legacyRef: CREDENTIAL_REF,
    legacyRefs: [],
  })
  const store = new DshOAuthCredentialStore(ctx.credentials, CREDENTIAL_REF, [], {
    expirySkewMs: OAUTH_EXPIRY_SKEW_MS,
    vault: accountVault,
  })
  const baseProvider = openaiCodexProvider()
  let resolveAuth = async () => undefined
  let subagentBackend
  const subagentCli = createSubagentCli({ profile: () => ctx.get?.('profileContext') })
  const runtimeManagement = createRuntimeManagement({
    inspect: () => inspectSubagentRuntime(undefined, subagentCli), cli: subagentCli,
    active: () => subagentBackend?.activeCount() ?? 0,
    selectDsh: async () => { if (subagentBackend) await subagentBackend.select('dsh'); else await settings.update({ subagentBackend: 'dsh' }) },
  })
  const modelCatalog = createOfficialModelCatalog({
    onUpdated: () => ctx.llm.emitAdaptersUpdated?.(),
    onCacheError: error => ctx.logger?.debug?.('could not access the Codex model catalog cache (%s)', error?.code ?? error?.name ?? 'unknown error'),
    cacheDirectory: dshHomePath('state', 'ocean-codex-subscription', 'model-catalog'),
    getAuth: options => resolveAuth(options),
    readCredential: options => store.read(PROVIDER, options),
    baseModels: () => baseProvider.getModels(),
    fetch: (input, init) => network.fetch('catalog', input, init),
    retryDelaysMs: [5_000, 15_000, 30_000, 60_000, 120_000, 300_000],
  })
  const subagentCatalog = createOfficialModelCatalog({
    subagent: true,
    getAuth: options => resolveAuth(options),
    readCredential: options => store.read(PROVIDER, options),
    baseModels: () => baseProvider.getModels(),
    fetch: (input, init) => network.fetch('catalog', input, init),
  })
  ctx.effect(() => () => subagentCatalog.clear())
  const subagentDefaults = createSubagentDefaults({
    readSettings: settings.get, catalog: subagentCatalog,
    modelSelection: () => ctx.get?.('subagentModelSelection')?.current(),
    projections: () => ctx.get?.('sessionProjections'),
  })
  const ultra = createUltraExecutionPreset({
    catalog: modelCatalog,
    resolveAgent: () => ctx.get?.('agents')?.currentInitiator?.(),
    defaultEffort: () => settings.get()[DEFAULT_REASONING_EFFORT_FIELD],
  })
  ctx.inject(['systemPrompt'], scope => scope.effect(() => {
    const dispose = ultra.install(scope)
    ctx.llm.emitAdaptersUpdated?.()
    return () => { dispose(); ctx.llm.emitAdaptersUpdated?.() }
  }, 'codex-subscription: Ultra execution preset'))
  const connection = createSubscriptionConnection({ resolveMode: () => settings.get().connectionMode })
  // The settings surface edits DSH's own default model instead of keeping a
  // second copy, so every new conversation opens on what the user selected.
  const defaultModel = createDefaultModelController({
    resolveService: () => ctx.get?.('agentDefaultModel'),
    resolveEditor: () => ctx.get?.('configEditor'),
    listModels: () => modelCatalog.getModels().map(model => model.id),
  })
  const accountScope = async () => {
    await resolveAuth()
    const credential = await store.read(PROVIDER)
    return credential?.type === 'oauth' ? credential.accountId : undefined
  }
  const compaction = createCompactionBridge({ enabled: () => settings.get().compactionMode === 'cloud', accountScope })
  const reasoning = createReasoningBridge({
    enabled: () => normalizeReasoningCache(settings.get().reasoningCache) === 'on',
    supportsModel: id => modelCatalog.metadata(id)?.supportsReasoningEffortUpdates === true,
    resolveSession: id => ctx.get?.('sessions')?.get?.(id),
    cloud: () => settings.get().compactionMode === 'cloud',
    unlimited: () => settings.get()[RETRY_POLICY_FIELD] === 'unlimited',
    accountScope,
    diagnostic: reason => diagnosticLog.info('model', `cache-preserving reasoning: ${reason}`),
    lockDiagnostic: event => diagnosticLog[event.event === 'conflict' ? 'warn' : 'info']('model', 'reasoning checkpoint lock', JSON.stringify(event)),
  })
  ctx.on('session/created', session => reasoning.sessionCreated(session))
  ctx.on('session/disposed', session => reasoning.sessionDisposed(session))
  ctx.on('session/event', (session, event) => reasoning.sessionEvent(session, event))
  ctx.effect(() => () => connection.dispose())
  const provider = openaiCodexSubscriptionProvider({
    ultra,
    connection,
    compaction,
    reasoning,
    resolveSpeedMode: () => settings.get()[SPEED_MODE_FIELD],
    resolveOutputVerbosity: () => normalizeOutputVerbosity(settings.get()[OUTPUT_VERBOSITY_FIELD]),
    resolveInputImageDetail: () => settings.get()[INPUT_IMAGE_DETAIL_FIELD],
    resolveReasoningSummary: () => settings.get()[REASONING_SUMMARY_FIELD],
    resolveContextMode: () => normalizeContextMode(settings.get()[CONTEXT_MODE_FIELD]),
    resolveCustomContextWindow: modelKey => {
      const overrides = readCapabilitySettings(settings.get())[CUSTOM_CONTEXT_OVERRIDES_FIELD]
      if (Object.hasOwn(overrides, modelKey)) return overrides[modelKey]
      const field = CUSTOM_CONTEXT_MODEL_FIELDS[modelKey]
      if (field === undefined) return undefined
      return normalizeCustomContextWindow(settings.get()[field] ?? CUSTOM_CONTEXT_MODEL_DEFAULTS[modelKey], CUSTOM_CONTEXT_MODEL_CAPS[modelKey])
    },
    resolveReviewModel: () => settings.get().reviewModel,
    catalog: modelCatalog,
    runNetwork: network.run,
    runOAuthRefresh: network.refreshOAuth,
    beginModelAttempt: network.beginModelAttempt,
  })
  let fetchRouted = false
  const preferences = {
    status: () => {
      const models = modelCatalog.getModels()
      return {
        [DISABLED_MODELS_FIELD]: normalizeDisabledModels(settings.get()[DISABLED_MODELS_FIELD]),
        [AUTO_QUOTA_RETRY_FIELD]: normalizeAutoQuotaRetry(settings.get()[AUTO_QUOTA_RETRY_FIELD]),
        compactionMode: settings.get().compactionMode ?? 'dsh',
        reasoningCache: normalizeReasoningCache(settings.get().reasoningCache),
        [DEFAULT_REASONING_EFFORT_FIELD]: normalizeDefaultReasoningEffort(settings.get()[DEFAULT_REASONING_EFFORT_FIELD]),
        connectionMode: settings.get().connectionMode ?? 'sse',
        reviewModel: settings.get().reviewModel ?? 'session',
        remoteControl: settings.get().remoteControl ?? 'off',
        composerPredictions: settings.get().composerPredictions === 'on' ? 'on' : 'off',
        composerModelPicker: normalizeComposerModelPicker(settings.get().composerModelPicker),
        otherModels: settings.get().otherModels === 'off' ? 'off' : 'on',
        subagentBackend: settings.get().subagentBackend ?? 'dsh',
        subagentDefaultModel: normalizeSubagentModel(settings.get().subagentDefaultModel),
        subagentDefaultEffort: normalizeSubagentEffort(settings.get().subagentDefaultEffort),
        subagentModels: subagentDefaults.list(),
        subagentBackendAvailable: subagentBackend !== undefined,
        subagentRuntimeInstalled: inspectSubagentRuntime(undefined, subagentCli).installed,
        ...readCapabilitySettings(settings.get()),
        [QUICK_QUOTA_MODE_FIELD]: normalizeQuickQuotaMode(
          settings.get()[QUICK_QUOTA_MODE_FIELD],
          settings.get()[LEGACY_QUICK_QUOTA_FIELD],
        ),
        [SEARCH_PROVIDER_FIELD]: settings.get()[SEARCH_PROVIDER_FIELD],
        [FETCH_PROVIDER_FIELD]: normalizeFetchProvider(settings.get()[FETCH_PROVIDER_FIELD]),
        fetchRoutingAvailable: fetchRouted,
        [SPEED_MODE_FIELD]: settings.get()[SPEED_MODE_FIELD],
        [OUTPUT_VERBOSITY_FIELD]: normalizeOutputVerbosity(settings.get()[OUTPUT_VERBOSITY_FIELD]),
        [INPUT_IMAGE_DETAIL_FIELD]: normalizeInputImageDetail(settings.get()[INPUT_IMAGE_DETAIL_FIELD]),
        [REASONING_SUMMARY_FIELD]: normalizeReasoningSummary(settings.get()[REASONING_SUMMARY_FIELD]),
        [VOICE_CALL_FIELD]: normalizeVoiceCall(settings.get()[VOICE_CALL_FIELD]),
        [VOICE_VOICE_FIELD]: normalizeVoiceVoice(settings.get()[VOICE_VOICE_FIELD]),
        [VOICE_LANGUAGE_FIELD]: normalizeVoiceLanguage(settings.get()[VOICE_LANGUAGE_FIELD]),
        [RETRY_POLICY_FIELD]: normalizeRetryPolicy(settings.get()[RETRY_POLICY_FIELD]),
        [CONNECTORS_FIELD]: normalizeConnectorMode(settings.get()[CONNECTORS_FIELD]),
        [STREAM_IDLE_TIMEOUT_MINUTES_FIELD]: normalizeStreamIdleTimeoutMinutes(settings.get()[STREAM_IDLE_TIMEOUT_MINUTES_FIELD]),
        [CONTEXT_MODE_FIELD]: normalizeContextMode(settings.get()[CONTEXT_MODE_FIELD]),
        [CUSTOM_CONTEXT_WINDOW_FIELD]: normalizeCustomContextWindow(settings.get()[CUSTOM_CONTEXT_WINDOW_FIELD]),
        ...Object.fromEntries(Object.entries(CUSTOM_CONTEXT_MODEL_FIELDS).map(([modelKey, field]) => [field, normalizeCustomContextWindow(settings.get()[field] ?? CUSTOM_CONTEXT_MODEL_DEFAULTS[modelKey], CUSTOM_CONTEXT_MODEL_CAPS[modelKey])])),
        contextModels: contextModelGroups(models),
        availableModels: models.map(({ id, name }) => ({ id, name })),
        catalogStatus: modelCatalog.status(),
        verbosityModels: provider.getModels().filter(model => modelCatalog.metadata(model.id)?.supportVerbosity ?? model.id !== 'gpt-5.3-codex-spark').map(model => model.id),
        ultrafastModels: provider.getModels().filter(model => modelCatalog.metadata(model.id)?.supportsUltrafast === true).map(model => model.id),
        ultraModels: provider.getModels().filter(model => ultra.supported(model.id)).map(model => model.id),
        fastModels: provider.getModels().filter(model => modelCatalog.metadata(model.id)?.supportsFast ?? supportsCodexFastMode(model.id)).map(model => model.id),
        writable: ctx.settings.writable,
      }
    },
    update: async patch => {
      if (patch.subagentDefaultModel && !subagentDefaults.list().some(model => model.id === patch.subagentDefaultModel)) {
        throw new Error('Codex subtask model is unavailable or disallowed')
      }
      if (patch[FETCH_PROVIDER_FIELD] === FETCH_PROVIDER_CODEX && !fetchRouted) throw new Error('This DSH version does not support Codex webpage reading')
      if (Object.hasOwn(patch, 'subagentBackend')) {
        if (!subagentBackend) throw new Error('DSH subagent services are unavailable')
        await subagentBackend.select(patch.subagentBackend)
        if (patch.subagentBackend === 'codex') await subagentCatalog.refresh().catch(() => {})
      }
      const rest = { ...patch }
      delete rest.subagentBackend
      if (Object.keys(rest).length) await settings.update(rest)
    },
  }
  const authModels = createModels({ credentials: store })
  authModels.setProvider(provider)
  const profile = Object.freeze({
    provider: PROVIDER,
    displayName: 'ChatGPT subscription (legacy)',
    piProvider: provider,
    configuredMaxTokens: new Map(),
    // Custom PiAiAdapter profiles bypass the settings-backed profile resolver,
    // so the model diagnostics the host adapter reads on resolution must be
    // present here rather than left undefined.
    modelErrors: new Map(),
    // Custom PiAiAdapter profiles bypass the settings-backed profile resolver,
    // so request-image limits must be complete here rather than left undefined.
    maxRequestImageBytes: MAX_REQUEST_IMAGE_BYTES,
    requestImagePixelBudget: REQUEST_IMAGE_PIXEL_BUDGET,
    requestImageMaxBytes: REQUEST_IMAGE_MAX_BYTES,
    // pi-ai owns prompt_cache_key and encrypted reasoning replay. The explicit
    // profile values make the subscription cache contract auditable.
    cacheRetention: 'short',
    // The request-local connection policy upgrades this only when opted in.
    transport: 'sse',
  })
  let planProfiles, planProfilesRevision = -1, planTimeoutMinutes
  const getPlanProfiles = () => {
    const timeoutMinutes = normalizeStreamIdleTimeoutMinutes(settings.get()[STREAM_IDLE_TIMEOUT_MINUTES_FIELD])
    if (planProfilesRevision !== planRevision || planTimeoutMinutes !== timeoutMinutes) {
      planProfilesRevision = planRevision
      planTimeoutMinutes = timeoutMinutes
      const epoch = planEpoch
      const base = planProvider.provider
      const models = [...base.getModels()]
      const withEpoch = options => ({ ...options, signal: options?.signal ? AbortSignal.any([options.signal, epoch.signal]) : epoch.signal })
      const piProvider = { ...base, getModels: () => models,
        stream: (model, context, options) => base.stream(model, context, withEpoch(options)),
        streamSimple: (model, context, options) => base.streamSimple(model, context, withEpoch(options)) }
      planProfiles = new Map([['ocean-chatgpt-plan', Object.freeze({ ...profile, provider: 'ocean-chatgpt-plan', displayName: 'ChatGPT plan', piProvider, streamIdleTimeoutMs: timeoutMinutes * 60 * 1000, planEpoch: epoch, planAccountId: planCatalogAccountId })]])
    }
    return planProfiles
  }
  const planAdapter = new PiAiAdapter({
    profiles: getPlanProfiles,
    resolveApiKey: async (_route, selectedProfile) => {
      try {
        if (selectedProfile.planEpoch !== planEpoch || selectedProfile.planEpoch.signal.aborted) throw new Error('Account changed')
        const token = await planService.accessToken(selectedProfile.planAccountId)
        if (selectedProfile.planEpoch !== planEpoch || selectedProfile.planEpoch.signal.aborted) throw new Error('Account changed')
        return token
      }
      catch { throw new dshLlm.LlmError('ChatGPT plan sign-in is unavailable', 'MISSING_CREDENTIAL') }
    },
    auth: { credentials: store, authContext: { env: async () => undefined, fileExists: async () => false } },
    resolveAttachments: () => ctx.get?.('attachments'),
  })
  ctx.effect(() => {
    const lifetime = new AbortController()
    const dispose = ctx.llm.registerAdapter(['ocean-chatgpt-plan'], planAdapter)
    void Promise.resolve().then(() => restorePlanCatalog(planService, { signal: lifetime.signal }))
      .catch(() => { if (!lifetime.signal.aborted) ctx.logger?.debug?.('could not restore the ChatGPT plan model catalog') })
    return () => { lifetime.abort(); dispose() }
  }, 'ChatGPT plan Responses adapter')
  // Retries are DSH's own: this only hands its retry layer the policy the person chose.
  const retryProfile = choice => {
    const retryPolicy = retryPolicyFor(choice, dshLlm.resolveRetryPolicy)
    return retryPolicy === undefined ? {} : { retryPolicy }
  }
  let profileKey
  let profileSnapshot
  const profiles = () => {
    const preferences = settings.get()
    const streamIdleTimeoutMinutes = normalizeStreamIdleTimeoutMinutes(preferences[STREAM_IDLE_TIMEOUT_MINUTES_FIELD])
    const retryChoice = normalizeRetryPolicy(preferences[RETRY_POLICY_FIELD])
    const key = JSON.stringify([modelCatalog.revision(), streamIdleTimeoutMinutes, retryChoice, normalizeContextMode(preferences[CONTEXT_MODE_FIELD]), preferences[CUSTOM_CONTEXT_OVERRIDES_FIELD], ...Object.values(CUSTOM_CONTEXT_MODEL_FIELDS).map(field => preferences[field])])
    if (key !== profileKey) {
      profileKey = key
      profileSnapshot = new Map([[PROVIDER, Object.freeze({ ...profile, streamIdleTimeoutMs: streamIdleTimeoutMinutes * 60 * 1000, ...retryProfile(retryChoice) })]])
    }
    return profileSnapshot
  }
  resolveAuth = () => authModels.getAuth(PROVIDER)
  // Native Codex execution is not registered in the Ocean subscription build.
  const adapterAuth = Object.freeze({
    credentials: store,
    authContext: Object.freeze({
      env: async () => undefined,
      fileExists: async () => false,
    }),
  })
  ctx.effect(() => watchImageTool(settings, () => ctx.tools.register(createCodexImageTool({
    getFeatures: () => settings.get(),
    allowed: () => servesCurrentModel(),
    getAuth: resolveAuth,
    readCredential: options => store.read(PROVIDER, options),
    attachments: ctx.attachments,
    getSessionMessages: sessionId => ctx.get?.('sessions')?.get?.(sessionId)?.deriveMessages?.() ?? [],
    originalImages,
    fetch: (input, init) => network.fetch('image', input, init),
  }))), 'codex-subscription: image tool availability')
  const connectorsClient = createConnectorsClient({
    getAuth: resolveAuth,
    readCredential: options => store.read(PROVIDER, options),
    fetch: (input, init) => network.fetch('connectors', input, init),
  })
  ctx.effect(() => {
    let disposers = []
    const sync = () => {
      const on = normalizeConnectorMode(settings.get()[CONNECTORS_FIELD]) !== 'off'
      if (on && disposers.length === 0) {
        disposers = createConnectorTools({
          client: connectorsClient,
          getMode: () => normalizeConnectorMode(settings.get()[CONNECTORS_FIELD]),
          allowed: () => servesCurrentModel(),
          getApproval: () => ctx.get?.('approval'),
        }).map(tool => ctx.tools.register(tool))
      } else if (!on && disposers.length > 0) {
        for (const dispose of disposers) dispose()
        disposers = []
        connectorsClient.clear()
      }
    }
    sync()
    const unwatch = settings.watch(sync)
    return () => { unwatch(); for (const dispose of disposers) dispose(); disposers = [] }
  }, 'codex-subscription: ChatGPT connectors')
  const adapter = new PiAiAdapter({
    profiles,
    resolveApiKey: async () => {
      let resolved
      try {
        resolved = await resolveAuth()
      } catch (error) {
        // DSH lists models by resolving the route's key; signed out has to read as "no credential".
        if (error?.code === 'MISSING_CREDENTIAL') throw new dshLlm.LlmError('ChatGPT subscription is not signed in', 'MISSING_CREDENTIAL')
        throw new dshLlm.LlmError('ChatGPT subscription authorization failed', 'AUTH_FAILED')
      }
      if (typeof resolved?.auth.apiKey !== 'string' || resolved.auth.apiKey.length === 0) {
        throw new dshLlm.LlmError('ChatGPT subscription is not signed in', 'MISSING_CREDENTIAL')
      }
      return resolved.auth.apiKey
    },
    auth: adapterAuth,
    resolveAttachments: () => ctx.get?.('attachments'),
  })
  // Hiding a model means "do not use it": the host directory drops hidden models, except those a session, the default or a plugin setting still uses.
  const hiddenDirectory = createHiddenModelDirectory({
    provider: PROVIDER,
    disabled: () => normalizeDisabledModels(settings.get()[DISABLED_MODELS_FIELD]),
    pinned: () => {
      const keep = []
      try {
        for (const session of ctx.get?.('sessions')?.list?.() ?? []) {
          const route = session.requestContext?.()
          if (route?.provider === PROVIDER && typeof route.model === 'string') keep.push(route.model)
        }
      } catch {}
      const selection = defaultModel.status()
      if (selection.managed) keep.push(selection.model)
      return keep
    },
    fallback: () => { const selection = defaultModel.status(); return selection.managed ? selection.model : undefined },
    emit: () => ctx.llm.emitAdaptersUpdated?.(),
  })
  ctx.effect(() => settings.watch((value, previous) => hiddenDirectory.settingsChanged(normalizeDisabledModels(value[DISABLED_MODELS_FIELD]), normalizeDisabledModels(previous[DISABLED_MODELS_FIELD]))), 'codex-subscription: hidden model directory')
  ctx.effect(() => ctx.on?.('session/event', (_session, event) => { if (event?.type === 'request/context') hiddenDirectory.dependenciesChanged() }), 'codex-subscription: hidden model dependencies')
  ctx.effect(() => settings.watch((value, previous) => {
    if (normalizeDefaultReasoningEffort(value[DEFAULT_REASONING_EFFORT_FIELD]) !== normalizeDefaultReasoningEffort(previous[DEFAULT_REASONING_EFFORT_FIELD])) ctx.llm.emitAdaptersUpdated?.()
  }), 'codex-subscription: default reasoning effort')
  ctx.effect(() => {
    const lifetime = new AbortController()
    const defaults = withDefaultReasoningEffort(ultra.wrapAdapter(observeAdapter(reasoning.wrapAdapter(compaction.wrapAdapter(provider.wrapRetryAdapter(adapter))), provider)), {
      preference: () => settings.get()[DEFAULT_REASONING_EFFORT_FIELD],
      modelDefault: id => modelCatalog.metadata(id)?.defaultReasoningEffort,
    })
    const readyAdapter = withModelCatalogReady(hiddenDirectory.wrap(defaults), modelCatalog, { signal: lifetime.signal })
    const disposeAdapter = ctx.llm.registerAdapter([PROVIDER], readyAdapter)
    // Defer credential work until the synchronous apply() has installed resolveAuth.
    void Promise.resolve().then(() => modelCatalog.refresh({ signal: lifetime.signal }))
      .catch(error => { if (!lifetime.signal.aborted) ctx.logger?.debug?.('could not refresh Codex model catalog (%s)', error?.code ?? error?.name ?? 'unknown error') })
    return () => {
      lifetime.abort()
      disposeAdapter?.()
      modelCatalog.clear()
    }
  }, 'codex-subscription: official model catalog')
  // Ocean owns its web registries and configured providers. This plugin never wraps or replaces them.
  const servesCurrentModel = () => ctx.get?.('agents')?.currentInitiator?.()?.session.requestContext?.()?.provider === PROVIDER

  const auth = createCodexAuthService(authModels, store, {
    runLogin: operation => network.run('login', operation),
    accountVault,
    createLoginModels: credentials => {
      const loginModels = createModels({ credentials })
      loginModels.setProvider(provider)
      return loginModels
    },
  })
  const coordinator = new CodexLoginCoordinator(auth)
  const remoteImages = createRemoteImageAssets({
    credentials: ({ signal }) => readSubscriptionCredentials(resolveAuth, options => store.read(PROVIDER, { ...options, signal }), signal),
    fetch: (input, init) => network.fetch('remote', input, init),
    stateFile: dshHomePath('state', 'ocean-codex-subscription', 'remote-images.json'),
  })
  const remoteBridge = createDshRemoteControl({
    controller: () => ctx.get?.('sessionController'),
    agents: () => ctx.get?.('agents'),
    permissions: () => ctx.get?.('permissionPresets'),
    workspaces: () => ctx.get?.('workspaceRegistry'),
    attachments: () => ctx.attachments,
    remoteImages,
    usage: () => usageReader,
    usageProfile: () => usageProfileReader,
    projections: () => ctx.get?.('sessionProjections'),
    skills: () => ctx.get?.('skills'),
    commands: () => ctx.get?.('commands'),
    llm: () => ctx.llm,
    modelMetadata: (provider, model) => provider === PROVIDER ? modelCatalog.metadata(model) : undefined,
    historySource: createRemoteHistorySource({ query: () => ctx.get?.('sessionQuery') }),
    speed: {
      tiers: (provider, model) => provider === PROVIDER ? (modelCatalog.metadata(model)?.serviceTiers ?? []) : [],
      current: () => settings.get()[SPEED_MODE_FIELD],
      set: mode => settings.update({ [SPEED_MODE_FIELD]: mode }),
    },
    trace: entry => { try { remoteControl.host.note(entry) } catch { /* diagnostics only */ } },
    userAgent: USER_AGENT,
    configFile: dshHomePath('state', 'ocean-codex-subscription', 'remote-config.json'),
    voice: {
      WebSocket,
      resolveProxy: resolveCodexOAuthProxy,
      fetch: (input, init) => network.fetch('voice', input, init),
      credentials: signal => readSubscriptionCredentials(resolveAuth, options => store.read(PROVIDER, { ...options, signal }), signal),
      classifyHangUp: createVoiceHangupClassifier({
        stream: request => ctx.llm.stream(request), provider: PROVIDER,
        model: () => ['gpt-5.6-luna', 'gpt-5.4-mini'].find(id => modelCatalog.getModels().some(model => model.id === id)) ?? 'gpt-5.6-luna',
      }),
    },
  })
  ctx.effect(() => () => remoteBridge.close())
  const remoteControl = createRemoteControl({
    credentials: signal => readSubscriptionCredentials(resolveAuth, options => store.read(PROVIDER, { ...options, signal }), signal),
    WebSocket,
    fetch: (input, init) => network.fetch('remote', input, init),
    stateFile: dshHomePath('state', 'ocean-codex-subscription', 'remote-control.json'),
    debugFile: dshHomePath('state', 'ocean-codex-subscription', 'remote-debug.jsonl'),
    hostName: `DSH (${hostname()})`,
    userAgent: USER_AGENT,
    // Only for acceptance runs against a local stand-in relay; anything but chatgpt.com or a loopback address is refused.
    base: undefined,
    methods: remoteBridge.methods,
    onActive: (_client, notify) => remoteBridge.adopt(notify),
    onClose: (_client, notify) => remoteBridge.forget(notify),
  })
  ctx.on('agent/assistant-stream', ({ agent, frame }) => { try { remoteBridge.onStream(agent?.session, frame) } catch { /* the phone view must never disturb the session */ } })
  ctx.on('session/event', (session, event) => { try { remoteBridge.onSessionEvent(session, event) } catch { /* the phone view must never disturb the session */ } })
  // Prepended: the DSH window answers these too and would otherwise claim them before the phone sees them.
  ctx.on('approval/request', (request, next) => { try { return remoteBridge.onApproval(request, next) } catch { return next() } }, true)
  ctx.on('user-questions/request', (request, next) => { try { return remoteBridge.onQuestion(request, next) } catch { return next() } }, true)
  ctx.effect(() => {
    // Remote Control stays off until the user switches it on; then it follows the setting.
    let wanted = false
    const follow = value => {
      const next = value.remoteControl === 'on'
      if (next === wanted) return
      wanted = next
      void (next ? remoteControl.enable() : remoteControl.disable()).catch(error => ctx.logger?.debug?.('Remote Control: %s', error?.code ?? error?.message))
    }
    follow(settings.get())
    const unwatch = settings.watch(follow)
    return () => { unwatch(); void remoteControl.disable().catch(() => {}) }
  }, 'codex-subscription: Remote Control host')
  const baseUsageReader = createCodexUsageReader({
    getAuth: resolveAuth,
    readCredential: options => store.read(PROVIDER, options),
    fetch: (input, init) => network.fetch('quota', input, init),
  })
  const planHistoryReader = createPlanHistoryReader({
    getAuth: resolveAuth,
    readCredential: options => store.read(PROVIDER, options),
    fetch: (input, init) => network.fetch('quota', input, init),
  })
  const usageProfileReader = createUsageProfileReader({
    getAuth: resolveAuth,
    readCredential: options => store.read(PROVIDER, options),
    fetch: (input, init) => network.fetch('quota', input, init),
  })
  const usageReader = createQuotaForecastReader({
    reader: baseUsageReader,
    enabled: () => normalizeQuickQuotaMode(settings.get()[QUICK_QUOTA_MODE_FIELD], settings.get()[LEGACY_QUICK_QUOTA_FIELD]) === QUICK_QUOTA_MODE_FORECAST,
    scope: async () => await accountVault?.activeId() ?? 'legacy',
    stateStore: new QuotaForecastStateStore({
      filename: dshHomePath('state', 'ocean-codex-subscription', 'quota-forecast.json'),
    }),
  })
  ctx.effect(() => {
    let forecasting = false
    const warmForecast = value => {
      const next = normalizeQuickQuotaMode(value[QUICK_QUOTA_MODE_FIELD], value[LEGACY_QUICK_QUOTA_FIELD]) === QUICK_QUOTA_MODE_FORECAST
      if (!next) {
        if (forecasting) void usageReader.clear().catch(error => ctx.logger?.debug?.('could not clear Codex quota forecast: %s', error.message))
        forecasting = false
        return
      }
      forecasting = true
      void usageReader.read().catch(error => ctx.logger?.debug?.('could not warm Codex quota forecast: %s', error.message))
    }
    warmForecast(settings.get())
    const unwatch = settings.watch(warmForecast)
    return () => {
      unwatch()
      usageReader.clearCache()
    }
  }, 'codex-subscription: quota forecast warm-up')
  const quotaRetryLifetime = new AbortController()
  const activeQuotaRetries = new Set()
  const quotaRetryHandler = createCodexQuotaRetryHandler({
    usageReader,
    enabled: () => normalizeAutoQuotaRetry(settings.get()[AUTO_QUOTA_RETRY_FIELD]),
    modelsReady: catalogModelsReady(modelCatalog),
  })
  const disposeQuotaRetry = ctx.on('agent/request-error', (payload, next) => {
    if (quotaRetryLifetime.signal.aborted) return Promise.resolve(undefined)
    const signal = payload.signal === undefined
      ? quotaRetryLifetime.signal
      : AbortSignal.any([payload.signal, quotaRetryLifetime.signal])
    const operation = quotaRetryHandler({ ...payload, signal }, next)
    const tracked = operation.finally(() => activeQuotaRetries.delete(tracked))
    activeQuotaRetries.add(tracked)
    return tracked
  }, true)
  ctx.effect(() => async () => {
    disposeQuotaRetry()
    quotaRetryLifetime.abort(new Error('codex-subscription quota retry disposed'))
    await Promise.allSettled([...activeQuotaRetries])
  }, 'codex-subscription: abort and drain quota recovery')
  ctx.effect(() => settings.watch((value, previous) => {
    if (normalizeAutoQuotaRetry(value[AUTO_QUOTA_RETRY_FIELD])
      !== normalizeAutoQuotaRetry(previous?.[AUTO_QUOTA_RETRY_FIELD])) {
      quotaRetryHandler.notifyConfigurationChanged()
    }
  }), 'codex-subscription: update quota recovery preference')
  const resetCreditService = createCodexResetCreditService({
    getAuth: resolveAuth,
    readCredential: options => store.read(PROVIDER, options),
    usageReader,
    fetch: (input, init) => network.fetch('quota-reset', input, init),
  })
  const sketchBridge = createSketchAgentBridge({enabled:()=>settings.get().imageSketchAgent && settings.get().imageSketch && settings.get().imageEditing})
  ctx.effect(()=>{
    let dispose
    const sync=()=>{
      const value=settings.get()
      if(value.imageSketchAgent && value.imageSketch && value.imageEditing){dispose??=ctx.tools.register(createSketchAgentTool(sketchBridge,ctx.attachments,sessionId=>ctx.get?.('sessions')?.get?.(sessionId)?.deriveMessages?.()??[]))}
      else {dispose?.();dispose=undefined;sketchBridge.dispose()}
    }
    sync();const unwatch=settings.watch(sync)
    return ()=>{unwatch();dispose?.();sketchBridge.dispose()}
  },'codex-subscription: native sketch tool')
  const accountUsageReader = createAccountUsageReader({
    vault: accountVault,
    createModels: credentials => {
      const accountModels = createModels({ credentials })
      accountModels.setProvider(provider)
      return accountModels
    },
    fetch: (input, init) => network.fetch('quota', input, init),
    expirySkewMs: OAUTH_EXPIRY_SKEW_MS,
    activeReader: baseUsageReader,
  })
  const desktopVoice = withEndCallTool(remoteBridge.desktopVoice, tool => ctx.tools.register(tool))
  const nativeVoice = createNativeVoiceHost({ desktopVoice, log: diagnosticLog })
  ctx.effect(() => {
    const close = () => { void nativeVoice.close().catch(() => diagnosticLog.warn('voice-native', 'native call cleanup is waiting for a cancelled start')) }
    const sync = () => { if (settings.get().voiceCall !== 'on') close() }
    const unwatch = settings.watch(sync)
    return () => { unwatch(); close() }
  })
  const voicePreview = createVoicePreview({ fetch: (input, init) => network.fetch('voice', input, init, { standardHttps: true }), credentials: signal => readSubscriptionCredentials(resolveAuth, options => store.read(PROVIDER, { ...options, signal }), signal), userAgent: USER_AGENT })
  ctx.effect(() => () => voicePreview.clear())
  const composerPredictions = createComposerPredictions({
    fetch: (input, init) => network.fetch('predictions', input, init, { standardHttps: true }),
    credentials: signal => readSubscriptionCredentials(resolveAuth, options => store.read(PROVIDER, { ...options, signal }), signal),
    enabled: () => settings.get().composerPredictions === 'on', userAgent: USER_AGENT,
  })
  ctx.effect(() => () => composerPredictions.clear())
  ctx.effect(() => settings.watch(value => { if (value.composerPredictions !== 'on') composerPredictions.clear() }))
  const subscriptionHandler = createSubscriptionRpcHandler({
    authHandler: createCodexRpcHandler(coordinator, { openExternal: openCodexAuthUrl }),
    usageReader,
    accountUsageReader,
    planHistoryReader,
    usageProfileReader,
    resetCreditService,
    preferences,
    defaultModel,
    runtimeManagement,
    remoteControl,
    desktopVoice,
    nativeVoice,
    voicePreview,
    composerPredictions,
    onAccountChanged: () => { subagentCatalog.clear(); connectorsClient.clear(); usageProfileReader.clear(); voicePreview.clear(); composerPredictions.clear(); quotaRetryHandler.notifyAccountChanged() },
    diagnosticsReader: () => createSubscriptionDiagnostics({ auth, preferences, login: coordinator.supportState(), network, modelCatalog, connection, compaction, review: provider, operations: diagnosticOperations, runtimeManagement, storage: () => usageReader.storage(), tools: ctx.tools }),
    onCleanupFailure: () => diagnosticOperations.record('account/cleanup', 'failed'),
    modelCatalog,
    subagentCatalog,
    closeConnections: () => connection.dispose(),
    originalImages,
    resolveInheritedOriginal: (sessionId, assetId) => inheritedOriginalImageRef(
      ctx.get?.('sessions')?.get?.(sessionId),
      assetId,
    ),
  })

  const handler = withOceanRpcPolicy(diagnosticOperations.wrap((endpoint, payload, signal) => endpoint.startsWith('plan/') ? planHandler(endpoint, payload, signal) : subscriptionHandler(endpoint, payload, signal)))

  ctx.effect(() => ctx.tools.register(createSubscriptionPreferencesTool(handler, () => ctx.get?.('approval'))),
    'codex-subscription: response preferences tool')

  ctx.inject(['connection'], connectionContext => connectionContext.effect(
    () => registerSubscriptionTransport(connectionContext.connection, handler),
    'codex-subscription: DSH-trusted account RPC',
  ))
}

export { createCodexAuthService, DshOAuthCredentialStore } from './credential-store.js'
export { createSubscriptionDiagnostics } from './diagnostics.js'
export { normalizeContextMode, normalizeCustomContextWindow } from './settings-contract.js'
export { createDefaultModelController, DEFAULT_MODEL_PROVIDER } from './default-model.js'
export { assertCodexAuthUrl, commandForCodexAuthUrl, openCodexAuthUrl } from './external-url.js'
export { CodexLoginCoordinator, createCodexRpcHandler } from './login-coordinator.js'
export { CODEX_USAGE_URL, createCodexUsageReader, parseCodexUsage } from './usage.js'
export {
  CODEX_RESET_CONSUME_URL,
  CODEX_RESET_CREDITS_URL,
  createCodexResetCreditService,
} from './reset-credits.js'
export {
  CODEX_IMAGE_GENERATION_URL,
  CODEX_IMAGE_TOOL_NAME,
  createCodexImageTool,
  decodeCodexPng,
} from './codex-images.js'
