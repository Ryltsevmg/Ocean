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
])

/** The bundle list a `dsh plugin` init uses for a name with no shipped template. */
export const DEFAULT_PROFILE_BUNDLES: readonly string[] = ['@ocean/ocean-base']

/**
 * The bundles the dsh installation ships for a person to switch on: each a
 * runtime dependency of the installation that declares `dsh.bundle.patch`,
 * an `icon`, and `./locale/*.json` display metadata, selected by no shipped
 * template, and offered switched off by the plugin manager except persistent
 * terminals, which have no page switch.
 */
export const OPTIONAL_BUNDLES: readonly string[] = [
  '@ocean/ocean-subagent-codex',
  '@ocean/ocean-browser-use-browse',
  '@ocean/ocean-personalized-recommendations',
  '@ocean/ocean-cua-bundle',
  '@ocean/ocean-experimental-session-search',
  '@ocean/ocean-experimental-ralph-bundle',
  '@ocean/ocean-experimental-terminal-bundle',
  '@ocean/ocean-experimental-badge-skill-bundle',
  '@ocean/ocean-experimental-session-titles-bundle',
  '@ocean/ocean-experimental-voice-input-bundle',
  '@ocean/ocean-experimental-cot-translation-bundle',
  '@ocean/ocean-experimental-auto-review',
  '@ocean/ocean-experimental-inspector-profile',
  '@ocean/ocean-experimental-liveshare',
  '@ocean/ocean-experimental-plugin-market-bundle',
  '@ocean/ocean-experimental-tool-worktree',
  '@ocean/ocean-experimental-forge-bundle',
]

/** Public DSH release members available through the ordinary on-demand bundle installer. */
export const ON_DEMAND_BUNDLES: readonly string[] = [
  '@ocean/ocean-subagent-claude-code',
]
