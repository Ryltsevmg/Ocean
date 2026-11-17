/** Bounded renderer metadata shared with the Desktop Host selector. */
import { z } from 'zod'

const publicationSchema = z.strictObject({
  revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  sessions: z.array(z.strictObject({
    id: z.string().min(1).max(128),
    title: z.string().max(256),
  })).max(50),
  pendingApprovals: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  pendingQuestions: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
}).refine(value => new Set(value.sessions.map(row => row.id)).size === value.sessions.length)

/** One renderer's complete recent-session list and totals across all its Sessions. */
export type DesktopHostPublication = z.infer<typeof publicationSchema>

/**
 * Validate IPC metadata without accepting credentials or unbounded fields.
 * @param value - Renderer-provided publication.
 * @returns The publication, or undefined for invalid input.
 */
export function readDesktopHostPublication(value: unknown): DesktopHostPublication | undefined {
  const result = publicationSchema.safeParse(value)
  return result.success ? result.data : undefined
}
