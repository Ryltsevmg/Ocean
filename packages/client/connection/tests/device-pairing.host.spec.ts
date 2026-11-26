/** Pairing links are accepted only in their two documented forms. */
import { expect, it } from 'vitest'
import { parsePairing, parsePairingLink, parsePairingUrl } from '../src/device-pairing.ts'

const grant = `${'a'.repeat(8)}-aaaa-4aaa-8aaa-${'a'.repeat(12)}.${'B'.repeat(43)}`
const link = (host: string, label = 'Phone', fragment = grant): string => {
  const url = new URL('ocean://pair')
  url.searchParams.set('host', host)
  url.searchParams.set('label', label)
  url.hash = fragment
  return url.href
}

it('reads the Host mount, device label, and grant from a pairing link', () => {
  expect(parsePairingLink(link('https://ocean.example/mount'))).toEqual({
    address: 'https://ocean.example/mount/', label: 'Phone', secret: grant,
  })
  expect(parsePairingLink(`  ${link('https://ocean.example/')}\n`)?.secret).toBe(grant)
})

it.each([
  ['a non-Ocean scheme', link('https://ocean.example/').replace('ocean:', 'https:')],
  ['another Ocean action', link('https://ocean.example/').replace('//pair', '//open')],
  ['a plain HTTP Host', link('http://ocean.example/')],
  ['a Host address with credentials', link('https://user:secret@ocean.example/')],
  ['a Host address with a query', link('https://ocean.example/?next=1')],
  ['an unparsable Host address', link('not an address')],
  ['a missing grant', link('https://ocean.example/', 'Phone', '')],
  ['a malformed grant', link('https://ocean.example/', 'Phone', 'short')],
  ['an empty label', link('https://ocean.example/', '   ')],
  ['an oversized label', link('https://ocean.example/', 'x'.repeat(129))],
  ['a grant in the query instead of the fragment', `ocean://pair?host=${encodeURIComponent('https://ocean.example/')}&label=Phone&grant=${grant}`],
  ['text that is not a URL', 'pair me'],
])('refuses an app link with %s', (_description, value) => {
  expect(parsePairingLink(value)).toBeUndefined()
})

it('refuses an app link with no Host or label parameter', () => {
  expect(parsePairingLink(`ocean://pair?label=Phone#${grant}`)).toBeUndefined()
  expect(parsePairingLink(`ocean://pair?host=${encodeURIComponent('https://ocean.example/')}#${grant}`)).toBeUndefined()
})

it('reads the Host mount and grant from a browser pairing URL', () => {
  expect(parsePairingUrl(`https://ocean.example/mount#pair=${grant}`)).toEqual({
    address: 'https://ocean.example/mount/', secret: grant,
  })
  expect(parsePairingUrl(`  https://ocean.example:8445/#pair=${grant}\n`)).toEqual({
    address: 'https://ocean.example:8445/', secret: grant,
  })
})

it.each([
  ['an app link', link('https://ocean.example/')],
  ['a plain HTTP Host', `http://ocean.example/#pair=${grant}`],
  ['a Host address with a user', `https://user@ocean.example/#pair=${grant}`],
  ['a Host address with a password', `https://user:secret@ocean.example/#pair=${grant}`],
  ['a Host address with a query', `https://ocean.example/?next=1#pair=${grant}`],
  ['a bare grant in the fragment', `https://ocean.example/#${grant}`],
  ['a missing grant', 'https://ocean.example/#pair='],
  ['a malformed grant', `https://ocean.example/#pair=${grant}#extra`],
  ['text that is not a URL', 'pair me'],
])('refuses a browser URL with %s', (_description, value) => {
  expect(parsePairingUrl(value)).toBeUndefined()
})

it('reads either form and refuses everything else', () => {
  expect(parsePairing(link('https://ocean.example/'))).toEqual({ address: 'https://ocean.example/', label: 'Phone', secret: grant })
  expect(parsePairing(`https://ocean.example/#pair=${grant}`)).toEqual({ address: 'https://ocean.example/', secret: grant })
  expect(parsePairing('https://ocean.example/')).toBeUndefined()
})
