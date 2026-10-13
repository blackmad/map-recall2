/**
 * Contact sheet for review: 40 roofs, each as the ortho crop (with the BAG outline) beside the top-down
 * render the generic tier paints from its roof facts (the slot's display colour via `roofSlotHex`,
 * measured furniture as unit boxes in their colours). Picks pands from the staged roof-facts in a box.
 *
 *   tsx scripts/roofs/contact-sheet.mts [--facts=artifacts/roofs/roof-facts] [--bbox=4.862,52.362,4.877,52.370] [--n=40] [--out=artifacts/roofs/contact-kinkerbuurt.png]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createCanvas } from '@napi-rs/canvas';
import { OrthoMosaic } from './orthoTiles.ts';
import { readPands, type Pand } from './roofPixels.ts';
import { decodeRoofFactTile, roofSlotHex, type RoofFact, type RoofFactTile } from '../../src/canalRecall/roofs/roofSlots.ts';
import { FURNITURE_UNITS } from '../../src/canalRecall/roofs/roofFurniture.ts';
import { lngLatToRd } from '../../src/canalRecall/rdCoordinates.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const FACTS = path.resolve(arg('facts', 'artifacts/roofs/roof-facts')), OUT = path.resolve(arg('out', 'artifacts/roofs/contact-kinkerbuurt.png'));
const [w0, s0, e0, n0] = arg('bbox', '4.862,52.362,4.877,52.370').split(',').map(Number), N = Number(arg('n', '40'));
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

const facts = new Map<string, RoofFact>();
for (const x of fs.readdirSync(path.join(FACTS, '14')).filter(n => /^\d+$/.test(n))) for (const f of fs.readdirSync(path.join(FACTS, '14', x)).filter(n => n.endsWith('.json.gz')))
  for (const [id, fact] of decodeRoofFactTile(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(FACTS, '14', x, f))).toString('utf8')) as RoofFactTile)) facts.set(id, fact);
const [minX, minY] = lngLatToRd(w0, s0), [maxX, maxY] = lngLatToRd(e0, n0);
const candidates: Pand[] = [];
for (const p of readPands(path.resolve('public/data/extracts/amsterdam/bag-tiles/14'))) {
  const cx = (p.bbox[0] + p.bbox[2]) / 2, cy = (p.bbox[1] + p.bbox[3]) / 2;
  if (cx < minX || cx > maxX || cy < minY || cy > maxY || p.areaM2 < 40 || !facts.has(p.id)) continue;
  candidates.push(p);
}
// Spread over slots: round-robin by slot so rare slots show up.
const bySlot = new Map<string, Pand[]>();
for (const p of candidates.sort((a, b) => hash(a.id) - hash(b.id))) { const s = facts.get(p.id)!.slot; (bySlot.get(s) ?? bySlot.set(s, []).get(s)!).push(p); }
const chosen: Pand[] = [];
while (chosen.length < N && [...bySlot.values()].some(l => l.length)) for (const l of bySlot.values()) if (l.length && chosen.length < N) chosen.push(l.shift()!);

const cols = 4, cell = 180, pair = cell * 2 + 8, canvas = createCanvas(cols * pair, Math.ceil(chosen.length / cols) * (cell + 18)), ctx = canvas.getContext('2d');
ctx.fillStyle = '#16181a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
const mosaic = new OrthoMosaic('Actueel_ortho25', 14);
for (const [k, p] of chosen.entries()) {
  const fact = facts.get(p.id)!, [a, b, c, d] = p.bbox, cx = (a + c) / 2, cy = (b + d) / 2, half = Math.max(c - a, d - b) / 2 + 2, scale = cell / (2 * half);
  const ox = (k % cols) * pair, oy = Math.floor(k / cols) * (cell + 18);
  await mosaic.load(cx - half, cy - half, cx + half, cy + half);
  const img = ctx.createImageData(cell, cell);
  for (let j = 0; j < cell; j++) for (let i = 0; i < cell; i++) {
    const px = mosaic.pixel(cx - half + (i + .5) / scale, cy + half - (j + .5) / scale), o = (j * cell + i) * 4;
    if (px) { img.data[o] = px[0]; img.data[o + 1] = px[1]; img.data[o + 2] = px[2]; } img.data[o + 3] = 255;
  }
  ctx.putImageData(img, ox, oy);
  const sx = (x: number) => (x - cx + half) * scale, sy = (y: number) => (cy + half - y) * scale;
  const outline = (dx: number) => { for (const poly of p.polygons) { ctx.beginPath(); poly[0].forEach(([x, y], i) => i ? ctx.lineTo(dx + sx(x), oy + sy(y)) : ctx.moveTo(dx + sx(x), oy + sy(y))); ctx.closePath(); } };
  ctx.strokeStyle = '#ffe600'; ctx.lineWidth = 1; outline(ox); ctx.stroke();
  // The render: the lid in the slot colour, furniture boxes on top.
  const rx = ox + cell + 4;
  ctx.fillStyle = '#d9d4c7'; ctx.fillRect(rx, oy, cell, cell);
  ctx.fillStyle = roofSlotHex(fact.slot, fact.rgb); outline(rx); ctx.fill();
  const [lng0, lat0] = p.anchor;
  for (const it of fact.furniture) {
    const [x, y] = lngLatToRd(lng0 + it.e / (111_320 * Math.cos(lat0 * Math.PI / 180)), lat0 + it.n / 110_540);
    ctx.save(); ctx.translate(rx + sx(x), oy + sy(y)); ctx.rotate(-it.yawDeg * Math.PI / 180);
    ctx.fillStyle = FURNITURE_UNITS[it.kind].hex; ctx.strokeStyle = '#222'; ctx.lineWidth = 0.6;
    ctx.fillRect(-it.l / 2 * scale, -it.w / 2 * scale, it.l * scale, it.w * scale); ctx.strokeRect(-it.l / 2 * scale, -it.w / 2 * scale, it.l * scale, it.w * scale);
    ctx.restore();
  }
  ctx.fillStyle = '#eee'; ctx.font = '11px sans-serif';
  ctx.fillText(`${k} ${fact.slot} ${Math.round(fact.confidence * 100)}%${fact.furniture.length ? ` +${fact.furniture.length}` : ''}${fact.dormer ? ' dormer' : ''}${p.roof === 3 ? ' (pitched)' : ''}`, ox + 2, oy + cell + 13);
  if (mosaic.size > 400) mosaic.clear();
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, canvas.toBuffer('image/png'));
console.log(`${candidates.length} candidates, ${chosen.length} drawn -> ${OUT}`);
