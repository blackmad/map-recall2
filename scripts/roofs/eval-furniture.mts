/**
 * Roof furniture detections drawn on the flat roofs of the labelled 100, for a precision count by eye.
 * Boxes: solar blue, hvac orange, overrun red, skylight cyan, chimney magenta, vent yellow.
 *
 *   tsx scripts/roofs/eval-furniture.mts [--out=artifacts/roofs/labels]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { OrthoMosaic } from './orthoTiles.ts';
import { readPands, type Pand } from './roofPixels.ts';
import { detectFurniture, roofRaster } from './detectFurniture.ts';
import { lngLatToRd } from '../../src/canalRecall/rdCoordinates.ts';
import type { FurnitureItem } from '../../src/canalRecall/roofs/roofSlots.ts';

const OUT = path.resolve(process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'artifacts/roofs/labels');
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/roof-labels-100.json', import.meta.url), 'utf8')) as { roof: Record<string, number> };
const ids = Object.keys(fixture.roof).filter(id => fixture.roof[id] !== 3);
const want = new Set(ids), pands = new Map<string, Pand>();
for (const p of readPands(path.resolve('public/data/extracts/amsterdam/bag-tiles/14'))) if (want.has(p.id)) pands.set(p.id, p);
const COLOURS: Record<string, string> = { solar: '#3b6cff', hvac: '#ff8c00', overrun: '#ff2020', skylight: '#00e5ff', chimney: '#ff00d4', vent: '#ffe600' };
const toRd = (p: Pand, it: FurnitureItem): [number, number] => {
  const [lng0, lat0] = p.anchor;
  return lngLatToRd(lng0 + it.e / (111_320 * Math.cos(lat0 * Math.PI / 180)), lat0 + it.n / 110_540);
};
const mosaic = new OrthoMosaic('Actueel_ortho25', 14);
const cols = 5, cell = 300, list = ids.map(id => pands.get(id)!);
const counts: Record<string, number> = {};
for (let s = 0; s * 25 < list.length; s++) {
  const page = list.slice(s * 25, s * 25 + 25), canvas = createCanvas(cols * cell, Math.ceil(page.length / cols) * cell), ctx = canvas.getContext('2d');
  for (const [k, p] of page.entries()) {
    const [minX, minY, maxX, maxY] = p.bbox, cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, half = Math.max(maxX - minX, maxY - minY) / 2 + 2, scale = (cell - 4) / (2 * half);
    await mosaic.load(cx - half, cy - half, cx + half, cy + half);
    const img = ctx.createImageData(cell - 4, cell - 4);
    for (let j = 0; j < cell - 4; j++) for (let i = 0; i < cell - 4; i++) {
      const px = mosaic.pixel(cx - half + (i + .5) / scale, cy + half - (j + .5) / scale), o = (j * (cell - 4) + i) * 4;
      if (px) { img.data[o] = px[0]; img.data[o + 1] = px[1]; img.data[o + 2] = px[2]; } img.data[o + 3] = 255;
    }
    const ox = (k % cols) * cell + 2, oy = Math.floor(k / cols) * cell + 2;
    ctx.putImageData(img, ox, oy);
    const r = roofRaster(p, mosaic), items = r ? detectFurniture(p, r) : [];
    for (const it of items) {
      counts[it.kind] = (counts[it.kind] ?? 0) + 1;
      const [x, y] = toRd(p, it), sx = ox + (x - cx + half) * scale, sy = oy + (cy + half - y) * scale;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(-it.yawDeg * Math.PI / 180);
      ctx.strokeStyle = COLOURS[it.kind]; ctx.lineWidth = 1.5; ctx.strokeRect(-it.l / 2 * scale, -it.w / 2 * scale, it.l * scale, it.w * scale);
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1;
    for (const poly of p.polygons) for (const ring of poly) { ctx.beginPath(); ring.forEach(([x, y], i) => { const sx = ox + (x - cx + half) * scale, sy = oy + (cy + half - y) * scale; if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); }); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(ox, oy, 60, 16); ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.fillText(`${s * 25 + k} (${items.length})`, ox + 3, oy + 12);
  }
  fs.writeFileSync(path.join(OUT, `furniture-sheet-${s}.png`), canvas.toBuffer('image/png'));
}
console.log(`${list.length} flat roofs; detections`, counts, '->', OUT);
