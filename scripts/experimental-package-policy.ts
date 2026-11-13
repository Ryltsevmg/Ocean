/** Experimental package identities, publication policy, and npm names. */

/**
 * Experimental packages whose npm names omit the experimental prefix, by directory. Every new experimental package
 * belongs here so that promotion keeps its name; isolation checks and plugin-record ownership recognize an unprefixed
 * experimental name only through this map.
 */
export const EXPERIMENTAL_PACKAGE_NAME_EXCEPTIONS: Readonly<Record<string, string>> = {
  'packages/experimental/browser-use-browse': '@ocean/ocean-browser-use-browse',
  'packages/experimental/cua': '@ocean/ocean-cua',
  'packages/experimental/cua-bundle': '@ocean/ocean-cua-bundle',
  'packages/experimental/cua-linux': '@ocean/ocean-cua-linux',
  'packages/experimental/cua-windows': '@ocean/ocean-cua-windows',
  'packages/experimental/tool-session-query': '@ocean/ocean-tool-session-query',
  'packages/experimental/session-title-all-prompts-llm': '@ocean/ocean-session-title-all-prompts-llm',
  'packages/experimental/tool-terminal': '@ocean/ocean-tool-terminal',
  'packages/experimental/terminal-panel': '@ocean/ocean-terminal-panel',
  'packages/experimental/tool-ralph': '@ocean/ocean-tool-ralph',
  'packages/experimental/skill-badge': '@ocean/ocean-skill-badge',
  'packages/experimental/hook-protocol': '@ocean/ocean-hook-protocol',
  'packages/experimental/hooks-claude-code': '@ocean/ocean-hooks-claude-code',
  'packages/experimental/hooks-codex': '@ocean/ocean-hooks-codex',
  'packages/experimental/webhook': '@ocean/ocean-webhook',
  'packages/experimental/webhook-github': '@ocean/ocean-webhook-github',
  'packages/experimental/action-cards': '@ocean/ocean-action-cards',
  'packages/experimental/client-ui-action-cards': '@ocean/ocean-client-ui-action-cards',
  'packages/experimental/creation-recommendations': '@ocean/ocean-creation-recommendations',
  'packages/experimental/client-ui-creation-recommendations': '@ocean/ocean-client-ui-creation-recommendations',
  'packages/experimental/plugin-recommendations': '@ocean/ocean-plugin-recommendations',
  'packages/experimental/client-ui-plugin-recommendations': '@ocean/ocean-client-ui-plugin-recommendations',
  'packages/experimental/personalized-recommendations': '@ocean/ocean-personalized-recommendations',
} satisfies Record<`packages/experimental/${string}`, `@ocean/ocean-${string}`>

/** Legacy npm namespace, allowed only in `LEGACY_PREFIXED_EXPERIMENTAL_PACKAGE_DIRECTORIES`. */
export const EXPERIMENTAL_PACKAGE_NAME_PREFIX = '@ocean/ocean-experimental-'

/** Existing experimental packages that keep the legacy prefix until a rename; this list must not grow. */
export const LEGACY_PREFIXED_EXPERIMENTAL_PACKAGE_DIRECTORIES: readonly string[] = [
  'packages/experimental/api-speech-to-text',
  'packages/experimental/auto-review',
  'packages/experimental/badge-skill-bundle',
  'packages/experimental/browser-use-chrome-devtools-mcp',
  'packages/experimental/browser-use-playwright-mcp',
  'packages/experimental/browser-use-runtime',
  'packages/experimental/browser-use-stagehand-native',
  'packages/experimental/claude-code-mods',
  'packages/experimental/client-ui-claude-code-mods',
  'packages/experimental/client-ui-cot-translation',
  'packages/experimental/client-ui-forge',
  'packages/experimental/client-ui-stats',
  'packages/experimental/client-ui-voice-input',
  'packages/experimental/computer-use-cua-driver-mcp',
  'packages/experimental/computer-use-cua-driver-native',
  'packages/experimental/cot-translation-bundle',
  'packages/experimental/cua-macos',
  'packages/experimental/forge',
  'packages/experimental/forge-bundle',
  'packages/experimental/forge-github',
  'packages/experimental/forge-session',
  'packages/experimental/inspector',
  'packages/experimental/inspector-profile',
  'packages/experimental/liveshare',
  'packages/experimental/liveshare-protocol',
  'packages/experimental/plugin-market-bundle',
  'packages/experimental/ptc-runtime-python',
  'packages/experimental/ralph-bundle',
  'packages/experimental/session-inspector',
  'packages/experimental/session-search',
  'packages/experimental/session-titles-bundle',
  'packages/experimental/speech-to-text',
  'packages/experimental/speech-to-text-sensevoice',
  'packages/experimental/subagent-oar',
  'packages/experimental/terminal-bundle',
  'packages/experimental/tool-subagent-oar',
  'packages/experimental/tool-worktree',
  'packages/experimental/translator',
  'packages/experimental/voice-input-bundle',
  'packages/experimental/webworker-packer',
  'packages/experimental/webworker-runtime',
  'packages/experimental/worktree',
]
const unprefixedNames = new Set(Object.values(EXPERIMENTAL_PACKAGE_NAME_EXCEPTIONS))

/**
 * Identify an experimental npm package independently of its installed directory.
 * @param name - complete npm package name, without a version or subpath.
 * @returns Whether the name uses the legacy prefix or appears in `EXPERIMENTAL_PACKAGE_NAME_EXCEPTIONS`.
 */
export function isExperimentalPackageName(name: string): boolean {
  return name.startsWith(EXPERIMENTAL_PACKAGE_NAME_PREFIX) || unprefixedNames.has(name)
}

/**
 * Find experimental identities in module ids, paths, subpaths, or npm alias specifications.
 * @param reference - package reference or bundler/runtime module identifier.
 * @returns Whether a delimited package name identifies an experimental capability.
 */
export function hasExperimentalPackageReference(reference: string): boolean {
  const normalized = reference.replaceAll('\\', '/')
  return [...normalized.matchAll(/(?:^|[/:\u0000])(@(?:deepseek-ai|ocean)\/[^/@?#:\s]+)(?=$|[/@?#:])/g)]
    .some(([, name]) => name !== undefined && isExperimentalPackageName(name))
}

/**
 * Derive the package-owned plugin record namespace without changing persisted names.
 * @param name - complete experimental npm package name.
 * @returns Capability suffix, or undefined for a non-experimental name.
 */
export function experimentalPackageRecordNamespace(name: string): string | undefined {
  if (!isExperimentalPackageName(name)) return undefined
  return name.slice(name.startsWith(EXPERIMENTAL_PACKAGE_NAME_PREFIX) ? EXPERIMENTAL_PACKAGE_NAME_PREFIX.length : '@ocean/ocean-'.length)
}

/** Experimental packages excluded from public releases and npm baselines. */
export const PRIVATE_EXPERIMENTAL_PACKAGE_DIRECTORIES: readonly string[] = []

/**
 * Whether an experimental package publishes under the default-public policy.
 * @param directory - repository-relative package directory.
 * @param privateDirectories - experimental directories excluded from publication.
 * @returns Whether the package publishes with the dsh family.
 */
export function isPublicExperimentalPackageDirectory(
  directory: string,
  privateDirectories: readonly string[] = PRIVATE_EXPERIMENTAL_PACKAGE_DIRECTORIES,
): boolean {
  return /^packages\/experimental\/[^/]+$/.test(directory)
    && !privateDirectories.includes(directory)
}
