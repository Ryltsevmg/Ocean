import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('uses Ocean for install and initial document branding', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const manifest: unknown = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'))
  expect(html).toContain('<title>Ocean</title>')
  expect(html).toContain('name="apple-mobile-web-app-title" content="Ocean"')
  expect(manifest).toMatchObject({ name: 'Ocean', short_name: 'Ocean' })
})
