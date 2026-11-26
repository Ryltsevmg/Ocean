/** Terminal QR code for a pairing link. */
import { encode } from 'uqr'

/** Quiet zone in modules on every side; the QR specification requires four. */
const QUIET_ZONE = 4

const BLACK = 30
const WHITE = 37

/**
 * Encode text and draw it with explicit black and white, two module rows per line.
 * Plain block characters take the terminal's foreground color, which inverts the code on a dark theme.
 * @param text - Pairing link to encode.
 * @returns Lines of `▀` characters with SGR colors and a quiet zone, for a terminal that emits what it receives.
 */
export function qrTerminal(text: string): string {
  const { size, data } = encode(text, { ecc: 'L', border: QUIET_ZONE })
  const lines: string[] = []
  for (let y = 0; y < size; y += 2) {
    let line = ''
    for (let x = 0; x < size; x += 1) {
      const top = data[y]?.[x] === true
      const bottom = data[y + 1]?.[x] === true
      line += `\x1b[${top ? BLACK : WHITE};${bottom ? BLACK + 10 : WHITE + 10}m▀`
    }
    lines.push(`${line}\x1b[0m`)
  }
  return lines.join('\n')
}
