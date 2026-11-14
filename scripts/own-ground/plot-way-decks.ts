// Lane F1b (2026-11-14): the PDOK orthophoto beside the road survey (ground polygons filled by class, deck-level ones
// outlined) with the decks' footprints (white), their hole ranges (DeckProfile.under, yellow) and water ranges (cyan).
//
//   node --import tsx scripts/own-ground/plot-way-decks.ts --at=lng,lat [--half=50] --out=file.png [--opts='{...}']
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import sharp from 'sharp';
import { GroundStore, toLocal, fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { decodeRoadLine, type RoadCell } from '../../src/canalRecall/ownGround/roadCells.ts';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
const ROOT = 'public/data/extracts/amsterdam';
const flag = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const st = new GroundStore(async path => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); }, { roads: true, ...JSON.parse(flag('opts') ?? '{}') });
await st.init();
const [lng, lat] = flag('at')!.split(',').map(Number), [cx, cy] = toLocal(lng, lat), key = st.cellAt(cx, cy);
await st.prepareCell(key);
const input = await st.cellInput(key, 0);
const half = Number(flag('half') ?? 50), PX = 6;
const x0 = cx - half, x1 = cx + half, y0 = cy - half, y1 = cy + half, W = Math.round((x1 - x0) * PX), H = Math.round((y1 - y0) * PX);
const X = (x: number) => ((x - x0) * PX).toFixed(1), Y = (y: number) => ((y1 - y) * PX).toFixed(1);
const path = (ring: readonly (readonly number[])[], close = true) => ring.map((p, i) => `${i ? 'L' : 'M'}${X(p[0])},${Y(p[1])}`).join('') + (close ? 'Z' : '');
const FILL: Record<string, string> = { carriage: '#5a5c60', cycle: '#b8473e', foot: '#d8d2c6', pedestrian: '#cfc4b0', parking: '#44464a', driveway: '#77797d' };
const surf = [input.roads ?? null, ...(input.roadsAround ?? [])].filter((r): r is RoadCell => !!r).flatMap(r => r.surfaces);
const ground = surf.filter(s => s.h < 1).map(s => `<path d="${s.r.map(e => path(decodeRoadLine(e))).join('')}" fill="${FILL[s.c] ?? '#999'}" fill-rule="evenodd"/>`).join('');
const decksv = surf.filter(s => s.h >= 1).map(s => `<path d="${s.r.map(e => path(decodeRoadLine(e))).join('')}" fill="${FILL[s.c] ?? '#999'}" fill-opacity="0.35" stroke="#000" stroke-width="2" fill-rule="evenodd"/>`).join('');
const water = [input.water, ...input.waterAround].flatMap(w => w?.polygons ?? []).map(poly => `<path d="${poly.map(r => path(r)).join('')}" fill="#3a6f8a" fill-rule="evenodd"/>`).join('');
let profs = '';
for (const d of st.surface.decks) {
  const p = d.profile, [bx0, by0, bx1, by1] = p.bbox;
  if (bx1 < x0 || bx0 > x1 || by1 < y0 || by0 > y1) continue;
  const strip = (a: number, b: number, col: string) => {
    const L: number[][] = [], R: number[][] = [];
    for (let i = 0; i < p.s.length; i++) {
      if (p.s[i] < a || p.s[i] > b) continue;
      const j0 = Math.max(0, i - 1), j1 = Math.min(p.s.length - 1, i + 1), dx = p.x[j1] - p.x[j0], dy = p.y[j1] - p.y[j0], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      const hl = p.edges ? Math.max(p.halfWidth[i], p.edges.left[i]) : p.halfWidth[i], hr = p.edges ? Math.max(p.halfWidth[i], p.edges.right[i]) : p.halfWidth[i];
      L.push([p.x[i] + nx * hl, p.y[i] + ny * hl]); R.push([p.x[i] - nx * hr, p.y[i] - ny * hr]);
    }
    if (L.length > 1) profs += `<path d="${path([...L, ...R.reverse()])}" fill="${col}" fill-opacity="0.18" stroke="${col}" stroke-width="2"/>`;
  };
  strip(p.deck[0], p.deck[1], '#ffffff');
  for (const [a, b] of p.under ?? []) strip(a, b, '#ffe000');
  if (p.water) strip(p.water[0], p.water[1], '#00e0ff');
  const m = p.x.length >> 1;
  profs += `<text x="${X(p.x[m])}" y="${Y(p.y[m])}" font-family="Helvetica" font-size="14" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${p.id}</text>`;
}
const a = lngLatToRd(fromLocal(x0, y0)), b = lngLatToRd(fromLocal(x1, y1)), WR = Math.round((b.x - a.x) * PX), HR = Math.round((b.y - a.y) * PX);
const url = `https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0?service=WMS&version=1.3.0&request=GetMap&layers=Actueel_orthoHR&styles=&crs=EPSG:28992&bbox=${a.x},${a.y},${a.x + WR / PX},${a.y + HR / PX}&width=${WR}&height=${HR}&format=image/jpeg`;
const res = await fetch(url, { headers: { 'User-Agent': 'map-recall2 (github.com/blackmad/map-recall2)' } });
const ortho = await sharp(Buffer.from(await res.arrayBuffer())).resize(W, H, { fit: 'fill' }).png().toBuffer();
const left = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${profs}</svg>`;
const right = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#9a9184"/>${water}${ground}${decksv}${profs}</svg>`;
await sharp({ create: { width: 2 * W + 10, height: H, channels: 3, background: '#ffffff' } })
  .composite([{ input: ortho, left: 0, top: 0 }, { input: Buffer.from(left), left: 0, top: 0 }, { input: await sharp(Buffer.from(right)).png().toBuffer(), left: W + 10, top: 0 }]).png().toFile(flag('out')!);
console.log('wrote', flag('out'));
