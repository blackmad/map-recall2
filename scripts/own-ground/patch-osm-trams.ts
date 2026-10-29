// Tag road ways that carry tram track in OSM but lack `embedded_rails=tram`, so the
// own-ground road look draws rails only where the tram really runs (staging path first,
// then review and copy):
//
//   npx tsx scripts/own-ground/patch-osm-trams.ts            # fetch + write artifacts/own-ground/staging/own-ground-osm-v1-trams/
//   npx tsx scripts/own-ground/patch-osm-trams.ts --offline  # re-use the cached Overpass response
//   # review report.json, then copy the cells into public/data/extracts/amsterdam/own-ground-osm-v1/cells/
//
// A road way is patched when at least 70 % of its stations (every 2 m along the way) lie
// within 3 m of a tram way (`railway=tram`, minus `service=yard`). Patched ways get
// `embedded_rails=tram` and `embedded_rails:source=railway=tram`.
//
// Source: Overpass API (build time only). © OpenStreetMap contributors, ODbL.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { join } from 'node:path';
import type { OsmGroundExtract, OsmWay } from '../../src/canalRecall/ownGround/osmGround.ts';

const SRC = 'public/data/extracts/amsterdam/own-ground-osm-v1';
const OUT = 'artifacts/own-ground/staging/own-ground-osm-v1-trams';
const CACHE = 'artifacts/own-ground/raw/overpass-patch';
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const offline = process.argv.includes('--offline');

type Element = { type: 'way' | 'relation'; id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] };

async function overpass(label: string, query: string): Promise<Element[]> {
  const cached = join(CACHE, `${label}.json`);
  if (existsSync(cached)) return JSON.parse(readFileSync(cached, 'utf8')).elements;
  if (offline) throw new Error(`${label}: no cached response`);
  for (let attempt = 0; attempt < 24; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];
    let status = 0, text = '';
    try {
      const res = await fetch(endpoint, { method: 'POST', body: new URLSearchParams({ data: query }), headers: { 'User-Agent': 'map-recall-own-ground/1 (build script)' } });
      status = res.status; text = await res.text();
      if (res.ok && text.startsWith('{')) {
        const body = JSON.parse(text) as { elements: Element[]; remark?: string };
        if (!body.remark || !/error/i.test(body.remark)) { mkdirSync(CACHE, { recursive: true }); writeFileSync(cached, text); return body.elements; }
        text = body.remark;
      }
    } catch (error) { text = String(error); }
    console.warn(`${label} @ ${new URL(endpoint).host}: ${status} ${text.slice(0, 80).replace(/\s+/g, ' ')}, retrying`);
    await new Promise(r => setTimeout(r, 6_000));
  }
  throw new Error(`overpass ${label} failed`);
}

const BBOX = '52.27,4.70,52.44,5.11';
const LAT0 = 52.37;
const M_PER_DEG = 111320;
const KX = M_PER_DEG * Math.cos(LAT0 * Math.PI / 180);
const STEP_M = 2;
const NEAR_M = 3.0;
const MIN_LEN_M = 10;
const MIN_SHARE = 0.7;
const GRID_M = 20;
const ROAD_HW = new Set(['primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'residential', 'unclassified', 'living_street', 'service', 'busway', 'trunk', 'trunk_link', 'road', 'pedestrian']);
const SANITY_WAY = 323258151;
const SANITY_STREET = 'Jan Evertsenstraat';

type XY = [number, number];
type Seg = [number, number, number, number];

const proj = (lng: number, lat: number): XY => [lng * KX, lat * M_PER_DEG];

function segDist(p: XY, s: Seg): number {
  const [ax, ay, bx, by] = s;
  const vx = bx - ax, vy = by - ay;
  const l2 = vx * vx + vy * vy;
  const t = l2 === 0 ? 0 : Math.min(1, Math.max(0, ((p[0] - ax) * vx + (p[1] - ay) * vy) / l2));
  const dx = ax + t * vx - p[0], dy = ay + t * vy - p[1];
  return Math.sqrt(dx * dx + dy * dy);
}

// Tram segments bucketed on a GRID_M grid; a query looks at the 3x3 buckets around the point,
// which covers every segment within GRID_M of it.
class SegmentGrid {
  private cells = new Map<string, number[]>();
  private segs: Seg[] = [];
  add(a: XY, b: XY): void {
    const i = this.segs.length;
    this.segs.push([a[0], a[1], b[0], b[1]]);
    const x0 = Math.floor(Math.min(a[0], b[0]) / GRID_M), x1 = Math.floor(Math.max(a[0], b[0]) / GRID_M);
    const y0 = Math.floor(Math.min(a[1], b[1]) / GRID_M), y1 = Math.floor(Math.max(a[1], b[1]) / GRID_M);
    for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) {
      const k = `${ix},${iy}`;
      const bucket = this.cells.get(k);
      if (bucket) bucket.push(i); else this.cells.set(k, [i]);
    }
  }
  nearest(p: XY): number {
    const ix = Math.floor(p[0] / GRID_M), iy = Math.floor(p[1] / GRID_M);
    let best = Infinity;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const i of this.cells.get(`${ix + dx},${iy + dy}`) ?? []) best = Math.min(best, segDist(p, this.segs[i]));
    }
    return best;
  }
}

// Stations every STEP_M metres along the polyline, plus both ends.
function stationsAlong(pts: XY[]): { stations: XY[]; length: number } {
  const stations: XY[] = [pts[0]];
  let total = 0, target = STEP_M;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const l = Math.hypot(bx - ax, by - ay);
    if (l === 0) continue;
    while (target <= total + l) {
      const t = (target - total) / l;
      stations.push([ax + t * (bx - ax), ay + t * (by - ay)]);
      target += STEP_M;
    }
    total += l;
  }
  stations.push(pts[pts.length - 1]);
  return { stations, length: total };
}

type Decision = { patch: boolean; length: number; share: number; nearestMin: number; nearestMedian: number };

function decide(grid: SegmentGrid, w: OsmWay): Decision {
  const pts = w.g.map(([lng, lat]) => proj(lng, lat));
  const { stations, length } = stationsAlong(pts);
  const dists = stations.map(p => grid.nearest(p)).sort((a, b) => a - b);
  const onTram = dists.filter(d => d <= NEAR_M).length;
  const share = dists.length ? onTram / dists.length : 0;
  const nearestMedian = dists.length ? dists[Math.floor(dists.length / 2)] : Infinity;
  return { patch: length >= MIN_LEN_M && share >= MIN_SHARE, length, share, nearestMin: dists[0] ?? Infinity, nearestMedian };
}

async function main(): Promise<void> {
  const els = await overpass('railway-tram', `[out:json][timeout:240];way[railway=tram](${BBOX});out tags geom;`);
  const tram = els.filter(e => e.type === 'way' && e.geometry && e.geometry.length >= 2 && e.tags?.service !== 'yard');
  const grid = new SegmentGrid();
  for (const e of tram) {
    const pts = e.geometry!.map(p => proj(p.lon, p.lat));
    for (let i = 1; i < pts.length; i++) grid.add(pts[i - 1], pts[i]);
  }
  console.log(JSON.stringify({ tramWaysFetched: els.length, tramWaysKept: tram.length }));

  mkdirSync(join(OUT, 'cells'), { recursive: true });
  const memo = new Map<number, Decision>();
  const alreadyIds = new Set<number>();
  const patched = new Map<number, { name: string; metres: number }>();
  const cellsChanged: string[] = [];
  let sanityFound = false;
  let sanityDecision: Decision | undefined;
  let sanityInfo = '';

  for (const f of readdirSync(join(SRC, 'cells')).filter(n => n.endsWith('.json.gz')).sort()) {
    const j = JSON.parse(gunzipSync(readFileSync(join(SRC, 'cells', f))).toString('utf8')) as OsmGroundExtract;
    let changed = false;
    for (const w of j.ways) {
      const t = w.tags ?? {};
      if (/tram/.test(t.embedded_rails ?? '')) alreadyIds.add(w.id);
      if (w.id === SANITY_WAY) {
        sanityFound = true;
        sanityInfo = `highway=${t.highway} embedded_rails=${t.embedded_rails ?? '-'} tunnel=${t.tunnel ?? '-'} name=${t.name ?? '-'} cell=${f}`;
        sanityDecision = decide(grid, w);
      }
      if (!ROAD_HW.has(t.highway ?? '') || t.tunnel === 'yes' || /tram/.test(t.embedded_rails ?? '')) continue;
      const d = memo.get(w.id) ?? decide(grid, w);
      memo.set(w.id, d);
      if (!d.patch) continue;
      w.tags.embedded_rails = 'tram';
      w.tags['embedded_rails:source'] = 'railway=tram';
      changed = true;
      if (!patched.has(w.id)) patched.set(w.id, { name: t.name ?? '(unnamed)', metres: d.length });
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

  const report = {
    bbox: BBOX,
    thresholds: { stepM: STEP_M, nearM: NEAR_M, minLenM: MIN_LEN_M, minShare: MIN_SHARE, gridM: GRID_M },
    tramWaysFetched: els.length,
    tramWaysKept: tram.length,
    alreadyTagged: alreadyIds.size,
    candidatesEvaluated: memo.size,
    waysPatched: patched.size,
    cellsChanged,
    streets: sorted,
  };
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 1));

  console.log(JSON.stringify({ tramWaysFetched: report.tramWaysFetched, tramWaysKept: report.tramWaysKept, alreadyTagged: report.alreadyTagged, candidatesEvaluated: report.candidatesEvaluated, waysPatched: report.waysPatched, cellsChanged: cellsChanged.length }));
  console.log('top streets by metres:');
  for (const [name, v] of Object.entries(sorted).slice(0, 15)) console.log(`  ${name}: ${v.ways} ways, ${v.metres} m`);

  const sanityPatched = patched.has(SANITY_WAY);
  console.log(`sanity way ${SANITY_WAY} patched: ${sanityPatched}`);
  if (!sanityFound) console.log(`sanity way ${SANITY_WAY}: not present in any extract cell`);
  else {
    console.log(`  ${sanityInfo}`);
    if (sanityDecision) console.log(`  length ${sanityDecision.length.toFixed(1)} m, on-tram share ${(sanityDecision.share * 100).toFixed(1)} %, nearest tram min ${sanityDecision.nearestMin.toFixed(2)} m, median ${sanityDecision.nearestMedian.toFixed(2)} m`);
  }
  console.log(`${SANITY_STREET} in streets: ${Object.keys(sorted).includes(SANITY_STREET)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
