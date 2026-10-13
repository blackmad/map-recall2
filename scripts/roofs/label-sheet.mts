/**
 * The hand-label set: a deterministic sample of pands (half flat, half pitched by 3DBAG roof type,
 * area 30–3000 m²), each drawn as an ortho crop with its outline, numbered, for a person to label
 * blind to the classifier. Writes `<out>/label-set.json` (ids) and `<out>/label-sheet-<k>.png`.
 *
 *   tsx scripts/roofs/label-sheet.mts [--n=100] [--out=artifacts/roofs/labels] [--seed=roof-labels-v1]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { OrthoMosaic } from './orthoTiles.ts';
import { readPands, type Pand } from './roofPixels.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const N = Number(arg('n', '100')), OUT = path.resolve(arg('out', 'artifacts/roofs/labels')), SEED = arg('seed', 'roof-labels-v1');
const TILES = path.resolve(arg('tiles', 'public/data/extracts/amsterdam/bag-tiles/14'));
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

export async function drawCrops(pands: Pand[], file: string, labels?: string[], cols = 10, cell = 200, first = 0, legend = false) {
  const top = legend ? 40 : 0, rows = Math.ceil(pands.length / cols), canvas = createCanvas(cols * cell, rows * cell + top), ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const mosaic = new OrthoMosaic('Actueel_ortho25', 14);
  if (legend) {
    // Neutral greys as this mosaic shows them (cast added back): the D|M|L|W boundaries labels are judged against.
    const { castAt, ORTHO25_CAST } = await import('../../src/canalRecall/roofs/roofSlots.ts');
    for (const [i, [y, name]] of ([[70, 'D'], [100, 'D|M 108'], [125, 'M'], [155, 'M|L 158'], [175, 'L'], [205, 'W']] as const).entries()) {
      const [cr, cg, cb] = castAt(ORTHO25_CAST, y);
      ctx.fillStyle = `rgb(${y + cr},${y + cg},${y + cb})`; ctx.fillRect(4 + i * 120, 4, 112, 32);
      ctx.fillStyle = y > 130 ? '#000' : '#fff'; ctx.font = '13px sans-serif'; ctx.fillText(name, 10 + i * 120, 25);
    }
  }
  for (const [k, p] of pands.entries()) {
    const [minX, minY, maxX, maxY] = p.bbox, cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const half = Math.max(maxX - minX, maxY - minY) / 2 + 3, scale = (cell - 4) / (2 * half);
    await mosaic.load(cx - half, cy - half, cx + half, cy + half);
    const img = ctx.createImageData(cell - 4, cell - 4);
    for (let j = 0; j < cell - 4; j++) for (let i = 0; i < cell - 4; i++) {
      const px = mosaic.pixel(cx - half + (i + .5) / scale, cy + half - (j + .5) / scale), o = (j * (cell - 4) + i) * 4;
      if (px) { img.data[o] = px[0]; img.data[o + 1] = px[1]; img.data[o + 2] = px[2]; } img.data[o + 3] = 255;
    }
    const ox = (k % cols) * cell + 2, oy = top + Math.floor(k / cols) * cell + 2;
    ctx.putImageData(img, ox, oy);
    ctx.strokeStyle = '#ffe600'; ctx.lineWidth = 1.2;
    for (const poly of p.polygons) for (const ring of poly) {
      ctx.beginPath();
      ring.forEach(([x, y], i) => { const sx = ox + (x - cx + half) * scale, sy = oy + (cy + half - y) * scale; if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy); });
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(ox, oy, labels ? cell - 4 : 34, 16);
    ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.fillText(`${first + k}${labels ? ` ${labels[k]}` : ''}`, ox + 3, oy + 12);
    if (mosaic.size > 400) mosaic.clear();
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const flat: Pand[] = [], pitched: Pand[] = [];
  for (const p of readPands(TILES)) {
    if (p.areaM2 < 30 || p.areaM2 > 3000 || p.height < 4) continue;
    const h = hash(`${SEED}:${p.id}`);
    if (h > 0.004) continue; // ~1,300 candidates city-wide
    (p.roof === 3 ? pitched : p.roof === 1 || p.roof === 2 ? flat : []).push(p);
  }
  const by = (a: Pand, b: Pand) => hash(`${SEED}:o:${a.id}`) - hash(`${SEED}:o:${b.id}`);
  const chosen = [...flat.sort(by).slice(0, N / 2), ...pitched.sort(by).slice(0, N / 2)].sort(by);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'label-set.json'), JSON.stringify({ seed: SEED, imagery: 'Actueel_ortho25 L14 0.21 m', ids: chosen.map(p => p.id), roof: chosen.map(p => p.roof) }, null, 1));
  for (let s = 0; s * 20 < chosen.length; s++) await drawCrops(chosen.slice(s * 20, s * 20 + 20), path.join(OUT, `label-sheet-${s}.png`), undefined, 5, 300, s * 20, true);
  console.log(`flat candidates ${flat.length}, pitched ${pitched.length}; wrote ${chosen.length} to ${OUT}`);
}
