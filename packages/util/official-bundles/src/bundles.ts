/** The bundle package names the dsh installation selects, offers, installs on demand, or retires. */

/** Installation-owned defaults used when a shipped profile is first opened. */
export interface ProfileTemplate {
  /** Ordered bundle layer list. */
  bundles: readonly string[]
}

/** The shipped profile templates auto-initialized on first use, by name. */
export const PROFILE_TEMPLATES: Record<string, ProfileTemplate> = {
  acp: {
    bundles: ['@ocean/ocean-base', '@ocean/ocean-acp-app'],
  },
  web: {
    bundles: ['@ocean/ocean-base', '@ocean/ocean-web-app'],
  },
  headless: {
    bundles: ['@ocean/ocean-base', '@ocean/ocean-headless'],
  },
  sdk: {
    bundles: ['@ocean/ocean-base', '@ocean/ocean-sdk-app'],
  },
  'sdk-minimal': {
    bundles: ['@ocean/ocean-sdk-minimal'],
  },
}

/**
 * Installation-owned bundle tuples that an earlier release wrote into a shipped profile; app-boot replaces an exact
 * match with the {@link PROFILE_TEMPLATES} entry of the same name and leaves every other list untouched.
 */
export const INSTALLATION_OWNED_PROFILE_TUPLES: Readonly<Record<string, readonly string[]>> = {
  headless: ['@ocean/ocean-base', '@ocean/ocean-web-app', '@ocean/ocean-headless'],
}

/** Bundles an earlier release shipped and the installation no longer carries; app-boot removes them from profiles. */
export const RETIRED_BUNDLES: ReadonlySet<string> = new Set([
  // The Web composition mounts Schedule itself
  // ([upgrade guide](../../../../docs/upgrade-guide/v0.2.0-rc.2/schedule-bundle-retired/guide.md)).
  '@ocean/ocean-experimental-schedule-bundle',
  '@ocean/ocean-experimental-agent-team-profile',
  // The experimental group retired with 0.2.2-rc.2; app-boot drops its bundles from
  // profiles earlier releases wrote
  // ([upgrade guide](../../../../docs/upgrade-guide/v0.2.2-rc.2/experimental-plugins-retired/guide.md)).
  '@ocean/ocean-action-cards',
  '@ocean/ocean-browser-use-browse',
  '@ocean/ocean-client-ui-action-cards',
  '@ocean/ocean-client-ui-creation-recommendations',
  '@ocean/ocean-client-ui-plugin-recommendations',
  '@ocean/ocean-creation-recommendations',
  '@ocean/ocean-cua',
  '@ocean/ocean-cua-bundle',
  '@ocean/ocean-cua-linux',
  '@ocean/ocean-cua-windows',
  '@ocean/ocean-experimental-api-speech-to-text',
  '@ocean/ocean-experimental-auto-review',
  '@ocean/ocean-experimental-badge-skill-bundle',
  '@ocean/ocean-experimental-browser-use-chrome-devtools-mcp',
  '@ocean/ocean-experimental-browser-use-playwright-mcp',
  '@ocean/ocean-experimental-browser-use-runtime',
  '@ocean/ocean-experimental-browser-use-stagehand-native',
  '@ocean/ocean-experimental-claude-code-mods',
  '@ocean/ocean-experimental-client-ui-claude-code-mods',
  '@ocean/ocean-experimental-client-ui-cot-translation',
  '@ocean/ocean-experimental-client-ui-forge',
  '@ocean/ocean-experimental-client-ui-stats',
  '@ocean/ocean-experimental-client-ui-voice-input',
  '@ocean/ocean-experimental-computer-use-cua-driver-mcp',
  '@ocean/ocean-experimental-computer-use-cua-driver-native',
  '@ocean/ocean-experimental-cot-translation-bundle',
  '@ocean/ocean-experimental-cua-macos',
  '@ocean/ocean-experimental-forge',
  '@ocean/ocean-experimental-forge-bundle',
  '@ocean/ocean-experimental-forge-github',
  '@ocean/ocean-experimental-forge-session',
  '@ocean/ocean-experimental-inspector',
  '@ocean/ocean-experimental-inspector-profile',
  '@ocean/ocean-experimental-liveshare',
  '@ocean/ocean-experimental-liveshare-protocol',
  '@ocean/ocean-experimental-plugin-market-bundle',
  '@ocean/ocean-experimental-ptc-runtime-python',
  '@ocean/ocean-experimental-ralph-bundle',
  '@ocean/ocean-experimental-session-inspector',
  '@ocean/ocean-experimental-session-search',
  '@ocean/ocean-experimental-session-titles-bundle',
  '@ocean/ocean-experimental-speech-to-text',
  '@ocean/ocean-experimental-speech-to-text-sensevoice',
  '@ocean/ocean-experimental-subagent-oar',
  '@ocean/ocean-experimental-terminal-bundle',
  '@ocean/ocean-experimental-tool-subagent-oar',
  '@ocean/ocean-experimental-tool-worktree',
  '@ocean/ocean-experimental-translator',
  '@ocean/ocean-experimental-voice-input-bundle',
  '@ocean/ocean-experimental-webworker-packer',
  '@ocean/ocean-experimental-webworker-runtime',
  '@ocean/ocean-experimental-worktree',
  '@ocean/ocean-hook-protocol',
  '@ocean/ocean-hooks-claude-code',
  '@ocean/ocean-hooks-codex',
  '@ocean/ocean-personalized-recommendations',
  '@ocean/ocean-plugin-recommendations',
  '@ocean/ocean-session-title-all-prompts-llm',
  '@ocean/ocean-skill-badge',
  '@ocean/ocean-terminal-panel',
  '@ocean/ocean-tool-ralph',
  '@ocean/ocean-tool-session-query',
  '@ocean/ocean-tool-terminal',
  '@ocean/ocean-webhook',
  '@ocean/ocean-webhook-github',
])

/** The bundle list a `dsh plugin` init uses for a name with no shipped template. */
export const DEFAULT_PROFILE_BUNDLES: readonly string[] = ['@ocean/ocean-base']

/**
 * The bundles the dsh installation ships for a person to switch on: each a
 * runtime dependency of the installation that declares `dsh.bundle.patch`,
 * an `icon`, and `./locale/*.json` display metadata, selected by no shipped
 * template, and offered switched off by the plugin manager.
 */
export const OPTIONAL_BUNDLES: readonly string[] = [
  '@ocean/ocean-subagent-codex',
]

/** Public DSH release members available through the ordinary on-demand bundle installer. */
export const ON_DEMAND_BUNDLES: readonly string[] = [
  '@ocean/ocean-subagent-claude-code',
]
