/** Render the fixed macOS icon from the shared Ocean vector mark. */
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'

const source = await readFile(new URL('../resources/icon-macos.svg', import.meta.url), 'utf8')
const glyph = source.slice(source.indexOf('<g'), source.lastIndexOf('</svg>')).replace('fill="#2679D8"', 'fill="#257AD8"')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect x="64" y="64" width="896" height="896" rx="200" fill="#0C111C"/><g transform="translate(102.4 102.4) scale(0.8)">${glyph}</g></svg>`
await sharp(Buffer.from(svg)).png().toFile(new URL('../resources/dock-dark.png', import.meta.url).pathname)
