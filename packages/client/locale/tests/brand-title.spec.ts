import { expect, it } from 'vitest'
import { en } from '../src/locales/en.ts'
import { zh } from '../src/locales/zh.ts'
import { ru } from '../src/locales/ru.ts'
import { de } from '../src/locales/de.ts'
import { es } from '../src/locales/es.ts'
import { fr } from '../src/locales/fr.ts'
import { ja } from '../src/locales/ja.ts'
import { pt } from '../src/locales/pt.ts'
import { oceanKoreanCatalogs } from '../src/locales/ocean-korean.ts'

it('keeps the product title free from local-build labels in every UI language', () => {
  for (const locale of [en, zh, ru, de, es, fr, ja, pt, oceanKoreanCatalogs.common!]) {
    expect(locale['brand.localBuild']).toBe('Ocean')
  }
})
