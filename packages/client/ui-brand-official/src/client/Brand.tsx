import { BrandWordmark, FishLogo } from '@ocean/ocean-client-ui-primitives'
import type { SidebarBrandMarkOwnerProps } from '@ocean/ocean-client-ui-sidebar/client'
import type {} from '@ocean/ocean-client-locale/client'
import type { PropsLocale } from '@ocean/ocean-client-ui-slots'

/**
 * Render the official mark with the presentation requested by its host surface.
 * @param props - Host-supplied mark presentation.
 * @returns the official whale mark.
 */
export function OfficialBrandMark({ size }: SidebarBrandMarkOwnerProps) {
  return <FishLogo size={size} />
}

/**
 * Render the official name artwork without its independently slotted mark.
 * @param props - The common locale dictionary supplied by the slot renderer.
 * @returns the official name wordmark.
 */
export function OfficialBrandName({ t }: PropsLocale<'common'>) {
  return <BrandWordmark name={t('brand.localBuild')} includeMark={false} />
}
