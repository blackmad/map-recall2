// Relief (ground-height field, scene z) around a point as a PNG heat map plus a text summary.
//
//   npx tsx scripts/own-ground/probe-relief.ts <lng> <lat> [halfM=150] [mPerPx=1] [out.png] [lo] [hi]
//   GROUND_HEIGHT_DIR=<dir> reads the relief tiles from another copy of ground-height-v1 (a before frame).
// Writes the 8 cm PDOK orthophoto (left) beside the relief (right, blue lo → red hi, scene metres).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync, deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { OrthoTiles } from './ortho.ts';

function png(width: number, height: number, rgb: Uint8Array): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (width * 3 + 1)] = 0; Buffer.from(rgb.buffer, rgb.byteOffset + y * width * 3, width * 3).copy(raw, y * (width * 3 + 1) + 1); }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const a = process.argv.slice(2);
const [lng, lat] = [Number(a[0]), Number(a[1])], half = Number(a[2] ?? 150), res = Number(a[3] ?? 1);
const out = a[4] ?? `artifacts/own-ground/relief-${lng}-${lat}.png`;
const ROOT = 'public/data/extracts/amsterdam';
const HEIGHT_DIR = process.env.GROUND_HEIGHT_DIR;
const store = new GroundStore(async p => { const b = readFileSync(HEIGHT_DIR && p.startsWith('ground-height-v1/') ? join(HEIGHT_DIR, p.slice('ground-height-v1/'.length)) : join(ROOT, p)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); });
await store.init();
const [cx, cy] = toLocal(lng, lat);
await store.ensureRelief([cx - half, cy - half, cx + half, cy + half]);
const n = Math.round(2 * half / res), z = new Float32Array(n * n);
for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) z[j * n + i] = store.surface.ground(cx - half + (i + 0.5) * res, cy + half - (j + 0.5) * res);
const sorted = [...z].sort((p, q) => p - q), q = (f: number) => sorted[Math.floor(f * (n * n - 1))];
const lo = Number(a[5] ?? q(0.01)), hi = Number(a[6] ?? q(0.99));
const rgb = new Uint8Array(n * n * 3);
for (let k = 0; k < n * n; k++) { const t = Math.max(0, Math.min(1, (z[k] - lo) / (hi - lo || 1))); rgb[k * 3] = 255 * t; rgb[k * 3 + 1] = 255 * (1 - Math.abs(2 * t - 1)); rgb[k * 3 + 2] = 255 * (1 - t); }
// Beside the 8 cm PDOK orthophoto (same grid, north up).
const photo = await new OrthoTiles().crop(cx - half, cy - half, n, n, res);
const both = new Uint8Array(n * 2 * n * 3);
for (let j = 0; j < n; j++) { both.set(photo.subarray(j * n * 3, (j + 1) * n * 3), j * 2 * n * 3); both.set(rgb.subarray(j * n * 3, (j + 1) * n * 3), (j * 2 + 1) * n * 3); }
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, png(2 * n, n, both));
console.log(JSON.stringify({ out, lo, hi, min: sorted[0], p01: q(0.01), p50: q(0.5), p99: q(0.99), max: sorted[n * n - 1] }));
