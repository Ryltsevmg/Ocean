/** Runtime inspection and workflow reports from recorded text. */
import type { ToolDetailsModel } from '../components/ToolDetails.tsx'
import { hasSpillNotice } from '@ocean/ocean-spill-policy/notice'
import {
  detailJson, detailList, detailRecord, inspectionItems,
  type DetailItem, type DetailTranslate,
} from './detail-model-shared.ts'

function cordisDetails(name: string, args: Record<string, unknown>, value: unknown, t: DetailTranslate): ToolDetailsModel | null {
  if (!detailRecord(value)) return null
  if (name === 'cordis_inspect_list') {
    if (!Array.isArray(value.providers)) return null
    return detailList(inspectionItems(value.providers, t), t('detail.providers.count', { count: value.providers.length }), t)
  }
  if (name === 'cordis_inspect_query') {
    if (!('data' in value) || typeof value.provider !== 'string' || typeof value.method !== 'string') return null
    return detailList(inspectionItems(value.data, t), `${value.provider}.${value.method}`, t)
  }
  if (name === 'cordis_inspect_self') {
    if (Array.isArray(value.plugins)) return detailList(inspectionItems(value.plugins, t), t('detail.plugins.count', { count: value.plugins.length }), t)
    return detailList(inspectionItems(value, t), String(args.pluginId ?? args.packageId ?? value.mode), t)
  }
  return null
}

function workflowDetails(args: Record<string, unknown>, text: string, t: DetailTranslate): ToolDetailsModel | null {
  const match = /^workflow "([\s\S]*?)" completed \((\d+) agents?\)\.\nReturn value:\n([\s\S]*)$/u.exec(text)
  if (match === null || match[1] === undefined || match[2] === undefined || match[3] === undefined) return null
  const value = detailJson(match[3])
  if (value === undefined) return null
  const header: DetailItem = {
    title: match[1], badge: { label: t('detail.status.completed'), tone: 'success' },
    fields: [{ label: t('detail.field.agents'), value: match[2] }],
    ...(typeof args.code === 'string' ? { groups: [{ label: t('detail.workflow.script'), items: [{ fields: [], code: { text: args.code, language: 'javascript' } }] }] } : {}),
  }
  return detailList([header, ...inspectionItems(value, t)], match[1], t)
}

/**
 * Present successful inspection, query, and workflow text as named records.
 * @param name - Wire tool name.
 * @param args - Recorded argument object.
 * @param text - Recorded result text.
 * @param json - Parsed whole-result JSON, or undefined for non-JSON text.
 * @param t - Conversation translator.
 * @returns Structured details, or null when an output format is unknown.
 */
export function inspectionDetails(
  name: string, args: Record<string, unknown>, text: string, json: unknown, t: DetailTranslate,
): ToolDetailsModel | null {
  if (hasSpillNotice(text)) return null
  switch (name) {
    case 'cordis_inspect_list':
    case 'cordis_inspect_query':
    case 'cordis_inspect_self': return cordisDetails(name, args, json, t)
    case 'workflow': return workflowDetails(args, text, t)
    default: return null
  }
}
