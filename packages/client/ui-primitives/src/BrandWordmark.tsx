import type { IconProps } from './icons/props.ts'
import { FishLogo } from './FishLogo.tsx'

/** Display options for the Ocean wordmark. */
export interface BrandWordmarkProps extends IconProps {
  /** Whether to include the leading Ocean mark. */
  includeMark?: boolean | undefined
}

/**
 * Render the Ocean wordmark in the inherited brand box.
 * @param props - Requested height, placement class and mark visibility.
 * @returns the decorative Ocean wordmark.
 */
export function BrandWordmark({ size = 24, className, includeMark = true }: BrandWordmarkProps) {
  const width = includeMark ? 98 : 72
  return (
    <svg width={(size * width) / 24} height={size} className={className}
      viewBox={includeMark ? '0 0 98 24' : '26 0 72 24'} fill="none" aria-hidden="true">
      {includeMark && <FishLogo size={24} />}
      <text x="30" y="18" fill="currentColor" fontFamily="Inter, sans-serif" fontWeight="500" fontSize="20" letterSpacing="-0.75">Ocean</text>
    </svg>
  )
}
