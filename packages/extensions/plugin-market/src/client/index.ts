/** Browser entry for the bundled plugin catalog. */
import * as React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { createMarket } from '../entry.js'

const plugin = createMarket(React)

/** Services required by the catalog tab. */
export const inject = plugin.inject

/** Register the catalog tab and its owned lifecycle. @param ctx - Browser plugin context. */
export function apply(ctx: Context): void { plugin.apply(ctx) }
