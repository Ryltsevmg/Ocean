/** Ocean mark and static fallback for the running Chat status. */
import { FishLogo } from '@ocean/ocean-client-ui-primitives'
import css from './ChatView.module.css'

/**
 * Render the approved Ocean mark in the inherited running-status seat.
 * @returns a decorative mask and SVG fallback.
 */
export function RunningWhaleTail() {
  return (
    <span className={css.runningIcon} aria-hidden="true">
      <span className={css.runningWhaleAnimated} />
      <FishLogo className={css.runningWhaleStill} size={14} />
    </span>
  )
}
