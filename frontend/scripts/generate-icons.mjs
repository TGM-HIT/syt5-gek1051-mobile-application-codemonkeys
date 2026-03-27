/**
 * Generates PNG icons for the PWA manifest.
 * Run with: node scripts/generate-icons.mjs
 * No external dependencies – uses only Node.js built-ins.
 */

import { createDeflateRaw } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';

// ── CRC32 table ──────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crcVal = crc32(Buffer.concat([t, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal);
  return Buffer.concat([len, t, data, crcBuf]);
}

// ── Draw icon into RGBA buffer ────────────────────────────────────────────────
function drawIcon(size) {
  const buf = new Uint8Array(size * size * 4);

  // Background color: #16a34a
  const bgR = 22,
    bgG = 163,
    bgB = 74;
  const cornerRadius = size * 0.15;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Rounded rectangle check
      const dx = Math.abs(x - (size - 1) / 2) - (size / 2 - cornerRadius);
      const dy = Math.abs(y - (size - 1) / 2) - (size / 2 - cornerRadius);
      const insideBg = dx <= 0 || dy <= 0 ? true : dx * dx + dy * dy <= cornerRadius * cornerRadius;

      const idx = (y * size + x) * 4;
      if (!insideBg) {
        buf[idx] = buf[idx + 1] = buf[idx + 2] = 0;
        buf[idx + 3] = 0;
        continue;
      }

      // Background
      buf[idx] = bgR;
      buf[idx + 1] = bgG;
      buf[idx + 2] = bgB;
      buf[idx + 3] = 255;

      // Draw a simplified shopping cart shape (white)
      const nx = x / size; // 0..1
      const ny = y / size;

      // Cart trapezoid body: from x=0.28..0.80, top=0.24..0.58 (slanted top)
      const cartLeft = 0.28,
        cartRight = 0.8;
      const cartBottom = 0.6;
      // Top edge: slanted from y=0.30 at left to y=0.24 at right
      const cartTopAtX = 0.3 - (nx - cartLeft) * 0.075;
      const inCart = nx >= cartLeft && nx <= cartRight && ny >= cartTopAtX && ny <= cartBottom;

      // Handle: vertical bar at left x=0.18..0.24, y=0.15..0.32
      const inHandle = nx >= 0.17 && nx <= 0.26 && ny >= 0.14 && ny <= 0.34;

      // Horizontal connector: y=0.28..0.34, x=0.17..0.32
      const inConnector = nx >= 0.17 && nx <= 0.32 && ny >= 0.27 && ny <= 0.34;

      // Wheels: two circles at bottom
      const w1cx = 0.38,
        w1cy = 0.74,
        wr = 0.075;
      const w2cx = 0.68,
        w2cy = 0.74;
      const inWheel1 = (nx - w1cx) ** 2 + (ny - w1cy) ** 2 <= wr ** 2;
      const inWheel2 = (nx - w2cx) ** 2 + (ny - w2cy) ** 2 <= wr ** 2;

      if (inCart || inHandle || inConnector || inWheel1 || inWheel2) {
        buf[idx] = 255;
        buf[idx + 1] = 255;
        buf[idx + 2] = 255;
        buf[idx + 3] = 255;
      }
    }
  }

  return buf;
}

// ── Encode RGBA buffer as PNG ─────────────────────────────────────────────────
async function encodePNG(size, pixels) {
  // Build raw scanlines: filter-byte (0) + RGBA per pixel
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 4)] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = y * (1 + size * 4) + 1 + x * 4;
      raw[dst] = pixels[src];
      raw[dst + 1] = pixels[src + 1];
      raw[dst + 2] = pixels[src + 2];
      raw[dst + 3] = pixels[src + 3];
    }
  }

  // Deflate-compress
  const compressed = await new Promise((res, rej) => {
    const d = createDeflateRaw({ level: 6 });
    const parts = [];
    d.on('data', (c) => parts.push(c));
    d.on('end', () => res(Buffer.concat(parts)));
    d.on('error', rej);
    d.write(raw);
    d.end();
  });

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Main ─────────────────────────────────────────────────────────────────────
mkdirSync('./public/icons', { recursive: true });

for (const size of [192, 512]) {
  const pixels = drawIcon(size);
  const png = await encodePNG(size, pixels);
  const path = `./public/icons/icon-${size}.png`;
  writeFileSync(path, png);
  console.log(`✓ Generated ${path} (${png.length} bytes)`);
}
