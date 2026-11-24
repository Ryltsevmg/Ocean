/** Pairing links are accepted only in their documented form. */
import { expect, it } from 'vitest'
import { findPairingArgument, parsePairingLink } from '../src/remote-pairing.ts'

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
])('refuses %s', (_description, value) => {
  expect(parsePairingLink(value)).toBeUndefined()
})

it('refuses a link with no Host or label parameter', () => {
  expect(parsePairingLink(`ocean://pair?label=Phone#${grant}`)).toBeUndefined()
  expect(parsePairingLink(`ocean://pair?host=${encodeURIComponent('https://ocean.example/')}#${grant}`)).toBeUndefined()
})

it('finds the pairing link among launch arguments', () => {
  const argument = link('https://ocean.example/')
  expect(findPairingArgument(['/Applications/Ocean', '--flag', argument])).toBe(argument)
  expect(findPairingArgument(['/Applications/Ocean', 'ocean://open'])).toBeUndefined()
})
