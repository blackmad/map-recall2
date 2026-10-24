/**
 * Mean wall luma per street, the game frame against the real street (GitHub #50, measured period walls brightness).
 *
 *   npx tsx scripts/look/period-walls-luma.ts [strip=artifacts/period-walls/strip] [dir...=off on]
 *
 * Frames: the strip's chase (and Nassaukade's row) shots with WALLS_MASK=1 (tests/e2e/period-walls-strip.spec.ts);
 * wall pixels are the region mask's facade walls (look/frameRegions.ts, windows and trim included, as in the photo).
 * Panoramas: hand-placed boxes on the facades in the strip's panorama thumbnails (pano/<place>.jpg), sunlit and
 * shaded fronts both, windows included, no sky, trees, cars or shopfront signs. Luma is Rec. 709 on the sRGB bytes,
 * the same as frameRegions. Prints a table and writes <strip>/luma.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { REGIONS, regionOfMask } from '../../src/canalRecall/look/frameRegions.ts';

type Box = [number, number, number, number];
/** Facade boxes per panorama (1000 x 625 thumbnails from scripts/look/period-walls-panos.ts). */
export const PANO_WALLS: Record<string, Box[]> = {
  nassaukade: [[0, 150, 90, 400], [100, 250, 240, 400]],
  'nassaukade-row': [[100, 0, 380, 330], [600, 100, 1000, 380]],
  bloemgracht: [[0, 0, 240, 340], [930, 260, 1000, 460]],
  'pijp-govert-flinck': [[0, 0, 95, 190], [200, 0, 300, 180], [800, 90, 895, 370], [905, 0, 1000, 300]],
  'zuid-verhulst': [[0, 0, 180, 300], [840, 150, 1000, 420]],
  'nieuwwest-deyssel': [[0, 380, 75, 500], [860, 270, 1000, 440], [660, 390, 860, 470]],
};
const SHOTS: Record<string, string[]> = {
  nassaukade: ['nassaukade-chase', 'nassaukade-row'], bloemgracht: ['bloemgracht-chase'], 'pijp-govert-flinck': ['pijp-govert-flinck-chase'],
  'zuid-verhulst': ['zuid-verhulst-chase'], 'nieuwwest-deyssel': ['nieuwwest-deyssel-chase'],
};
const PANOS: Record<string, string[]> = { nassaukade: ['nassaukade', 'nassaukade-row'] };
const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const chroma = (r: number, g: number, b: number) => Math.max(r, g, b) - Math.min(r, g, b);
type Acc = { n: number; l: number; c: number };
const add = (a: Acc, r: number, g: number, b: number) => { a.n++; a.l += luma(r, g, b); a.c += chroma(r, g, b); };
const done = (a: Acc) => (a.n ? { luma: +(a.l / a.n).toFixed(1), chroma: +(a.c / a.n).toFixed(1), n: a.n } : null);

async function rgb(file: string) { const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height }; }

async function panoWalls(strip: string, place: string) {
  const acc: Acc = { n: 0, l: 0, c: 0 };
  for (const name of PANOS[place] ?? [place]) {
    const f = path.join(strip, 'pano', `${name}.jpg`);
    if (!fs.existsSync(f)) continue;
    const { data, w } = await rgb(f);
    for (const [x0, y0, x1, y1] of PANO_WALLS[name]) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 3; add(acc, data[i], data[i + 1], data[i + 2]); }
  }
  return done(acc);
}
async function frameWalls(dir: string, place: string) {
  const acc: Acc = { n: 0, l: 0, c: 0 }, wall = REGIONS.indexOf('wall');
  for (const shot of SHOTS[place]) {
    const clean = path.join(dir, `${shot}.png`), mask = path.join(dir, `${shot}.mask.png`);
    if (!fs.existsSync(mask)) continue;
    const c = await rgb(clean), m = await rgb(mask);
    const regions = regionOfMask(m.data, c.data, c.w, c.h);
    for (let i = 0; i < regions.length; i++) if (regions[i] === wall) add(acc, c.data[i * 3], c.data[i * 3 + 1], c.data[i * 3 + 2]);
  }
  return done(acc);
}

const args = process.argv.slice(2), strip = args[0] ?? 'artifacts/period-walls/strip', dirs = args.length > 1 ? args.slice(1) : ['off', 'on'];
const out: Record<string, Record<string, unknown>> = {};
for (const place of Object.keys(SHOTS)) {
  out[place] = { pano: await panoWalls(strip, place) };
  for (const d of dirs) out[place][d] = await frameWalls(path.join(strip, d), place);
}
const fmt = (v: any) => (v ? `${v.luma} (C ${v.chroma})` : '-');
console.table(Object.fromEntries(Object.entries(out).map(([p, r]) => [p, Object.fromEntries(Object.entries(r).map(([k, v]) => [k, fmt(v)]))])));
fs.writeFileSync(path.join(strip, 'luma.json'), JSON.stringify(out, null, 1));
