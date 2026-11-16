/**
 * Lane shop-interiors: a Node preview of every room as the shader draws it (a CPU port of shopInteriorGlsl's ray cast,
 * nearest-texel, no mips): a 4 m x 1.9 m window seen from 6 m, square on and from 35 degrees either side, by day and
 * at dusk. For tuning the atlas without a browser; the game frames are the acceptance.
 *   node --import tsx scripts/shop-interiors/preview.ts [out.png]
 */
import sharp from 'sharp';
import { ATLAS_W, CEIL_RISE, CEIL_TILE, FACE, FLOOR_DROP, FLOOR_TILE, MID_H, ROOM_W, paintInteriorAtlas, roomCell } from '../../src/canalRecall/shopInteriors/atlas.ts';
import { ROOM_KINDS, decodeVariant, type RoomKind } from '../../src/canalRecall/shopInteriors/rooms.ts';
import { SHOP_LOOK } from '../../src/canalRecall/shopInteriors/shader.ts';

const out = process.argv[2] ?? 'artifacts/shop-interiors/preview.png';
const atlas = paintInteriorAtlas();
const TW = 200, TH = 110, W = 4, H = 1.9;
type V = [number, number, number];
const tex = (room: RoomKind, k: keyof typeof FACE, qx: number, qy: number): [V, number] => {
  const [cx, cy] = roomCell(room), [x, y, w, h] = FACE[k];
  const px = cx + x + Math.min(w - 1, Math.max(0, Math.floor(qx * w))), py = cy + y + Math.min(h - 1, Math.max(0, Math.floor(qy * h)));
  const i = (py * ATLAS_W + px) * 4;
  return [[(atlas[i] / 255) ** 2.2, (atlas[i + 1] / 255) ** 2.2, (atlas[i + 2] / 255) ** 2.2], atlas[i + 3] / 255];
};
const fract = (v: number) => v - Math.floor(v);
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** One pixel: the ray from eye `e` (local metres: x along the glass, y up, z out of the room = negative) through (gx, gy). */
function shade(room: RoomKind, variant: number, dusk: number, e: V, gx: number, gy: number): V {
  const L = SHOP_LOOK, { mirror, depthM: D, offset: off } = decodeVariant(variant);
  const p: V = [gx, gy, 0], dv: V = [p[0] - e[0], p[1] - e[1], p[2] - e[2]], n = Math.hypot(...dv);
  const d: V = [dv[0] / n, dv[1] / n, dv[2] / n];
  const o: V = [mirror ? W - gx : gx, gy, 0], dl: V = [mirror ? -d[0] : d[0], d[1], Math.max(d[2], 1e-3)];
  const yF = -FLOOR_DROP, yC = H + CEIL_RISE, rh = yC - yF, offset = off * ROOM_W;
  const tx = Math.abs(dl[0]) < 1e-4 ? 1e4 : ((dl[0] > 0 ? W : 0) - o[0]) / dl[0], ty = Math.abs(dl[1]) < 1e-4 ? 1e4 : ((dl[1] > 0 ? yC : yF) - o[1]) / dl[1], tz = D / dl[2];
  const t = Math.min(tx, ty, tz), h: V = [o[0] + dl[0] * t, o[1] + dl[1] * t, o[2] + dl[2] * t];
  let c: V, k: number;
  if (t === tz) { [c] = tex(room, 'back', fract((h[0] + offset) / ROOM_W), 1 - (h[1] - yF) / rh); k = 1; }
  else if (t === tx) { [c] = tex(room, 'side', h[2] / D, 1 - (h[1] - yF) / rh); k = 0.8; }
  else if (dl[1] < 0) { [c] = tex(room, 'floor', fract(h[0] / FLOOR_TILE), fract(h[2] / FLOOR_TILE)); k = 0.72; }
  else { [c] = tex(room, 'ceil', fract((h[0] + 0.5) / CEIL_TILE), fract(h[2] / CEIL_TILE)); k = 0.9; }
  k *= 1 - 0.28 * h[2] / D;
  const zm = Math.min(L.midM, L.midShare * D), tm = zm / dl[2];
  if (tm < t) {
    const hm: V = [o[0] + dl[0] * tm, o[1] + dl[1] * tm, zm], my = (hm[1] - yF) / MID_H;
    if (my < 1) { const [mc, ma] = tex(room, 'mid', fract((hm[0] + offset) / ROOM_W), 1 - my); const m = smooth(0.35, 0.65, ma); c = c.map((v, i) => v + (mc[i] - v) * m) as V; k += ((1 - 0.28 * zm / D) - k) * m; }
  }
  const level = (L.dayLevel + (L.duskLevel - L.dayLevel) * dusk);
  const rc = c.map(v => v * k * level) as V;
  // Reflection: the glass normal is -z (toward the viewer); the reflected ray's y decides street or sky.
  const r: V = [d[0], d[1], -d[2]], cosv = Math.max(0, d[2]);
  const refl = L.street.map((s, i) => s + (L.sky[i] - s) * smooth(-0.15, 0.35, r[1])), fres = 0.04 + 0.96 * (1 - cosv) ** 5;
  const amount = Math.min(0.9, L.reflectDay + (L.reflectDusk - L.reflectDay) * dusk + L.fresnelGain * fres);
  return rc.map((v, i) => v + (refl[i] * (1 - 0.65 * dusk) - v) * amount) as V;
}

const views: Array<[string, V]> = [['left 35', [W / 2 - 6 * Math.sin(0.61), 1.1, -6 * Math.cos(0.61)]], ['square', [W / 2, 1.1, -6]], ['right 35', [W / 2 + 6 * Math.sin(0.61), 1.1, -6 * Math.cos(0.61)]]];
const cols = views.length * 2, rows = ROOM_KINDS.length, img = Buffer.alloc(cols * TW * rows * TH * 3);
ROOM_KINDS.forEach((room, ri) => {
  [0, 1].forEach(dusk => views.forEach(([, e], vi) => {
    const col = dusk * views.length + vi;
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
      const c = shade(room, 0b00001010, dusk, e, (x + 0.5) / TW * W, (1 - (y + 0.5) / TH) * H);
      const i = (((ri * TH + y) * cols * TW) + col * TW + x) * 3;
      for (let k = 0; k < 3; k++) img[i + k] = Math.round(255 * Math.min(1, Math.max(0, c[k])) ** (1 / 2.2));
    }
  }));
});
await import('node:fs').then(fs => fs.mkdirSync(out.replace(/[^/]+$/, '') || '.', { recursive: true }));
await sharp(img, { raw: { width: cols * TW, height: rows * TH, channels: 3 } }).png().toFile(out);
console.log(`${out}: rows ${ROOM_KINDS.join(', ')}; columns day (left 35, square, right 35), dusk (same)`);
