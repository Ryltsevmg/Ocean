import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const tree = readFileSync(new URL('../src/client/FileTree.module.css', import.meta.url), 'utf8')
const body = readFileSync(new URL('../src/client/FilesBody.module.css', import.meta.url), 'utf8')

describe('Ocean workspace files geometry', () => {
  it('uses compact thirty-pixel rows and twelve-pixel hierarchy steps', () => {
    expect(tree).toContain('min-height: 30px')
    expect(tree).toContain('padding-left: 12px')
    expect(tree).toContain('gap: 8px')
  })
  it('keeps selection and keyboard focus distinct', () => {
    expect(tree).toContain('var(--dsw-alias-bg-selected)')
    expect(tree).toContain('.action:focus-visible')
    expect(tree).toContain('outline-offset: -2px')
  })
  it('matches the path row and tree inset without removing navigator adaptation', () => {
    expect(body).toContain('height: 42px')
    expect(body).toContain('padding: 0 16px')
    expect(body).toContain('padding: 8px 0 8px 16px')
    expect(body).toContain('@media (width < 768px)')
    expect(body).toContain('scrollbar-gutter: stable')
  })
})
