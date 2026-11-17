/** Shared names for the desktop Platform bridge. */
/** Private desktop channels; the Platform renderer receives bootstrap and locale updates. */
export const PLATFORM_IPC = {
  bootstrap: 'ocean-platform:bootstrap',
  localeChanged: 'ocean-platform:locale-changed',
  open: 'ocean-platform:open',
  bounds: 'ocean-platform:bounds',
  close: 'ocean-platform:close',
} as const

/** Resolved Platform language; Desktop resolves the system preference before sending it. */
export type PlatformLocale = 'en_US' | 'zh_CN'
