/** The pairing QR code is black on white whatever the terminal theme, with the quiet zone the specification requires. */
import { describe, expect, it } from 'vitest'
import { pairingUrl } from '../src/device-admin-client.ts'
import { qrTerminal } from '../src/pairing-qr.ts'

const grant = `${'a'.repeat(8)}-aaaa-4aaa-8aaa-${'a'.repeat(12)}.${'B'.repeat(43)}`
const light = '\x1b[37;47m▀'
const reset = '\x1b[0m'

describe('pairingUrl', () => {
  it('keeps the grant in the fragment of the canonical Host mount', () => {
    expect(pairingUrl('https://bigpc.tail71ee4f.ts.net:8445', grant)).toBe(`https://bigpc.tail71ee4f.ts.net:8445/#pair=${grant}`)
  })

  it('refuses an address that is not an HTTPS mount', () => {
    expect(() => pairingUrl('http://ocean.example', grant)).toThrow('HTTPS')
  })
})

describe('qrTerminal', () => {
  const code = qrTerminal(pairingUrl('https://bigpc.tail71ee4f.ts.net:8445', grant))
  const lines = code.split('\n')
  const cells = (line: string): string[] => line.slice(0, -reset.length).match(/\x1b\[\d+;\d+m▀/gu) ?? []

  it('draws two module rows per line and one module per cell', () => {
    // This link encodes as version 6 at error level L: 41 modules and a four-module quiet zone on every side.
    expect(lines).toHaveLength(25)
    for (const line of lines) {
      expect(line.endsWith(reset)).toBe(true)
      expect(cells(line)).toHaveLength(49)
    }
  })

  it('leaves the quiet zone white on every side', () => {
    // Four quiet rows make two lines at the top and two at the bottom; the last line has no row below its quiet row.
    const blank = `${light.repeat(49)}${reset}`
    expect(lines.slice(0, 2)).toEqual([blank, blank])
    expect(lines.slice(-2)).toEqual([blank, blank])
    for (const line of lines) {
      expect(line.startsWith(light.repeat(4))).toBe(true)
      expect(cells(line).slice(-4)).toEqual(Array.from({ length: 4 }, () => light))
    }
  })

  it('colors dark modules explicitly instead of relying on the terminal theme', () => {
    for (const colored of ['\x1b[30;40m▀', '\x1b[37;40m▀', '\x1b[30;47m▀']) expect(code).toContain(colored)
  })

  it('encodes its text: another link yields another code', () => {
    expect(qrTerminal(pairingUrl('https://ocean.example', grant))).not.toBe(code)
  })
})
