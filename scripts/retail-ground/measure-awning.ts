/**
 * Round 7 (lane retail-look-20261114): the awning colour of a shop, measured where a photo shows one. The reads file
 * (data/retail-ground/awning-reads.json) lists, per pand, a panorama cut and the awning's box in it (fractions of the
 * image, marked by a judge who reads the cut: a fabric or metal canopy over this shop's windows, not a neighbour's);
 * the colour is the per-channel median of the box's pixels, the outer 15 % of the box dropped (edges, sky, frame).
 * Stages data/retail-ground/awnings.json; build-templates.ts folds it into the extract's `awnings`. Never publishes.
 *   node --import tsx scripts/retail-ground/measure-awning.ts
 */
import fs from 'node:fs';
import sharp from 'sharp';

type Read = { pand: string; file: string; box: [number, number, number, number]; note?: string };
const READS = 'data/retail-ground/awning-reads.json', OUT = 'data/retail-ground/awnings.json', INSET = 0.15;
const reads = (JSON.parse(fs.readFileSync(READS, 'utf8')) as { reads: Read[] }).reads;
const buildings: Record<string, { hex: string; receipt: { file: string; box: number[]; px: number; note?: string } }> = {};
const hex = (v: number[]) => '#' + v.map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
for (const r of reads) {
  if (!fs.existsSync(r.file)) { console.log(`${r.pand}: ${r.file} missing`); continue; }
  const { width: W, height: H } = await sharp(r.file).metadata();
  const [x0, y0, x1, y1] = r.box, dx = (x1 - x0) * INSET, dy = (y1 - y0) * INSET;
  const left = Math.round((x0 + dx) * W!), top = Math.round((y0 + dy) * H!), width = Math.max(1, Math.round((x1 - x0 - 2 * dx) * W!)), height = Math.max(1, Math.round((y1 - y0 - 2 * dy) * H!));
  const { data, info } = await sharp(r.file).extract({ left, top, width, height }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch: number[][] = [[], [], []];
  for (let i = 0; i < data.length; i += info.channels) for (let c = 0; c < 3; c++) ch[c].push(data[i + c]);
  const med = ch.map(a => a.sort((p, q) => p - q)[a.length >> 1]);
  buildings[r.pand.replace(/^NL\.IMBAG\.Pand\./, '')] = { hex: hex(med), receipt: { file: r.file, box: r.box, px: width * height, ...(r.note ? { note: r.note } : {}) } };
}
fs.writeFileSync(OUT, JSON.stringify({ rule: 'scripts/retail-ground/measure-awning.ts: median of the judged box, 15 % inset', buildings }, null, 1));
console.log(`${Object.keys(buildings).length} awnings -> ${OUT}: ${Object.entries(buildings).map(([k, v]) => `${k} ${v.hex}`).join(', ')}`);
