// Road diagnosis by source layer (lane roads-diagnose 2026-10-23; user: "our roads still look like shit: too many
// weird gaps and strange paints and multiple lanes where people don't expect").
//
//   npx tsx scripts/own-ground/render-road-sources.ts [--only=id,id] [--out=artifacts/roads/diagnose] [--res=0.1]
//
// For every roadRegressions ROAD_SPOTS entry: the own ground built offline as the game builds it (roads-v1 on, LOD 0)
// with source tracing on (sourceTrace.ts), rasterised top-down, each pixel coloured by the source of the triangle a
// camera straight above sees (BGT polygon class, fietsstraat, OSM band fallback, junction fill, cycle ribbon, paint by
// evidence, rails, pocket, bare land), beside the PDOK 8 cm orthophoto crop (ortho.ts) and the game frame
// (tests/e2e/own-ground-roads.spec.ts shots in <out>/frames/desktop-<id>.png):
//   <out>/<id>.png        sources | orthophoto | frame
//   <out>/table.json      per spot: m² per source, bare land within 6 m of a carriageway (split by what the
//                         orthophoto shows there), cycle-ribbon triangles over a BGT `cycle` polygon, paint triangles
//                         by evidence, and the three complaints in m² (R1 gaps, R2 lanes, R3 paint) with the owner.
// The orthophoto decides what counts: a red source over red in the photo, paint over white in the photo, are not
// complaints; the same over grey asphalt are.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import sharp from 'sharp';
import { GroundStore, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { buildCell, GROUND_LAYERS, type BuiltCell, type GroundLayer } from '../../src/canalRecall/ownGround/groundCell.ts';
import { RoadIndex } from '../../src/canalRecall/ownGround/roadSurfaces.ts';
import type { RoadCell } from '../../src/canalRecall/ownGround/roadCells.ts';
import { ROAD_SPOTS, type RoadSpot } from '../../src/canalRecall/ownGround/roadRegressions.ts';
import { GROUND_SOURCES, setSourceTracing, sourceCode, sourceOfCode, type GroundSource } from '../../src/canalRecall/ownGround/sourceTrace.ts';
import { fillPolygons, layerOfId, rasterLayerIds } from '../../src/canalRecall/overviewTiles/raster.ts';
import { fromLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { OrthoTiles, ORTHO_ATTRIBUTION } from './ortho.ts';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const OUT = arg('out', 'artifacts/roads/diagnose'), RES = Number(arg('res', '0.1'));
const ONLY = process.argv.find(a => a.startsWith('--only='))?.slice(7).split(',');
const ROOT = 'public/data/extracts/amsterdam';
const bytes = async (path: string) => { const b = readFileSync(join(ROOT, path)); return new Uint8Array(b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b); };

/** Bare land this close to a carriageway is a gap (R1). */
export const GAP_REACH_M = 6;
/** Orthophoto tests (raw sRGB of the 8 cm crop, 2 × 2 box per texel). Calibrated on the spots' BGT fietspad vs rijbaan texels (printed). */
// Red as a ratio, so a red fietspad in a facade's shadow still counts: r ≥ RED_MIN·max(g, b) and not black.
const RED_MIN = 1.08;
const isRed = (r: number, g: number, b: number) => r >= 30 && r >= RED_MIN * Math.max(g, b);
const isGreen = (r: number, g: number, b: number) => g > r + 4 && g > b + 4;
const isBright = (r: number, g: number, b: number) => Math.min(r, g, b) > 195;
/** Paint is confirmed when the photo is bright within this (ortho registration and the 0.12 m dashes). */
const PAINT_CONFIRM_M = 0.3;
const BRIGHT_LOCAL = 30;
// In a facade's shadow the contrast is compressed (lane roads-lanes 2026-10-23: Oud-West zebras in shade read ~25 over
// their 2 m box, under the 30 the sun needs): there the step is a share of the box mean, at least BRIGHT_LOCAL_MIN.
const BRIGHT_LOCAL_SHARE = 0.3, BRIGHT_LOCAL_MIN = 12;

type RGB = readonly [number, number, number];
const SOURCE_RGB: Record<GroundSource, RGB> = {
  land: [214, 200, 170], osmArea: [190, 160, 220], park: [120, 170, 90],
  bgtCarriage: [70, 72, 78], bgtParking: [110, 110, 140], bgtFoot: [200, 196, 188], bgtPedestrian: [176, 170, 150], bgtCycle: [190, 60, 50], bgtDriveway: [150, 110, 80],
  fietsstraat: [255, 120, 0], bgtKerb: [250, 250, 245],
  band: [0, 150, 255], junctionFill: [0, 90, 180],
  laneRibbon: [255, 0, 160], cyclePaint: [200, 0, 255], cycleCross: [255, 210, 0],
  nodePaint: [0, 230, 120], graphPaint: [0, 255, 255], bandPaint: [255, 255, 0],
  rails: [20, 20, 20], pocket: [255, 160, 200], photoPaint: [120, 255, 200],
  water: [48, 75, 77], quay: [90, 80, 70], deck: [120, 100, 60], other: [128, 128, 128],
};
/** Bare land within GAP_REACH_M of a carriageway (drawn over the land colour). */
const GAP_RGB: RGB = [255, 0, 0];
const NONE_RGB: RGB = [255, 255, 255];
/** OSM green fills (osmArea drawn as park / wood): told apart from the BGT park surfaces. */
const OSM_GREEN_RGB: RGB = [170, 200, 40];
/** Building footprints (not ground; drawn so a review sees what is a house). */
const HOUSE_RGB: RGB = [60, 40, 70];
const RED_SOURCES: ReadonlySet<GroundSource> = new Set(['laneRibbon', 'cyclePaint', 'cycleCross', 'fietsstraat']);
const PAINT_SOURCES: readonly GroundSource[] = ['nodePaint', 'photoPaint', 'graphPaint', 'bandPaint', 'cycleCross'];

async function roadCellsFor(keys: Iterable<string>): Promise<RoadCell[]> {
  const out: RoadCell[] = [];
  for (const k of keys) { const f = join(ROOT, 'roads-v1/cells', `${k}.json.gz`); if (existsSync(f)) out.push(JSON.parse(gunzipSync(readFileSync(f)).toString())); }
  return out;
}

/** Building footprints (building-tiles z14, the 3D city's source) over the view: the land under a house is no gap. */
function buildingMask(x0: number, y0: number, w: number, res: number): Uint8Array {
  const dir = join(ROOT, 'building-tiles'), list = new Set((JSON.parse(readFileSync(join(dir, 'index-z14.json'), 'utf8')) as { tileList: string[] }).tileList);
  const tileOf = (lng: number, lat: number) => [Math.floor((lng + 180) / 360 * 2 ** 14), Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** 14)];
  const [lw, ls] = fromLocal(x0, y0), [le, ln] = fromLocal(x0 + w * res, y0 + w * res), [tx0, ty0] = tileOf(lw, ln), [tx1, ty1] = tileOf(le, ls);
  const polys: [number, number][][][] = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const t = `14/${tx}/${ty}`;
    if (!list.has(t)) continue;
    for (const f of (JSON.parse(gunzipSync(readFileSync(join(dir, `${t}.geojson.gz`))).toString()) as { features: { geometry: { type: string; coordinates: unknown } }[] }).features) {
      const ps = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates as unknown[] : [];
      for (const p of ps as [number, number][][][]) polys.push(p.map(r => r.map(([lng, lat]) => toLocal(lng, lat))));
    }
  }
  const out = new Uint8Array(w * w);
  fillPolygons(out, polys, x0, y0, w, w, res, 1);
  return out;
}

/** Chamfer distance (metres) from every pixel to the nearest `on` pixel, capped. */
function distanceTo(on: Uint8Array, w: number, h: number, res: number): Float32Array {
  const INF = 1e9, d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = on[i] ? 0 : INF;
  const a = res, b = res * Math.SQRT2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + a);
    if (y > 0) { v = Math.min(v, d[i - w] + a); if (x > 0) v = Math.min(v, d[i - w - 1] + b); if (x < w - 1) v = Math.min(v, d[i - w + 1] + b); }
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; let v = d[i];
    if (x < w - 1) v = Math.min(v, d[i + 1] + a);
    if (y < h - 1) { v = Math.min(v, d[i + w] + a); if (x < w - 1) v = Math.min(v, d[i + w + 1] + b); if (x > 0) v = Math.min(v, d[i + w - 1] + b); }
    d[i] = v;
  }
  return d;
}

const round = (v: number, k = 1) => Math.round(v * 10 ** k) / 10 ** k;

interface SpotTable {
  id: string; label: string; at: [number, number]; halfM: number; res: number; cells: number;
  m2: Partial<Record<GroundSource | 'none', number>>;
  /** Visible m² per source and the layer (palette) it is drawn with, e.g. bgtFoot/klinker: function lost, material kept. */
  m2ByLayer: Record<string, number>;
  /** Visible m² per source by what the photo shows there (green / bright / other). */
  orthoBySource: Record<string, { green: number; bright: number; other: number }>;
  /** Visible m² of the red sources over red in the photo / not. */
  redConfirmed: Partial<Record<GroundSource, { m2: number; orthoRedShare: number }>>;
  gaps: { m2: number; orthoGreen: number; orthoPaved: number; carriageM2: number };
  ribbonTris: { total: number; overCyclePolygon: number };
  paintTris: Partial<Record<GroundSource, number>> & { offNodeEvidence: number };
  paintM2: { visible: number; orthoWhite: number; unconfirmed: number; unconfirmedBySource: Partial<Record<GroundSource, number>> };
  complaints: { R1_gaps: number; R2_lanes: number; R3_paint: number };
  owner: 'R1 gaps' | 'R2 lanes' | 'R3 paint';
  /** Share of the spot's BGT fietspad / rijbaan texels the photo reads as red (the red test's baseline and false-positive rate). */
  orthoRedBaseline?: Record<string, number>;
  /** OSM area fills drawn where a BGT wegdeel polygon lies (the fill pokes through the survey). */
  osmAreaOverSurveyM2?: number;
  /** Median photo colour (raw sRGB) per source/layer with ≥ 20 m² visible. */
  orthoMedianRgb?: Record<string, number[]>;
  ranked: string[];
}

async function diagnose(store: GroundStore, ortho: OrthoTiles, s: RoadSpot): Promise<{ table: SpotTable; sources: Uint8Array; w: number; orthoRgb: Uint8Array; gapPx: Uint8Array; ids: Uint8Array; paintPx: Uint8Array }> {
  const [x, y] = toLocal(s.at[0], s.at[1]), half = s.halfM, w = Math.round(2 * half / RES), x0 = x - half, y0 = y - half;
  const keys = new Set<string>([store.cellAt(x, y)]);
  for (const dx of [-half, half]) for (const dy of [-half, half]) keys.add(store.cellAt(x + dx, y + dy));
  for (const k of [...keys]) for (const n of GroundStore.neighbours(k)) keys.add(n);
  const cells: BuiltCell[] = [];
  setSourceTracing(true);
  for (const k of keys) if (store.covers(k)) cells.push(buildCell(await store.cellInput(k, 0)));
  setSourceTracing(false);
  const src = new Uint8Array(w * w), ids = rasterLayerIds(cells, x0, y0, w, w, RES, new Set(), src);
  const index = new RoadIndex(await roadCellsFor(keys), [x0 - 5, y0 - 5, x0 + 2 * half + 5, y0 + 2 * half + 5]);
  const o = await ortho.crop(x0, y0, w, w, RES);
  const px = (i: number): [number, number] => [x0 + (i % w + 0.5) * RES, y0 + 2 * half - (Math.floor(i / w) + 0.5) * RES];

  // Carriageways: BGT rijbaan polygons (ground level) and the OSM carriageway bands / fills off the survey.
  const carriage = new Uint8Array(w * w), cls = new Uint8Array(w * w);
  const srcAt = (i: number) => sourceOfCode(src[i]);
  for (let i = 0; i < w * w; i++) {
    const [px_, py_] = px(i), s_ = srcAt(i), layer = layerOfId(ids[i]);
    const c_ = index.classAt(px_, py_);
    if (c_) cls[i] = 1;
    if (c_ === 'carriage') carriage[i] = 1;
    else if ((s_ === 'band' || s_ === 'junctionFill') && (layer === 'asphalt' || layer === 'klinker')) carriage[i] = 1;
  }
  const dist = distanceTo(carriage, w, w, RES), house = buildingMask(x0, y0, w, RES);
  // White in the photo within PAINT_CONFIRM_M of a pixel.
  const bright = new Uint8Array(w * w);
  // Paint is white in the sun and the brightest thing around in a shadow: absolute, or BRIGHT_LOCAL over the 2 m box mean.
  const lum = new Float64Array(w * w);
  for (let i = 0; i < w * w; i++) lum[i] = 0.2126 * o[i * 3] + 0.7152 * o[i * 3 + 1] + 0.0722 * o[i * 3 + 2];
  const integral = new Float64Array((w + 1) * (w + 1));
  for (let yy = 0; yy < w; yy++) for (let xx = 0; xx < w; xx++) integral[(yy + 1) * (w + 1) + xx + 1] = lum[yy * w + xx] + integral[yy * (w + 1) + xx + 1] + integral[(yy + 1) * (w + 1) + xx] - integral[yy * (w + 1) + xx];
  const R = Math.round(1 / RES);
  for (let yy = 0; yy < w; yy++) for (let xx = 0; xx < w; xx++) {
    const i = yy * w + xx, xa = Math.max(0, xx - R), xb = Math.min(w, xx + R + 1), ya = Math.max(0, yy - R), yb = Math.min(w, yy + R + 1);
    const mean = (integral[yb * (w + 1) + xb] - integral[ya * (w + 1) + xb] - integral[yb * (w + 1) + xa] + integral[ya * (w + 1) + xa]) / ((xb - xa) * (yb - ya));
    if (isBright(o[i * 3], o[i * 3 + 1], o[i * 3 + 2]) || lum[i] > mean + Math.min(BRIGHT_LOCAL, Math.max(BRIGHT_LOCAL_MIN, BRIGHT_LOCAL_SHARE * mean))) bright[i] = 1;
  }
  const nearBright = distanceTo(bright, w, w, RES);

  const a = RES * RES, m2: SpotTable['m2'] = {}, redHits: Partial<Record<GroundSource, [number, number]>> = {};
  const gaps = { m2: 0, orthoGreen: 0, orthoPaved: 0, carriageM2: 0 };
  const paintM2 = { visible: 0, orthoWhite: 0, unconfirmed: 0, unconfirmedBySource: {} as Partial<Record<GroundSource, number>> };
  const gapPx = new Uint8Array(w * w), paintPx = new Uint8Array(w * w);
  let osmOverSurvey = 0;
  const samples: Record<string, [number, number, number][]> = {};
  const calibRed: Record<string, [number, number]> = {}, m2ByLayer: Record<string, number> = {}, orthoBy: Record<string, { green: number; bright: number; other: number }> = {};
  for (let i = 0; i < w * w; i++) {
    const s_ = srcAt(i), layer = layerOfId(ids[i]), key = s_ ?? (ids[i] ? 'other' : 'none');
    m2[key as GroundSource] = (m2[key as GroundSource] ?? 0) + a;
    const kl = `${key}/${layer ?? 'none'}`; m2ByLayer[kl] = (m2ByLayer[kl] ?? 0) + a;
    const r = o[i * 3], g = o[i * 3 + 1], b = o[i * 3 + 2];
    if (s_ === 'osmArea' && cls[i]) osmOverSurvey += a;
    if (i % 3 === 0) { const ok = `${key}/${layer ?? 'none'}`; (samples[ok] ??= []).push([r, g, b]); }
    const okey = `${key}/${layer ?? 'none'}`, ob = (orthoBy[okey] ??= { green: 0, bright: 0, other: 0 }); if (isGreen(r, g, b)) ob.green += a; else if (isBright(r, g, b)) ob.bright += a; else ob.other += a;
    if (carriage[i]) gaps.carriageM2 += a;
    if ((s_ === 'land' || !ids[i]) && !house[i] && dist[i] <= GAP_REACH_M) {
      gapPx[i] = 1; gaps.m2 += a;
      if (isGreen(r, g, b)) gaps.orthoGreen += a; else gaps.orthoPaved += a;
    }
    if (s_ && RED_SOURCES.has(s_) && layer === 'cycle') { const h = (redHits[s_] ??= [0, 0]); h[0]++; if (isRed(r, g, b)) h[1]++; }
    if (s_ === 'band' && layer === 'cycle') { const h = (redHits.band ??= [0, 0]); h[0]++; if (isRed(r, g, b)) h[1]++; }
    if (layer === 'paint') {
      paintM2.visible += a;
      paintPx[i] = nearBright[i] <= PAINT_CONFIRM_M ? 1 : 2;
      if (nearBright[i] <= PAINT_CONFIRM_M) paintM2.orthoWhite += a;
      else { paintM2.unconfirmed += a; paintM2.unconfirmedBySource[s_ ?? 'other'] = (paintM2.unconfirmedBySource[s_ ?? 'other'] ?? 0) + a; }
    }
    if (s_ === 'bgtCycle' || s_ === 'bgtCarriage') { const c = (calibRed[s_] ??= [0, 0]); c[0]++; if (isRed(r, g, b)) c[1]++; }
  }
  const redConfirmed: SpotTable['redConfirmed'] = {};
  for (const [k, [n, red]] of Object.entries(redHits) as [GroundSource, [number, number]][]) redConfirmed[k] = { m2: round(n * a), orthoRedShare: round(red / n, 2) };

  // Triangles in the view: cycle ribbons (and red pieces of part-covered ways) over a BGT fietspad; paint by evidence.
  const ribbonTris = { total: 0, overCyclePolygon: 0 }, paintTris: SpotTable['paintTris'] = { offNodeEvidence: 0 };
  const inView = (cx: number, cy: number) => cx >= x0 && cx < x0 + 2 * half && cy >= y0 && cy < y0 + 2 * half;
  for (const c of cells) for (const layer of ['cycle', 'paint'] as GroundLayer[]) {
    const m = c.layers[layer], sources = c.sources?.[layer];
    if (!m || !sources) continue;
    const p = m.positions, idx = m.indices;
    for (let t = 0; t < idx.length; t += 3) {
      const A = idx[t] * 3, B = idx[t + 1] * 3, C = idx[t + 2] * 3, cx = (p[A] + p[B] + p[C]) / 3, cy = (p[A + 1] + p[B + 1] + p[C + 1]) / 3;
      if (!inView(cx, cy)) continue;
      const s_ = sourceOfCode(sources[t / 3]) ?? 'other';
      if (layer === 'cycle' && (s_ === 'laneRibbon' || s_ === 'cyclePaint')) { ribbonTris.total++; if (index.classAt(cx, cy) === 'cycle') ribbonTris.overCyclePolygon++; }
      if (layer === 'paint') { paintTris[s_] = ((paintTris[s_] as number | undefined) ?? 0) + 1; if (s_ !== 'nodePaint' && s_ !== 'photoPaint') paintTris.offNodeEvidence++; }
    }
  }

  // The three complaints, m² the photo does not back.
  // A red source counts as backed by the photo in proportion to how often the photo reads red on this spot's BGT
  // fietspad texels (shade, wear and parked bikes keep that under 1): share / baseline, capped at 1.
  const base = calibRed.bgtCycle && calibRed.bgtCycle[0] > 2000 ? calibRed.bgtCycle[1] / calibRed.bgtCycle[0] : null;
  const unred = (k: GroundSource) => { const r = redConfirmed[k]; return r ? r.m2 * (1 - Math.min(1, base ? r.orthoRedShare / base : r.orthoRedShare)) : 0; };
  const R1 = gaps.m2;
  const R2 = unred('laneRibbon') + unred('cyclePaint') + unred('band');
  const R3 = paintM2.unconfirmed + unred('fietsstraat') + unred('cycleCross');
  const complaints = { R1_gaps: round(R1), R2_lanes: round(R2), R3_paint: round(R3) };
  const ranked = (Object.entries({ 'R1 gaps': R1, 'R2 lanes': R2, 'R3 paint': R3 }) as [SpotTable['owner'], number][]).sort((p, q) => q[1] - p[1]);
  const table: SpotTable = {
    id: s.id, label: s.label, at: s.at, halfM: half, res: RES, cells: cells.length,
    m2: Object.fromEntries(Object.entries(m2).filter(([, v]) => v! >= 0.05).sort((p, q) => q[1]! - p[1]!).map(([k, v]) => [k, round(v!)])),
    m2ByLayer: Object.fromEntries(Object.entries(m2ByLayer).filter(([, v]) => v >= 0.5).sort((p, q) => q[1] - p[1]).map(([k, v]) => [k, round(v)])),
    orthoBySource: Object.fromEntries(Object.entries(orthoBy).filter(([, v]) => v.green + v.bright + v.other >= 0.5).map(([k, v]) => [k, { green: round(v.green), bright: round(v.bright), other: round(v.other) }])),
    redConfirmed, gaps: { m2: round(gaps.m2), orthoGreen: round(gaps.orthoGreen), orthoPaved: round(gaps.orthoPaved), carriageM2: round(gaps.carriageM2) },
    ribbonTris, paintTris,
    paintM2: { visible: round(paintM2.visible), orthoWhite: round(paintM2.orthoWhite), unconfirmed: round(paintM2.unconfirmed), unconfirmedBySource: Object.fromEntries(Object.entries(paintM2.unconfirmedBySource).map(([k, v]) => [k, round(v!)])) },
    complaints, owner: ranked[0][0], ranked: ranked.map(([k, v]) => `${k} ${round(v)} m²`),
  };
  table.osmAreaOverSurveyM2 = round(osmOverSurvey);
  const med = (xs: number[]) => { const q = [...xs].sort((p, r) => p - r); return q[q.length >> 1]; };
  table.orthoMedianRgb = Object.fromEntries(Object.entries(samples).filter(([, v]) => v.length * 3 * a >= 20).map(([k, v]) => [k, [0, 1, 2].map(c => med(v.map(p => p[c])))]));
  table.orthoRedBaseline = Object.fromEntries(Object.entries(calibRed).map(([k, [n, r]]) => [k, round(r / n, 2)]));
  for (let i = 0; i < w * w; i++) if (house[i]) gapPx[i] = 2;
  return { table, sources: src, w, orthoRgb: o, gapPx, ids, paintPx };
}

function sourceImage(src: Uint8Array, gapPx: Uint8Array, w: number, ids: Uint8Array): Uint8Array {
  const rgb = new Uint8Array(w * w * 3);
  for (let i = 0; i < w * w; i++) {
    const s = sourceOfCode(src[i]), l = layerOfId(ids[i]), c = s === 'osmArea' && (l === 'park' || l === 'wood') ? OSM_GREEN_RGB : gapPx[i] === 1 ? GAP_RGB : gapPx[i] === 2 ? HOUSE_RGB : s ? SOURCE_RGB[s] : NONE_RGB;
    rgb[i * 3] = c[0]; rgb[i * 3 + 1] = c[1]; rgb[i * 3 + 2] = c[2];
  }
  return rgb;
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

async function sheet(t: SpotTable, rgb: Uint8Array, orthoRgb: Uint8Array, w: number, present: ReadonlySet<GroundSource>): Promise<string> {
  const tile = 560, frameW = 896, gap = 4, head = 30, W = tile * 2 + frameW + gap * 2;
  const raw = (b: Uint8Array) => sharp(Buffer.from(b), { raw: { width: w, height: w, channels: 3 } }).resize(tile, tile, { kernel: 'nearest' }).png().toBuffer();
  const framePath = join(OUT, 'frames', `desktop-${t.id}.png`);
  const frame = existsSync(framePath)
    ? await sharp(framePath).resize(frameW, tile, { fit: 'cover' }).png().toBuffer()
    : await sharp({ create: { width: frameW, height: tile, channels: 3, background: '#333' } }).composite([{ input: Buffer.from(`<svg width="${frameW}" height="${tile}" xmlns="http://www.w3.org/2000/svg"><text x="50%" y="50%" font-family="Helvetica" font-size="20" fill="#bbb" text-anchor="middle">no game frame (run own-ground-roads.spec)</text></svg>`), left: 0, top: 0 }]).png().toBuffer();
  const items: [string, RGB][] = [...GROUND_SOURCES.filter(s => present.has(s)).map(s => [s, SOURCE_RGB[s]] as [string, RGB]), [`bare land ≤ ${GAP_REACH_M} m of a carriageway`, GAP_RGB], ['building footprint', HOUSE_RGB], ['osmArea green fill (park/wood)', OSM_GREEN_RGB]];
  const per = 4, lh = 22, legendH = Math.ceil(items.length / per) * lh + 10 + 3 * lh;
  const colW = W / per;
  const lines = [
    `R1 gaps ${t.complaints.R1_gaps} m² (photo green ${t.gaps.orthoGreen}, paved ${t.gaps.orthoPaved}) · R2 lanes ${t.complaints.R2_lanes} m² · R3 paint ${t.complaints.R3_paint} m²  →  largest: ${t.owner}`,
    `cycle-ribbon triangles ${t.ribbonTris.total}, over a BGT fietspad ${t.ribbonTris.overCyclePolygon} · paint triangles ${Object.entries(t.paintTris).filter(([k]) => k !== 'offNodeEvidence').map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}; off node evidence ${t.paintTris.offNodeEvidence}`,
    `${2 * t.halfM} m square, north up, ${t.res} m/px. ${ORTHO_ATTRIBUTION}.`,
  ];
  const legend = `<svg width="${W}" height="${legendH}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#1d1d1d"/>${items.map(([n, c], i) => `<rect x="${(i % per) * colW + 10}" y="${Math.floor(i / per) * lh + 8}" width="16" height="14" fill="rgb(${c.join(',')})" stroke="#888"/><text x="${(i % per) * colW + 32}" y="${Math.floor(i / per) * lh + 20}" font-family="Helvetica" font-size="14" fill="#eee">${esc(n)}</text>`).join('')}${lines.map((l, i) => `<text x="10" y="${Math.ceil(items.length / per) * lh + 22 + i * lh}" font-family="Helvetica" font-size="14" fill="#fff">${esc(l)}</text>`).join('')}</svg>`;
  const titles: [string, number][] = [[`${t.id}: source per pixel`, tile / 2], ['PDOK 8 cm orthophoto', tile + gap + tile / 2], ['game frame (chase, desktop)', 2 * (tile + gap) + frameW / 2]];
  const header = `<svg width="${W}" height="${head}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#222"/>${titles.map(([s, cx]) => `<text x="${cx}" y="21" font-family="Helvetica" font-size="16" fill="#fff" text-anchor="middle">${esc(s)}</text>`).join('')}</svg>`;
  const out = join(OUT, `${t.id}.png`);
  await sharp({ create: { width: W, height: head + tile + legendH, channels: 3, background: '#222' } }).composite([
    { input: Buffer.from(header), left: 0, top: 0 },
    { input: await raw(rgb), left: 0, top: head },
    { input: await raw(orthoRgb), left: tile + gap, top: head },
    { input: frame, left: 2 * (tile + gap), top: head },
    { input: Buffer.from(legend), left: 0, top: head + tile },
  ]).png().toFile(out);
  return out;
}

async function main(): Promise<void> {
  const store = new GroundStore(bytes, { roads: true });
  await store.init();
  const ortho = new OrthoTiles();
  mkdirSync(OUT, { recursive: true });
  const tables: SpotTable[] = [];
  const prev = existsSync(join(OUT, 'table.json')) ? (JSON.parse(readFileSync(join(OUT, 'table.json'), 'utf8')).spots as SpotTable[]) : [];
  for (const s of ROAD_SPOTS) {
    if (ONLY && !ONLY.includes(s.id)) { const p = prev.find(q => q.id === s.id); if (p) tables.push(p); continue; }
    const t0 = Date.now();
    const d = await diagnose(store, ortho, s);
    const present = new Set<GroundSource>();
    for (const c of d.sources) { const k = sourceOfCode(c); if (k) present.add(k); }
    const out = await sheet(d.table, sourceImage(d.sources, d.gapPx, d.w, d.ids), d.orthoRgb, d.w, present);
    tables.push(d.table);
    // The game's paint over the orthophoto: green where the photo is bright within PAINT_CONFIRM_M, magenta where not.
    const ov = new Uint8Array(d.orthoRgb);
    for (let i = 0; i < d.w * d.w; i++) if (d.paintPx[i]) { const c = d.paintPx[i] === 1 ? [0, 230, 120] : [255, 0, 200]; for (let k = 0; k < 3; k++) ov[i * 3 + k] = Math.round(ov[i * 3 + k] * 0.35 + c[k] * 0.65); }
    await sharp(Buffer.from(ov), { raw: { width: d.w, height: d.w, channels: 3 } }).png().toFile(join(OUT, `${s.id}-paint.png`));
    console.log(`${s.id}: ${out} (${((Date.now() - t0) / 1000).toFixed(1)} s) ${d.table.ranked.join(' > ')}`);
  }
  writeFileSync(join(OUT, 'table.json'), JSON.stringify({ source: ORTHO_ATTRIBUTION, gapReachM: GAP_REACH_M, redMin: RED_MIN, sources: GROUND_SOURCES, spots: tables }, null, 1));
  console.table(tables.map(t => ({ spot: t.id, R1: t.complaints.R1_gaps, R2: t.complaints.R2_lanes, R3: t.complaints.R3_paint, owner: t.owner, ribbonOverCycle: `${t.ribbonTris.overCyclePolygon}/${t.ribbonTris.total}`, paintOffNode: t.paintTris.offNodeEvidence })));
}

void sourceCode; void GROUND_LAYERS;
if (process.argv[1]?.endsWith('render-road-sources.ts')) main().catch(e => { console.error(e); process.exit(1); });
