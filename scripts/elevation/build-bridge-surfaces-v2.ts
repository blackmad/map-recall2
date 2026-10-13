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
const OUT = 'artifacts/own-ground/staging/bridge-surfaces-v2';
const WCS = 'https://service.pdok.nl/rws/ahn/wcs/v1_0';
const APPROACH_M = 24, STEP_M = 1.5;
const args = process.argv.slice(2);
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
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
async function raster(id: string, coverage: 'dsm_05m' | 'dtm_05m', bbox: number[]): Promise<{ r: Raster; url: string; sha: string }> {
  const url = `${WCS}?` + new URLSearchParams({ SERVICE: 'WCS', VERSION: '1.0.0', REQUEST: 'GetCoverage', COVERAGE: coverage, CRS: 'EPSG:28992', BBOX: bbox.join(','), RESX: '0.5', RESY: '0.5', FORMAT: 'GEOTIFF' });
  const file = `${RAW}/${id}-${coverage}.tif`, meta = `${file}.json`;
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

// --------------------------------------------------------------- one bridge
interface Row { id: string; name: string; type: string; material: string; ring: P[] }
interface Outcome { id: string; name: string; status: string; reason?: string; movable: boolean; hump?: number; widthM?: number; family?: string; profile?: any }

async function profileFor(row: Row): Promise<Outcome> {
  const movable = row.type === 'Beweegbare brug';
  const base = { id: row.id, name: row.name, movable };
  // Unnumbered register rows get positional ids in the extract builder, which shift once a row is measured.
  if (row.id.startsWith('register-')) return { ...base, status: 'unnumbered', reason: 'register row without an object number' };
  const ring = row.ring;
  const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
  const bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  // Candidate ways: any whose centreline passes through the footprint.
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
  if (!best) return { ...base, status: 'no-road', reason: 'no OSM way passes through the footprint' };
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
  const line: P[] = [...before.slice(0, Math.max(0, before.length - 1)), ...mid, ...after.slice(1)];
  const lens = [0];
  for (let i = 1; i < line.length; i++) lens.push(lens[i - 1] + dist(line[i], line[i - 1]));
  const total = lens[lens.length - 1];
  if (total < 20) return { ...base, status: 'short', reason: `alignment only ${total.toFixed(0)} m` };

  const stations: { s: number; p: P; n: P; t: P }[] = [];
  const count = Math.ceil(total / STEP_M);
  for (let k = 0; k <= count; k++) {
    const s = k * total / count;
    let i = 1; while (i < lens.length - 1 && lens[i] < s) i++;
    const a = line[i - 1], b = line[i], len = dist(a, b) || 1, t = (s - lens[i - 1]) / len;
    stations.push({ s, p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], n: [-(b[1] - a[1]) / len, (b[0] - a[0]) / len], t: [(b[0] - a[0]) / len, (b[1] - a[1]) / len] });
  }
  const onDeck = (p: P) => inPoly(ring, p[0], p[1]) || distToRing(ring, p[0], p[1]) < 0.3;
  const deckStations = stations.filter(s => onDeck(s.p));
  if (deckStations.length < 2) return { ...base, status: 'no-deck', reason: 'alignment does not cross the footprint' };
  const deckRange: P = [deckStations[0].s, deckStations[deckStations.length - 1].s];
  if (deckRange[1] - deckRange[0] > 65) return { ...base, status: 'too-long', reason: `deck ${(deckRange[1] - deckRange[0]).toFixed(0)} m` };

  const all = [...line, ...ring];
  const rbox = [Math.floor(Math.min(...all.map(p => p[0])) - 6), Math.floor(Math.min(...all.map(p => p[1])) - 6), Math.ceil(Math.max(...all.map(p => p[0])) + 6), Math.ceil(Math.max(...all.map(p => p[1])) + 6)];
  if (rbox[2] - rbox[0] > 400 || rbox[3] - rbox[1] > 400) return { ...base, status: 'too-big', reason: 'raster box > 400 m' };
  const [dsm, dtm] = await Promise.all([raster(row.id, 'dsm_05m', rbox), raster(row.id, 'dtm_05m', rbox)]);
  const readers = { dsm_05m: sampler(dsm.r), dtm_05m: sampler(dtm.r) };

  const rows = stations.map(st => {
    const deck = onDeck(st.p), cov = deck ? 'dsm_05m' as const : 'dtm_05m' as const, read = readers[cov], v: number[] = [];
    for (let along = -0.5; along <= 0.5; along += 0.5) for (let across = -1.5; across <= 1.5; across += 0.5) {
      const q: P = [st.p[0] + st.n[0] * across + st.t[0] * along, st.p[1] + st.n[1] * across + st.t[1] * along];
      if (deck && !onDeck(q)) continue;
      const h = read(q[0], q[1]);
      if (Number.isFinite(h) && h >= -8 && h <= 15) v.push(h);
    }
    v.sort((a, b) => a - b);
    return { ...st, cov, count: v.length, raw: v.length >= 8 ? round(v[Math.floor(v.length * 0.3)]) : null };
  });
  const missing = rows.filter(r => r.raw === null).length;
  if (missing > rows.length * 0.2 || rows[0].raw === null || rows[rows.length - 1].raw === null) return { ...base, status: 'coverage', reason: `${missing}/${rows.length} stations without AHN` };
  const measured = rows.map((r, i) => {
    if (r.raw !== null) return r.raw;
    const left = rows.slice(0, i).findLast(q => q.raw !== null)!, right = rows.slice(i + 1).find(q => q.raw !== null)!;
    if (right.s - left.s > 6) return NaN;
    return left.raw! + (right.raw! - left.raw!) * (r.s - left.s) / (right.s - left.s);
  });
  if (measured.some(Number.isNaN)) return { ...base, status: 'gap', reason: 'profile gap > 6 m' };
  const med = measured.map((_, i) => { const n = measured.slice(Math.max(0, i - 1), i + 2).sort((a, b) => a - b); return n[Math.floor(n.length / 2)]; });
  const smooth = med.map((h, i) => (med[Math.max(0, i - 1)] + 2 * h + med[Math.min(med.length - 1, i + 1)]) / 4);
  const baseline: P = [smooth[0], smooth[smooth.length - 1]];
  const rel = smooth.map((h, i) => {
    const ground = baseline[0] + (baseline[1] - baseline[0]) * rows[i].s / total;
    const t = Math.max(0, Math.min(1, rows[i].s / 8, (total - rows[i].s) / 8));
    return Math.max(0, h - ground) * t * t * (3 - 2 * t);
  });
  const hump = Math.max(...rel);
  const grade = Math.max(...rel.slice(1).map((h, i) => Math.abs(h - rel[i]) / STEP_M));

  // Footprint width: area over its extent along the deck axis.
  const a0 = deckStations[0].p, a1 = deckStations[deckStations.length - 1].p, axis: P = [(a1[0] - a0[0]) / (dist(a0, a1) || 1), (a1[1] - a0[1]) / (dist(a0, a1) || 1)];
  const area = Math.abs(ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  const alongs = ring.map(p => p[0] * axis[0] + p[1] * axis[1]);
  const width = area / (Math.max(...alongs) - Math.min(...alongs));
  if (width < 2 || width > 45) return { ...base, status: 'width', reason: `footprint width ${width.toFixed(1)} m`, widthM: round(width) };
  if (hump > 4 || grade > 0.22) return { ...base, status: 'limits', reason: `hump ${hump.toFixed(2)} m, grade ${grade.toFixed(2)}`, hump };

  const ll0 = rdToLngLat({ x: line[0][0], y: line[0][1] }), olng = ll0[0], olat = ll0[1];
  const toLocal = (p: P): P => { const ll = rdToLngLat({ x: p[0], y: p[1] }); return [round((ll[0] - olng) * 111320 * Math.cos(olat * Math.PI / 180)), round((ll[1] - olat) * 111320)]; };
  const family = /metselwerk/i.test(row.material) ? 'masonry-arch' : /hout/i.test(row.material) ? 'wooden-deck' : /staal/i.test(row.material) ? 'steel-deck' : 'concrete-deck';
  const profile = {
    id: row.id, name: row.name, roadId: `osm:${way.id}`, roadIds: [`osm:${way.id}`], origin: [olng, olat], outline: ring.map(toLocal),
    deckRangeM: [round(deckRange[0]), round(deckRange[1])], widthM: round(width), approachHalfWidthM: Math.min(3.5, Math.max(2.5, width / 2)),
    family, material: row.material, bridgeType: row.type,
    samples: rows.map((r, i) => ({ s: round(r.s), point: toLocal(r.p), rawNAP: r.raw, surfaceNAP: round(smooth[i]), heightM: round(rel[i]), validPixels: r.count, coverage: r.cov })),
    provenance: {
      alignment: { source: 'own-ground-osm-v1', wayId: way.id, bridgeTagged: way.bridge },
      elevation: { rasters: [{ coverage: 'dsm_05m', url: dsm.url, sha256: dsm.sha }, { coverage: 'dtm_05m', url: dtm.url, sha256: dtm.sha }], resolutionM: 0.5, heightDatum: 'NAP', method: 'DSM-footprint-clipped-deck-DTM-approaches-q30-median3-weighted3', interpolatedStations: missing },
      renderDatum: { method: 'linear-endpoint-baseline-with-8m-approach-blend', endpointNAP: baseline.map(round) },
    },
  };
  return { ...base, status: 'ok', hump: round(hump), widthM: round(width), family, profile };
}

async function main(): Promise<void> {
  mkdirSync(RAW, { recursive: true }); mkdirSync(OUT, { recursive: true });
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
  }).slice(0, limit);
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
  const written = outcomes.filter(o => o.status === 'ok' && !o.movable);
  const file = { version: 1, renderHeightDatum: 'local-game-ground', generated: 'scripts/elevation/build-bridge-surfaces-v2.ts', bridges: written.map(o => o.profile) };
  const json = JSON.stringify(file);
  writeFileSync(`${OUT}/bridge-surfaces-v2.json`, json);
  const tally = (f: (o: Outcome) => boolean) => outcomes.filter(f).length;
  const byStatus: Record<string, number> = {};
  for (const o of outcomes) byStatus[o.status + (o.movable ? ' (movable)' : '')] = (byStatus[o.status + (o.movable ? ' (movable)' : '')] ?? 0) + 1;
  const humps = written.map(o => o.hump!);
  const report = {
    sources: { ahn: `${WCS} (AHN4 dsm_05m/dtm_05m, CC0)`, footprints: 'scripts/data/amsterdam-bridge-register.json (Gemeente Amsterdam)', alignment: 'own-ground-osm-v1 (OSM, ODbL)' },
    footprints: rows.length, byStatus,
    measuredWritten: written.length, humpOver0_3m: written.filter(o => o.hump! > 0.3).length, humpOver1m: written.filter(o => o.hump! > 1).length,
    humpMedianM: humps.length ? humps.sort((a, b) => a - b)[humps.length >> 1] : null, humpMaxM: humps.length ? Math.max(...humps) : null,
    movableMeasuredButKeptFlat: tally(o => o.status === 'ok' && o.movable), movableHumpOver0_3m: tally(o => o.status === 'ok' && o.movable && o.hump! > 0.3),
    families: Object.fromEntries([...new Set(written.map(o => o.family!))].map(f => [f, written.filter(o => o.family === f).length])),
    bytes: json.length, gzipBytes: gzipSync(json).length,
    rejected: outcomes.filter(o => o.status !== 'ok').map(o => ({ id: o.id, name: o.name, status: o.status, reason: o.reason, movable: o.movable })),
    humps: outcomes.filter(o => o.status === 'ok').map(o => ({ id: o.id, name: o.name, hump: o.hump, movable: o.movable })).sort((a, b) => b.hump! - a.hump!).slice(0, 40),
  };
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ ...report, rejected: report.rejected.length, humps: report.humps.slice(0, 10) }, null, 1));
}

void main();
