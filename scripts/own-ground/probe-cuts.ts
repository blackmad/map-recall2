// Tunnel cuts (tunnels.ts) planned around a point: per cut its kind, length, walls, depth and portals, and a PNG of
// the 8 cm PDOK orthophoto with the strips (tinted), the walls (red: left, orange: right), the floor's centreline
// (blue) and the portals (magenta) drawn over it.
//
//   npx tsx scripts/own-ground/probe-cuts.ts <lng> <lat> [halfM=150] [mPerPx=0.25] [out.png]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync, deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { GroundStore, toLocal, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { cutRing, type Cut } from '../../src/canalRecall/ownGround/tunnels.ts';
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

export async function probeCuts(lng: number, lat: number, half = 150): Promise<{ store: GroundStore; cuts: Cut[] }> {
  const ROOT = 'public/data/extracts/amsterdam';
  const store = new GroundStore(async p => { const b = readFileSync(join(ROOT, p)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); });
  await store.init();
  const [x, y] = toLocal(lng, lat);
  await store.prepareCell(store.cellAt(x, y));
  return { store, cuts: store.surface.cuts.filter(c => c.bbox[2] >= x - half && c.bbox[0] <= x + half && c.bbox[3] >= y - half && c.bbox[1] <= y + half) };
}

export function describeCut(c: Cut): string {
  const f = (v: number) => v.toFixed(1), n = c.x.length, L = c.s[n - 1];
  const depthL = c.rimL.map((r, i) => (c.wallL[i] ? r - c.floor[i] : 0)), depthR = c.rimR.map((r, i) => (c.wallR[i] ? r - c.floor[i] : 0));
  const [a, b] = [fromLocal(c.x[0], c.y[0]), fromLocal(c.x[n - 1], c.y[n - 1])];
  return `${c.id} ${c.kind}${c.motor ? ' motor' : ''} L=${f(L)} walls L ${c.wallL.filter(Boolean).length}/${n} R ${c.wallR.filter(Boolean).length}/${n} depth max L ${f(Math.max(...depthL))} R ${f(Math.max(...depthR))} floor ${f(c.floor[0])}..${f(c.floor[n - 1])} reach L ${f(Math.min(...c.left))}-${f(Math.max(...c.left))} R ${f(Math.min(...c.right))}-${f(Math.max(...c.right))} ${a[1].toFixed(5)},${a[0].toFixed(5)} -> ${b[1].toFixed(5)},${b[0].toFixed(5)} portals ${c.portals.map(p => `${p.at}:top ${f(p.top)}`).join(' ')}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2);
  const [lng, lat] = [Number(a[0]), Number(a[1])], half = Number(a[2] ?? 150), res = Number(a[3] ?? 0.25);
  const out = a[4] ?? `artifacts/tunnel-places/cuts-${lng}-${lat}.png`;
  const { cuts } = await probeCuts(lng, lat, half);
  for (const c of cuts) console.log(describeCut(c));
  const [cx, cy] = toLocal(lng, lat), n = Math.round(2 * half / res);
  const rgb = await new OrthoTiles().crop(cx - half, cy - half, n, n, res);
  const px = (x: number, y: number): [number, number] => [Math.floor((x - (cx - half)) / res), Math.floor((cy + half - y) / res)];
  const put = (x: number, y: number, c: [number, number, number], a = 1) => {
    const [i, j] = px(x, y);
    if (i < 0 || j < 0 || i >= n || j >= n) return;
    const k = (j * n + i) * 3;
    for (let q = 0; q < 3; q++) rgb[k + q] = Math.round(rgb[k + q] * (1 - a) + c[q] * a);
  };
  const line = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number], w = 1) => {
    const L = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(1, Math.ceil(L / (res / 2)));
    for (let s = 0; s <= steps; s++) { const x = x0 + (x1 - x0) * s / steps, y = y0 + (y1 - y0) * s / steps; for (let d = -w; d <= w; d++) for (let e = -w; e <= w; e++) put(x + d * res, y + e * res, c); }
  };
  for (const c of cuts) {
    const ring = cutRing(c);
    // Strip tint: scan the ring's box.
    const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += res) for (let x = Math.min(...xs); x <= Math.max(...xs); x += res) {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; }
      if (inside) put(x, y, c.kind === 'slot' ? [40, 200, 80] : [60, 120, 255], 0.3);
    }
    const m = c.x.length;
    for (let i = 0; i + 1 < m; i++) {
      line(c.x[i], c.y[i], c.x[i + 1], c.y[i + 1], [40, 40, 255], 0);
      for (const sg of [1, -1]) {
        const w = sg > 0 ? c.wallL : c.wallR, r = sg > 0 ? c.left : c.right;
        if (!w[i] || !w[i + 1]) continue;
        const nrm = (k: number) => { const a2 = Math.max(0, k - 1), b2 = Math.min(m - 1, k + 1), dx = c.x[b2] - c.x[a2], dy = c.y[b2] - c.y[a2], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; };
        const [ax, ay] = nrm(i), [bx, by] = nrm(i + 1);
        line(c.x[i] + ax * sg * r[i], c.y[i] + ay * sg * r[i], c.x[i + 1] + bx * sg * r[i + 1], c.y[i + 1] + by * sg * r[i + 1], sg > 0 ? [255, 30, 30] : [255, 150, 0], 1);
      }
    }
    for (const p of c.portals) for (let d = -2; d <= 2; d += 0.1) put(c.x[p.at] + d * -p.dir[1], c.y[p.at] + d * p.dir[0], [255, 0, 255]);
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, png(n, n, rgb));
  console.log(out);
}
