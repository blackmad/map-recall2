// Real Amsterdam ground tones from open data, for the own-ground palette (docs/ground-tones-20261014.md).
//
//   npx tsx scripts/own-ground/measure-ground-tones.ts [--out=artifacts/ground-look/tones.json] [--cache=artifacts/ground-look/pdok-ortho-8cm]
//
// Orthophoto: PDOK luchtfoto RGB (Actueel_orthoHR, 8 cm, open data) over three places. Pixels are sampled at the
// own-ground OSM cross-section bands (the middle half of each band's width, every metre along the way; bridges and
// tunnels skipped) and inside the canal polygons at least WATER_INSET_M from any shore. Tree crowns (green-dominant
// pixels on land) are dropped. Shade correction: per surface the luma histogram is split by Otsu's threshold and the
// upper (sunlit) class is the flat-sunlight tone; the raw median of all pixels is reported beside it.
//
// Panoramas: the city's panorama views of the archived reference walls (MAP_RECALL_SOURCE_DATA/pand-reference-walls,
// CC BY 4.0) — the bottom fifth of each view is street and pavement in front of the facade. Homogeneous 20 px patches
// (luma s.d. < 10) are classed by hue only (grey, brick-brown, cycle red), so this is a cross-check, not a label.
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import sharp from 'sharp';
import { GroundStore, fromLocal, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { prepareWays, type LocalWay } from '../../src/canalRecall/ownGround/streets.ts';
import type { Vec2 } from '../../src/canalRecall/ownGround/surface.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const OUT = arg('out', 'artifacts/ground-look/tones.json');
const CACHE = arg('cache', 'artifacts/ground-look/pdok-ortho-8cm');
const SOURCE = process.env.MAP_RECALL_SOURCE_DATA || '/Users/blackmad/Code/map-recall2-source-data';
const WATER_INSET_M = 8;

export const PLACES = [
  { name: 'Singelgracht (Nassaukade)', lng: 4.8790, lat: 52.3785, r: 260 },
  { name: 'Houtmankade', lng: 4.8850, lat: 52.3890, r: 220 },
  { name: 'Prinsengracht (Westerkerk)', lng: 4.8840, lat: 52.3740, r: 260 },
] as const;

// ------------------------------------------------------------------ orthophoto tiles (EPSG:3857, ~7.8 cm ground)
const R = 6378137, TILE_M = 128, TILE_PX = 1000;
const merc = (lng: number, lat: number): Vec2 => [(lng * Math.PI / 180) * R, Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2)) * R];
const tiles = new Map<string, Promise<Uint8Array>>();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function tile(tx: number, ty: number): Promise<Uint8Array> {
  const file = join(CACHE, `${tx}_${ty}.jpg`);
  if (!existsSync(file)) {
    const x0 = tx * TILE_M, y0 = ty * TILE_M, url = new URL('https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0');
    url.search = new URLSearchParams({ SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetMap', LAYERS: 'Actueel_orthoHR', STYLES: '', CRS: 'EPSG:3857', BBOX: `${x0},${y0},${x0 + TILE_M},${y0 + TILE_M}`, WIDTH: String(TILE_PX), HEIGHT: String(TILE_PX), FORMAT: 'image/jpeg' }).toString();
    let res: Response | null = null;
    for (let i = 0; i < 4; i++) { res = await fetch(url, { headers: { 'User-Agent': 'MapRecallGroundTones/1.0' } }); if (res.ok) break; await sleep(600 * (i + 1)); }
    if (!res?.ok) throw new Error(`PDOK ${tx},${ty}: ${res?.status}`);
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    await sleep(50);
  }
  const { data } = await sharp(readFileSync(file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return new Uint8Array(data);
}
const DEBUG_TILE = process.env.DEBUG_TILE, debugDots: { x: number; y: number; s: string }[] = [];
async function pixel(lng: number, lat: number, s = ''): Promise<[number, number, number]> {
  const [mx, my] = merc(lng, lat), tx = Math.floor(mx / TILE_M), ty = Math.floor(my / TILE_M);
  const k = `${tx}_${ty}`;
  if (k === DEBUG_TILE) debugDots.push({ x: (mx - tx * TILE_M) / TILE_M * TILE_PX, y: ((ty + 1) * TILE_M - my) / TILE_M * TILE_PX, s });
  if (!tiles.has(k)) tiles.set(k, tile(tx, ty));
  const d = await tiles.get(k)!;
  const px = Math.min(TILE_PX - 1, Math.floor((mx - tx * TILE_M) / TILE_M * TILE_PX)), py = Math.min(TILE_PX - 1, Math.floor(((ty + 1) * TILE_M - my) / TILE_M * TILE_PX));
  const i = (py * TILE_PX + px) * 3;
  return [d[i], d[i + 1], d[i + 2]];
}

// ------------------------------------------------------------------ statistics
type RGB = [number, number, number];
export const luma = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const medianRgb = (px: RGB[]): RGB => [0, 1, 2].map(i => median(px.map(p => p[i]))) as RGB;
/** Otsu threshold on 0–255 luma. */
export function otsu(l: number[]): number {
  const h = new Array(256).fill(0); for (const v of l) h[Math.max(0, Math.min(255, Math.round(v)))]++;
  const n = l.length; let sum = 0; for (let i = 0; i < 256; i++) sum += i * h[i];
  let sB = 0, wB = 0, best = 0, t = 128;
  for (let i = 0; i < 256; i++) { wB += h[i]; if (!wB) continue; const wF = n - wB; if (!wF) break; sB += i * h[i]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; t = i; } }
  return t;
}
const isCanopy = (c: RGB) => c[1] > c[0] + 6 && c[1] > c[2] + 6;
/**
 * The OSM bands are centrelines plus prior offsets, so a band's pixels include its neighbours (a pavement dot on the
 * cycle path, a carriageway dot on a red lane). Each class keeps only pixels whose chroma could be that class: this
 * drops mislabelled neighbours of a different kind; it never decides the luma.
 */
const sat = (c: readonly number[]) => { const mx = Math.max(...c), mn = Math.min(...c); return mx ? (mx - mn) / mx : 0; };
const CHROMA_GATE: Record<string, (c: RGB) => boolean> = {
  asphalt: c => sat(c) < 0.12,
  paving: c => sat(c) < 0.2,
  klinker: c => c[0] >= c[2] + 4 && sat(c) < 0.45,
  cycle: c => c[0] >= c[1] + 14 && c[0] >= c[2] + 14,
};
interface Tone { surface: string; source: string; n: number; raw: RGB; sun: RGB; nSun: number; shade: RGB | null; rawLuma: number; sunLuma: number }
function summarise(surface: string, source: string, px: RGB[], land = true, gate?: (c: RGB) => boolean, split = true): Tone {
  const kept = (land ? px.filter(c => !isCanopy(c)) : px).filter(c => !gate || gate(c));
  const l = kept.map(luma), t = otsu(l);
  const sun = kept.filter((_, i) => l[i] > t), shade = kept.filter((_, i) => l[i] <= t);
  // Water has no cast-shadow split (its upper class is boats and glints): its flat tone is the median of all.
  const raw = medianRgb(kept), s = split ? medianRgb(sun.length ? sun : kept) : raw;
  return { surface, source, n: kept.length, raw, sun: s, nSun: sun.length, shade: shade.length ? medianRgb(shade) : null, rawLuma: Math.round(luma(raw)), sunLuma: Math.round(luma(s)) };
}

// ------------------------------------------------------------------ geometry
const ROOT = 'public/data/extracts/amsterdam';
const store = new GroundStore(async p => { const f = join(ROOT, p); if (!existsSync(f)) throw new Error(p); const b = readFileSync(f); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); });
await store.init();

function bandSamples(w: LocalWay, offset: number, half: number, step = 1): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 1; i < w.points.length; i++) {
    const a = w.points[i - 1], b = w.points[i], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    if (L < 0.5) continue;
    const nx = -dy / L, ny = dx / L; // left normal
    for (let s = step / 2; s < L; s += step) for (const f of half > 0.6 ? [-0.5, 0, 0.5] : [0]) {
      const o = offset + f * half;
      out.push([a[0] + dx * s / L + nx * o, a[1] + dy * s / L + ny * o]);
    }
  }
  return out;
}
const inRing = (ring: Vec2[], x: number, y: number) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const segDist = (p: Vec2, a: Vec2, b: Vec2) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy; const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };

const SURF: Record<string, string> = { asphalt: 'asphalt', klinker: 'klinker (brick carriageway)', cycle: 'cycle red asphalt', paving: 'pavement (sidewalk tiles)' };
const ortho: Record<string, RGB[]> = {}, perPlace: Tone[] = [], locals: { place: string; local: Record<string, RGB[]> }[] = [];
for (const place of PLACES) {
  const [cx, cy] = toLocal(place.lng, place.lat), r = place.r;
  const keys = new Set<string>(); for (const dx of [-r, 0, r]) for (const dy of [-r, 0, r]) keys.add(store.cellAt(cx + dx, cy + dy));
  const ways = new Map<number, LocalWay>(); const water: Vec2[][][] = [];
  for (const k of keys) {
    const osm = await store.osmCell(k).catch(() => null);
    for (const w of prepareWays(osm?.ways ?? [], p => toLocal(p[0], p[1]))) ways.set(w.id, w);
    const wg = await store.waterCell(k).catch(() => null); if (wg) water.push(...wg.polygons);
  }
  const local: Record<string, RGB[]> = {};
  const add = (s: string, c: RGB) => { (local[s] ||= []).push(c); (ortho[s] ||= []).push(c); };
  for (const w of ways.values()) {
    if ((w.tags.bridge && w.tags.bridge !== 'no') || w.tags.tunnel || w.tags.covered === 'yes' || w.tags.layer?.startsWith('-')) continue;
    for (const b of w.section.bands) {
      if (!SURF[b.surface]) continue;
      for (const [x, y] of bandSamples(w, b.offset, b.width / 2 * 0.5)) {
        if (Math.hypot(x - cx, y - cy) > r) continue;
        const [lng, lat] = fromLocal(x, y); add(b.surface, await pixel(lng, lat, b.surface));
      }
    }
  }
  // Water: a 3 m grid inside the polygons, WATER_INSET_M from every ring edge.
  for (let x = cx - r; x <= cx + r; x += 3) for (let y = cy - r; y <= cy + r; y += 3) {
    if (Math.hypot(x - cx, y - cy) > r) continue;
    const poly = water.find(p => { let inside = false; for (const ring of p) if (inRing(ring, x, y)) inside = !inside; return inside; });
    if (!poly) continue;
    let near = false; for (const ring of poly) { for (let i = 1; i < ring.length && !near; i++) if (segDist([x, y], ring[i - 1], ring[i]) < WATER_INSET_M) near = true; if (near) break; }
    if (near) continue;
    const [lng, lat] = fromLocal(x, y); add('water', await pixel(lng, lat, 'water'));
  }
  locals.push({ place: place.name, local });
  process.stderr.write(`${place.name}: ${Object.entries(local).map(([s, p]) => `${s} ${p.length}`).join(', ')}; tiles ${tiles.size}\n`);
}
// Haze: the aerial carries an additive blue path radiance (its darkest 0.1 % of pixels sit at ~[33, 48, 65], not
// black). Dark-object subtraction in linear light, rescaled so white stays white, before any statistic.
const toLin = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const toSrgb = (l: number) => Math.round(255 * Math.max(0, Math.min(1, l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055)));
const hist = [0, 1, 2].map(() => new Array(256).fill(0)); let nPx = 0;
for (const p of tiles.values()) { const d = await p; for (let i = 0; i < d.length; i += 3) { hist[0][d[i]]++; hist[1][d[i + 1]]++; hist[2][d[i + 2]]++; nPx++; } }
export const HAZE = hist.map(h => { let s = 0; for (let v = 0; v < 256; v++) { s += h[v]; if (s >= 0.001 * nPx) return v; } return 0; }) as RGB;
const hz = HAZE.map(toLin);
const dehaze = (c: RGB): RGB => [0, 1, 2].map(i => toSrgb((toLin(c[i]) - hz[i]) / (1 - hz[i]))) as RGB;
for (const { place, local } of locals) for (const [s, px] of Object.entries(local)) perPlace.push(summarise(`${SURF[s] ?? 'canal water'} @ ${place}`, 'PDOK ortho 8 cm, dehazed', px.map(dehaze), s !== 'water', CHROMA_GATE[s], s !== 'water'));
const orthoTones = Object.entries(ortho).map(([s, px]) => summarise(SURF[s] ?? 'canal water', 'PDOK ortho 8 cm, dehazed, 3 places', px.map(dehaze), s !== 'water', CHROMA_GATE[s], s !== 'water'));
process.stderr.write(`haze (0.1 % dark object over ${tiles.size} tiles): ${HAZE.join(', ')}\n`);

// ------------------------------------------------------------------ panoramas
const pano: Record<string, RGB[]> = { grey: [], brick: [], red: [] };
const walls = join(SOURCE, 'pand-reference-walls');
let views = 0;
for (const d of existsSync(walls) ? readdirSync(walls) : []) for (const f of readdirSync(join(walls, d))) {
  if (!f.endsWith('.thumb.jpg')) continue;
  views++;
  const { data, info } = await sharp(join(walls, d, f)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, P = 20;
  for (let y0 = Math.round(H * 0.8); y0 + P <= H; y0 += P) for (let x0 = 0; x0 + P <= W; x0 += P) {
    const px: RGB[] = []; for (let y = y0; y < y0 + P; y++) for (let x = x0; x < x0 + P; x++) { const i = (y * W + x) * 3; px.push([data[i], data[i + 1], data[i + 2]]); }
    const l = px.map(luma), m = l.reduce((a, b) => a + b, 0) / l.length, sd = Math.sqrt(l.reduce((a, b) => a + (b - m) ** 2, 0) / l.length);
    if (sd >= 10 || m < 25) continue;
    const c = medianRgb(px), mx = Math.max(...c), mn = Math.min(...c), sat = mx ? (mx - mn) / mx : 0;
    const hue = mx === mn ? 0 : mx === c[0] ? (60 * ((c[1] - c[2]) / (mx - mn)) + 360) % 360 : mx === c[1] ? 60 * ((c[2] - c[0]) / (mx - mn)) + 120 : 60 * ((c[0] - c[1]) / (mx - mn)) + 240;
    if (sat < 0.1) pano.grey.push(c);
    else if ((hue < 18 || hue > 345) && sat >= 0.35) pano.red.push(c);
    else if (hue < 40 && sat >= 0.12 && sat < 0.35) pano.brick.push(c);
  }
}
const panoTones = Object.entries(pano).filter(([, p]) => p.length).map(([k, px]) => summarise({ grey: 'grey ground (asphalt + concrete tiles)', brick: 'brick-brown ground (klinker)', red: 'red ground (cycle asphalt)' }[k]!, `city panoramas, ${views} views, 20 px patches`, px, false));

mkdirSync(join(OUT, '..'), { recursive: true });
if (DEBUG_TILE) {
  const col: Record<string, string> = { asphalt: '#000', klinker: '#a52', cycle: '#f0f', paving: '#ff0', water: '#0ff' };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_PX}" height="${TILE_PX}">${debugDots.map(d => `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="1.6" fill="${col[d.s] ?? '#fff'}"/>`).join('')}</svg>`;
  await sharp(join(CACHE, `${DEBUG_TILE}.jpg`)).composite([{ input: Buffer.from(svg) }]).toFile(join(OUT, '..', `debug-${DEBUG_TILE}.png`));
}
writeFileSync(OUT, JSON.stringify({ measured: new Date().toISOString().slice(0, 10), haze: HAZE, ortho: orthoTones, perPlace, panorama: panoTones }, null, 1));
const row = (t: Tone) => `| ${t.surface} | ${t.source} | ${t.n} | ${t.raw.join(', ')} (${t.rawLuma}) | ${t.sun.join(', ')} (${t.sunLuma}) | ${t.nSun} |`;
console.log('| surface | source | n | median sRGB (luma) | sunlit median sRGB (luma) | n sunlit |\n|---|---|---|---|---|---|');
for (const t of [...orthoTones, ...panoTones, ...perPlace]) console.log(row(t));
