/** A protocol launch carries at most one pairing link among its arguments. */
import { expect, it } from 'vitest'
import { findPairingArgument } from '../src/remote-pairing.ts'

it('finds the pairing link among launch arguments', () => {
  const argument = `ocean://pair?host=${encodeURIComponent('https://ocean.example/')}&label=Phone#grant`
  expect(findPairingArgument(['/Applications/Ocean', '--flag', argument])).toBe(argument)
  expect(findPairingArgument(['/Applications/Ocean', 'ocean://open'])).toBeUndefined()
})
