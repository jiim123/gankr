// One-off placeholder icon generator. Produces a flat square PNG (white "G"
// mark on a neutral-900 background) at resources/icon.png. Run with
// `node scripts/make-icon.cjs`. Not part of the build pipeline.
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

function makePng(size, bgHex, fgHex) {
  const bg = [
    parseInt(bgHex.slice(0, 2), 16),
    parseInt(bgHex.slice(2, 4), 16),
    parseInt(bgHex.slice(4, 6), 16)
  ]
  const fg = [
    parseInt(fgHex.slice(0, 2), 16),
    parseInt(fgHex.slice(2, 4), 16),
    parseInt(fgHex.slice(4, 6), 16)
  ]

  // Very small bitmap "G" glyph, scaled up to fill most of the canvas.
  const glyph = [
    '011110',
    '100001',
    '100000',
    '100111',
    '100001',
    '100001',
    '011110'
  ]
  const rows = glyph.length
  const cols = glyph[0].length
  const margin = Math.floor(size * 0.18)
  const cell = Math.floor((size - margin * 2) / Math.max(rows, cols))

  const raw = Buffer.alloc(size * (1 + size * 3))
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 3)
    raw[rowStart] = 0 // filter type: none
    for (let x = 0; x < size; x++) {
      let color = bg
      const gx = Math.floor((x - margin) / cell)
      const gy = Math.floor((y - margin) / cell)
      if (gy >= 0 && gy < rows && gx >= 0 && gx < cols && glyph[gy][gx] === '1') {
        color = fg
      }
      const px = rowStart + 1 + x * 3
      raw[px] = color[0]
      raw[px + 1] = color[1]
      raw[px + 2] = color[2]
    }
  }

  const idat = zlib.deflateSync(raw)

  function chunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length, 0)
    const typeBuf = Buffer.from(type, 'ascii')
    const crcBuf = Buffer.alloc(4)
    const crc = crc32(Buffer.concat([typeBuf, data]))
    crcBuf.writeUInt32BE(crc >>> 0, 0)
    return Buffer.concat([len, typeBuf, data, crcBuf])
  }

  const crcTable = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    crcTable[n] = c
  }
  function crc32(buf) {
    let c = 0xffffffff
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
    }
    return c ^ 0xffffffff
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: RGB
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const outDir = path.join(__dirname, '..', 'resources')
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'icon.png'), makePng(256, '171717', 'ffffff'))
fs.writeFileSync(path.join(outDir, 'tray-icon.png'), makePng(32, '171717', 'ffffff'))
console.log('wrote resources/icon.png and resources/tray-icon.png')
