// Road look at junctions (issue #52, user 2026-10-24: "why do the roads still look so bad?"): per roadRegressions
// ROAD_SPOTS entry, the PDOK 8 cm orthophoto, the own ground top-down in the game palette, a street-level panorama
// (data.amsterdam.nl, aimed along the spot's bearing from its viewpoint) and the chase frame of
// tests/e2e/own-ground-roads.spec.ts, for a before / after sheet.
//
//   npx tsx scripts/own-ground/road-look-junctions.ts render <label> [--only=id,id]   # top-downs (+ ortho, pano cache)
//   npx tsx scripts/own-ground/road-look-junctions.ts sheet <before> <after> [--only=id,id] [--frames-before=dir] [--frames-after=dir]
//   npx tsx scripts/own-ground/road-look-junctions.ts measure [--only=id,id]   # orthophoto tones: rails vs the road beside, per BGT class/mesh
//
// Writes under artifacts/roads/look-junctions/: top-<label>/<id>.png, ortho/<id>.png, pano/<id>.jpg, sheet.jpg.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import sharp from 'sharp';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { ROAD_SPOTS, spotViewpoint, type RoadSpot } from '../../src/canalRecall/ownGround/roadRegressions.ts';
import type { GroundLayer } from '../../src/canalRecall/ownGround/groundCell.ts';
import { rasterTopDown } from './render-topdown.ts';
import { paletteColours } from './road-look-v2.ts';
import { OrthoTiles, ORTHO_ATTRIBUTION } from './ortho.ts';
import { probeSpot } from './probe-doubled-lanes.ts';
import { RoadIndex } from '../../src/canalRecall/ownGround/roadSurfaces.ts';
import { sourceOfCode } from '../../src/canalRecall/ownGround/sourceTrace.ts';

const OUT = 'artifacts/roads/look-junctions', RES = 0.1, ROOT = 'public/data/extracts/amsterdam';
const bytes = async (path: string) => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
const arg = (k: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const only = arg('only')?.split(',');
const spots = (): RoadSpot[] => ROAD_SPOTS.filter(s => !only || only.includes(s.id));
const box = (s: RoadSpot) => { const [x, y] = toLocal(s.at[0], s.at[1]); return { x0: x - s.halfM, y0: y - s.halfM, w: Math.round(2 * s.halfM / RES) }; };
const png = (b: Uint8Array, w: number) => sharp(Buffer.from(b), { raw: { width: w, height: w, channels: 3 } }).png().toBuffer();

/** The panorama nearest the spot's viewpoint (≤ 25 m), aimed along its bearing: Gemeente Amsterdam, CC BY 4.0. */
async function panorama(s: RoadSpot): Promise<string | null> {
  const file = join(OUT, 'pano', `${s.id}.jpg`);
  if (existsSync(file)) return file;
  const v = spotViewpoint(s);
  const pick = await (await fetch(`https://api.data.amsterdam.nl/panorama/thumbnail/?lat=${v.lat}&lon=${v.lng}&radius=25&width=900&fov=80&aspect=1.6&horizon=0.45`)).json() as { pano_id?: string };
  if (!pick.pano_id) return null;
  const img = await fetch(`https://api.data.amsterdam.nl/panorama/thumbnail/${pick.pano_id}/?width=900&fov=80&aspect=1.6&horizon=0.45&heading=${Math.round(s.bearing)}`);
  if (!img.ok) return null;
  mkdirSync(join(OUT, 'pano'), { recursive: true });
  writeFileSync(file, Buffer.from(await img.arrayBuffer()));
  writeFileSync(file.replace(/\.jpg$/, '.json'), JSON.stringify({ pano: pick.pano_id, heading: s.bearing, source: 'https://api.data.amsterdam.nl/panorama/', licence: 'CC BY 4.0, Gemeente Amsterdam' }));
  return file;
}

async function render(label: string): Promise<void> {
  const store = new GroundStore(bytes, { roads: true });
  await store.init();
  const ortho = new OrthoTiles(), colours = paletteColours() as Partial<Record<GroundLayer, readonly number[]>>;
  for (const s of spots()) {
    const { x0, y0, w } = box(s), r = await probeSpot(store, s);
    const dir = join(OUT, `top-${label}`); mkdirSync(dir, { recursive: true });
    await sharp(await png(rasterTopDown(r.cells, x0, y0, w, w, RES, colours), w)).toFile(join(dir, `${s.id}.png`));
    const of = join(OUT, 'ortho', `${s.id}.png`);
    if (!existsSync(of)) { mkdirSync(join(OUT, 'ortho'), { recursive: true }); await sharp(await png(await ortho.crop(x0, y0, w, w, RES), w)).toFile(of); }
    await panorama(s).catch(e => console.log(`${s.id}: panorama ${(e as Error).message}`));
    const tris = r.cells.reduce((n, c) => n + c.stats.triangles, 0);
    console.log(`${s.id}: ${tris} triangles over ${r.cells.length} cells`);
  }
}

async function sheet(before: string, after: string): Promise<void> {
  const T = 420, F = 672, gap = 4, head = 24, W = 3 * (T + gap) + 3 * (F + gap);
  const fb = arg('frames-before') ?? 'artifacts/own-ground-roads/look-before', fa = arg('frames-after') ?? 'artifacts/own-ground-roads/look-after';
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const text = (t: string, w: number, h = head, size = 14) => Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#1d1d1d"/><text x="6" y="${h - 7}" font-family="Helvetica" font-size="${size}" fill="#eee">${esc(t)}</text></svg>`);
  const blank = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: '#333' } }).png().toBuffer();
  const img = async (f: string, w: number, h: number) => (existsSync(f) ? sharp(f).resize(w, h, { fit: 'cover' }).png().toBuffer() : blank(w, h));
  const parts: sharp.OverlayOptions[] = [];
  let y = 0;
  parts.push({ input: text(`Road look at junctions (#52): orthophoto | top-down before | top-down after | panorama (spot viewpoint, chase bearing) | chase before | chase after.   ${ORTHO_ATTRIBUTION}; panoramas Gemeente Amsterdam, CC BY 4.0`, W, 30, 16), left: 0, top: y }); y += 30;
  for (const s of spots()) {
    parts.push({ input: text(`${s.id}: ${s.label} (${2 * s.halfM} m, north up; chase looking ${s.bearing}°)`, W), left: 0, top: y }); y += head;
    const cells: [string, number][] = [
      [join(OUT, 'ortho', `${s.id}.png`), T], [join(OUT, `top-${before}`, `${s.id}.png`), T], [join(OUT, `top-${after}`, `${s.id}.png`), T],
      [join(OUT, 'pano', `${s.id}.jpg`), F], [join(fb, `desktop-${s.id}.png`), F], [join(fa, `desktop-${s.id}.png`), F],
    ];
    let x = 0;
    for (const [f, w] of cells) { parts.push({ input: await img(f, w, T), left: x, top: y }); x += w + gap; }
    y += T + gap;
  }
  const out = join(OUT, 'sheet.jpg');
  await sharp({ create: { width: W, height: y, channels: 3, background: '#111' } }).composite(parts).jpeg({ quality: 80 }).toFile(out);
  console.log(out);
}

/**
 * Orthophoto tones behind the #52 choices: per spot, the median luma under the drawn tram rails against 0.4 m beside
 * them (groundLook rail), and over the whole set the median colour inside each BGT class/mesh (roadSurfaces
 * surfaceLayer: asphalt islands). Sunlit and shaded texels are mixed; read the ratios, not the absolute tones.
 */
async function measure(): Promise<void> {
  const store = new GroundStore(bytes, { roads: true });
  await store.init();
  const ortho = new OrthoTiles(), luma = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const med = (a: number[][]) => [0, 1, 2].map(c => a.map(v => v[c]).sort((p, q) => p - q)[a.length >> 1]);
  const all: Record<string, number[][]> = {};
  for (const s of spots()) {
    const [x, y] = toLocal(s.at[0], s.at[1]), res = 0.05, w = Math.round(2 * s.halfM / res), x0 = x - s.halfM, y0 = y - s.halfM;
    const img = await ortho.crop(x0, y0, w, w, res);
    const at = (px: number, py: number) => { const i = Math.floor((px - x0) / res), j = w - 1 - Math.floor((py - y0) / res); if (i < 0 || j < 0 || i >= w || j >= w) return null; const k = (j * w + i) * 3; return [img[k], img[k + 1], img[k + 2]]; };
    const r = await probeSpot(store, s), rail: number[][] = [], beside: number[][] = [];
    for (const c of r.cells) {
      const m = c.layers.tram, src = c.sources?.tram;
      if (!m) continue;
      for (let t = 0; t < m.indices.length; t += 3) {
        if (src && sourceOfCode(src[t / 3]) !== 'rails') continue;
        const A = m.indices[t] * 3, B = m.indices[t + 1] * 3, C = m.indices[t + 2] * 3, cx = (m.positions[A] + m.positions[B] + m.positions[C]) / 3, cy = (m.positions[A + 1] + m.positions[B + 1] + m.positions[C + 1]) / 3;
        const v = at(cx, cy), e = at(cx + 0.4, cy + 0.4);
        if (v && e) { rail.push(v); beside.push(e); }
      }
    }
    const keys = new Set<string>(r.cells.map(c => c.key)), idx = new RoadIndex(await Promise.all([...keys].map(k => store.roadCell(k))), [x0, y0, x0 + 2 * s.halfM, y0 + 2 * s.halfM]);
    for (let py = y0; py < y0 + 2 * s.halfM; py += 0.25) for (let px = x0; px < x0 + 2 * s.halfM; px += 0.25) {
      const k = idx.findAtLevel(px, py), v = at(px, py);
      if (k < 0 || idx.records[k].h || !v) continue;
      (all[`${idx.records[k].c}/${idx.records[k].k}`] ??= []).push(v);
    }
    console.log(`${s.id}: rails ${rail.length ? luma(med(rail)).toFixed(0) : '-'} beside ${beside.length ? luma(med(beside)).toFixed(0) : '-'} (n ${rail.length})`);
  }
  for (const [k, a] of Object.entries(all).sort((p, q) => q[1].length - p[1].length)) { const m = med(a); console.log(`${k.padEnd(22)} ${m.join(',')} luma ${luma(m).toFixed(0)} n ${a.length}`); }
}

const [mode, a, b] = process.argv.slice(2);
if (mode === 'render') await render(a ?? 'now');
else if (mode === 'sheet') await sheet(a ?? 'before', b ?? 'after');
else if (mode === 'measure') await measure();
else console.log('render <label> | sheet <before> <after> | measure');
