/** Validate complete user-guide editions, verbatim examples and confirmed file hashes. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { USER_DOC_LOCALES, USER_DOC_SOURCES, userDocDigest, userDocStructure } from './user-doc-translations.ts'

/** Verify registered editions; write records only after every document passes structural checks.
 * @param root - Absolute repository root.
 * @param write - Record the reviewed contents instead of comparing saved hashes.
 * @returns Number of complete editions checked.
 */
export function verifyUserDocTranslations(root: string, write = false): number {
  const recordPath = resolve(root, 'scripts/user-doc-translations.record.json')
  const entries: Record<string, { source: string; translation: string }> = {}
  for (const source of USER_DOC_SOURCES) {
    const sourceText = readFileSync(resolve(root, source), 'utf8')
    const expected = userDocStructure(sourceText)
    for (const locale of USER_DOC_LOCALES) {
      const target = source.replace(/\.md$/, `.${locale}.md`)
      const targetText = readFileSync(resolve(root, target), 'utf8')
      if (JSON.stringify(userDocStructure(targetText)) !== JSON.stringify(expected)) {
        throw new Error(`${target}: headings, lists, tables, links or code differ from ${source}`)
      }
      if (!targetText.includes('<!-- USER_LANGUAGES_START -->')) throw new Error(`${target}: language navigation missing`)
      entries[target] = { source: userDocDigest(sourceText), translation: userDocDigest(targetText) }
    }
  }
  const rendered = JSON.stringify(entries, null, 2) + '\n'
  if (write) writeFileSync(recordPath, rendered)
  else if (!existsSync(recordPath) || readFileSync(recordPath, 'utf8') !== rendered) {
    throw new Error('User-document translations changed or are stale. Review the editions and re-record with verify-user-doc-translations --write.')
  }
  return Object.keys(entries).length
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  if (args.some(arg => arg !== '--write')) throw new Error('Expected only --write or no arguments')
  console.log(`User-document translations: ${verifyUserDocTranslations(resolve(import.meta.dirname, '..'), args.includes('--write'))} editions checked`)
}
