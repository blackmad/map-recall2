// Zebras the ground renderer draws, over the PDOK 8 cm orthophoto (ortho.ts, Beeldmateriaal Nederland, CC BY 4.0),
// for judging crossings against the photo. One PNG per spot: the photo | the photo with the drawn stripes (magenta,
// outlined) and the ground carriageway polygons' edges (cyan asphalt, orange klinker).
//
//   npx tsx scripts/own-ground/render-crossings.ts <label> [--out=artifacts/zebra-crossings] [--half=40] [--res=0.1] [--at=lng,lat]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import type { DrawnCrossing } from '../../src/canalRecall/ownGround/surveyMarkings.ts';
import { ZEBRA } from '../../src/canalRecall/ownGround/surveyMarkings.ts';
import type { Vec2 } from '../../src/canalRecall/ownGround/surface.ts';
import { OrthoTiles, ORTHO_ATTRIBUTION } from './ortho.ts';
import { cellCrossings, type CellCrossings } from '../../src/canalRecall/ownGround/crossingCells.ts';
import { readExtract } from './audit-crossings.ts';

export const CROSSING_SPOTS: readonly { name: string; lng: number; lat: number }[] = [
  { name: 'magna-plaza', lng: 4.89075, lat: 52.37320 },
  { name: 'dam-south', lng: 4.89067, lat: 52.37251 },
  { name: 'leidseplein', lng: 4.88220, lat: 52.36380 },
  { name: 'westermarkt', lng: 4.88445, lat: 52.37410 },
  { name: 'rembrandtplein', lng: 4.89700, lat: 52.36610 },
  { name: 'frederiksplein', lng: 4.89863, lat: 52.35950 },
  { name: 'mercatorplein', lng: 4.85070, lat: 52.36960 },
  { name: 'weteringcircuit', lng: 4.89076, lat: 52.35968 },
  { name: 'museumplein', lng: 4.87843, lat: 52.35811 },
];

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;

export async function renderSpot(store: GroundStore, ortho: OrthoTiles, cache: Map<string, CellCrossings | null>, spot: { name: string; lng: number; lat: number }, half: number, res: number): Promise<Buffer> {
  const [x, y] = toLocal(spot.lng, spot.lat), w = Math.round((2 * half) / res);
  const x0 = x - half, y0 = y - half;
  const keys = new Set<string>();
  for (const dx of [-half, 0, half]) for (const dy of [-half, 0, half]) keys.add(store.cellAt(x + dx, y + dy));
  const cells: CellCrossings[] = [];
  for (const k of keys) {
    if (!store.covers(k) || !store.roadCells.has(k)) continue;
    if (!cache.has(k)) cache.set(k, await cellCrossings(store, k));
    const c = cache.get(k);
    if (c) cells.push(c);
  }
  const px = (p: Vec2) => `${((p[0] - x0) / res).toFixed(1)},${((y0 + 2 * half - p[1]) / res).toFixed(1)}`;
  const inView = (p: Vec2) => p[0] > x0 - 20 && p[0] < x0 + 2 * half + 20 && p[1] > y0 - 20 && p[1] < y0 + 2 * half + 20;
  let svg = '';
  // Carriageway polygon edges.
  const ix = cells[0]?.index;
  if (ix) for (let k = 0; k < ix.records.length; k++) {
    const r = ix.records[k];
    if (r.h !== 0 || ix.drawClass(k) !== 'carriage') continue;
    for (const ring of ix.ringsOf(k)) {
      if (!ring.some(inView)) continue;
      svg += `<polygon points="${ring.map(px).join(' ')}" fill="none" stroke="${ix.mesh(k) === 'klinker' ? '#ff9a2e' : '#38d6ff'}" stroke-width="2" stroke-opacity="0.8"/>`;
    }
  }
  const crossings: DrawnCrossing[] = cells.flatMap(c => c.crossings).filter(c => inView(c.centre));
  for (const c of crossings) for (const s of c.stripes) for (const [p, q] of s.pieces) {
    const d: Vec2 = [q[0] - p[0], q[1] - p[1]], l = Math.hypot(d[0], d[1]) || 1, n: Vec2 = [-d[1] / l * ZEBRA.stripe / 2, d[0] / l * ZEBRA.stripe / 2];
    const quad: Vec2[] = [[p[0] - n[0], p[1] - n[1]], [q[0] - n[0], q[1] - n[1]], [q[0] + n[0], q[1] + n[1]], [p[0] + n[0], p[1] + n[1]]];
    svg += `<polygon points="${quad.map(px).join(' ')}" fill="#ff2bd6" fill-opacity="0.55" stroke="#ffffff" stroke-width="1"/>`;
  }
  const rgb = await ortho.crop(x0, y0, w, w, res);
  const photo = sharp(Buffer.from(rgb), { raw: { width: w, height: w, channels: 3 } });
  const base = await photo.png().toBuffer();
  const label = `<text x="12" y="28" font-family="Helvetica" font-size="22" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${spot.name}  ${crossings.length} drawn crossings</text><text x="12" y="${w - 12}" font-family="Helvetica" font-size="14" fill="#fff" stroke="#000" stroke-width="2" paint-order="stroke">${ORTHO_ATTRIBUTION}</text>`;
  const over = await sharp(base).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w}">${svg}${label}</svg>`) }]).png().toBuffer();
  return sharp({ create: { width: w * 2 + 8, height: w, channels: 3, background: '#222' } }).composite([{ input: base, left: 0, top: 0 }, { input: over, left: w + 8, top: 0 }]).png().toBuffer();
}

if (process.argv[1]?.endsWith('render-crossings.ts')) {
  const label = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'now';
  const out = arg('out', 'artifacts/zebra-crossings'), half = Number(arg('half', '40')), res = Number(arg('res', '0.1'));
  const at = arg('at', '');
  const spots = at ? [{ name: `at-${at}`, lng: Number(at.split(',')[0]), lat: Number(at.split(',')[1]) }] : CROSSING_SPOTS;
  const store = new GroundStore(readExtract, { roads: true });
  await store.init();
  const ortho = new OrthoTiles(), cache = new Map<string, CellCrossings | null>();
  mkdirSync(out, { recursive: true });
  for (const s of spots) {
    const png = await renderSpot(store, ortho, cache, s, half, res);
    const file = join(out, `${s.name}-${label}.png`);
    await sharp(png).toFile(file);
    console.log(file);
  }
}
