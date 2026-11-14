/**
 * Measure the market lines for the Albert Cuypmarkt and the Ten Katemarkt (lane markets-20261114) and stage them.
 *
 *   node --import tsx scripts/markets/build-lines.ts            # staging: artifacts/markets/staging/{market-lines,report}.json
 *   node --import tsx scripts/markets/build-lines.ts --publish  # also writes scripts/data/markets/market-lines.json
 *   MARKETS=0 node --import tsx scripts/markets/build-lines.ts  # kill switch: stages an empty market list
 *
 * Sources (open data only; requests name the repo as contact):
 *   OSM (ODbL) via Overpass: the market areas (relation 7112728 "Albert Cuyp-markt", three member polygons broken at the
 *     crossings; way 78090886 "Ten Katemarkt") and the street centrelines.
 *   BGT wegdeel (PDOK OGC API, CC0): the cross-section at every station. Albert Cuypstraat: carriageway (rijbaan) ~5.5 m,
 *     a ~4.3 m paved market strip (BGT parkeervlak) each side, then the 3-3.5 m footway to the shops; the stalls stand on
 *     the strip facing the carriageway (2022-03-21 panoramas). Ten Katestraat north of Kinkerstraat: one 15 m pedestrian
 *     area (voetpad); the stalls stand either side of a clear centre aisle (2024-12-11 panoramas).
 *   Gemeente Amsterdam municipal tree inventory (the game's municipal-trees extract): trees break a run.
 *   Gemeente Amsterdam markets register (maps.amsterdam.nl open geodata MARKTEN): opening hours.
 * Panoramas (Gemeente Amsterdam, CC BY 4.0) set the stall frame (stallKit.ts) and the Ten Kate aisle width.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { MIN_DEPTH_M, placeAll, stallFootprint, type LngLat, type MarketLine, type MarketLinesFile, type MarketPaletteId, type MarketSide, type Weekday } from '../../src/canalRecall/markets/placer.ts';
import { STALL } from '../../src/canalRecall/markets/stallKit.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const CACHE = path.join(ROOT, '.cache/markets');
const STAGING = path.join(ROOT, 'artifacts/markets/staging');
const PUBLISH = path.join(ROOT, 'scripts/data/markets/market-lines.json');
const UA = 'map-recall2 market lines (+https://github.com/blackmad/map-recall2)';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const BGT = 'https://api.pdok.nl/lv/bgt/ogc/v1/collections/wegdeel/items';
const TREES = path.join(ROOT, 'public/data/extracts/amsterdam/municipal-trees');

type Mode =
  /** The aisle is the carriageway: the kerb is where BGT leaves the aisle classes; the strip is the next class run. */
  | { kind: 'carriageway'; aisle: string[]; strip: string[] }
  /** A pedestrian street: the aisle is a measured clear centre band; the strip runs on in the strip classes. */
  | { kind: 'centre-aisle'; aisleHalfM: number; strip: string[] };

type MarketConfig = {
  id: string; name: string; palette: MarketPaletteId; bbox: string;
  /** OSM area: a multipolygon relation or a closed way; its extent along the centreline bounds the stalls. */
  area: { type: 'relation' | 'way'; id: number };
  /** Centreline way ids, chained in order. */
  centreline: number[];
  mode: Mode;
  maxDepthM: number;
  vans: Record<'left' | 'right', ('start' | 'end')[]>;
  hours: Partial<Record<Weekday, [number, number]>>;
};

const SIX_DAYS = (open: number, close: number) => Object.fromEntries((['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as Weekday[]).map(d => [d, [open, close]])) as Partial<Record<Weekday, [number, number]>>;

export const MARKETS: MarketConfig[] = [
  {
    id: 'albert-cuyp', name: 'Albert Cuypmarkt', palette: 'cuyp', bbox: '4.8895,52.3545,4.9000,52.3576',
    area: { type: 'relation', id: 7112728 }, centreline: [7371794],
    mode: { kind: 'carriageway', aisle: ['rijbaan lokale weg', 'fietspad', 'OV-baan'], strip: ['parkeervlak'] },
    maxDepthM: 4.5,
    // The 2021-04-23 west-end capture: a coffee trailer and a van at the Ferdinand Bolstraat end of both rows.
    vans: { left: ['start', 'end'], right: ['start'] },
    // Register: Ma-Za 10.00-17.00 uur (OSM says Mo-Sa 09:00-17:00).
    hours: SIX_DAYS(10, 17),
  },
  {
    id: 'ten-kate', name: 'Ten Katemarkt', palette: 'tenkate', bbox: '4.8655,52.3650,4.8685,52.3685',
    // The pedestrian block from the Bellamystraat crossing to the Kinkerstraat crossing (way 7373352). North of
    // Bellamystraat the panoramas (2016-08-09, 2025-07-31) show only stray frames; south of Kinkerstraat the street
    // carries traffic and the 2025-07-31 capture shows market vans parked there, no stalls.
    area: { type: 'way', id: 78090886 }, centreline: [7373352],
    // The clear centre aisle in the 2024-12-11 capture is ~4.4 m (the tactile strip runs down it).
    mode: { kind: 'centre-aisle', aisleHalfM: 2.2, strip: ['voetpad', 'voetgangersgebied'] },
    maxDepthM: 3.2,
    vans: { left: [], right: [] },
    hours: SIX_DAYS(9, 18),
  },
];

const RAD = Math.PI / 180, KY = 110540;
const KX = (lat: number) => 111320 * Math.cos(lat * RAD);

async function fetchJson(url: string, init: RequestInit = {}): Promise<any> {
  for (let i = 0; ; i++) {
    const r = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers ?? {}) } });
    if (r.ok) return r.json();
    if (i > 3) throw new Error(`${r.status} ${url}`);
    await new Promise(res => setTimeout(res, 2000 * (i + 1)));
  }
}
async function cached(name: string, get: () => Promise<unknown>): Promise<any> {
  const file = path.join(CACHE, name);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const v = await get();
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(v));
  return v;
}

type Ring = [number, number][];
type Poly = { cls: string; rings: Ring[] };
const pip = (x: number, y: number, r: Ring): boolean => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const classAt = (polys: Poly[], lng: number, lat: number): string => {
  for (const p of polys) if (pip(lng, lat, p.rings[0]) && !p.rings.slice(1).some(h => pip(lng, lat, h))) return p.cls;
  return '';
};

async function bgtWegdeel(id: string, bbox: string): Promise<Poly[]> {
  const fc = await cached(`bgt-wegdeel-${id}.json`, async () => {
    const feats: any[] = [];
    let url: string | null = `${BGT}?bbox=${bbox}&f=json&limit=1000`;
    while (url) {
      const page = await fetchJson(url);
      feats.push(...page.features.filter((f: any) => f.properties.eind_registratie == null));
      url = page.links?.find((l: any) => l.rel === 'next')?.href ?? null;
    }
    return { type: 'FeatureCollection', retrieved: new Date().toISOString(), features: feats };
  });
  const out: Poly[] = [];
  for (const f of fc.features) {
    const g = f.geometry, polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
    for (const rings of polys) out.push({ cls: f.properties.functie, rings });
  }
  return out;
}

async function osm(): Promise<any> {
  const ids = MARKETS.flatMap(m => m.centreline).join(',');
  const q = `[out:json][timeout:60];(relation(7112728);way(78090886);way(id:${ids}););out geom;`;
  return cached('osm.json', () => fetchJson(OVERPASS, { method: 'POST', body: new URLSearchParams({ data: q }), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }));
}

function chain(ways: LngLat[][]): LngLat[] {
  let line = ways[0].slice();
  for (const w of ways.slice(1)) {
    const near = (a: LngLat, b: LngLat) => Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
    const last = line[line.length - 1];
    if (near(last, w[0])) line = line.concat(w.slice(1));
    else if (near(last, w[w.length - 1])) line = line.concat(w.slice(0, -1).reverse());
    else if (near(line[0], w[w.length - 1])) line = w.slice(0, -1).concat(line);
    else if (near(line[0], w[0])) line = w.slice(1).reverse().concat(line);
    else throw new Error('centreline ways do not join');
  }
  return line;
}

function trees(bbox: number[]): LngLat[] {
  const index = JSON.parse(fs.readFileSync(path.join(TREES, 'index.json'), 'utf8'));
  const out: LngLat[] = [];
  for (const t of index.tiles) {
    const [, x, y] = t.key.split('/').map(Number), n = 2 ** 15;
    const w = x / n * 360 - 180, e = (x + 1) / n * 360 - 180;
    const lat = (yy: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * yy / n))) / RAD;
    if (e < bbox[0] || w > bbox[2] || lat(y) < bbox[1] || lat(y + 1) > bbox[3]) continue;
    const tile = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(TREES, t.url))).toString('utf8'));
    for (const tr of tile.trees) if (tr.lng >= bbox[0] && tr.lng <= bbox[2] && tr.lat >= bbox[1] && tr.lat <= bbox[3]) out.push([tr.lng, tr.lat]);
  }
  return out;
}

const STEP = 0.5, SCAN_STEP = 0.25, SCAN_MAX = 16;
/** A tree within this distance of a stall's band (across) and along it breaks the run. */
const TREE_ACROSS_M = 0.6, TREE_ALONG_M = 1.0;
/** Runs end this far short of a crossing or tree (the frames' guy space). */
const RUN_END_MARGIN_M = 0.5;

type Station = { s: number; x: number; y: number; nx: number; ny: number };

export async function measure(cfg: MarketConfig, data: any): Promise<{ line: MarketLine; report: Record<string, unknown> }> {
  const byId = new Map<number, any>(data.elements.map((e: any) => [e.id, e]));
  const centre = chain(cfg.centreline.map(id => (byId.get(id)?.geometry ?? []).map((p: any) => [p.lon, p.lat] as LngLat)));
  const lng0 = centre[0][0], lat0 = centre[0][1], kx = KX(lat0);
  const loc = (p: LngLat): [number, number] => [(p[0] - lng0) * kx, (p[1] - lat0) * KY];
  const geo = (x: number, y: number): LngLat => [lng0 + x / kx, lat0 + y / KY];
  const pts = centre.map(loc), cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1];
  const at = (s: number): Station => {
    let i = 1; while (i < pts.length - 1 && cum[i] < s) i++;
    const a = pts[i - 1], b = pts[i], seg = cum[i] - cum[i - 1], t = (s - cum[i - 1]) / seg, tx = (b[0] - a[0]) / seg, ty = (b[1] - a[1]) / seg;
    return { s, x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, nx: -ty, ny: tx };
  };
  const project = (p: LngLat): number => {
    const [x, y] = loc(p); let best = Infinity, bs = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], seg = cum[i] - cum[i - 1], t = Math.max(0, Math.min(1, ((x - a[0]) * (b[0] - a[0]) + (y - a[1]) * (b[1] - a[1])) / (seg * seg)));
      const d = Math.hypot(x - a[0] - t * (b[0] - a[0]), y - a[1] - t * (b[1] - a[1]));
      if (d < best) { best = d; bs = cum[i - 1] + t * seg; }
    }
    return bs;
  };
  // The market area's extent along the centreline: one interval per member polygon.
  const area = byId.get(cfg.area.id);
  const areaRings: LngLat[][] = cfg.area.type === 'way' ? [area.geometry.map((p: any) => [p.lon, p.lat])] : area.members.filter((m: any) => m.role === 'outer').map((m: any) => m.geometry.map((p: any) => [p.lon, p.lat]));
  const areaRanges = areaRings.map(r => { const ss = r.map(project); return [Math.min(...ss), Math.max(...ss)] as [number, number]; }).sort((a, b) => a[0] - b[0]);
  const inArea = (s: number) => areaRanges.some(([a, b]) => s >= a && s <= b);

  const polys = await bgtWegdeel(cfg.id, cfg.bbox);
  const bb = cfg.bbox.split(',').map(Number), treePts = trees(bb).map(loc);
  const sides: MarketSide[] = [], report: Record<string, unknown> = { centrelineM: +total.toFixed(1), areaRanges: areaRanges.map(r => r.map(v => +v.toFixed(1))) };
  for (const [name, sign] of [['left', 1], ['right', -1]] as const) {
    // Per station: is a stall possible here, at which kerb offset, with how much depth.
    const stations: { st: Station; ok: boolean; inner: number | null; depth: number; why: string }[] = [];
    for (let s = 0; s <= total; s += STEP) {
      const st = at(s), cls = (o: number) => { const [lng, lat] = geo(st.x + st.nx * o * sign, st.y + st.ny * o * sign); return classAt(polys, lng, lat); };
      let inner: number | null = null, outer = 0, why = '';
      if (cfg.mode.kind === 'carriageway') {
        const aisle = cfg.mode.aisle, strip = cfg.mode.strip;
        if (!aisle.includes(cls(0))) why = 'centre not carriageway';
        else {
          let o = 0; while (o < SCAN_MAX && aisle.includes(cls(o))) o += SCAN_STEP;
          inner = o; while (o < SCAN_MAX && strip.includes(cls(o + SCAN_STEP / 2))) o += SCAN_STEP;
          outer = o; if (outer - inner < MIN_DEPTH_M) why = 'strip broken';
        }
      } else {
        const strip = cfg.mode.strip;
        if (!strip.includes(cls(0))) why = 'centre not pedestrian';
        else {
          inner = cfg.mode.aisleHalfM; let o = 0; while (o < SCAN_MAX && strip.includes(cls(o))) o += SCAN_STEP;
          outer = o; if (outer - inner < MIN_DEPTH_M) why = 'strip broken';
        }
      }
      if (!why && !inArea(s)) why = 'outside market area';
      const depth = inner === null ? 0 : Math.min(cfg.maxDepthM, outer - inner);
      if (!why && inner !== null) {
        const band0 = inner - TREE_ACROSS_M, band1 = inner + MIN_DEPTH_M + TREE_ACROSS_M;
        for (const [tx, ty] of treePts) {
          const dx = tx - st.x, dy = ty - st.y, along = dx * -st.ny + dy * st.nx, across = (dx * st.nx + dy * st.ny) * sign;
          if (Math.abs(along) <= TREE_ALONG_M && across >= band0 && across <= band1) { why = 'tree'; break; }
        }
      }
      stations.push({ st, ok: !why, inner, depth, why });
    }
    // Kerb offsets: a running median over ±3 m of the measured ones, carried across gaps (crossings).
    const known = stations.map(x => x.inner);
    const smooth = known.map((_, i) => {
      const w: number[] = []; for (let j = Math.max(0, i - 6); j <= Math.min(known.length - 1, i + 6); j++) if (known[j] !== null && stations[j].ok) w.push(known[j]!);
      return w.length ? w.sort((a, b) => a - b)[w.length >> 1] : null;
    });
    let last = smooth.find(v => v !== null) ?? 0;
    const offs = smooth.map(v => (v === null ? last : (last = v)));
    // Kerb polyline every 2 m (and its own arc length), runs mapped onto it.
    const kerbIdx: number[] = [];
    for (let i = 0; i < stations.length; i += 4) kerbIdx.push(i);
    if (kerbIdx[kerbIdx.length - 1] !== stations.length - 1) kerbIdx.push(stations.length - 1);
    const kerbLocal = kerbIdx.map(i => { const { st } = stations[i]; return [st.x + st.nx * offs[i] * sign, st.y + st.ny * offs[i] * sign] as [number, number]; });
    const kerbCum = [0]; for (let k = 1; k < kerbLocal.length; k++) kerbCum.push(kerbCum[k - 1] + Math.hypot(kerbLocal[k][0] - kerbLocal[k - 1][0], kerbLocal[k][1] - kerbLocal[k - 1][1]));
    const kerbS = (i: number): number => { // station index → kerb arc length (linear between kerb vertices)
      let k = 1; while (k < kerbIdx.length - 1 && kerbIdx[k] < i) k++;
      const t = (i - kerbIdx[k - 1]) / (kerbIdx[k] - kerbIdx[k - 1] || 1); return kerbCum[k - 1] + t * (kerbCum[k] - kerbCum[k - 1]);
    };
    const runs: [number, number][] = [], depths: number[] = [];
    for (let i = 0; i < stations.length;) {
      if (!stations[i].ok) { i++; continue; }
      let j = i; while (j + 1 < stations.length && stations[j + 1].ok) j++;
      const a = kerbS(i) + RUN_END_MARGIN_M, b = kerbS(j) - RUN_END_MARGIN_M;
      if (b - a >= STALL.length) { runs.push([+a.toFixed(2), +b.toFixed(2)]); for (let k = i; k <= j; k++) depths.push(stations[k].depth); }
      i = j + 1;
    }
    depths.sort((a, b) => a - b);
    const why: Record<string, number> = {}; for (const x of stations) if (!x.ok) why[x.why] = (why[x.why] ?? 0) + STEP;
    // The kerb line runs along the street; for the left side the aisle (carriageway / centre) lies to its right.
    sides.push({ side: name, kerb: kerbLocal.map(([x, y]) => geo(x, y).map(v => +v.toFixed(7)) as LngLat), aisle: sign === 1 ? -1 : 1, depthM: +(depths[Math.floor(depths.length * 0.05)] ?? 0).toFixed(2), runs, vans: cfg.vans[name] });
    report[name] = { runs: runs.length, runM: +runs.reduce((a, [p, q]) => a + q - p, 0).toFixed(1), depthP05: depths[Math.floor(depths.length * 0.05)], depthMedian: depths[depths.length >> 1], kerbOffsetMedian: [...offs].sort((a, b) => a - b)[offs.length >> 1], blockedM: why };
  }
  const line: MarketLine = { id: cfg.id, name: cfg.name, hours: cfg.hours, palette: cfg.palette, sides };
  // Clearance: no stall or van footprint (roof overhang included) may touch the carriageway / bike lane.
  const aisleClasses = cfg.mode.kind === 'carriageway' ? cfg.mode.aisle : ['rijbaan lokale weg', 'fietspad', 'OV-baan'];
  const { instances, stalls } = placeAll({ version: 1, sources: [], markets: [line] });
  let intrusions = 0;
  for (const i of instances) if (i.part === 'stall-frame') {
    const c = stallFootprint(i);
    for (let k = 0; k < 4; k++) for (let t = 0; t <= 1; t += 0.25) {
      const a = c[k], b = c[(k + 1) % 4], p: LngLat = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      if (aisleClasses.includes(classAt(polys, p[0], p[1]))) intrusions++;
    }
  }
  report.stalls = stalls.filter(s => s.goods !== 'van').length;
  report.vans = stalls.filter(s => s.goods === 'van').length;
  report.bySide = Object.fromEntries(sides.map(s => [s.side, stalls.filter(x => x.side === s.side && x.goods !== 'van').length]));
  report.aisleIntrusionSamples = intrusions;
  report.trees = treePts.length;
  return { line, report };
}

async function main(): Promise<void> {
  const publish = process.argv.includes('--publish');
  const off = process.env.MARKETS === '0';
  const data = off ? null : await osm();
  const markets: MarketLine[] = [], report: Record<string, unknown> = {};
  if (data) for (const cfg of MARKETS) { const r = await measure(cfg, data); markets.push(r.line); report[cfg.id] = r.report; }
  const file: MarketLinesFile = {
    version: 1,
    sources: [
      'OpenStreetMap contributors (ODbL): relation 7112728, way 78090886, centreline ways',
      'BGT wegdeel, PDOK OGC API (CC0)',
      'Gemeente Amsterdam municipal tree inventory (game extract municipal-trees)',
      'Gemeente Amsterdam markets register, maps.amsterdam.nl open geodata MARKTEN (hours)',
      'Gemeente Amsterdam panoramas (CC BY 4.0): stall frame, palettes, Ten Kate aisle',
    ],
    markets,
  };
  fs.mkdirSync(STAGING, { recursive: true });
  fs.writeFileSync(path.join(STAGING, 'market-lines.json'), JSON.stringify(file) + '\n');
  fs.writeFileSync(path.join(STAGING, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (publish) { fs.mkdirSync(path.dirname(PUBLISH), { recursive: true }); fs.writeFileSync(PUBLISH, JSON.stringify(file) + '\n'); console.log(`published ${path.relative(ROOT, PUBLISH)}`); }
}

if (process.argv[1]?.endsWith('build-lines.ts')) void main();
