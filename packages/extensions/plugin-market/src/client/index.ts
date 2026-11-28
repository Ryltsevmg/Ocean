/** Browser entry for the bundled plugin catalog. */
import * as React from 'react'
import * as primitives from '@ocean/ocean-client-ui-primitives'
import type { Context } from '@deepseek-ai/cordis'
import { createMarket } from '../entry.js'
import css from './MarketDetails.module.css'

const plugin = createMarket(React, primitives, css.dialog)

/** Services required by the catalog tab. */
export const inject = plugin.inject

/** Register the catalog tab and its owned lifecycle. @param ctx - Browser plugin context. */
export function apply(ctx: Context): void { plugin.apply(ctx) }
