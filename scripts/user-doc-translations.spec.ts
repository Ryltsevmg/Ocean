/** User-guide editions must keep examples and expire when their source changes. */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isTranslationScopeFile } from './translation-pairing.ts'
import { partitionPairedMarkdownDerivatives } from './paired-markdown-derivatives.ts'
import { USER_DOC_LOCALES, USER_DOC_SOURCES, userDocStructure, userDocTranslationSource } from './user-doc-translations.ts'
import { verifyUserDocTranslations } from './verify-user-doc-translations.ts'

const navigation = '<!-- USER_LANGUAGES_START -->\n[English](README.md)\n<!-- USER_LANGUAGES_END -->\n'
const source = '# Guide\n\n' + navigation + '\nSome instructions.\n\n```sh\necho example\n```\n'
const translated = source.replace('# Guide', '# Руководство').replace('Some instructions.', 'Инструкция.')

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'ocean-user-docs-'))
  mkdirSync(join(root, 'scripts'))
  for (const path of USER_DOC_SOURCES) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), source)
    for (const locale of USER_DOC_LOCALES) writeFileSync(join(root, path.replace(/\.md$/, `.${locale}.md`)), translated)
  }
  return root
}

describe('registered user translations', () => {
  it('separates only the exact registered editions from the bilingual corpus', () => {
    expect(userDocTranslationSource('docs/user/guide/providers.ja.md')).toBe('docs/user/guide/providers.md')
    expect(isTranslationScopeFile('docs/user/guide/providers.ja.md')).toBe(false)
    expect(isTranslationScopeFile('docs/unregistered.ja.md')).toBe(true)
    expect(isTranslationScopeFile('docs/user/guide/providers.md')).toBe(true)
    expect(isTranslationScopeFile('docs/user/guide/providers.zh.md')).toBe(true)
    expect(userDocTranslationSource('README.xyz.md')).toBeNull()
  })

  it('reuses identical code while changed examples still require checking', () => {
    const blocks = [
      { doc: 'docs/user/guide/providers.md', code: 'valid' },
      { doc: 'docs/user/guide/providers.ja.md', code: 'valid' },
      { doc: 'docs/user/guide/providers.ko.md', code: 'changed' },
    ]
    const partition = partitionPairedMarkdownDerivatives(blocks, b => b.doc, b => b.code)
    expect(partition).toEqual({ primary: [blocks[0], blocks[2]], derivatives: [blocks[1]] })
  })

  it('keeps VitePress container names while allowing translated titles', () => {
    const container = (label: string): string => '::: ' + label + '\n\nText.\n\n:::\n'
    expect(userDocStructure(container('tip Notes'))).toEqual(userDocStructure(container('tip Hinweise')))
    expect(userDocStructure(container('code-group'))).not.toEqual(userDocStructure(container('Codegruppe')))
  })

  it('rejects missing editions, changed examples and stale confirmations', () => {
    const root = fixture()
    try {
      expect(verifyUserDocTranslations(root, true)).toBe(70)
      expect(verifyUserDocTranslations(root)).toBe(70)
      const target = join(root, 'README.ru.md')
      writeFileSync(target, translated.replace('echo example', 'echo changed'))
      expect(() => verifyUserDocTranslations(root, true)).toThrow('code differ')
      writeFileSync(target, translated)
      writeFileSync(join(root, 'README.md'), source.replace('Some instructions.', 'Updated instructions.'))
      expect(() => verifyUserDocTranslations(root)).toThrow('stale')
      writeFileSync(join(root, 'README.md'), source)
      writeFileSync(target, translated.replace('Инструкция.', 'Изменённый перевод.'))
      expect(() => verifyUserDocTranslations(root)).toThrow('stale')
      writeFileSync(target, translated)
      rmSync(target)
      expect(() => verifyUserDocTranslations(root)).toThrow()
      expect(readFileSync(join(root, 'scripts/user-doc-translations.record.json'), 'utf8')).toContain('README.ru.md')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
