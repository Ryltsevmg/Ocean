import { describe, expect, it } from 'vitest'
import { clientImportViolation, resolveClientImport } from './verify-client-domain-graph.ts'

describe('client domain import resolution', () => {
  it('preserves imports that leave src/client from a top-level file', () => {
    expect(resolveClientImport('styles.ts', '../styles/base.css?inline'))
      .toBe('../styles/base.css?inline')
  })

  it('normalizes imports between domains inside src/client', () => {
    expect(resolveClientImport('input/hub.ts', '../queue/store.ts'))
      .toBe('queue/store.ts')
  })
})

describe('client implementation layers', () => {
  it('allows static resources without treating their directory as shared executable code', () => {
    for (const resource of ['../rows/Rows.module.css', '../assets/logo.svg?url', '../assets/logo.webp', '../fonts/body.woff2']) {
      expect(clientImportViolation('actions/Button.tsx', resource)).toBeUndefined()
    }
    for (const source of ['../assets/helper.ts', '../locales/dictionary.ts', '../fonts/font.ts?raw', '../rows/Button.tsx']) {
      expect(clientImportViolation('actions/Button.tsx', source)).toContain('imports sibling domain')
    }
  })

  it('rejects shared contracts importing implementations while permitting owner composition', () => {
    expect(clientImportViolation('contract/slots.ts', '../document/body.ts')).toContain('imports sibling domain')
    expect(clientImportViolation('document/body.ts', '../contract/slots.ts')).toBeUndefined()
    expect(clientImportViolation('index.ts', './document/body.ts')).toBeUndefined()
    expect(clientImportViolation('face.ts', './document/body.ts')).toContain('only apply/index may assemble')
  })
})
