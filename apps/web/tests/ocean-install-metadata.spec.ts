import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('uses Ocean-Chat for install and initial document branding', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const manifest: unknown = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'))
  expect(html).toContain('<title>Ocean-Chat</title>')
  expect(html).toContain('name="apple-mobile-web-app-title" content="Ocean-Chat"')
  expect(manifest).toMatchObject({ name: 'Ocean-Chat', short_name: 'Ocean-Chat' })
})
