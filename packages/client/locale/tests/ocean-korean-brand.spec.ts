import { describe, expect, it } from 'vitest'
import { oceanKoreanCatalogs } from '../src/locales/ocean-korean.ts'

describe('Ocean Korean product identity', () => {
  it('uses Ocean in shipped Korean copy without changing archived import catalogs', () => {
    const copy = Object.values(oceanKoreanCatalogs).flatMap(dictionary => Object.values(dictionary))
    expect(copy.join('\n')).not.toMatch(/DeepSeek Harness|Ocean-Chat/)
    expect(oceanKoreanCatalogs.common?.['brand.localBuild']).toBe('Ocean')
  })
})
