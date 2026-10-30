// Tag road ways that carry tram track but lack `embedded_rails=tram`, so the own-ground road look
// draws rails only where the tram really runs (staging path first, then review and copy):
//
//   npx tsx scripts/own-ground/patch-osm-trams.ts            # fetch + write artifacts/own-ground/staging/own-ground-osm-v1-trams/
//   npx tsx scripts/own-ground/patch-osm-trams.ts --offline  # re-use the cached Overpass and BGT responses
//   # review report.json, then copy the cells into public/data/extracts/amsterdam/own-ground-osm-v1/cells/
//
// Track sources: OSM `railway=tram` ways (minus `service=yard`) plus BGT `spoor` lines with
// functie=tram, eind_registratie null and relatieve_hoogteligging not negative (deduplicated by lokaal_id).
//
// A road way (>= 10 m, same highway list as before, not tunnel, not already tagged with tram) is
// patched when at least 70 % of its stations (every 2 m along the way) have a track segment within
// tol = clamp(halfWidth + 1, 3, 8) m, where halfWidth = width/2, else est_width/2, else lanes x 3 / 2,
// else 4. Patched ways get `embedded_rails=tram`, `embedded_rails:source` (`bgt-spoor` when any BGT
// track matched, else `railway=tram`) and `embedded_rails:offsets` ('a;b', signed metres of each track
// centreline from the way, positive = left of the direction of travel).
//
// Sources: Overpass API (© OpenStreetMap contributors, ODbL, build time only); PDOK BGT OGC API `spoor`
// (CC0), cached per tile under artifacts/own-ground/raw/bgt-spoor/.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { join } from 'node:path';
import type { OsmGroundExtract, OsmWay } from '../../src/canalRecall/ownGround/osmGround.ts';

const SRC = 'public/data/extracts/amsterdam/own-ground-osm-v1';
const OUT = 'artifacts/own-ground/staging/own-ground-osm-v1-trams';
const CACHE = 'artifacts/own-ground/raw/overpass-patch';
const BGT_CACHE = 'artifacts/own-ground/raw/bgt-spoor';
const BGT_BASE = 'https://api.pdok.nl/lv/bgt/ogc/v1/collections/spoor/items';
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const UA = 'map-recall-own-ground/1 (build script)';
const offline = process.argv.includes('--offline');

type Element = { type: 'way' | 'relation'; id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] };

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function overpass(label: string, query: string): Promise<Element[]> {
  const cached = join(CACHE, `${label}.json`);
  if (existsSync(cached)) return JSON.parse(readFileSync(cached, 'utf8')).elements;
  if (offline) throw new Error(`${label}: no cached response`);
  for (let attempt = 0; attempt < 24; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];
    let status = 0, text = '';
    try {
      const res = await fetch(endpoint, { method: 'POST', body: new URLSearchParams({ data: query }), headers: { 'User-Agent': UA } });
      status = res.status; text = await res.text();
      if (res.ok && text.startsWith('{')) {
        const body = JSON.parse(text) as { elements: Element[]; remark?: string };
        if (!body.remark || !/error/i.test(body.remark)) { mkdirSync(CACHE, { recursive: true }); writeFileSync(cached, text); return body.elements; }
        text = body.remark;
      }
    } catch (error) { text = String(error); }
    console.warn(`${label} @ ${new URL(endpoint).host}: ${status} ${text.slice(0, 80).replace(/\s+/g, ' ')}, retrying`);
    await sleep(6_000);
  }
  throw new Error(`overpass ${label} failed`);
}

// ---- BGT spoor (PDOK OGC API), fetched per tile and cached ----

type LngLat = [number, number];
type BgtFeature = { id?: string | number; properties?: Record<string, unknown> | null; geometry?: { type: string; coordinates: unknown } | null };
type Tile = { name: string; bbox: string };

const CITY = { minLon: 4.70, minLat: 52.27, maxLon: 5.11, maxLat: 52.44 };
const TILE_LON = 0.02, TILE_LAT = 0.012;

function tileList(): Tile[] {
  const out: Tile[] = [];
  const nx = Math.ceil((CITY.maxLon - CITY.minLon) / TILE_LON);
  const ny = Math.ceil((CITY.maxLat - CITY.minLat) / TILE_LAT);
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const w = CITY.minLon + i * TILE_LON, s = CITY.minLat + j * TILE_LAT;
    const e = Math.min(w + TILE_LON, CITY.maxLon), n = Math.min(s + TILE_LAT, CITY.maxLat);
    out.push({ name: `${w.toFixed(2)}_${s.toFixed(3)}`, bbox: [w, s, e, n].map(v => v.toFixed(4)).join(',') });
  }
  return out;
}

async function getJson(url: string): Promise<{ features?: BgtFeature[]; links?: { rel: string; href: string }[] }> {
  let last = '';
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
      const text = await res.text();
      if (res.ok) return JSON.parse(text);
      last = `${res.status} ${text.slice(0, 80).replace(/\s+/g, ' ')}`;
    } catch (error) { last = String(error); }
    if (attempt < 6) {
      const wait = 1_000 * 2 ** (attempt - 1);
      console.warn(`bgt ${url.slice(0, 100)}: ${last}, retry ${attempt}/5 in ${wait} ms`);
      await sleep(wait);
    }
  }
  throw new Error(`bgt page failed after 6 tries: ${last} (${url})`);
}

async function bgtTile(t: Tile): Promise<BgtFeature[]> {
  const cached = join(BGT_CACHE, `${t.name}.json`);
  if (existsSync(cached)) return (JSON.parse(readFileSync(cached, 'utf8')) as { features: BgtFeature[] }).features;
  if (offline) throw new Error(`bgt tile ${t.name}: no cached response`);
  const features: BgtFeature[] = [];
  let url: string | undefined = `${BGT_BASE}?bbox=${t.bbox}&limit=1000&f=json`;
  let pages = 0;
  while (url) {
    await sleep(150);
    const body = await getJson(url);
    features.push(...(body.features ?? []));
    pages++;
    if (pages > 200) throw new Error(`bgt tile ${t.name}: more than 200 pages`);
    const next = body.links?.find(l => l.rel === 'next')?.href;
    url = next ? new URL(next, url).toString() : undefined;
  }
  mkdirSync(BGT_CACHE, { recursive: true });
  writeFileSync(cached, JSON.stringify({ bbox: t.bbox, pages, fetched: new Date().toISOString(), features }));
  return features;
}

function lineParts(g: BgtFeature['geometry']): LngLat[][] {
  if (!g) return [];
  const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? (g.coordinates as unknown[]) : [];
  return (lines as number[][][]).filter(l => l.length >= 2).map(l => l.map(([x, y]) => [x, y] as LngLat));
}

async function bgtTramLines(): Promise<{ count: number; lines: LngLat[][] }> {
  const seen = new Map<string, LngLat[][]>();
  for (const t of tileList()) {
    for (const f of await bgtTile(t)) {
      const p = f.properties ?? {};
      if (p.functie !== 'tram' || p.eind_registratie != null) continue;
      if (p.relatieve_hoogteligging != null && Number(p.relatieve_hoogteligging) < 0) continue;
      const key = String(p.lokaal_id ?? f.id ?? JSON.stringify(f.geometry));
      if (seen.has(key)) continue;
      seen.set(key, lineParts(f.geometry));
    }
  }
  const lines = [...seen.values()].flat();
  return { count: seen.size, lines };
}

// ---- geometry ----

const BBOX = '52.27,4.70,52.44,5.11';
const LAT0 = 52.37;
const M_PER_DEG = 111320;
const KX = M_PER_DEG * Math.cos(LAT0 * Math.PI / 180);
const STEP_M = 2;
const MIN_LEN_M = 10;
const MIN_SHARE = 0.7;
const GRID_M = 20;
const TOL_MIN_M = 3, TOL_MAX_M = 8, DEFAULT_HALF_M = 4;
const CLUSTER_GAP_M = 0.8;
// Offsets read only from track segments within ~18 deg of the way (cross-overs and junction curves fill the gap
// between the two rails otherwise: Witte de Withstraat pooled to one cluster at 0.9 m where BGT has -1.9 and +1.9),
// and a cluster must hold this share of the stations that saw a parallel track.
const PARALLEL_COS = 0.95;
const MIN_CLUSTER_SHARE = 0.2;
const MAX_CLUSTER_IQR_M = 0.6;
const MAX_CLUSTERS = 2;
const ROAD_HW = new Set(['primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'residential', 'unclassified', 'living_street', 'service', 'busway', 'trunk', 'trunk_link', 'road', 'pedestrian']);
const SANITY_WAY = 323258151;
const SANITY_STREET = 'Jan Evertsenstraat';

type XY = [number, number];
type Seg = [number, number, number, number];

const proj = (lng: number, lat: number): XY => [lng * KX, lat * M_PER_DEG];

// Closest point of segment s to p, and its distance.
function closest(p: XY, s: Seg): { dist: number; q: XY } {
  const [ax, ay, bx, by] = s;
  const vx = bx - ax, vy = by - ay;
  const l2 = vx * vx + vy * vy;
  const t = l2 === 0 ? 0 : Math.min(1, Math.max(0, ((p[0] - ax) * vx + (p[1] - ay) * vy) / l2));
  const q: XY = [ax + t * vx, ay + t * vy];
  return { dist: Math.hypot(q[0] - p[0], q[1] - p[1]), q };
}

// Track segments (OSM and BGT) bucketed on a GRID_M grid. A query radius must be <= GRID_M, so the
// 3x3 buckets around the point cover every segment within the radius.
class SegmentGrid {
  private cells = new Map<string, number[]>();
  readonly segs: Seg[] = [];
  readonly fromBgt: boolean[] = [];
  add(a: XY, b: XY, bgt: boolean): void {
    const i = this.segs.length;
    this.segs.push([a[0], a[1], b[0], b[1]]);
    this.fromBgt.push(bgt);
    const x0 = Math.floor(Math.min(a[0], b[0]) / GRID_M), x1 = Math.floor(Math.max(a[0], b[0]) / GRID_M);
    const y0 = Math.floor(Math.min(a[1], b[1]) / GRID_M), y1 = Math.floor(Math.max(a[1], b[1]) / GRID_M);
    for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) {
      const k = `${ix},${iy}`;
      const bucket = this.cells.get(k);
      if (bucket) bucket.push(i); else this.cells.set(k, [i]);
    }
  }
  // Every segment within r of p. `off` is the signed perpendicular offset of the segment's nearest
  // point from the way: positive = left of the direction of travel `dir` (unit vector, metric frame).
  near(p: XY, dir: XY, r: number): { i: number; dist: number; off: number; cos: number }[] {
    const ix = Math.floor(p[0] / GRID_M), iy = Math.floor(p[1] / GRID_M);
    const seen = new Set<number>();
    const out: { i: number; dist: number; off: number; cos: number }[] = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const i of this.cells.get(`${ix + dx},${iy + dy}`) ?? []) {
        if (seen.has(i)) continue;
        seen.add(i);
        const { dist, q } = closest(p, this.segs[i]);
        if (dist > r) continue;
        const vx = q[0] - p[0], vy = q[1] - p[1];
        const [ax, ay, bx, by] = this.segs[i], l = Math.hypot(bx - ax, by - ay) || 1;
        const cos = Math.abs(((bx - ax) * dir[0] + (by - ay) * dir[1]) / l);
        out.push({ i, dist, off: vy * dir[0] - vx * dir[1], cos }); // dot(v, left normal (-dy, dx))
      }
    }
    return out;
  }
}

// Stations every STEP_M metres along the polyline (both ends included), each with the unit direction of
// the segment it lies on.
type Station = { p: XY; d: XY };
function stationsAlong(pts: XY[]): { stations: Station[]; length: number } {
  const segs: { a: XY; b: XY; l: number }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const l = Math.hypot(bx - ax, by - ay);
    if (l > 0) segs.push({ a: [ax, ay], b: [bx, by], l });
  }
  if (!segs.length) return { stations: [], length: 0 };
  const unit = (s: { a: XY; b: XY; l: number }): XY => [(s.b[0] - s.a[0]) / s.l, (s.b[1] - s.a[1]) / s.l];
  const stations: Station[] = [{ p: segs[0].a, d: unit(segs[0]) }];
  let total = 0, target = STEP_M;
  for (const s of segs) {
    while (target <= total + s.l) {
      const t = (target - total) / s.l;
      stations.push({ p: [s.a[0] + t * (s.b[0] - s.a[0]), s.a[1] + t * (s.b[1] - s.a[1])], d: unit(s) });
      target += STEP_M;
    }
    total += s.l;
  }
  const last = segs[segs.length - 1];
  stations.push({ p: last.b, d: unit(last) });
  return { stations, length: total };
}

// tol = clamp(halfWidth + 1, 3, 8) m; halfWidth from width, else est_width, else lanes x 3 m, else 4 m.
function trackTolerance(t: Record<string, string>): number {
  const w = parseFloat(t.width ?? ''), ew = parseFloat(t.est_width ?? ''), lanes = parseInt(t.lanes ?? '', 10);
  const half = Number.isFinite(w) ? w / 2 : Number.isFinite(ew) ? ew / 2 : Number.isFinite(lanes) ? (lanes * 3.0) / 2 : DEFAULT_HALF_M;
  return Math.min(TOL_MAX_M, Math.max(TOL_MIN_M, half + 1.0));
}

// Cluster the pooled signed offsets on gaps > CLUSTER_GAP_M, keep the MAX_CLUSTERS largest, return each
// cluster's median rounded to 0.1 m, ascending.
function trackOffsets(values: number[], stationsSeen = values.length): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const clusters: number[][] = [];
  for (const x of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && x - last[last.length - 1] <= CLUSTER_GAP_M) last.push(x); else clusters.push([x]);
  }
  const median = (c: number[]) => (c.length % 2 ? c[(c.length - 1) / 2] : (c[c.length / 2 - 1] + c[c.length / 2]) / 2);
  const kept = clusters
    .filter(c => c.length >= MIN_CLUSTER_SHARE * stationsSeen)
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_CLUSTERS);
  // A track that wanders against the way (Witte de Withstraat: the OSM centreline and the BGT tracks diverge along
  // 750 m, the station offsets spread from -2.5 to +3 m) has no one offset: write none, the game's prior stands.
  const iqr = (c: number[]) => c[Math.floor(c.length * 0.75)] - c[Math.floor(c.length * 0.25)];
  if (kept.some(c => iqr(c) > MAX_CLUSTER_IQR_M)) return [];
  return kept.map(c => Number(median(c).toFixed(1))).sort((a, b) => a - b);
}

type Decision = { patch: boolean; length: number; stations: number; onTram: number; share: number; tol: number; offsets: number[]; source: 'bgt-spoor' | 'railway=tram' | null };

function decide(grid: SegmentGrid, w: OsmWay): Decision {
  const t = w.tags ?? {};
  const tol = trackTolerance(t);
  const pts = w.g.map(([lng, lat]) => proj(lng, lat));
  const { stations, length } = stationsAlong(pts);
  let onTram = 0, bgtHit = false;
  const offs: number[] = [], osmOffs: number[] = [];
  let seenBgt = 0, seenOsm = 0;
  for (const s of stations) {
    const hits = grid.near(s.p, s.d, tol);
    if (!hits.length) continue;
    onTram++;
    // Per station, each parallel track once (BGT and OSM apart; BGT preferred for the offsets).
    const b = new Set<number>(), o = new Set<number>();
    for (const h of hits) {
      if (grid.fromBgt[h.i]) bgtHit = true;
      if (h.cos < PARALLEL_COS) continue;
      (grid.fromBgt[h.i] ? b : o).add(Math.round(h.off * 10) / 10);
    }
    if (b.size) { seenBgt++; offs.push(...b); }
    if (o.size) { seenOsm++; osmOffs.push(...o); }
  }
  const share = stations.length ? onTram / stations.length : 0;
  if (process.env.DEBUG_WAY && Number(process.env.DEBUG_WAY) === w.id) {
    const hist: Record<string, number> = {};
    for (const v of offs) { const k = (Math.round(v * 2) / 2).toFixed(1); hist[k] = (hist[k] ?? 0) + 1; }
    console.log('debug', w.id, JSON.stringify({ seenBgt, seenOsm, hist }));
  }
  const near = length >= MIN_LEN_M && share >= MIN_SHARE;
  const offsets = near ? (seenBgt ? trackOffsets(offs, seenBgt) : trackOffsets(osmOffs, seenOsm)) : [];
  // A track past the carriageway's half-width runs beside the road on its own baan (Sarphatistraat 4.7 m, tol 5 m),
  // not in it: no embedded rails there.
  const patch = near && offsets.every(o => Math.abs(o) <= tol - 1);
  return {
    patch, length, stations: stations.length, onTram, share, tol,
    offsets: patch ? offsets : [],
    source: patch ? (bgtHit ? 'bgt-spoor' : 'railway=tram') : null,
  };
}

function nearestTrack(grid: SegmentGrid, p: XY, bgtOnly: boolean): number {
  let best = Infinity;
  for (let i = 0; i < grid.segs.length; i++) {
    if (bgtOnly && !grid.fromBgt[i]) continue;
    best = Math.min(best, closest(p, grid.segs[i]).dist);
  }
  return best;
}

async function main(): Promise<void> {
  const els = await overpass('railway-tram', `[out:json][timeout:240];way[railway=tram](${BBOX});out tags geom;`);
  const tram = els.filter(e => e.type === 'way' && e.geometry && e.geometry.length >= 2 && e.tags?.service !== 'yard');
  const bgt = await bgtTramLines();
  const grid = new SegmentGrid();
  for (const e of tram) {
    const pts = e.geometry!.map(p => proj(p.lon, p.lat));
    for (let i = 1; i < pts.length; i++) grid.add(pts[i - 1], pts[i], false);
  }
  for (const line of bgt.lines) {
    const pts = line.map(([lng, lat]) => proj(lng, lat));
    for (let i = 1; i < pts.length; i++) grid.add(pts[i - 1], pts[i], true);
  }
  console.log(JSON.stringify({ tramWaysFetched: els.length, tramWaysKept: tram.length, bgtTramLines: bgt.count, trackSegments: grid.segs.length }));

  rmSync(join(OUT, 'cells'), { recursive: true, force: true });
  mkdirSync(join(OUT, 'cells'), { recursive: true });
  const memo = new Map<number, Decision>();
  const alreadyIds = new Set<number>();
  const patched = new Map<number, { name: string; metres: number; offsets: number[]; tol: number; source: string }>();
  const cellsChanged: string[] = [];
  let sanityWay: OsmWay | undefined;
  let sanityInfo = '';

  for (const f of readdirSync(join(SRC, 'cells')).filter(n => n.endsWith('.json.gz')).sort()) {
    const j = JSON.parse(gunzipSync(readFileSync(join(SRC, 'cells', f))).toString('utf8')) as OsmGroundExtract;
    let changed = false;
    for (const w of j.ways) {
      const t = w.tags ?? {};
      if (/tram/.test(t.embedded_rails ?? '')) alreadyIds.add(w.id);
      if (w.id === SANITY_WAY && !sanityWay) {
        sanityWay = w;
        sanityInfo = `highway=${t.highway} embedded_rails=${t.embedded_rails ?? '-'} tunnel=${t.tunnel ?? '-'} name=${t.name ?? '-'} cell=${f}`;
      }
      if (!ROAD_HW.has(t.highway ?? '') || t.tunnel === 'yes' || /tram/.test(t.embedded_rails ?? '')) continue;
      const d = memo.get(w.id) ?? decide(grid, w);
      memo.set(w.id, d);
      if (!d.patch) continue;
      w.tags.embedded_rails = 'tram';
      w.tags['embedded_rails:source'] = d.source!;
      if (d.offsets.length) w.tags['embedded_rails:offsets'] = d.offsets.join(';');
      changed = true;
      if (!patched.has(w.id)) patched.set(w.id, { name: t.name ?? '(unnamed)', metres: Math.round(d.length), offsets: d.offsets, tol: d.tol, source: d.source! });
    }
    if (changed) {
      writeFileSync(join(OUT, 'cells', f), gzipSync(Buffer.from(JSON.stringify(j))));
      cellsChanged.push(f);
    }
  }

  const streets: Record<string, { ways: number; metres: number }> = {};
  for (const { name, metres } of patched.values()) {
    const s = streets[name] ?? { ways: 0, metres: 0 };
    s.ways++; s.metres += metres;
    streets[name] = s;
  }
  const sorted = Object.fromEntries(Object.entries(streets)
    .map(([k, v]) => [k, { ways: v.ways, metres: Math.round(v.metres) }] as const)
    .sort((a, b) => b[1].metres - a[1].metres));
  const patchedWays = [...patched.entries()].map(([id, p]) => ({ id, ...p })).sort((a, b) => b.metres - a.metres);

  const sanityD = sanityWay ? (memo.get(SANITY_WAY) ?? decide(grid, sanityWay)) : undefined;
  const sanityPatched = patched.has(SANITY_WAY);

  const report = {
    bbox: BBOX,
    thresholds: { stepM: STEP_M, minLenM: MIN_LEN_M, minShare: MIN_SHARE, trackTolM: [TOL_MIN_M, TOL_MAX_M], defaultHalfWidthM: DEFAULT_HALF_M, clusterGapM: CLUSTER_GAP_M, maxClusters: MAX_CLUSTERS, gridM: GRID_M },
    tramWaysFetched: els.length,
    tramWaysKept: tram.length,
    bgtTramLines: bgt.count,
    alreadyTagged: alreadyIds.size,
    candidatesEvaluated: memo.size,
    waysPatched: patched.size,
    cellsChanged,
    streets: sorted,
    patched: patchedWays,
    sanity: sanityD && { wayId: SANITY_WAY, cell: sanityInfo, patched: sanityPatched, share: sanityD.share, onTram: sanityD.onTram, stations: sanityD.stations, tol: sanityD.tol, offsets: sanityD.offsets, source: sanityD.source },
  };
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));

  console.log(JSON.stringify({ tramWaysKept: tram.length, bgtTramLines: bgt.count, candidatesEvaluated: report.candidatesEvaluated, alreadyTagged: report.alreadyTagged, waysPatched: report.waysPatched, cellsChanged: cellsChanged.length }));
  console.log('top 20 streets by metres:');
  for (const [name, v] of Object.entries(sorted).slice(0, 20)) console.log(`  ${name}: ${v.ways} ways, ${v.metres} m`);

  console.log(`sanity way ${SANITY_WAY}: ${sanityInfo || 'not present in any extract cell'}`);
  if (sanityD && sanityWay) {
    console.log(`  patched: ${sanityPatched}; share ${(sanityD.share * 100).toFixed(1)} % (${sanityD.onTram}/${sanityD.stations} stations); tol ${sanityD.tol} m; source ${sanityD.source ?? '-'}; offsets ${sanityD.offsets.join(';') || '-'}`);
    if (!sanityPatched) {
      const pts = sanityWay.g.map(([lng, lat]) => proj(lng, lat));
      const { stations } = stationsAlong(pts);
      console.log('  5 stations: along-m, nearest BGT track m, nearest any track m');
      for (let k = 0; k < 5; k++) {
        const idx = Math.round(k * (stations.length - 1) / 4);
        const p = stations[idx].p;
        console.log(`    ${(idx * STEP_M).toFixed(0)} m: BGT ${nearestTrack(grid, p, true).toFixed(2)}, any ${nearestTrack(grid, p, false).toFixed(2)}`);
      }
    }
  }
  console.log(`${SANITY_STREET} in streets: ${Object.keys(sorted).includes(SANITY_STREET)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
