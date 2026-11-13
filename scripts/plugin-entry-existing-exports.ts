/**
 * Value exports that plugin entries already had when verify-plugin-entry-exports started enforcing the plugin entry
 * rule in docs/defensive-patterns/package-surface.md. Each line records existing debt, not an approved exception. The
 * gate passes a listed export and fails a line when its package has no plugin entry, when its export list is empty or
 * repeats a name, or when it names an export the entry no longer reports, so removing an export removes its line in
 * the same change. A line added after the gate's introduction is an exception under the rule, and the rule requires
 * the domain owner's confirmation for it.
 */
export const EXISTING_PLUGIN_ENTRY_EXPORTS = {
  '@ocean/ocean-acp-app': ['ACP_APP_STARTUP_SERVICE'],
  '@ocean/ocean-action-cards': ['Config', 'isPluginStopping'],
  '@ocean/ocean-agent': [
    'AgentModel', 'agentCarrier', 'agentEvents', 'assembleContextFor', 'emitAgentEvent', 'foldConsumedWork',
    'installModelSelection', 'modelSelectionProjectionDefinition',
  ],
  '@ocean/ocean-agent-instructions': [
    'discoverBaselineInstructionFiles', 'loadBaselineInstructions', 'renderAgentInstructions',
  ],
  '@ocean/ocean-agent-loop': ['CONFIGURED_AGENT_IDENTITIES_KEY', 'DEFAULT_MAX_PARALLEL_TOOL_CALLS'],
  '@ocean/ocean-agent-preset-registry': [
    'agentPresetProjectionDefinition', 'auditRows', 'entryListProblem', 'leakedServices',
  ],
  '@ocean/ocean-agent-team': ['TeamId', 'TeamMessageId', 'TeamTaskId'],
  '@ocean/ocean-api-remote-access': ['REMOTE_ACCESS_SNAPSHOT_KEY'],
  '@ocean/ocean-api-remotes': ['API_REMOTE_FORWARDED_EVENTS'],
  '@ocean/ocean-attachment-local': [
    'DEFAULT_IMAGE_COMPRESSION_CONCURRENCY', 'DEFAULT_MAX_IMAGES_PER_MESSAGE', 'DEFAULT_MAX_IMAGE_BYTES',
    'DEFAULT_MAX_IMAGE_DIMENSION', 'DEFAULT_MAX_IMAGE_PIXELS', 'DEFAULT_MAX_MESSAGE_IMAGE_BYTES',
    'DEFAULT_NORMALIZED_IMAGE_MAX_BYTES', 'DEFAULT_NORMALIZED_IMAGE_MAX_DIMENSION',
    'DEFAULT_NORMALIZED_IMAGE_MAX_PIXELS', 'MAX_IMAGE_COMPRESSION_CONCURRENCY', 'canPassThroughNormalization',
    'commitPreparedImageFile', 'normalizeImage', 'prepareImageFile', 'readImageFile', 'readRequestImageFile',
    'requestImageVariantId', 'saveImageFile', 'validateImageFile',
  ],
  '@ocean/ocean-bash-local': ['ENV_OVERRIDES', 'assertServiceableBashConfig'],
  '@ocean/ocean-client-connection': [
    'API_PATH', 'CONNECT_PATH', 'Peer', 'RpcId', 'clientRequestSchema', 'rpcErrorSchema', 'rpcIdSchema',
    'rpcMessageSchema', 'rpcResultSchema', 'serverResponseSchema', 'transportError',
  ],
  '@ocean/ocean-client-hmr': ['EVENTS_ENDPOINT'],
  '@ocean/ocean-client-locale': ['LOCALE_IDS', 'LOCALE_PREFERENCE_FIELD', 'LOCALE_SETTINGS_NAMESPACE'],
  '@ocean/ocean-client-modules': ['bootInjections', 'orderByModuleGraph', 'stripClientSuffix'],
  '@ocean/ocean-client-ui-chat': [
    'CHAT_SETTINGS_NAMESPACE', 'DEFAULT_TRANSCRIPT_VIEW_MODE', 'LEGACY_EXPANDED_TRANSCRIPT_VIEW_MODE',
    'LEGACY_TRANSCRIPT_VIEW_MODE', 'TRANSCRIPT_VIEW_FIELD', 'TRANSCRIPT_VIEW_MODES',
  ],
  '@ocean/ocean-client-ui-conversation': [
    'BUSY_ENTER_BEHAVIORS', 'BUSY_ENTER_FIELD', 'CONVERSATION_SETTINGS_NAMESPACE', 'DEFAULT_BUSY_ENTER_BEHAVIOR',
  ],
  '@ocean/ocean-client-ui-theme': [
    'DEFAULT_FONT_SIZE', 'DEFAULT_PREFERENCE', 'FONT_SIZE_FIELD', 'FONT_SIZE_MAX', 'FONT_SIZE_MIN', 'THEME_PREFERENCES',
    'THEME_PREFERENCE_FIELD', 'THEME_SETTINGS_NAMESPACE',
  ],
  '@ocean/ocean-command-feedback': ['FEEDBACK_CATEGORIES', 'recordFeedback'],
  '@ocean/ocean-commands': ['CommandDefinitionId', 'CommandId', 'name', 'parseCommand'],
  '@ocean/ocean-compaction-tool-result-pruner': ['DEFAULTS', 'PRUNE_MARKER', 'codePointLength', 'resolveConfig'],
  '@ocean/ocean-cordis-host-runner': [
    'ApprovalRequestId', 'CordisDynamicPackageId', 'CordisDynamicPluginId', 'CordisDynamicPluginRunId',
  ],
  '@ocean/ocean-credentials-local': [
    'CREDENTIALS_FILENAME', 'DOCUMENT_VERSION', 'parseCredentialsDocument', 'renderFlatLayoutMigration', 'resolveSpec',
  ],
  '@ocean/ocean-cua': ['CuaConfig', 'installCua'],
  '@ocean/ocean-experimental-claude-code-mods': [
    'DEFAULT_TOOL_ALIASES', 'KNOWN_EVENTS', 'MODS_API_VERSION', 'SERVED_EVENTS', 'defineMod',
  ],
  '@ocean/ocean-experimental-cua-macos': ['GUIDANCE'],
  '@ocean/ocean-experimental-forge': ['changeRequestKey'],
  '@ocean/ocean-experimental-inspector': ['resolveInspectorOptions', 'startInspector'],
  '@ocean/ocean-experimental-ptc-runtime-python': [
    'checkDoneValue', 'detachResidual', 'encodeJsonPlain', 'hasNonLosslessNumber', 'hasUnsafeIntegerToken',
    'hostFrameParseCeiling', 'logTruncationMarker', 'readProcessStart', 'resolvePythonBin', 'validateChildFrame',
  ],
  '@ocean/ocean-experimental-worktree': [
    'CREATED_RECORD', 'createdWorktreeSchema', 'generatedWorktreeName', 'worktreeProjection',
  ],
  '@ocean/ocean-goal': [
    'GOAL_CHANGE_VERSION', 'GoalId', 'applyGoalProjection', 'decodeGoalChange', 'foldGoal', 'goalChangeRef',
    'goalProjectionDefinition',
  ],
  '@ocean/ocean-goal-round-driver': ['renderGoalRoundPrompt'],
  '@ocean/ocean-host-directory-picker-auto': [
    'BACKEND_PACKAGES', 'SURFACE_PACKAGES', 'canExecute', 'hasLinuxChooserBinary', 'resolveDirectoryPickerBackend',
  ],
  '@ocean/ocean-host-directory-picker-browse': ['boundedInsert', 'fullyQualified', 'raceAbort'],
  '@ocean/ocean-host-directory-picker-native': ['pickNativeDirectory'],
  '@ocean/ocean-host-plugin-inventory': ['pluginEntryId', 'readPluginInventory'],
  '@ocean/ocean-host-product-telemetry-otel': ['Config'],
  '@ocean/ocean-host-webserver': [
    'bindUrlHost', 'isLoopbackHost', 'isWildcardHost', 'normalizeBindAddress', 'renderIndexInjections',
  ],
  '@ocean/ocean-jobs-local': ['TASK_WAIT_TIMEOUT'],
  '@ocean/ocean-llm': [
    'ACCOUNT_QUOTA_EXCEEDED_CODE', 'APP_IDENTITY', 'AssistantStreamAccumulator', 'BlockAssembler',
    'CONTEXT_SUMMARY_MAX_CHARS', 'CONTEXT_WINDOW_EXCEEDED_CODE', 'EMPTY_RESPONSE_CODE', 'IMAGE_OFFLOAD_REQUIRED_CODE',
    'INVALID_CREDENTIAL_CODE', 'LLM_FAILURE_CODES', 'LlmAdapter', 'LlmAttemptId', 'MessageId', 'ProviderRequestId',
    'QUOTA_EXCEEDED_CODE', 'RETRY_CODE_CHOICES', 'ReasoningEffortId', 'RetryPolicySchema', 'ToolCallId',
    'assembleAssistantStream', 'assertUsableApiKey', 'assistantStreamChunks', 'assistantStreamFirstTokenTime',
    'assistantStreamHasVisibleContent', 'assistantStreamHasVisibleText', 'attributionHeaders', 'boundContextSummary',
    'callConfigEquals', 'chunkHasVisibleText', 'contentHasFile', 'contentHasImage', 'createAssistantMessage',
    'createDeveloperMessage', 'createMessage', 'createSystemMessage', 'createToolResultMessage', 'createUserMessage',
    'errorChain', 'expandAssistantStream', 'fileHandleText', 'freezeMessage', 'isAgentLoopRequest',
    'isContextWindowExceededError', 'isHarnessError', 'isQuotaExceededError', 'isTokenDelta', 'isVisibleChunk',
    'joinAssistantStreamText', 'lastAssistantStreamChunk', 'markAgentLoopRequest', 'normalizeApiKey',
    'offloadedImageText', 'projectFilesToText', 'projectImagesForTextModel', 'projectOffloadedImages',
    'projectToolUpdates', 'requestImageHandleText', 'requiredImageOffload', 'resolveImageAttachmentAccess',
    'resolveRetryPolicy', 'runFirstTokenTime', 'runFirstVisibleTime', 'textOnlyImageText', 'userAgent',
  ],
  '@ocean/ocean-llm-deepseek-account': ['plainAccountOptions', 'resolveAccountOptions'],
  '@ocean/ocean-llm-deepseek-api-key': ['plainOptions', 'resolveAdapterOptions'],
  '@ocean/ocean-llm-pi-ai': ['PiAiAdapter', 'supportedProtocols'],
  '@ocean/ocean-llm-replay': [
    'deriveReplayScript', 'installLlmReplay', 'loadReplayScript', 'loadSessionScripts', 'parseSessionHeader',
    'parseSessionLog', 'prepareSessionSnapshotFixtureForComparison', 'resolveScriptedEntry',
  ],
  '@ocean/ocean-llm-retry': ['RetryId'],
  '@ocean/ocean-lsp': ['LspProviderId', 'finalExtension'],
  '@ocean/ocean-mcp-client': [
    'ReconnectSchema', 'SERVER_NAME_PATTERN', 'assertTemplateSyntax', 'connectionStatusOf', 'createMcpToolDefinition',
    'probeServer', 'resolveReconnectPolicy',
  ],
  '@ocean/ocean-office-kit': ['Config', 'OfficeKitGeneration', 'OfficeKitKey', 'OfficeSourceKey'],
  '@ocean/ocean-permission-presets': ['AUTO_PRESET', 'CUSTOM_PRESET'],
  '@ocean/ocean-persona': ['PERSONA_PREFIX_SECTION', 'PERSONA_SUFFIX_SECTION'],
  '@ocean/ocean-plan-mode': ['EXIT_PLAN_MODE', 'planProjectionDefinition', 'resolveConfig'],
  '@ocean/ocean-plugin-manager': ['classifyInstallFailure', 'parseInstallSpec', 'pinnedGitOrigin'],
  '@ocean/ocean-pwsh-local': [
    'ENCODING_PREAMBLE', 'ENV_OVERRIDES', 'assertServiceablePwshConfig', 'candidatePwshPaths', 'resolvePwshPath',
  ],
  '@ocean/ocean-sandbox-policy': ['SANDBOX_MODES', 'setSandboxMode'],
  '@ocean/ocean-schedule': [
    'DEFAULT_LIST_LIMIT', 'MAX_LIST_LIMIT', 'MAX_TITLE_LENGTH', 'MIN_EVERY_INTERVAL_SECONDS', 'REQUIRED_TITLE_MESSAGE',
    'ScheduleId', 'canonicalizeCronExpression', 'createAfterScheduleRecord', 'createAtScheduleRecord',
    'createCronScheduleRecord', 'createDailyScheduleRecord', 'createEveryScheduleRecord', 'createWeeklyScheduleRecord',
    'decodeScheduleRecord', 'formatScheduleLocalTime', 'isRecurringScheduleRecord', 'normalizeWeekdays',
    'parseCronInput', 'parseWeeklyInput', 'renderRecurringReminderBatchFraming', 'renderReminderFraming',
    'resolveCronOccurrence', 'resolveDailyOccurrence', 'resolveEveryOccurrence', 'resolveRecurringOccurrence',
    'resolveWeeklyOccurrence', 'scheduleDomain', 'scheduleTitle', 'weeklyTime',
  ],
  '@ocean/ocean-sdk-app': ['SDK_APP_STARTUP_SERVICE'],
  '@ocean/ocean-sdk-jsonrpc-server': ['HarnessSdkJsonRpcServer'],
  '@ocean/ocean-session': [
    'KNOWN_SESSION_EVENT_TYPES', 'SESSION_FORMAT_VERSION', 'Session', 'SessionId', 'SessionLogOffset',
    'SessionPreparation', 'SessionSeq', 'TOOL_NOT_STARTED', 'TOOL_OUTCOME_UNKNOWN', 'ToolCallRecovery',
    'adoptSessionEvent', 'appendPluginRecord', 'buildForkSeed', 'canonicalHeader', 'decodeSeqRanges',
    'deriveEventMessage', 'encodeSeqRanges', 'foldRequestHeader', 'foldSurface', 'headerEquals',
    'interruptedTurnClosers', 'isAppendSurfaceEvent', 'isReplacementSurfaceEvent', 'isSurfaceEligibleType',
    'isSurfaceEvent', 'pluginRecordOf', 'snapshotSessionEvent',
  ],
  '@ocean/ocean-session-log-deepseek': ['acceptedThrough'],
  '@ocean/ocean-session-log-export': [
    'DEFAULT_SESSION_LOG_COMPRESSION_LEVEL', 'SESSION_LOG_EXPORT_PATH', 'SESSION_LOG_FILENAME', 'flushLiveSessionLog',
    'formatSessionMarkdown', 'readSessionLogText', 'serializeSessionLog', 'sessionLogExportDeps',
    'sessionLogZipEntries', 'sessionLogZipFilename', 'streamSessionLogZip',
  ],
  '@ocean/ocean-session-persistence-jsonl': ['JsonlCompressionSchema'],
  '@ocean/ocean-session-projection-cache': [
    'Config', 'checkpointIdentity', 'checkpointRecord', 'checkpointRow', 'projectionCacheDomainSpec',
  ],
  '@ocean/ocean-session-query-sqlite': [
    'SESSION_QUERY_SQLITE_APPLICATION_ID', 'SESSION_QUERY_SQLITE_DEFAULT_LIMIT', 'SESSION_QUERY_SQLITE_MAX_LIMIT',
    'SESSION_QUERY_SQLITE_PATH_KEY', 'SESSION_QUERY_SQLITE_SCHEMA_VERSION', 'SESSION_QUERY_SQLITE_SNIPPET_CHARS',
  ],
  '@ocean/ocean-session-reference': [
    'DEFAULT_CANDIDATE_LIMIT', 'DEFAULT_MAX_REFERENCE_BYTES', 'MAX_REFERENCES', 'SESSION_REFERENCE_SCHEME',
    'decodeSessionReferenceUri', 'encodeSessionReferenceUri', 'formatSessionReferenceMention',
    'parseSessionReferenceText',
  ],
  '@ocean/ocean-session-telemetry-otel': [
    'Config', 'DEFAULT_SHUTDOWN_TIMEOUT_MILLIS', 'DEFAULT_TELEMETRY_MODE', 'SessionTelemetryMode',
  ],
  '@ocean/ocean-session-title': [
    'SessionTitleProviderId', 'fallbackSessionTitle', 'foldSessionTitle', 'normalizeSessionTitle',
    'titleProjectionDefinition', 'truncateTitleUtf8',
  ],
  '@ocean/ocean-settings': ['redactSecrets'],
  '@ocean/ocean-skill': [
    'BUNDLED_SKILL_RANK', 'escapeText', 'isModelInvocable', 'isSkillName', 'isUserInvocable', 'renderSkillContent',
  ],
  '@ocean/ocean-skill-filesystem': ['FileSystemSkillProvider'],
  '@ocean/ocean-spill-local': [
    'DEFAULT_ROOT_PREFIX', 'discoverDefaultRoots', 'encodeSegment', 'isErrno', 'privateRoot', 'saveTextFile',
    'sessionDir', 'sweepSpillRoots',
  ],
  '@ocean/ocean-storage': ['BackendRegistry', 'UNIT_NAME_RE', 'storageBackendServiceKey'],
  '@ocean/ocean-storage-domain': ['DomainFacility', 'defineDomain', 'descriptorOf', 'domainTable'],
  '@ocean/ocean-storage-json': ['JsonStorageBackend'],
  '@ocean/ocean-storage-sqlite': ['STORAGE_SQLITE_SCHEMA_VERSION', 'SqliteStorageBackend'],
  '@ocean/ocean-subagent': [
    'AssistantOutputFold', 'NO_START_CAPABILITIES', 'ROOT_AGENT_NAME', 'STRUCTURED_OUTPUT_TOOL',
    'SUBAGENT_DESCRIPTOR_VERSION', 'SubagentRunId', 'appendDelegatedPolicyOverrides', 'applyChildComposition',
    'assertPositiveFinite', 'assertSubagentMaxDepth', 'assertUsableCwd', 'captureDelegatedPolicyOverrides',
    'childSessionMeta', 'delegationDepthOf', 'finalAssistantOutput', 'foldSubagentDescriptor',
    'parentAgentOptionsForDelegation', 'resolveChildAgentOptions', 'resolveChildDepth', 'settleRunResult',
    'snapshotSubagentDescriptor', 'subprocessRunHandle',
  ],
  '@ocean/ocean-system-prompt': [
    'PERSONA_PREFIX_SECTION', 'PERSONA_SUFFIX_SECTION', 'TOOL_ORDER_REST', 'joinContextSections',
    'renderContextSections', 'renderContextSnapshot', 'renderPrompt',
  ],
  '@ocean/ocean-terminal': ['TerminalSessionId'],
  '@ocean/ocean-terminal-bash': ['BashTerminalBackend', 'PWSH_PROMPT_SETUP'],
  '@ocean/ocean-terminal-panel': ['GUIDANCE'],
  '@ocean/ocean-tool-call-timeout-policy': ['TOOL_TIMEOUT'],
  '@ocean/ocean-tool-executor-native': ['NativeToolExecutor'],
  '@ocean/ocean-tool-executor-ptc': [
    'PtcExecutor', 'jsonSchemaToPy', 'jsonSchemaToTs', 'renderToolsSdk', 'renderToolsSdkPy',
  ],
  '@ocean/ocean-tool-fs-search': [
    'GLOB_MAX_RESULTS', 'GLOB_VCS_EXCLUDES', 'GREP_MAX_LINE_BYTES', 'GREP_MAX_MATCHES', 'RAW_OUTPUT_MAX_BYTES',
    'SEARCH_GRACE_MS', 'SEARCH_META_MAX_BYTES', 'SEARCH_STDERR_MAX_BYTES', 'SEARCH_TIMEOUT_MS', 'applyGlobTool',
    'applyGrepTool', 'buildGlobCommand', 'buildGrepCommand', 'formatGlobOutput', 'formatGrepMatches',
    'formatGrepOutput', 'parseGlobArgs', 'parseGrepArgs', 'parseGrepMatches', 'presentGlobCall', 'presentGlobResult',
    'presentGrepCall', 'presentGrepResult', 'previewLine', 'resolveRgPath', 'runRipgrep', 'sampleAcrossTopLevel',
    'toWorkdirRelative', 'trySaveFormattedResult',
  ],
  '@ocean/ocean-tool-lsp': [
    'DEFAULT_LSP_TOOL_TIMEOUT_MS', 'DEFAULT_MAX_LOCATIONS', 'DEFAULT_MAX_RESULT_CHARS', 'LSP_OPERATIONS',
    'LSP_PROMPT_TEXT', 'formatHover', 'formatLocations', 'parseLspArgs', 'presentLspCall', 'renderUri',
  ],
  '@ocean/ocean-tool-session-query': ['DEFAULT_MAX_SEARCH_RESULTS', 'DEFAULT_SEARCH_TIMEOUT_MS'],
  '@ocean/ocean-tool-terminal': ['DEFAULT_MAX_RESULT_BYTES', 'MIN_MAX_RESULT_BYTES'],
  '@ocean/ocean-tool-web': [
    'DEFAULT_FETCH_MAX_OUTPUT_CHARS', 'DEFAULT_WEB_TOOL_TIMEOUT_MS', 'WEB_SEARCH_MAX_QUERIES', 'WEB_SEARCH_MAX_RESULTS',
    'applyWebFetchTool', 'applyWebSearchTool', 'fetchMetaFromResult', 'fetchMetaFromValue', 'formatFetchOutput',
    'formatSearchOutput', 'parseFetchArgs', 'presentFetchCall', 'presentFetchResult', 'presentSearchCall',
    'presentSearchResult', 'searchMetaFromResult', 'searchMetaFromValue',
  ],
  '@ocean/ocean-tool-workspace-dependencies': [
    'copyPrimaryRuntime', 'installPrimaryRuntime', 'parsePrimaryRuntime', 'primaryRuntimePythonAliases',
    'readPrimaryRuntime', 'resolvePrimaryRuntime', 'workspaceDependencyPaths',
  ],
  '@ocean/ocean-tools': [
    'RUN_CODE_NAME', 'TOOL_ABORTED', 'TOOL_ABORTED_BEFORE_DISPATCH', 'assertObjectJsonSchema',
    'assertSupportedJsonSchema', 'defineTool', 'isJsonSchemaRecord', 'isPlainJsonArray', 'isPlainJsonRecord',
    'parameterSchemaSpecToJsonSchema', 'projectToolSchema', 'validateArgs', 'validateJsonSchemaValue',
    'valueSchemaSpecToJsonSchema',
  ],
  '@ocean/ocean-typert-loader': ['TYPERT_HOST_EXPORT', 'validateTypertManifest'],
  '@ocean/ocean-typert-registry': ['typertEndpoint', 'typertKey', 'typertPackageKey'],
  '@ocean/ocean-user-approval': ['APPROVAL_POLICIES', 'ApprovalRequestId', 'setApprovalPolicy'],
  '@ocean/ocean-user-questions': ['TIMED_WAIT_PARAMETER', 'isTimedAskUserQuestionSchema'],
  '@ocean/ocean-web-app': ['internals'],
  '@ocean/ocean-web-deepseek-api': [
    'DEEPSEEK_DEFAULT_COUNT', 'DEEPSEEK_FETCH_API_PROVIDER_ID', 'DEEPSEEK_SEARCH_API_PROVIDER_ID',
    'DEEPSEEK_SEARCH_REQUESTS_PER_SECOND', 'DEEPSEEK_WEB_API_BASE_URL', 'DeepSeekFetchApiProvider',
    'DeepSeekSearchApiProvider', 'mapSearchResponse',
  ],
  '@ocean/ocean-web-fetch-http': ['DEFAULT_USER_AGENT', 'HttpFetchProvider', 'LOCAL_FETCH_PROVIDER_ID'],
  '@ocean/ocean-web-search-deepseek': [
    'DEEPSEEK_DEFAULT_API_VERSION', 'DEEPSEEK_DEFAULT_BASE_URL', 'DEEPSEEK_DEFAULT_MAX_TOKENS',
    'DEEPSEEK_DEFAULT_MAX_USES', 'DEEPSEEK_DEFAULT_MODEL', 'DEEPSEEK_PROVIDER_ID', 'DeepSeekSearchProvider',
    'WEB_SEARCH_DEEPSEEK_SETTINGS_NAMESPACE',
  ],
  '@ocean/ocean-webhook': ['WebhookDeliveryId', 'WebhookRuleId', 'WebhookSourceId'],
  '@ocean/ocean-workflow-ptc': ['materializeFromRealm', 'validateMeta'],
  '@ocean/ocean-workspace': [
    'WorkspaceId', 'realpathNormalize', 'workspaceDomainSpec', 'workspaceDomainState', 'workspaceRecord',
  ],
} as const satisfies Readonly<Record<string, readonly string[]>>
