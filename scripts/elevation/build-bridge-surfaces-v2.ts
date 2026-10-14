// AHN profiles for the municipal bridge footprints that have no measured
// deck yet (lane task 3, 2026-10-13). Same method as the 729 profiles of
// feat/measured-bridges (799f82b4, scripts/build-bridge-surfaces.ts): AHN
// dsm_05m on the deck (samples inside the footprint), dtm_05m on the
// approaches, 3 × 7 samples per 1.5 m station, 30th percentile, median-3 and
// 1-2-1 smoothing, height above the line between the approach ends with an
// 8 m blend. The alignment comes from the OSM ground extract instead of that
// branch's discovery step: the OSM way crossing the footprint (bridge-tagged
// first), extended 24 m each side along connected ways.
//
//   npx tsx scripts/elevation/build-bridge-surfaces-v2.ts [--limit N]
//   # review artifacts/own-ground/staging/bridge-surfaces-v2/report.json, then rebuild the
//   # extract with `uv run scripts/elevation/build-canal-elevation.py --extra-profiles <file>`.
//
// Movable bridges ("Beweegbare brug") are sampled for the report but never
// written: a raised leaf or a lowered deck is not the road surface, so they
// stay flat unless a reference-led model exists.
//
// Sources (all open): AHN4 via PDOK WCS https://service.pdok.nl/rws/ahn/wcs/v1_0 (CC0);
// footprints scripts/data/amsterdam-bridge-register.json (Gemeente Amsterdam, CC0);
// OSM ground extract own-ground-osm-v1 (© OpenStreetMap contributors, ODbL).
// Rasters are cached under artifacts/own-ground/raw/ahn-bridges.
//
// Opt-in recovery passes (2026-10-14, any of them writes to bridge-surfaces-v3
// instead, holding only bridges that the plain v2 run leaves unmeasured):
//   --bgt-axis      no OSM way through the footprint: take the crossing axis from
//                   the BGT overbruggingsdeel 'dek' polygons inside the register
//                   footprint (PDOK OGC API, CC0; cached under
//                   artifacts/own-ground/raw/bgt-overbruggingsdeel), else the ring;
//                   of the principal axis and its perpendicular, the one whose ends
//                   just beyond the footprint land on AHN DTM land on both sides.
//   --dsm-fallback  approach stations without DTM read the DSM 10th percentile,
//                   accepted only within 1.0 m of the line between the nearest
//                   measured neighbours (rejects canopy); narrow decks accept
//                   fewer in-footprint pixels. The 20 % missing rule applies after.
//   --per-span      profiles over the v2 limits are re-measured on the deck alone:
//                   median-5 despike first; else the deck alone (deck-end baseline, approaches
//                   flat, optionally inset one station), grade <= 0.22, hump <= 4, and only where
//                   the deck ends sit within 1 m of the approach line (no viaducts).
//   Any v3 profile with a hump over 2.5 m is rejected as suspect (canal bridges).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync, inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readGeoTiff, type Raster } from '../../src/canalRecall/ownGround/geotiff.ts';
import { lngLatToRd, rdToLngLat } from '../../src/canalRecall/facade/rdNew.ts';
import { localToLngLat, type BridgeExtract } from '../../src/canalRecall/elevation/elevationData.ts';
import { elevationIndex } from '../own-ground/game-cells.ts';
import type { OsmGroundExtract } from '../../src/canalRecall/ownGround/osmGround.ts';

type P = [number, number];
const EXTRACTS = 'public/data/extracts/amsterdam';
const RAW = 'artifacts/own-ground/raw/ahn-bridges';
const BGT_RAW = 'artifacts/own-ground/raw/bgt-overbruggingsdeel';
const BGT_API = 'https://api.pdok.nl/lv/bgt/ogc/v1/collections/overbruggingsdeel/items';
const WCS = 'https://service.pdok.nl/rws/ahn/wcs/v1_0';
const APPROACH_M = 24, STEP_M = 1.5;
const args = process.argv.slice(2);
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
const BGT_AXIS = args.includes('--bgt-axis'), DSM_FALLBACK = args.includes('--dsm-fallback'), PER_SPAN = args.includes('--per-span');
const V3 = BGT_AXIS || DSM_FALLBACK || PER_SPAN;
const OUT = V3 ? 'artifacts/own-ground/staging/bridge-surfaces-v3' : 'artifacts/own-ground/staging/bridge-surfaces-v2';
const OUT_NAME = V3 ? 'bridge-surfaces-v3.json' : 'bridge-surfaces-v2.json';
const ONLY = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
const DUMP = args.includes('--dump');
const SUSPECT_HUMP_M = 2.5, DECK_END_ABOVE_MAX_M = 1.0;
const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const round = (v: number) => Math.round(v * 1000) / 1000;

function inPoly(ring: readonly P[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function distToRing(ring: readonly P[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2));
    best = Math.min(best, Math.hypot(a[0] + dx * t - x, a[1] + dy * t - y));
  }
  return best;
}

// --------------------------------------------------------------- road network (RD)
interface RoadWay { id: number; bridge: boolean; pts: P[]; hw: string }
const roads: RoadWay[] = [];
const vertexIndex = new Map<string, { w: number; i: number }[]>();
const gridIndex = new Map<string, number[]>();
const keyOf = (p: P) => `${Math.round(p[0] * 20)}_${Math.round(p[1] * 20)}`;
function loadRoads(): void {
  const manifest = JSON.parse(readFileSync(`${EXTRACTS}/own-ground-osm-v1/cells.json`, 'utf8')) as { cells: string[] };
  const seen = new Set<number>();
  for (const key of manifest.cells) {
    const cell = JSON.parse(gunzipSync(readFileSync(`${EXTRACTS}/own-ground-osm-v1/cells/${key}.json.gz`)).toString()) as OsmGroundExtract;
    for (const w of cell.ways) {
      const hw = w.tags.highway;
      if (!hw || seen.has(w.id) || ['steps', 'proposed', 'construction', 'platform', 'corridor', 'elevator'].includes(hw)) continue;
      if (w.tags.tunnel && w.tags.tunnel !== 'no') continue;
      seen.add(w.id);
      const pts = w.g.map(([lng, lat]) => { const r = lngLatToRd([lng, lat]); return [r.x, r.y] as P; });
      const idx = roads.push({ id: w.id, bridge: !!w.tags.bridge && w.tags.bridge !== 'no', pts, hw }) - 1;
      pts.forEach((p, i) => { const k = keyOf(p); (vertexIndex.get(k) ?? vertexIndex.set(k, []).get(k)!).push({ w: idx, i }); });
      for (let i = 0; i + 1 < pts.length; i++) {
        const x0 = Math.floor(Math.min(pts[i][0], pts[i + 1][0]) / 50), x1 = Math.floor(Math.max(pts[i][0], pts[i + 1][0]) / 50);
        const y0 = Math.floor(Math.min(pts[i][1], pts[i + 1][1]) / 50), y1 = Math.floor(Math.max(pts[i][1], pts[i + 1][1]) / 50);
        for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) { const k = `${gx}_${gy}`; const l = gridIndex.get(k) ?? gridIndex.set(k, []).get(k)!; if (l[l.length - 1] !== idx) l.push(idx); }
      }
    }
  }
}

/** Follow connected ways from `end` (arriving from `prev`) for `length` metres, straightest continuation first. */
function approach(end: P, prev: P, length: number): P[] {
  const out: P[] = [end];
  let remaining = length, previous = prev;
  const visited = new Set<string>();
  while (remaining > 0.01 && out.length < 60) {
    const cur = out[out.length - 1];
    const cands: { next: P; cos: number; key: string }[] = [];
    for (const { w, i } of vertexIndex.get(keyOf(cur)) ?? []) {
      const pts = roads[w].pts;
      if (dist(pts[i], cur) > 0.3) continue;
      for (const j of [i - 1, i + 1]) {
        if (j < 0 || j >= pts.length) continue;
        const next = pts[j], inx = cur[0] - previous[0], iny = cur[1] - previous[1], ox = next[0] - cur[0], oy = next[1] - cur[1];
        const l = Math.hypot(inx, iny) * Math.hypot(ox, oy);
        if (l < 1e-6) continue;
        cands.push({ next, cos: (inx * ox + iny * oy) / l, key: keyOf(next) });
      }
    }
    const best = cands.filter(c => c.cos > -0.15 && !visited.has(c.key)).sort((a, b) => b.cos - a.cos)[0];
    if (!best) break;
    visited.add(best.key);
    const seg = dist(cur, best.next);
    if (seg < 0.01) { out.push(best.next); previous = cur; continue; }
    const t = Math.min(1, remaining / seg);
    out.push([cur[0] + (best.next[0] - cur[0]) * t, cur[1] + (best.next[1] - cur[1]) * t]);
    remaining -= seg; previous = cur;
  }
  return out;
}

// --------------------------------------------------------------- AHN rasters
async function raster(id: string, coverage: 'dsm_05m' | 'dtm_05m', bbox: number[], variant = ''): Promise<{ r: Raster; url: string; sha: string }> {
  const url = `${WCS}?` + new URLSearchParams({ SERVICE: 'WCS', VERSION: '1.0.0', REQUEST: 'GetCoverage', COVERAGE: coverage, CRS: 'EPSG:28992', BBOX: bbox.join(','), RESX: '0.5', RESY: '0.5', FORMAT: 'GEOTIFF' });
  const file = `${RAW}/${id}${variant}-${coverage}.tif`, meta = `${file}.json`;
  if (!(existsSync(file) && existsSync(meta) && JSON.parse(readFileSync(meta, 'utf8')).url === url)) {
    for (let attempt = 0; ; attempt++) {
      let status = 'network';
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
        status = String(res.status);
        if (res.ok && (res.headers.get('content-type') ?? '').includes('tiff')) { writeFileSync(file, Buffer.from(await res.arrayBuffer())); writeFileSync(meta, JSON.stringify({ url, retrievedAt: new Date().toISOString() })); break; }
      } catch (e) { status = String(e); }
      if (attempt >= 5) throw new Error(`PDOK ${status}: ${id} ${coverage}`);
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  const bytes = readFileSync(file);
  return { r: readGeoTiff(bytes, b => inflateSync(b)), url, sha: createHash('sha256').update(bytes).digest('hex') };
}
const sampler = (r: Raster) => (x: number, y: number): number => {
  const col = Math.floor((x - r.originX) / r.pixelX), row = Math.floor((r.originY - y) / Math.abs(r.pixelY));
  return col < 0 || row < 0 || col >= r.width || row >= r.height ? NaN : r.data[row * r.width + col];
};

// --------------------------------------------------------------- BGT overbruggingsdeel (RD)
/** 'dek' parts of BGT overbruggingsdeel around a footprint, RD rings, cached per bridge with the raw response. */
async function bgtDecks(id: string, bbox: number[]): Promise<{ rings: P[][]; ids: string[]; url: string }> {
  const b = [bbox[0] - 5, bbox[1] - 5, bbox[2] + 5, bbox[3] + 5].map(v => v.toFixed(1)).join(',');
  const rd = 'http://www.opengis.net/def/crs/EPSG/0/28992';
  const first = `${BGT_API}?` + new URLSearchParams({ f: 'json', limit: '200', bbox: b, 'bbox-crs': rd, crs: rd });
  const file = `${BGT_RAW}/${id}.json`;
  let pages: any[];
  if (existsSync(file) && JSON.parse(readFileSync(file, 'utf8')).url === first) pages = JSON.parse(readFileSync(file, 'utf8')).pages;
  else {
    pages = [];
    let url: string | null = first;
    while (url) {
      let j: any = null;
      for (let attempt = 0; ; attempt++) {
        try { const res = await fetch(url, { signal: AbortSignal.timeout(60_000) }); if (res.ok) { j = await res.json(); break; } } catch { /* retry */ }
        if (attempt >= 5) throw new Error(`BGT fetch failed: ${id}`);
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
      }
      pages.push(j);
      url = (j.links as any[]).find(l => l.rel === 'next')?.href ?? null;
    }
    writeFileSync(file, JSON.stringify({ url: first, retrievedAt: new Date().toISOString(), licence: 'CC0 1.0 (BGT, Kadaster/PDOK)', pages }));
  }
  const rings: P[][] = [], ids: string[] = [];
  for (const j of pages) for (const f of j.features as any[]) {
    const pr = f.properties;
    if ((pr.status && pr.status !== 'bestaand') || pr.eind_registratie || pr.type_overbruggingsdeel !== 'dek') continue;
    const polys: number[][][][] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
    for (const poly of polys) { rings.push(poly[0].map(([x, y]) => [x, y] as P)); ids.push(String(pr.lokaal_id)); }
  }
  return { rings, ids, url: first };
}

/** Principal axis of a 2-D point cloud: centroid and major unit vector. */
function principal(points: P[]): { c: P; major: P } {
  const n = points.length, cx = points.reduce((s, p) => s + p[0], 0) / n, cy = points.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of points) { sxx += (x - cx) ** 2; syy += (y - cy) ** 2; sxy += (x - cx) * (y - cy); }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { c: [cx, cy], major: [Math.cos(theta), Math.sin(theta)] };
}

// --------------------------------------------------------------- one bridge
interface Row { id: string; name: string; type: string; material: string; ring: P[] }
interface Outcome { id: string; name: string; status: string; reason?: string; movable: boolean; hump?: number; widthM?: number; family?: string; methods?: string[]; diagnostics?: Record<string, unknown>; profile?: any }
type Fetched = { r: Raster; url: string; sha: string };
type Alignment = { line: P[]; roadIds: string[]; alignment: Record<string, unknown>; rasters?: { dsm: Fetched; dtm: Fetched }; variant: string };

const AXIS_PROBE = { from: 1.5, to: 8, across: 1.5 };
const validDtm = (h: number) => Number.isFinite(h) && h >= -8 && h <= 15;

/**
 * --bgt-axis: a straight alignment through a footprint that no OSM way crosses.
 * Axis candidates are the principal axis of the BGT 'dek' area inside the footprint (or of the
 * footprint itself) and its perpendicular; the crossing is the one whose ends just beyond the
 * footprint land on AHN DTM ground on both sides (the other one runs along the water).
 */
async function axisAlignment(row: Row, bbox: number[]): Promise<Alignment | { status: string; reason: string; diagnostics?: Record<string, unknown> }> {
  const ring = row.ring;
  const bgt = await bgtDecks(row.id, bbox);
  const inRing: P[] = [], inDek: P[] = [];
  const usedDeks = new Set<number>();
  for (let x = bbox[0] + 0.25; x < bbox[2]; x += 0.5) for (let y = bbox[1] + 0.25; y < bbox[3]; y += 0.5) {
    if (!inPoly(ring, x, y)) continue;
    inRing.push([x, y]);
    const k = bgt.rings.findIndex(r => inPoly(r, x, y));
    if (k >= 0) { inDek.push([x, y]); usedDeks.add(k); }
  }
  if (inRing.length < 8) return { status: 'no-road', reason: 'footprint too small for an axis' };
  const fromBgt = inDek.length >= 8 && inDek.length >= 0.3 * inRing.length;
  const pts = fromBgt ? inDek : inRing;
  const { c, major } = principal(pts);
  const dirs: { name: string; d: P }[] = [{ name: 'major', d: major }, { name: 'minor', d: [-major[1], major[0]] }];
  const cand = dirs.map(({ name, d }) => {
    const ts = ring.map(p => (p[0] - c[0]) * d[0] + (p[1] - c[1]) * d[1]);
    const tmin = Math.min(...ts), tmax = Math.max(...ts);
    return { name, d, tmin, tmax, line: [[c[0] + d[0] * (tmin - APPROACH_M), c[1] + d[1] * (tmin - APPROACH_M)], [c[0] + d[0] * (tmax + APPROACH_M), c[1] + d[1] * (tmax + APPROACH_M)]] as P[] };
  });
  const all = [...ring, ...cand.flatMap(k => k.line)];
  const rbox = [Math.floor(Math.min(...all.map(p => p[0])) - 6), Math.floor(Math.min(...all.map(p => p[1])) - 6), Math.ceil(Math.max(...all.map(p => p[0])) + 6), Math.ceil(Math.max(...all.map(p => p[1])) + 6)];
  if (rbox[2] - rbox[0] > 400 || rbox[3] - rbox[1] > 400) return { status: 'too-big', reason: 'raster box > 400 m' };
  const [dsm, dtm] = await Promise.all([raster(row.id, 'dsm_05m', rbox, '-axis'), raster(row.id, 'dtm_05m', rbox, '-axis')]);
  const readDtm = sampler(dtm.r);
  // Fraction of valid DTM ground in a band from 1.5 m to 8 m beyond each end of the footprint along the axis.
  const side = (d: P, n: P, t0: number, sign: number) => {
    let ok = 0, total = 0;
    for (let a = AXIS_PROBE.from; a <= AXIS_PROBE.to; a += 0.5) for (let b = -AXIS_PROBE.across; b <= AXIS_PROBE.across; b += 0.5) {
      const t = t0 + sign * a, x = c[0] + d[0] * t + n[0] * b, y = c[1] + d[1] * t + n[1] * b;
      total++;
      if (!inPoly(ring, x, y) && validDtm(readDtm(x, y))) ok++;
    }
    return ok / total;
  };
  const scored = cand.map(k => { const n: P = [-k.d[1], k.d[0]]; const a = side(k.d, n, k.tmin, -1), b = side(k.d, n, k.tmax, 1); return { ...k, ends: [round(a), round(b)], score: Math.min(a, b) }; });
  scored.sort((a, b) => b.score - a.score);
  const [win, other] = scored;
  const diagnostics = { axisSource: fromBgt ? 'bgt-overbruggingsdeel' : 'register-ring-axis', axes: scored.map(k => ({ axis: k.name, ends: k.ends, lengthM: round(k.tmax - k.tmin) })) };
  if (win.score < 0.5) return { status: 'no-road', reason: `no axis lands on ground at both ends (${win.name} ${win.ends.join('/')}, ${other.name} ${other.ends.join('/')})`, diagnostics };
  if (other.score >= 0.5 && win.score - other.score < 0.15) return { status: 'no-road', reason: `ambiguous axis (${win.name} ${win.ends.join('/')}, ${other.name} ${other.ends.join('/')})`, diagnostics };
  return {
    line: win.line, roadIds: [], variant: '-axis', rasters: { dsm, dtm },
    alignment: fromBgt
      ? { source: 'bgt-overbruggingsdeel', url: bgt.url, lokaalIds: [...usedDeks].map(k => bgt.ids[k]), axis: win.name, endGroundFraction: win.ends, otherAxisEndGroundFraction: other.ends, approachM: APPROACH_M, licence: 'CC0 1.0 (BGT, PDOK)' }
      : { source: 'register-ring-axis', axis: win.name, endGroundFraction: win.ends, otherAxisEndGroundFraction: other.ends, approachM: APPROACH_M },
  };
}

/** The OSM way crossing the footprint (bridge-tagged first), cut and extended 24 m each side along connected ways. */
function osmAlignment(ring: P[], bbox: number[]): Alignment | null {
  const cand = new Map<number, number>();
  for (let gx = Math.floor((bbox[0] - 5) / 50); gx <= Math.floor((bbox[2] + 5) / 50); gx++) for (let gy = Math.floor((bbox[1] - 5) / 50); gy <= Math.floor((bbox[3] + 5) / 50); gy++) for (const wi of gridIndex.get(`${gx}_${gy}`) ?? []) cand.set(wi, 0);
  let best: { w: number; inside: number; first: number; last: number; score: number } | null = null;
  for (const wi of cand.keys()) {
    const pts = roads[wi].pts;
    let s = 0, inside = 0, first = Infinity, last = -Infinity;
    for (let i = 0; i + 1 < pts.length; i++) {
      const l = dist(pts[i], pts[i + 1]), n = Math.max(1, Math.ceil(l / 0.5));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n, x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
        if (x >= bbox[0] - 1 && x <= bbox[2] + 1 && y >= bbox[1] - 1 && y <= bbox[3] + 1 && inPoly(ring, x, y)) { inside += l / n; first = Math.min(first, s + l * t); last = Math.max(last, s + l * t); }
      }
      s += l;
    }
    if (inside < 3) continue;
    const score = inside + (roads[wi].bridge ? 1000 : 0) + (['cycleway', 'footway', 'pedestrian', 'path'].includes(roads[wi].hw) ? -0.5 : 0);
    if (!best || score > best.score) best = { w: wi, inside, first, last, score };
  }
  if (!best) return null;
  const way = roads[best.w];
  // Arc-length parametrise the way, cut [first, last], extend along connected ways.
  const cum = [0];
  for (let i = 1; i < way.pts.length; i++) cum.push(cum[i - 1] + dist(way.pts[i], way.pts[i - 1]));
  const at = (s: number): P => { let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const t = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); return [way.pts[i - 1][0] + (way.pts[i][0] - way.pts[i - 1][0]) * t, way.pts[i - 1][1] + (way.pts[i][1] - way.pts[i - 1][1]) * t]; };
  const sA = Math.max(0, best.first - APPROACH_M), sB = Math.min(cum[cum.length - 1], best.last + APPROACH_M);
  const mid: P[] = [at(sA), ...way.pts.filter((_, i) => cum[i] > sA && cum[i] < sB), at(sB)];
  let before: P[] = [], after: P[] = [];
  if (sA === 0 && mid.length >= 2) before = approach(mid[0], mid[1], APPROACH_M - best.first).reverse();
  if (sB === cum[cum.length - 1] && mid.length >= 2) after = approach(mid[mid.length - 1], mid[mid.length - 2], APPROACH_M - (cum[cum.length - 1] - best.last));
  return {
    line: [...before.slice(0, Math.max(0, before.length - 1)), ...mid, ...after.slice(1)], roadIds: [`osm:${way.id}`], variant: '',
    alignment: { source: 'own-ground-osm-v1', wayId: way.id, bridgeTagged: way.bridge },
  };
}

/** Median of xs over [i - half, i + half] clipped to [lo, hi]. */
const median = (xs: number[], i: number, half: number, lo = 0, hi = xs.length - 1) => {
  const n = xs.slice(Math.max(lo, i - half), Math.min(hi, i + half) + 1).sort((a, b) => a - b);
  return n[Math.floor(n.length / 2)];
};
/** 1-2-1 smoothing inside [lo, hi]; values outside are passed through. */
const smooth121 = (xs: number[], lo = 0, hi = xs.length - 1) => xs.map((h, i) => i < lo || i > hi ? h : (xs[Math.max(lo, i - 1)] + 2 * h + xs[Math.min(hi, i + 1)]) / 4);

async function profileFor(row: Row): Promise<Outcome> {
  const movable = row.type === 'Beweegbare brug';
  const base = { id: row.id, name: row.name, movable };
  // Unnumbered register rows get positional ids in the extract builder, which shift once a row is measured.
  if (row.id.startsWith('register-')) return { ...base, status: 'unnumbered', reason: 'register row without an object number' };
  const ring = row.ring;
  const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
  const bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const methods: string[] = [];
  let al: Alignment | null = osmAlignment(ring, bbox);
  if (!al) {
    if (!BGT_AXIS) return { ...base, status: 'no-road', reason: 'no OSM way passes through the footprint' };
    const axis = await axisAlignment(row, bbox);
    if (!('line' in axis)) return { ...base, ...axis };
    al = axis;
    methods.push('bgt-axis');
  }
  const line = al.line;
  const lens = [0];
  for (let i = 1; i < line.length; i++) lens.push(lens[i - 1] + dist(line[i], line[i - 1]));
  let total = lens[lens.length - 1];
  if (total < 20) return { ...base, status: 'short', reason: `alignment only ${total.toFixed(0)} m`, methods };

  let stations: { s: number; p: P; n: P; t: P }[] = [];
  const count = Math.ceil(total / STEP_M);
  for (let k = 0; k <= count; k++) {
    const s = k * total / count;
    let i = 1; while (i < lens.length - 1 && lens[i] < s) i++;
    const a = line[i - 1], b = line[i], len = dist(a, b) || 1, t = (s - lens[i - 1]) / len;
    stations.push({ s, p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], n: [-(b[1] - a[1]) / len, (b[0] - a[0]) / len], t: [(b[0] - a[0]) / len, (b[1] - a[1]) / len] });
  }
  const onDeck = (p: P) => inPoly(ring, p[0], p[1]) || distToRing(ring, p[0], p[1]) < 0.3;
  const deckStations = stations.filter(s => onDeck(s.p));
  if (deckStations.length < 2) return { ...base, status: 'no-deck', reason: 'alignment does not cross the footprint', methods };
  let deckRange: P = [deckStations[0].s, deckStations[deckStations.length - 1].s];
  if (deckRange[1] - deckRange[0] > 65) return { ...base, status: 'too-long', reason: `deck ${(deckRange[1] - deckRange[0]).toFixed(0)} m`, methods };
  // Footprint width: area over its extent along the deck axis.
  const a0 = deckStations[0].p, a1 = deckStations[deckStations.length - 1].p, axis: P = [(a1[0] - a0[0]) / (dist(a0, a1) || 1), (a1[1] - a0[1]) / (dist(a0, a1) || 1)];
  const area = Math.abs(ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  const alongs = ring.map(p => p[0] * axis[0] + p[1] * axis[1]);
  const width = area / (Math.max(...alongs) - Math.min(...alongs));

  let rasters = al.rasters;
  if (!rasters) {
    const all = [...line, ...ring];
    const rbox = [Math.floor(Math.min(...all.map(p => p[0])) - 6), Math.floor(Math.min(...all.map(p => p[1])) - 6), Math.ceil(Math.max(...all.map(p => p[0])) + 6), Math.ceil(Math.max(...all.map(p => p[1])) + 6)];
    if (rbox[2] - rbox[0] > 400 || rbox[3] - rbox[1] > 400) return { ...base, status: 'too-big', reason: 'raster box > 400 m', methods };
    const [dsm, dtm] = await Promise.all([raster(row.id, 'dsm_05m', rbox, al.variant), raster(row.id, 'dtm_05m', rbox, al.variant)]);
    rasters = { dsm, dtm };
  }
  const { dsm, dtm } = rasters;
  const readers = { dsm_05m: sampler(dsm.r), dtm_05m: sampler(dtm.r) };
  // Narrow decks: the 3 m sampling band reaches past the footprint, so fewer pixels qualify.
  const minDeckPixels = DSM_FALLBACK && width < 4 ? 4 : 8;

  const sampleBand = (st: { p: P; n: P; t: P }, read: (x: number, y: number) => number, deck: boolean) => {
    const v: number[] = [];
    for (let along = -0.5; along <= 0.5; along += 0.5) for (let across = -1.5; across <= 1.5; across += 0.5) {
      const q: P = [st.p[0] + st.n[0] * across + st.t[0] * along, st.p[1] + st.n[1] * across + st.t[1] * along];
      if (deck && !onDeck(q)) continue;
      const h = read(q[0], q[1]);
      if (Number.isFinite(h) && h >= -8 && h <= 15) v.push(h);
    }
    return v.sort((a, b) => a - b);
  };
  type StationRow = { s: number; p: P; n: P; t: P; cov: string; count: number; raw: number | null; dsmQ10?: number };
  let rows: StationRow[] = stations.map(st => {
    const deck = onDeck(st.p), cov = deck ? 'dsm_05m' : 'dtm_05m', v = sampleBand(st, deck ? readers.dsm_05m : readers.dtm_05m, deck);
    const raw = v.length >= (deck ? minDeckPixels : 8) ? round(v[Math.floor(v.length * 0.3)]) : null;
    if (raw === null && !deck && DSM_FALLBACK) {
      const d = sampleBand(st, readers.dsm_05m, false);
      if (d.length >= 4) return { ...st, cov, count: v.length, raw, dsmQ10: round(d[Math.floor(d.length * 0.1)]) };
    }
    return { ...st, cov, count: v.length, raw };
  });
  const narrowDeckStations = minDeckPixels < 8 ? rows.filter(r => r.cov === 'dsm_05m' && r.raw !== null && r.count < 8).length : 0;
  let dsmFilled = 0, dsmRejected = 0, trimmed = 0;
  if (DSM_FALLBACK) {
    // Approach stations without DTM: DSM q10, kept only when it sits within 1 m of the line between the
    // nearest DTM/deck neighbours (rejects canopy, cars, roofs). One-sided at the ends, within 6 m.
    const known = rows.map(r => r.raw);
    rows = rows.map((r, i) => {
      if (r.dsmQ10 === undefined) return r;
      let l = i - 1; while (l >= 0 && known[l] === null) l--;
      let h = i + 1; while (h < rows.length && known[h] === null) h++;
      let ref: number | null = null;
      if (l >= 0 && h < rows.length) ref = known[l]! + (known[h]! - known[l]!) * (r.s - rows[l].s) / (rows[h].s - rows[l].s);
      else if (l >= 0 && r.s - rows[l].s <= 6) ref = known[l];
      else if (h < rows.length && rows[h].s - r.s <= 6) ref = known[h];
      if (ref !== null && Math.abs(r.dsmQ10 - ref) <= 1.0) { dsmFilled++; return { ...r, raw: r.dsmQ10, cov: 'dsm_05m-q10' }; }
      dsmRejected++;
      return r;
    });
    // Approach ends still without ground: trim them while each approach keeps at least 10 m.
    let lo = 0, hi = rows.length - 1;
    while (lo < hi && rows[lo].raw === null && deckRange[0] - rows[lo + 1].s >= 10) lo++;
    while (hi > lo && rows[hi].raw === null && rows[hi - 1].s - deckRange[1] >= 10) hi--;
    if (lo > 0 || hi < rows.length - 1) {
      trimmed = lo + rows.length - 1 - hi;
      const s0 = rows[lo].s;
      rows = rows.slice(lo, hi + 1).map(r => ({ ...r, s: r.s - s0 }));
      stations = stations.slice(lo, hi + 1);
      deckRange = [deckRange[0] - s0, deckRange[1] - s0];
      total = rows[rows.length - 1].s;
    }
  }
  const missing = rows.filter(r => r.raw === null).length;
  if (missing > rows.length * 0.2 || rows[0].raw === null || rows[rows.length - 1].raw === null) return { ...base, status: 'coverage', reason: `${missing}/${rows.length} stations without AHN`, methods, diagnostics: { dsmFilled, dsmRejected, trimmed } };
  const measured = rows.map((r, i) => {
    if (r.raw !== null) return r.raw;
    const left = rows.slice(0, i).findLast(q => q.raw !== null)!, right = rows.slice(i + 1).find(q => q.raw !== null)!;
    if (right.s - left.s > 6) return NaN;
    return left.raw! + (right.raw! - left.raw!) * (r.s - left.s) / (right.s - left.s);
  });
  if (measured.some(Number.isNaN)) return { ...base, status: 'gap', reason: 'profile gap > 6 m', methods, diagnostics: { dsmFilled, dsmRejected, trimmed } };
  if (dsmFilled > 0 || narrowDeckStations > 0 || trimmed > 0) methods.push('dsm-fallback');

  const blendRel = (sm: number[], baseline: P) => sm.map((h, i) => {
    const ground = baseline[0] + (baseline[1] - baseline[0]) * rows[i].s / total;
    const t = Math.max(0, Math.min(1, rows[i].s / 8, (total - rows[i].s) / 8));
    return Math.max(0, h - ground) * t * t * (3 - 2 * t);
  });
  const gradeOf = (rel: number[]) => Math.max(...rel.slice(1).map((h, i) => Math.abs(h - rel[i]) / STEP_M));
  let smooth = smooth121(measured.map((_, i) => median(measured, i, 1)));
  let baseline: P = [smooth[0], smooth[smooth.length - 1]];
  let rel = blendRel(smooth, baseline);
  let hump = Math.max(...rel), grade = gradeOf(rel);
  let method = 'DSM-footprint-clipped-deck-DTM-approaches-q30-median3-weighted3';
  let datum = 'linear-endpoint-baseline-with-8m-approach-blend';
  let perSpanDiagnostics: Record<string, unknown> | undefined;

  if (width < 2 || width > 45) return { ...base, status: 'width', reason: `footprint width ${width.toFixed(1)} m`, widthM: round(width), methods };
  if (hump > 4 || grade > 0.22) {
    const steps = rel.slice(1).map((h, i) => Math.abs(h - rel[i]));
    const worst = steps.indexOf(Math.max(...steps)) + 1;
    const where = (s: number) => s < deckRange[0] - 1.5 ? 'approach' : s > deckRange[1] + 1.5 ? 'approach' : Math.min(s - deckRange[0], deckRange[1] - s) < 3 ? 'deck-end' : 'deck';
    const diagnostics: Record<string, unknown> = { v2: { hump: round(hump), grade: round(grade), worstGradeAt: where(rows[worst].s), endpointStepM: round(Math.abs(baseline[1] - baseline[0])), deckM: round(deckRange[1] - deckRange[0]) } };
    if (!PER_SPAN) return { ...base, status: 'limits', reason: `hump ${hump.toFixed(2)} m, grade ${grade.toFixed(2)}`, hump, methods, diagnostics };
    // 1. Same baseline, median-5 despike (lamp posts, railings, trusses in the deck DSM).
    const s5 = smooth121(measured.map((_, i) => median(measured, i, 2)));
    const r5 = blendRel(s5, [s5[0], s5[s5.length - 1]]);
    const h5 = Math.max(...r5), g5 = gradeOf(r5);
    diagnostics.despike5 = { hump: round(h5), grade: round(g5) };
    if (h5 <= 4 && g5 <= 0.22) {
      smooth = s5; baseline = [s5[0], s5[s5.length - 1]]; rel = r5; hump = h5; grade = g5;
      method = 'DSM-footprint-clipped-deck-DTM-approaches-q30-median5-weighted3'; methods.push('per-span');
    } else {
      // 2. Deck alone: median-5 inside the deck, baseline between the deck ends, approaches flat.
      //    Most v2 failures step at the deck ends (abutment walls, parapets, a deck above the quay),
      //    so a second try insets the span by one station at each end when the deck has room.
      const D0 = rows.findIndex(r => r.s >= deckRange[0] - 1e-6), D1 = rows.findLastIndex(r => r.s <= deckRange[1] + 1e-6);
      const tries = D1 - D0 >= 6 ? [0, 1] : [0];
      let accepted: { sd: number[]; rd: number[]; d0: number; d1: number; hd: number; gd: number; inset: number } | null = null;
      const attempts: Record<string, unknown>[] = [];
      for (const inset of tries) {
        const d0 = D0 + inset, d1 = D1 - inset;
        if (d1 - d0 < 2) continue;
        const sd = smooth121(measured.map((h, i) => i < d0 || i > d1 ? h : median(measured, i, 2, d0, d1)), d0, d1);
        const span = Math.max(1e-6, rows[d1].s - rows[d0].s);
        const rd = sd.map((h, i) => i <= d0 || i >= d1 ? 0 : Math.max(0, h - (sd[d0] + (sd[d1] - sd[d0]) * (rows[i].s - rows[d0].s) / span)));
        const hd = Math.max(...rd), gd = gradeOf(rd);
        // The deck-end datum drops the deck's height above the approaches; only accept it where that
        // loss is small (viaducts and decks high above the quay stay flat rather than pretend measured).
        const ground = (i: number) => s5[0] + (s5[s5.length - 1] - s5[0]) * rows[i].s / total;
        const endAbove = Math.max(sd[d0] - ground(d0), sd[d1] - ground(d1));
        attempts.push({ inset, hump: round(hd), grade: round(gd), deckEndStepM: round(Math.abs(sd[d1] - sd[d0])), deckEndAboveApproachM: round(endAbove) });
        if (hd <= 4 && gd <= 0.22 && endAbove <= DECK_END_ABOVE_MAX_M) { accepted = { sd, rd, d0, d1, hd, gd, inset }; break; }
      }
      diagnostics.deckAlone = attempts;
      if (!accepted) {
        const last = attempts[attempts.length - 1] as { hump: number; grade: number } | undefined;
        return { ...base, status: 'limits', reason: `hump ${hump.toFixed(2)} m, grade ${grade.toFixed(2)}; deck alone ${last ? `hump ${last.hump.toFixed(2)}, grade ${last.grade.toFixed(2)}` : 'too short'}`, hump, methods, diagnostics };
      }
      const { sd, rd, d0, d1 } = accepted;
      smooth = sd; baseline = [sd[d0], sd[d1]]; rel = rd; hump = accepted.hd; grade = accepted.gd;
      method = `DSM-footprint-clipped-deck-q30-median5-weighted3-deck-only${accepted.inset ? '-inset1' : ''}`;
      datum = 'deck-end-baseline-approaches-flat';
      methods.push('per-span');
    }
    perSpanDiagnostics = diagnostics;
  }
  if (V3 && hump > SUSPECT_HUMP_M) return { ...base, status: 'suspect', reason: `hump ${hump.toFixed(2)} m > ${SUSPECT_HUMP_M} m`, hump: round(hump), methods, diagnostics: perSpanDiagnostics };
  if (DUMP && ONLY) console.log(JSON.stringify({ id: row.id, methods, rows: rows.map((r, i) => [round(r.s), r.cov, r.count, r.raw, r.dsmQ10 ?? null, round(rel[i])]) }));

  const ll0 = rdToLngLat({ x: stations[0].p[0], y: stations[0].p[1] }), olng = ll0[0], olat = ll0[1];
  const toLocal = (p: P): P => { const ll = rdToLngLat({ x: p[0], y: p[1] }); return [round((ll[0] - olng) * 111320 * Math.cos(olat * Math.PI / 180)), round((ll[1] - olat) * 111320)]; };
  const family = /metselwerk/i.test(row.material) ? 'masonry-arch' : /hout/i.test(row.material) ? 'wooden-deck' : /staal/i.test(row.material) ? 'steel-deck' : 'concrete-deck';
  const elevation: Record<string, unknown> = { rasters: [{ coverage: 'dsm_05m', url: dsm.url, sha256: dsm.sha }, { coverage: 'dtm_05m', url: dtm.url, sha256: dtm.sha }], resolutionM: 0.5, heightDatum: 'NAP', method, interpolatedStations: missing };
  if (V3) Object.assign(elevation, { recovery: methods, dsmFilledStations: dsmFilled, narrowDeckStations, trimmedStations: trimmed });
  const profile = {
    id: row.id, name: row.name, roadId: al.roadIds[0] ?? null, roadIds: al.roadIds, origin: [olng, olat], outline: ring.map(toLocal),
    deckRangeM: [round(deckRange[0]), round(deckRange[1])], widthM: round(width), approachHalfWidthM: Math.min(3.5, Math.max(2.5, width / 2)),
    family, material: row.material, bridgeType: row.type,
    samples: rows.map((r, i) => ({ s: round(r.s), point: toLocal(r.p), rawNAP: r.raw, surfaceNAP: round(smooth[i]), heightM: round(rel[i]), validPixels: r.count, coverage: r.cov })),
    provenance: {
      alignment: al.alignment,
      elevation,
      renderDatum: { method: datum, endpointNAP: baseline.map(round) },
    },
  };
  return { ...base, status: 'ok', hump: round(hump), widthM: round(width), family, methods, diagnostics: perSpanDiagnostics, profile };
}

async function main(): Promise<void> {
  mkdirSync(RAW, { recursive: true }); mkdirSync(OUT, { recursive: true }); if (BGT_AXIS) mkdirSync(BGT_RAW, { recursive: true });
  loadRoads();
  const index = elevationIndex();
  const bridges = JSON.parse(readFileSync(`${EXTRACTS}/elevation-v1/bridges.json`, 'utf8')) as BridgeExtract;
  const register = JSON.parse(readFileSync('scripts/data/amsterdam-bridge-register.json', 'utf8')) as { fields: string[]; bridges: unknown[][] };
  const reg = new Map(register.bridges.map(b => { const r = Object.fromEntries(register.fields.map((f, i) => [f, b[i]])) as Record<string, any>; return [r.number as string, r]; }));
  const q = index.quantization.xy;
  const rows: Row[] = bridges.fallback.map(f => {
    const ring: P[] = [];
    for (let i = 0; i < f.ring.length; i += 2) { const ll = localToLngLat(index, f.ring[i] * q, f.ring[i + 1] * q); const r = lngLatToRd(ll); ring.push([r.x, r.y]); }
    const r = reg.get(f.id);
    return { id: f.id, name: r?.name || f.name || `Bridge ${f.id.replace('BRU', '')}`, type: r?.type ?? f.type ?? '', material: r?.material ?? '', ring };
  }).filter(r => !ONLY || ONLY.has(r.id)).slice(0, limit);
  console.log(`${rows.length} unmeasured footprints, ${roads.length} OSM ways`);
  const outcomes: Outcome[] = [];
  let next = 0, done = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let i = next++; i < rows.length; i = next++) {
      try { outcomes.push(await profileFor(rows[i])); } catch (e) { outcomes.push({ id: rows[i].id, name: rows[i].name, status: 'error', reason: String(e), movable: rows[i].type === 'Beweegbare brug' }); }
      if (++done % 50 === 0) console.log(`${done}/${rows.length}`);
    }
  }));
  outcomes.sort((a, b) => a.id.localeCompare(b.id));
  // The rows are the extract's fallback list, so v3 holds only bridges that are not measured yet.
  const already = new Set(bridges.measured.map(b => b.id));
  const written = outcomes.filter(o => o.status === 'ok' && !o.movable && !already.has(o.id));
  const generated = 'scripts/elevation/build-bridge-surfaces-v2.ts' + (V3 ? ' ' + args.filter(a => ['--bgt-axis', '--dsm-fallback', '--per-span'].includes(a)).join(' ') : '');
  const file = { version: 1, renderHeightDatum: 'local-game-ground', generated, bridges: written.map(o => o.profile) };
  const json = JSON.stringify(file);
  writeFileSync(`${OUT}/${OUT_NAME}`, json);
  const tally = (f: (o: Outcome) => boolean) => outcomes.filter(f).length;
  const byStatus: Record<string, number> = {};
  for (const o of outcomes) byStatus[o.status + (o.movable ? ' (movable)' : '')] = (byStatus[o.status + (o.movable ? ' (movable)' : '')] ?? 0) + 1;
  const humps = written.map(o => o.hump!);
  const report = {
    sources: { ahn: `${WCS} (AHN4 dsm_05m/dtm_05m, CC0)`, footprints: 'scripts/data/amsterdam-bridge-register.json (Gemeente Amsterdam)', alignment: 'own-ground-osm-v1 (OSM, ODbL)', ...(BGT_AXIS ? { bgt: `${BGT_API} (BGT overbruggingsdeel, CC0)` } : {}) },
    footprints: rows.length, byStatus,
    ...(V3 ? {
      byMethod: Object.fromEntries([...new Set(written.map(o => o.methods!.join('+') || 'plain'))].map(m => [m, written.filter(o => (o.methods!.join('+') || 'plain') === m).length])),
      methodCounts: Object.fromEntries(['bgt-axis', 'dsm-fallback', 'per-span'].map(m => [m, written.filter(o => o.methods!.includes(m)).length])),
      bgtAxisSources: Object.fromEntries(['bgt-overbruggingsdeel', 'register-ring-axis'].map(s => [s, written.filter(o => o.profile.provenance.alignment.source === s).length])),
      perSpanVariants: Object.fromEntries([...new Set(written.filter(o => o.methods!.includes('per-span')).map(o => o.profile.provenance.elevation.method))].map(m => [m, written.filter(o => o.profile.provenance.elevation.method === m).length])),
      limitsDiagnostics: outcomes.filter(o => o.diagnostics && (o.diagnostics as any).v2).map(o => ({ id: o.id, name: o.name, status: o.status, movable: o.movable, ...o.diagnostics })),
      noRoadDiagnostics: outcomes.filter(o => o.diagnostics && (o.diagnostics as any).axes).map(o => ({ id: o.id, status: o.status, reason: o.reason, ...o.diagnostics })),
    } : {}),
    measuredWritten: written.length, humpOver0_3m: written.filter(o => o.hump! > 0.3).length, humpOver1m: written.filter(o => o.hump! > 1).length,
    humpMedianM: humps.length ? humps.sort((a, b) => a - b)[humps.length >> 1] : null, humpMaxM: humps.length ? Math.max(...humps) : null,
    movableMeasuredButKeptFlat: tally(o => o.status === 'ok' && o.movable), movableHumpOver0_3m: tally(o => o.status === 'ok' && o.movable && o.hump! > 0.3),
    families: Object.fromEntries([...new Set(written.map(o => o.family!))].map(f => [f, written.filter(o => o.family === f).length])),
    bytes: json.length, gzipBytes: gzipSync(json).length,
    rejected: outcomes.filter(o => o.status !== 'ok').map(o => ({ id: o.id, name: o.name, status: o.status, reason: o.reason, movable: o.movable, ...(V3 ? { methods: o.methods } : {}) })),
    humps: outcomes.filter(o => o.status === 'ok').map(o => ({ id: o.id, name: o.name, hump: o.hump, movable: o.movable, ...(V3 ? { methods: o.methods } : {}) })).sort((a, b) => b.hump! - a.hump!).slice(0, 40),
  };
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ ...report, rejected: report.rejected.length, limitsDiagnostics: undefined, noRoadDiagnostics: undefined, humps: report.humps.slice(0, 10) }, null, 1));
}

void main();
