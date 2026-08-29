// Genera los iconos PWA (192, 512, apple-touch-icon 180) como PNGs simples,
// sin dependencias externas: un cuadrado con esquinas redondeadas en el color
// de acento y un pin de mapa blanco encima. Ejecutar una vez con:
//   node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const ACCENT = [184, 92, 62]; // #b85c3e

function crc32(buf) {
  let c;
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function roundedSquareAlpha(x, y, size, radius) {
  const cx = x < radius ? radius : x > size - radius ? size - radius : null;
  const cy = y < radius ? radius : y > size - radius ? size - radius : null;
  if (cx !== null && cy !== null) {
    const d = Math.hypot(x - cx + 0.5, y - cy + 0.5);
    return d <= radius ? 1 : 0;
  }
  return 1;
}

// Pin de mapa (gota) en blanco, centrado, ~55% del icono.
function pinAlpha(px, py, size) {
  const w = size * 0.5;
  const h = size * 0.66;
  const x0 = (size - w) / 2;
  const y0 = size * 0.16;
  const x = (px - x0) / w; // 0..1
  const y = (py - y0) / h; // 0..1
  if (x < 0 || x > 1 || y < 0 || y > 1.15) return 0;
  const cx = 0.5;
  const circleR = 0.5;
  const circleCy = 0.4;
  const distCircle = Math.hypot((x - cx) / circleR, (y - circleCy) / circleR);
  if (y <= circleCy + 0.05) return distCircle <= 1 ? 1 : 0;
  const tipY = 1.0;
  const t = (y - circleCy) / (tipY - circleCy);
  const halfWidthAtY = (1 - t) * circleR * Math.sqrt(1 - Math.min(t * t, 1));
  return Math.abs(x - cx) <= halfWidthAtY ? 1 : 0;
}

function holeAlpha(px, py, size) {
  const cx = size * 0.5;
  const cy = size * 0.365;
  const r = size * 0.13;
  return Math.hypot(px - cx, py - cy) <= r ? 1 : 0;
}

function makeIcon(size) {
  const radius = size * 0.22;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      const bgA = roundedSquareAlpha(x, y, size, radius);
      const pin = pinAlpha(x, y, size);
      const hole = holeAlpha(x, y, size);
      let r, g, b, a;
      if (pin && !hole) {
        r = g = b = 255;
        a = 255;
      } else {
        r = ACCENT[0];
        g = ACCENT[1];
        b = ACCENT[2];
        a = bgA ? 255 : 0;
      }
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const idat = deflateSync(raw);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(`public/icons/icon-${size}.png`, makeIcon(size));
  console.log(`public/icons/icon-${size}.png`);
}
writeFileSync("public/icons/apple-touch-icon.png", makeIcon(180));
console.log("public/icons/apple-touch-icon.png");
