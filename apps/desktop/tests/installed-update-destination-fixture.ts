import { afterEach, beforeEach, vi } from 'vitest'

/** Synthetic, non-production destination used only by local qualification tests. */
export const qualificationEnvironment = {
  DSH_DESKTOP_AUTO_UPDATE_ENV: 'test',
  DOWNLOAD_TEST_ORIGIN: 'https://qualification.ocean.example',
  DOWNLOAD_TEST_COS_BUCKET: 'ocean-qualification-1234567890',
}

beforeEach(() => {
  for (const [key, value] of Object.entries(qualificationEnvironment)) vi.stubEnv(key, value)
})
afterEach(() => vi.unstubAllEnvs())
