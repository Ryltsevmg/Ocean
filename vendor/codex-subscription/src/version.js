import packageJson from '../package.json' with { type: 'json' }

export const PACKAGE_VERSION = packageJson.version
export const USER_AGENT = `@ocean/ocean-codex-subscription/${PACKAGE_VERSION}`
