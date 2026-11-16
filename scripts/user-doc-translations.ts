/** Additional language editions of the root README and product user guides. */
import { createHash } from 'node:crypto'
import type { Nodes } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { gfm } from 'micromark-extension-gfm'

/** Editions maintained in addition to the existing English/Chinese pairs. */
export const USER_DOC_LOCALES = ['ru', 'ja', 'es', 'fr', 'de', 'pt', 'ko'] as const

/** The exact product-facing source set; contributor and architecture docs are outside it. */
export const USER_DOC_SOURCES = [
  'README.md',
  'docs/user/index.md',
  'docs/user/guide/index.md',
  'docs/user/guide/providers.md',
  'docs/user/guide/network-proxy.md',
  'docs/user/guide/public-deployments.md',
  'docs/user/guide/desktop-uninstall-cleanup.md',
  'docs/user/guide/python-sdk.md',
  'docs/user/guide/mcp-memory.md',
  'docs/user/guide/schedule.md',
] as const

/** Return a registered edition's source, or null for unrelated Markdown paths.
 * @param file - Repository-relative Markdown path.
 * @returns The unsuffixed source path when the edition is registered.
 */
export function userDocTranslationSource(file: string): string | null {
  for (const source of USER_DOC_SOURCES) {
    for (const locale of USER_DOC_LOCALES) {
      if (file === source.replace(/\.md$/, `.${locale}.md`)) return source
    }
  }
  return null
}

/** Hash exact file contents so source edits invalidate a confirmed edition.
 * @param content - Complete Markdown contents.
 * @returns SHA-256 digest in hexadecimal.
 */
export function userDocDigest(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

/** Remove the shared language navigation before comparing document structure.
 * @param content - Complete Markdown contents.
 * @returns Prose and examples without the navigation block.
 */
export function withoutUserDocNavigation(content: string): string {
  return content.replace(/<!-- USER_LANGUAGES_START -->[\s\S]*?<!-- USER_LANGUAGES_END -->\n?/g, '')
    .replace(/^English \| \[中文\]\([^\n]+\)\n/gm, '')
    .replace(/^\[English\]\([^\n]+\)(?: \| 中文)?\n/gm, '')
}

/** Capture non-translatable examples and the structure required in every edition.
 * @param content - Complete Markdown contents.
 * @returns Ordered structural tokens; labels and prose remain review-owned.
 */
export function userDocStructure(content: string): string[] {
  const tree = fromMarkdown(withoutUserDocNavigation(content), { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] })
  const tokens: string[] = []
  const normalizedTarget = (url: string): string => url.replace(/\.(?:ru|ja|es|fr|de|pt|ko)\.md(?=[?#]|$)/g, '.md')
  const visit = (node: Nodes): void => {
    switch (node.type) {
      case 'heading': tokens.push(`heading:${node.depth}`); break
      case 'code': tokens.push(`code:${node.lang ?? ''}:${node.meta ?? ''}:${node.value}`); break
      case 'inlineCode': tokens.push(`inline:${node.value}`); break
      case 'list': tokens.push(`list:${node.ordered}:${node.start}:${node.children.length}`); break
      case 'table': tokens.push(`table:${node.children.length}:${node.children[0]?.children.length}`); break
      case 'link':
      case 'image':
      case 'definition': tokens.push(`${node.type}:${normalizedTarget(node.url)}`); break
      default: break
    }
    if ('children' in node) node.children.forEach(visit)
  }
  visit(tree)
  return tokens
}
