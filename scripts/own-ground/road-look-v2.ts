// Road look v2 (lane road-look-v2, 2026-10-16; user: "not gonna lie, our roads still don't look great").
//
//   npx tsx scripts/own-ground/road-look-v2.ts measure [--out=artifacts/road-look-v2/tones.json]
//   npx tsx scripts/own-ground/road-look-v2.ts render <label> [--out=artifacts/road-look-v2]
//   npx tsx scripts/own-ground/road-look-v2.ts sheet <after-label> <before-label> [--out=artifacts/road-look-v2]
//
// measure: the PDOK 8 cm orthophoto (Actueel_orthoHR, CC BY 4.0; ortho.ts, tiles cached under .cache/pdok-ortho-8cm)
//   sampled inside the roads-v1 BGT polygons at the review spots, per (class, mesh): asphalt rijbaan, klinker rijbaan,
//   klinker inrit, klinker parking, pavement tiles, cycle red. A texel counts only when the polygon also lies under
//   four points 0.6 m around it (no edge pixels), it is not green (tree crowns) and not near-white (paint, cars).
//   Dehazed as docs/ground-tones-20261014.md (path radiance [33, 48, 65] subtracted in linear light, white kept);
//   shade split by Otsu per bucket, the sunlit class's median reported with the all-texel median.
// render: the own ground top-down at each spot in the game's ground palette (groundLook GROUND_LOOK_DEFAULT), roads on.
// sheet: orthophoto | after | before per spot, one JPEG.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import sharp from 'sharp';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, type BuiltCell, type GroundLayer } from '../../src/canalRecall/ownGround/groundCell.ts';
import { groundPalette, GROUND_LOOK_DEFAULT } from '../../src/canalRecall/ownGround/groundLook.ts';
import { RoadIndex } from '../../src/canalRecall/ownGround/roadSurfaces.ts';
import type { RoadCell } from '../../src/canalRecall/ownGround/roadCells.ts';
import { rasterTopDown } from './render-topdown.ts';
import { OrthoTiles, ORTHO_ATTRIBUTION } from './ortho.ts';

export interface Spot { name: string; lng: number; lat: number }
/** Junction centres: the six roads-v1 ride spots (three places, both bearings) and the city-wide sheet's Oost / Zuid / Noord, plus the paint spec's junction. */
const AT = process.argv.find(a => a.startsWith('--at='))?.slice(5).split(',').map(Number);
export const SPOTS: readonly Spot[] = AT ? [{ name: `at-${AT[0]}-${AT[1]}`, lng: AT[0], lat: AT[1] }] : [
  { name: 'kinker-dacosta', lng: 4.87353, lat: 52.36763 },
  { name: 'marnix-plantsoen', lng: 4.87674, lat: 52.37475 },
  { name: 'kinker-bilderdijkgracht', lng: 4.87081, lat: 52.36684 },
  { name: 'oost-linnaeus', lng: 4.92532, lat: 52.3601 },
  { name: 'zuid-ferdinandbol', lng: 4.8911, lat: 52.35288 },
  { name: 'noord-mosplein', lng: 4.9111, lat: 52.39115 },
  { name: 'nassaukade-fhplantsoen', lng: 4.8776303, lat: 52.3785795 },
];

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = arg('out', 'artifacts/road-look-v2');
const HALF = Number(arg('half', '40')), RES = Number(arg('res', '0.1'));
const ROOT = 'public/data/extracts/amsterdam';
const bytes = async (path: string) => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };

// ------------------------------------------------------------------ colour helpers
const lin = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const srgb = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const HAZE = [33, 48, 65].map(lin);
export const dehaze = (rgb: readonly number[]): [number, number, number] => rgb.map((v, i) => srgb(Math.max(0, (lin(v) - HAZE[i]) / (1 - HAZE[i])))) as [number, number, number];
export const luma = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
function otsu(values: number[]): number {
  const hist = new Array(256).fill(0);
  for (const v of values) hist[Math.max(0, Math.min(255, Math.round(v)))]++;
  const total = values.length; let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, th = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue; const wF = total - wB; if (!wF) break;
    sumB += t * hist[t]; const mB = sumB / wB, mF = (sum - sumB) / wF, between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; th = t; }
  }
  return th;
}
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : NaN; };
const medianRgb = (px: number[][]) => [0, 1, 2].map(c => Math.round(median(px.map(p => p[c]))));

// ------------------------------------------------------------------ measure
async function roadCells(keys: Iterable<string>): Promise<RoadCell[]> {
  const out: RoadCell[] = [];
  for (const k of keys) { const f = join(ROOT, 'roads-v1/cells', `${k}.json.gz`); if (existsSync(f)) out.push(JSON.parse(gunzipSync(readFileSync(f)).toString())); }
  return out;
}

async function measure(): Promise<void> {
  const store = new GroundStore(bytes, { roads: true });
  await store.init();
  const ortho = new OrthoTiles();
  const buckets = new Map<string, number[][]>();
  const perSpot: Record<string, Record<string, number>> = {};
  for (const s of SPOTS) {
    const [x, y] = toLocal(s.lng, s.lat), half = 60, res = 0.2, w = Math.round(2 * half / res);
    const keys = new Set<string>(); for (const dx of [-half, 0, half]) for (const dy of [-half, 0, half]) keys.add(store.cellAt(x + dx, y + dy));
    const index = new RoadIndex(await roadCells(keys));
    const rgb = await ortho.crop(x - half, y - half, w, w, res);
    perSpot[s.name] = {};
    for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
      const px = x - half + (i + 0.5) * res, py = y + half - (j + 0.5) * res;
      const k = index.findAtLevel(px, py, false);
      if (k < 0 || index.records[k].h !== 0) continue;
      if ([[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]].some(([dx, dy]) => index.findAtLevel(px + dx, py + dy, false) !== k)) continue;
      const t = (j * w + i) * 3, raw = [rgb[t], rgb[t + 1], rgb[t + 2]];
      if (raw[1] > raw[0] + 4 && raw[1] > raw[2] + 4) continue; // tree crowns, verges
      if (Math.min(...raw) > 215) continue; // paint, white cars
      const b = `${index.records[k].c}/${index.mesh(k)}`;
      (buckets.get(b) ?? buckets.set(b, []).get(b)!).push(dehaze(raw));
      perSpot[s.name][b] = (perSpot[s.name][b] ?? 0) + 1;
    }
  }
  const rows: Record<string, unknown>[] = [];
  for (const [b, px] of [...buckets.entries()].sort()) {
    if (px.length < 200) continue;
    const l = px.map(luma), th = otsu(l), sun = px.filter((_, i) => l[i] > th);
    const m = medianRgb(px), ms = medianRgb(sun);
    rows.push({ bucket: b, n: px.length, median: m, medianLuma: Math.round(luma(m)), sunlit: ms, sunlitLuma: Math.round(luma(ms)), otsu: th, chroma: Math.max(...ms) - Math.min(...ms) });
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'tones.json'), JSON.stringify({ source: ORTHO_ATTRIBUTION, spots: SPOTS, rows, perSpot }, null, 1));
  console.table(rows.map(r => ({ ...r, median: String(r.median), sunlit: String(r.sunlit) })));
}

// ------------------------------------------------------------------ render
type RGB3 = readonly [number, number, number];
const hexRgb = (h: string): RGB3 => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/** The game's ground palette per layer (flat, unlit). */
export function paletteColours(): Partial<Record<GroundLayer, RGB3>> {
  const { street: S, tones: T } = groundPalette(GROUND_LOOK_DEFAULT);
  const c = (v: unknown): RGB3 => (typeof v === 'string' ? hexRgb(v) : (v as RGB3));
  const out: Partial<Record<string, RGB3>> = {
    land: c(T.land.base), square: c(T.square.base), paving: c(S.pavement.base), asphalt: c(S.asphalt.base), klinker: c(S.klinker.base),
    cycle: c(S.cycle.base), kerb: c(S.kerb), paint: c(S.paint), tram: c(S.rail), water: c(T.water), parking: c(T.parking),
    park: c(T.park), wood: c(T.wood), gravel: c(T.gravel), lawn: c(T.lawn), parkPath: c(T.parkPath), pond: c(T.pond),
  };
  const brick = (S as unknown as Record<string, { base: RGB3 } | undefined>).brick;
  if (brick) out.brick = c(brick.base);
  return out as Partial<Record<GroundLayer, RGB3>>;
}

async function render(label: string): Promise<void> {
  const store = new GroundStore(bytes, { roads: true });
  await store.init();
  const dir = join(OUT, `top-${label}`); mkdirSync(dir, { recursive: true });
  const colours = paletteColours(), stats: Record<string, unknown> = {};
  for (const s of SPOTS) {
    const [x, y] = toLocal(s.lng, s.lat), w = Math.round(2 * HALF / RES);
    const keys = new Set<string>([store.cellAt(x, y)]);
    for (const dx of [-HALF, HALF]) for (const dy of [-HALF, HALF]) keys.add(store.cellAt(x + dx, y + dy));
    for (const k of [...keys]) for (const n of GroundStore.neighbours(k)) keys.add(n);
    const cells: BuiltCell[] = [];
    for (const k of keys) if (store.covers(k)) cells.push(buildCell(await store.cellInput(k, 0)));
    const rgb = rasterTopDown(cells, x - HALF, y - HALF, w, w, RES, colours as Partial<Record<GroundLayer, number[]>>);
    await sharp(Buffer.from(rgb), { raw: { width: w, height: w, channels: 3 } }).png().toFile(join(dir, `${s.name}.png`));
    stats[s.name] = { cells: cells.length };
    process.stdout.write(`${s.name} `);
  }
  console.log('\n', dir);
}

async function sheet(after: string, before: string): Promise<void> {
  const ortho = new OrthoTiles(), tile = 560, gap = 4, head = 26;
  const rows: Buffer[] = [];
  for (const s of SPOTS) {
    const [x, y] = toLocal(s.lng, s.lat), w = Math.round(2 * HALF / RES);
    const o = await ortho.crop(x - HALF, y - HALF, w, w, RES);
    const cols = [
      await sharp(Buffer.from(o), { raw: { width: w, height: w, channels: 3 } }).resize(tile, tile).png().toBuffer(),
      await sharp(join(OUT, `top-${after}`, `${s.name}.png`)).resize(tile, tile).png().toBuffer(),
      await sharp(join(OUT, `top-${before}`, `${s.name}.png`)).resize(tile, tile).png().toBuffer(),
    ];
    const titles = [`${s.name}: PDOK orthophoto`, `after (${after})`, `before (${before})`];
    const svg = Buffer.from(`<svg width="${3 * tile + 2 * gap}" height="${head}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#222"/>${titles.map((t, i) => `<text x="${i * (tile + gap) + tile / 2}" y="18" font-family="Helvetica" font-size="15" fill="#fff" text-anchor="middle">${t}</text>`).join('')}</svg>`);
    rows.push(await sharp({ create: { width: 3 * tile + 2 * gap, height: tile + head, channels: 3, background: '#222' } })
      .composite([{ input: svg, left: 0, top: 0 }, ...cols.map((input, i) => ({ input, left: i * (tile + gap), top: head }))]).png().toBuffer());
  }
  const H = rows.length * (tile + head);
  const out = join(OUT, `sheet-${after}-vs-${before}.jpg`);
  await sharp({ create: { width: 3 * tile + 2 * gap, height: H, channels: 3, background: '#222' } }).composite(rows.map((input, i) => ({ input, left: 0, top: i * (tile + head) }))).jpeg({ quality: 85 }).toFile(out);
  console.log(out);
}

const [cmd, a, b] = process.argv.slice(2).filter(x => !x.startsWith('--'));
if (process.argv[1]?.endsWith('road-look-v2.ts')) {
  (cmd === 'measure' ? measure() : cmd === 'render' ? render(a ?? 'now') : cmd === 'sheet' ? sheet(a, b) : Promise.reject(new Error(`unknown command ${cmd}`))).catch(e => { console.error(e); process.exit(1); });
}
