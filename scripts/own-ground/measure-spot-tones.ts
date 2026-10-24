// Road tones at the roadRegressions ROAD_SPOTS, sun and shade apart (lane roads-lanes 2026-10-23; user on the
// Spiegelgracht: "one brown klinker mass").
//
//   npx tsx scripts/own-ground/measure-spot-tones.ts [--out=artifacts/roads/tones.json]
//
// Inside the roads-v1 BGT polygons (ground level) of each spot's 80 m crop, per (class / mesh) bucket, the PDOK 8 cm
// orthophoto texels (raw sRGB; the polygon also under four points 0.6 m around, not green, not paint-white, as
// road-look-v2 measure). Each bucket's texels are split into shade and sun by Otsu on luma over all spots together;
// reported: the median per spot and light, and the pooled sun / shade medians, raw and dehazed (road-look-v2 dehaze,
// the path radiance the bright look's tones were set against).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { RoadIndex } from '../../src/canalRecall/ownGround/roadSurfaces.ts';
import type { RoadCell } from '../../src/canalRecall/ownGround/roadCells.ts';
import { ROAD_SPOTS } from '../../src/canalRecall/ownGround/roadRegressions.ts';
import { dehaze, luma } from './road-look-v2.ts';
import { OrthoTiles, ORTHO_ATTRIBUTION } from './ortho.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = arg('out', 'artifacts/roads/tones.json');
const ROOT = 'public/data/extracts/amsterdam';
const bytes = async (path: string) => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : NaN; };
const medianRgb = (px: number[][]) => [0, 1, 2].map(c => Math.round(median(px.map(p => p[c]))));
export function otsu(values: number[]): number {
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

async function main(): Promise<void> {
  const store = new GroundStore(bytes, { roads: true });
  await store.init();
  const ortho = new OrthoTiles();
  const px = new Map<string, { spot: string; rgb: number[] }[]>();
  for (const s of ROAD_SPOTS) {
    const [x, y] = toLocal(s.at[0], s.at[1]), half = s.halfM, res = 0.2, w = Math.round(2 * half / res);
    const keys = new Set<string>(); for (const dx of [-half, 0, half]) for (const dy of [-half, 0, half]) keys.add(store.cellAt(x + dx, y + dy));
    const cells: RoadCell[] = [];
    for (const k of keys) { const f = join(ROOT, 'roads-v1/cells', `${k}.json.gz`); if (existsSync(f)) cells.push(JSON.parse(gunzipSync(readFileSync(f)).toString())); }
    const index = new RoadIndex(cells);
    const rgb = await ortho.crop(x - half, y - half, w, w, res);
    for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) {
      const qx = x - half + (i + 0.5) * res, qy = y + half - (j + 0.5) * res;
      const k = index.findAtLevel(qx, qy, false);
      if (k < 0 || index.records[k].h !== 0) continue;
      if ([[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]].some(([dx, dy]) => index.findAtLevel(qx + dx, qy + dy, false) !== k)) continue;
      const t = (j * w + i) * 3, raw = [rgb[t], rgb[t + 1], rgb[t + 2]];
      if (raw[1] > raw[0] + 4 && raw[1] > raw[2] + 4) continue;
      if (Math.min(...raw) > 215) continue;
      const b = `${index.records[k].c}/${index.mesh(k)}`;
      (px.get(b) ?? px.set(b, []).get(b)!).push({ spot: s.id, rgb: raw });
    }
    process.stdout.write(`${s.id} `);
  }
  const rows: Record<string, unknown>[] = [];
  for (const [b, list] of [...px.entries()].sort()) {
    if (list.length < 400) continue;
    const l = list.map(p => luma(p.rgb)), th = otsu(l);
    const sun = list.filter((_, i) => l[i] > th), shade = list.filter((_, i) => l[i] <= th);
    const perSpot: Record<string, unknown> = {};
    for (const s of ROAD_SPOTS) {
      const su = sun.filter(p => p.spot === s.id), sh = shade.filter(p => p.spot === s.id);
      if (su.length + sh.length < 200) continue;
      perSpot[s.id] = { n: su.length + sh.length, sunShare: +(su.length / (su.length + sh.length)).toFixed(2), sun: su.length >= 100 ? medianRgb(su.map(p => p.rgb)) : null, shade: sh.length >= 100 ? medianRgb(sh.map(p => p.rgb)) : null };
    }
    const ms = medianRgb(sun.map(p => p.rgb)), mh = medianRgb(shade.map(p => p.rgb));
    rows.push({ bucket: b, n: list.length, otsu: th, sun: ms, sunLuma: Math.round(luma(ms)), sunDehazed: dehaze(ms).map(Math.round), shade: mh, shadeLuma: Math.round(luma(mh)), all: medianRgb(list.map(p => p.rgb)), perSpot });
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ source: ORTHO_ATTRIBUTION, spots: ROAD_SPOTS.map(s => s.id), rows }, null, 1));
  console.log();
  console.table(rows.map(r => ({ bucket: r.bucket, n: r.n, sun: String(r.sun), sunLuma: r.sunLuma, sunDehazed: String(r.sunDehazed), shade: String(r.shade), shadeLuma: r.shadeLuma })));
}

if (process.argv[1]?.endsWith('measure-spot-tones.ts')) main().catch(e => { console.error(e); process.exit(1); });
