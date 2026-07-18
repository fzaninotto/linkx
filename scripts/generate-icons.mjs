/**
 * Génère les icônes PNG de la PWA dans `public/`, sans dépendance npm.
 *
 *   node scripts/generate-icons.mjs
 *
 * Le dessin reprend la grammaire visuelle du jeu : une chaîne bleue reliant
 * deux coins opposés en diagonale, deux amorces blanches dans les deux autres
 * coins. Les tuiles sont rendues en suréchantillonnage 4x puis réduites, ce qui
 * donne l'antialiasing des coins arrondis sans bibliothèque graphique.
 *
 * L'encodeur PNG écrit un fichier minimal mais conforme : signature, IHDR,
 * IDAT (deflate) et IEND, chaque chunk suivi de son CRC32.
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

/** Palette alignée sur les variables CSS de `src/index.css`. */
const INK = [0x17, 0x21, 0x3a]
const BLUE = [0x16, 0x67, 0xd9]
const WHITE = [0xff, 0xfd, 0xfa]

const GRID = 5
const SUPERSAMPLE = 4

/* ---------------------------------------------------------------- encodeur */

const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n += 1) {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c >>> 0
}

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([length, body, crc])
}

/** `pixels` contient `width * height * 3` octets RGB opaques. */
function encodePng(width, height, pixels) {
  const stride = width * 3
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0 // filtre « None »
    Buffer.from(pixels.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // 8 bits par canal
  ihdr[9] = 2 // truecolor RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ------------------------------------------------------------------ dessin */

/**
 * Motif du logo sur une grille 5x5 : `s = x + y` vaut 4 sur l'anti-diagonale.
 * La chaîne bleue occupe cette diagonale, les deux triangles blancs occupent
 * les coins opposés. Le motif est invariant par rotation de 180°.
 */
function tileColor(x, y) {
  const s = x + y
  if (s === GRID - 1) return BLUE
  if (s <= 1 || s >= 2 * (GRID - 1) - 1) return WHITE
  return null
}

function isInsideRoundedSquare(px, py, left, top, side, radius) {
  const dx = Math.max(left - px, px - (left + side), 0)
  const dy = Math.max(top - py, py - (top + side), 0)
  if (dx === 0 && dy === 0) return true
  const cx = Math.min(Math.max(px, left + radius), left + side - radius)
  const cy = Math.min(Math.max(py, top + radius), top + side - radius)
  return (px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2
}

/** Rend l'icône à `size` pixels, la grille occupant `1 - 2 * padding` du côté. */
function renderIcon(size, padding) {
  const big = size * SUPERSAMPLE
  const pixels = new Uint8Array(big * big * 3)
  for (let i = 0; i < big * big; i += 1) {
    pixels[i * 3] = INK[0]
    pixels[i * 3 + 1] = INK[1]
    pixels[i * 3 + 2] = INK[2]
  }

  const content = big * (1 - 2 * padding)
  const origin = big * padding
  const cell = content / GRID
  const gap = cell * 0.14
  const side = cell - gap
  const radius = side * 0.22

  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      const color = tileColor(x, y)
      if (!color) continue
      const left = origin + x * cell + gap / 2
      const top = origin + y * cell + gap / 2
      const x0 = Math.max(0, Math.floor(left))
      const y0 = Math.max(0, Math.floor(top))
      const x1 = Math.min(big - 1, Math.ceil(left + side))
      const y1 = Math.min(big - 1, Math.ceil(top + side))
      for (let py = y0; py <= y1; py += 1) {
        for (let px = x0; px <= x1; px += 1) {
          if (!isInsideRoundedSquare(px + 0.5, py + 0.5, left, top, side, radius)) continue
          const i = (py * big + px) * 3
          pixels[i] = color[0]
          pixels[i + 1] = color[1]
          pixels[i + 2] = color[2]
        }
      }
    }
  }

  // Réduction par moyenne de blocs SUPERSAMPLE x SUPERSAMPLE.
  const out = new Uint8Array(size * size * 3)
  const samples = SUPERSAMPLE * SUPERSAMPLE
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sums = [0, 0, 0]
      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const i = ((y * SUPERSAMPLE + sy) * big + x * SUPERSAMPLE + sx) * 3
          sums[0] += pixels[i]
          sums[1] += pixels[i + 1]
          sums[2] += pixels[i + 2]
        }
      }
      const o = (y * size + x) * 3
      out[o] = Math.round(sums[0] / samples)
      out[o + 1] = Math.round(sums[1] / samples)
      out[o + 2] = Math.round(sums[2] / samples)
    }
  }
  return out
}

/* ------------------------------------------------------------------ sortie */

/**
 * `padding` du maskable : la zone sûre d'une icône masquable est le disque
 * central de 80 % du côté, donc le motif reste dans les 60 % centraux.
 */
const TARGETS = [
  { file: 'icon-192.png', size: 192, padding: 0.08 },
  { file: 'icon-512.png', size: 512, padding: 0.08 },
  { file: 'icon-maskable-512.png', size: 512, padding: 0.2 },
  { file: 'apple-touch-icon.png', size: 180, padding: 0.1 },
]

mkdirSync(PUBLIC_DIR, { recursive: true })
for (const { file, size, padding } of TARGETS) {
  const png = encodePng(size, size, renderIcon(size, padding))
  writeFileSync(join(PUBLIC_DIR, file), png)
  console.log(`${file} — ${size}x${size}, ${png.length} octets`)
}
