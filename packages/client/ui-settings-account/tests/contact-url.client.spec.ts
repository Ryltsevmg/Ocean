import { expect, it } from 'vitest'
import { ContactConfig } from '../src/contact-config.ts'
import { contactUrl } from '../src/client/contact-url.ts'

it('opens the Ocean support bot without context or a prefilled message', () => {
  expect(contactUrl(ContactConfig({}))).toBe('https://t.me/oceanchatsupportbot')
})

it('strips query, fragment and credentials from configured support URLs', () => {
  expect(contactUrl(ContactConfig({
    contactFormUrl: 'https://user:password@t.me/oceanchatsupportbot?start=account-user#device',
    contactSource: 'ignored',
  }))).toBe('https://t.me/oceanchatsupportbot')
})

it('rejects non-HTTPS support destinations', () => {
  expect(() => ContactConfig({ contactFormUrl: 'javascript:alert(1)' })).toThrow()
})
