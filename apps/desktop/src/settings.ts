/** Startup policy for optional Electron shell preferences, independent of the Host. */
import { DesktopSettingsFile, type DesktopLocalHostPreferences, type DesktopUpdatePreferences } from './settings-file.ts'

/** Resolved startup preferences; an invalid or unreadable field never disables the other section. */
export interface DesktopSettings {
  readonly updates: Pick<DesktopUpdatePreferences, 'allowTestAuthPopupWindow'>
  readonly localHost: DesktopLocalHostPreferences
}

/**
 * Initialize the shared document explicitly at startup, then resolve the popup and local Host preferences.
 * An absent or invalid local Host field starts the Host; an absent or invalid popup preference disables it.
 * @param userData - Electron userData, independent of OCEAN_HOME.
 * @returns Validated preferences, or their defaults with a diagnostic per failure; changes require restart.
 */
export async function readDesktopSettings(userData: string): Promise<DesktopSettings> {
  const file = new DesktopSettingsFile(userData)
  const result = await file.initialize()
  const ready = result.kind === 'ready' ? result.fields : undefined
  const popup = ready?.allowTestAuthPopupWindow
  const startAtLaunch = ready?.startAtLaunch
  const errors = [
    result.kind === 'error' ? result.error : undefined,
    popup?.kind === 'invalid' ? popup.error : undefined,
    startAtLaunch?.kind === 'invalid' ? startAtLaunch.error : undefined,
  ].filter(error => error !== undefined)
  for (const error of errors) {
    try { console.warn(`desktop settings: ${file.path}: using defaults because settings could not be loaded`, error) } catch (_logError) {
      // Preferences keep their defaults even when diagnostic output is unavailable.
    }
  }
  return {
    updates: { allowTestAuthPopupWindow: popup?.kind === 'valid' ? popup.value : false },
    // Only an explicit valid false stops the Host; absent, invalid and unreadable all start it.
    localHost: { startAtLaunch: startAtLaunch?.kind !== 'valid' || startAtLaunch.value },
  }
}
