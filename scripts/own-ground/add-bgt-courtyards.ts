// Build the courtyards-v1 extract: the BGT terrain of block interiors (courtyards, back gardens) per own-ground 1 km
// cell, kept apart from the OSM cells (ride review 2026-10-14 row J4: Jordaan inner gardens drew as bare sand land, so closed blocks
// read as public squares). docs/bgt-courtyards-20261014.md; the classification is src/canalRecall/ownGround/courtyards.ts.
//
//   npx tsx scripts/own-ground/add-bgt-courtyards.ts --raw <empty scratch dir> [--cells k1,k2] [--concurrency 4]
//       fetch (cached in --raw) + classify; writes the patched cells and report.json to the staging directory
//   npx tsx scripts/own-ground/add-bgt-courtyards.ts --raw <dir> --offline     # cached responses only
//   npx tsx scripts/own-ground/add-bgt-courtyards.ts --publish                 # after review: staging → public/data/extracts/amsterdam/courtyards-v1 (cells.json carries provenance)
//
// Sources (open data):
//   BGT (Kadaster / gemeente Amsterdam, CC0 1.0) via the PDOK OGC API https://api.pdok.nl/lv/bgt/ogc/v1:
//     begroeidterreindeel, onbegroeidterreindeel, ondersteunendwegdeel (the candidates), pand (closes a ray), waterdeel (opens one)
//   PDOK Luchtfoto CIR (Beeldmateriaal Nederland, CC BY 4.0), WMS https://service.pdok.nl/hwh/luchtfotocir/wms/v1_0
//     layer IMAGERY_LAYER at 0.5 m: the vegetated share of each `erf` (yard), which BGT leaves untyped
//   OSM streets (ODbL): the ways already in the published cells (open a ray)
// Idempotent: the extract is rebuilt whole; the report diffs each cell against the published one (id:class). An area belongs to the cell of its interior point.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { join } from 'node:path';
import sharp from 'sharp';
import { cellBounds, elevationIndex } from './game-cells.ts';
import { cellKey, lngLatToLocal } from '../../src/canalRecall/elevation/elevationData.ts';
import { fromLocal, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { encodeLine, inRings, interiorPoint, polygonArea } from '../../src/canalRecall/ownGround/parks.ts';
import type { OsmGroundExtract } from '../../src/canalRecall/ownGround/osmGround.ts';
import { COURTYARD_SURFACES, OPENING_HIGHWAYS, SegmentIndex, closedRays, courtyardSurface, MIN_CLOSED, pixelVegetated, segmentsOf, vegetatedShare, RAY_M, VEGETATED, type BgtProps, type CourtyardSurface, type CourtyardsCell, type CourtyardsManifest, type Segment } from '../../src/canalRecall/ownGround/courtyards.ts';
import type { Vec2 } from '../../src/canalRecall/ownGround/surface.ts';

type LngLat = [number, number];
const EXTRACT = 'public/data/extracts/amsterdam/own-ground-osm-v1';
const STAGING = 'artifacts/own-ground/staging/courtyards-v1';
const PUBLISHED = 'public/data/extracts/amsterdam/courtyards-v1';
const API = 'https://api.pdok.nl/lv/bgt/ogc/v1/collections';
const WMS = 'https://service.pdok.nl/hwh/luchtfotocir/wms/v1_0';
export const IMAGERY_LAYER = '2025_ortho25IR';
const CANDIDATES = ['begroeidterreindeel', 'onbegroeidterreindeel', 'ondersteunendwegdeel'] as const;
const CONTEXT = ['pand', 'waterdeel'] as const;
type Collection = typeof CANDIDATES[number] | typeof CONTEXT[number];
const NOW = '2026-10-14T00:00:00Z';
const PAD_M = RAY_M + 10;
/** Douglas–Peucker tolerance for the published rings, metres. */
const SIMPLIFY_M = 0.15;
const IMAGE_M_PER_PX = 0.5;

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const offline = process.argv.includes('--offline');
const publish = process.argv.includes('--publish');
const RAW = arg('--raw');
const index = elevationIndex();
const manifest = JSON.parse(readFileSync(join(EXTRACT, 'cells.json'), 'utf8')) as { cells: string[]; [k: string]: unknown };
const cellOf = (lng: number, lat: number) => { const [x, y] = lngLatToLocal(index, lng, lat); return cellKey(Math.floor(x / index.cellSizeM), Math.floor(y / index.cellSizeM)); };
const readCourtyards = (dir: string, key: string): CourtyardsCell | null => { const f = join(dir, 'cells', `${key}.json.gz`); return existsSync(f) ? JSON.parse(gunzipSync(readFileSync(f)).toString('utf8')) : null; };
const readCell = (dir: string, key: string): OsmGroundExtract | null => { const f = join(dir, 'cells', `${key}.json.gz`); return existsSync(f) ? JSON.parse(gunzipSync(readFileSync(f)).toString('utf8')) : null; };

// ------------------------------------------------------------------ fetch (cached)

interface BgtItem { id: string; c: Collection; props: Record<string, string | number>; geom: { type: string; coordinates: any } }
const KEEP_PROPS = ['fysiek_voorkomen', 'plus_fysiek_voorkomen', 'functie', 'relatieve_hoogteligging'];
let requests = 0, bytesIn = 0;

async function getJson(url: string): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'map-recall-own-ground/1 (build script)' } });
      if (res.ok) { const t = await res.text(); requests++; bytesIn += t.length; return JSON.parse(t); }
      if (attempt > 6 || (res.status < 500 && res.status !== 429)) throw new Error(`${res.status} ${url}`);
    } catch (e) { if (attempt > 6) throw e; }
    await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
  }
}

async function fetchBgt(key: string, c: Collection, bbox: number[]): Promise<BgtItem[]> {
  const file = join(RAW!, 'bgt', key, `${c}.json.gz`);
  if (existsSync(file)) return JSON.parse(gunzipSync(readFileSync(file)).toString());
  if (offline) return [];
  const out: BgtItem[] = [];
  let url: string | null = `${API}/${c}/items?f=json&limit=1000&datetime=${NOW}&bbox=${bbox.map(v => v.toFixed(6)).join(',')}`;
  while (url) {
    const j = await getJson(url);
    for (const f of j.features as any[]) {
      const p = f.properties;
      if (p.eind_registratie && p.eind_registratie < NOW) continue;
      if (p.status && p.status !== 'bestaand') continue;
      // Only the outline matters for buildings and water.
      const props = c === 'pand' || c === 'waterdeel' ? {} : Object.fromEntries(KEEP_PROPS.filter(k => p[k] !== undefined && p[k] !== null).map(k => [k, p[k]]));
      out.push({ id: p.lokaal_id ?? f.id, c, props, geom: f.geometry });
    }
    url = (j.links as any[]).find(l => l.rel === 'next')?.href ?? null;
  }
  mkdirSync(join(RAW!, 'bgt', key), { recursive: true });
  writeFileSync(file, gzipSync(JSON.stringify(out)));
  return out;
}

// Web Mercator (the WMS is asked in EPSG:3857; conformal, so a 500 m tile is square in pixels at 0.5 m).
const merc = (lng: number, lat: number): Vec2 => [lng * 20037508.342789244 / 180, Math.log(Math.tan((90 + lat) * Math.PI / 360)) * 6378137];

interface Tile { x0: number; y0: number; x1: number; y1: number; w: number; h: number; px: Buffer }
async function fetchTile(key: string, q: number, lngLat: number[]): Promise<Tile | null> {
  const [a, b] = [merc(lngLat[0], lngLat[1]), merc(lngLat[2], lngLat[3])];
  const scale = 1 / Math.cos(((lngLat[1] + lngLat[3]) / 2) * Math.PI / 180);
  const w = Math.round((b[0] - a[0]) / (IMAGE_M_PER_PX * scale)), h = Math.round((b[1] - a[1]) / (IMAGE_M_PER_PX * scale));
  const file = join(RAW!, 'cir', key, `${q}.jpg`);
  if (!existsSync(file)) {
    if (offline) return null;
    const url = `${WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${IMAGERY_LAYER}&STYLES=&CRS=EPSG:3857&BBOX=${[a[0], a[1], b[0], b[1]].map(v => v.toFixed(2)).join(',')}&WIDTH=${w}&HEIGHT=${h}&FORMAT=image/jpeg`;
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url).catch(() => null);
      // The body can still be cut off (ECONNRESET) after the headers: retried like a failed request.
      const buf = res?.ok && (res.headers.get('content-type') ?? '').startsWith('image/') ? await res.arrayBuffer().then(b => Buffer.from(b)).catch(() => null) : null;
      if (buf) { requests++; bytesIn += buf.length; mkdirSync(join(RAW!, 'cir', key), { recursive: true }); writeFileSync(file, buf); break; }
      if (attempt > 5) throw new Error(`CIR ${res?.status} ${url}`);
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  const { data, info } = await sharp(readFileSync(file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { x0: a[0], y0: a[1], x1: b[0], y1: b[1], w: info.width, h: info.height, px: data };
}

// ------------------------------------------------------------------ geometry

const polygonsOf = (g: BgtItem['geom']): LngLat[][][] => g.type === 'MultiPolygon' ? g.coordinates : g.type === 'Polygon' ? [g.coordinates] : [];

function simplify(pts: Vec2[], tol: number): Vec2[] {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    const [ax, ay] = pts[i], [bx, by] = pts[j], dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
    let best = -1, at = -1;
    for (let k = i + 1; k < j; k++) { const d = Math.abs((pts[k][0] - ax) * dy - (pts[k][1] - ay) * dx) / l; if (d > best) { best = d; at = k; } }
    if (best > tol) { keep[at] = 1; stack.push([i, at], [at, j]); }
  }
  return pts.filter((_, k) => keep[k]);
}

/** A closed ring (last point repeats the first) simplified in two halves, so its ends stay put. */
function simplifyRing(r: Vec2[]): Vec2[] {
  if (r.length < 6) return r;
  const mid = r.length >> 1;
  return [...simplify(r.slice(0, mid + 1), SIMPLIFY_M).slice(0, -1), ...simplify(r.slice(mid), SIMPLIFY_M)];
}

/** Pixel counts of a polygon (lng/lat rings) in the tiles: vegetated, bare, shadow. */
function pixelCounts(rings: LngLat[][], tiles: Tile[]) {
  const counts = { veg: 0, bare: 0, shadow: 0 };
  const m = rings.map(r => r.map(([lng, lat]) => merc(lng, lat)));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of m[0]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  for (const t of tiles) {
    if (x1 < t.x0 || x0 > t.x1 || y1 < t.y0 || y0 > t.y1) continue;
    const sx = (t.x1 - t.x0) / t.w, sy = (t.y1 - t.y0) / t.h;
    const i0 = Math.max(0, Math.floor((x0 - t.x0) / sx)), i1 = Math.min(t.w - 1, Math.ceil((x1 - t.x0) / sx));
    const j0 = Math.max(0, Math.floor((t.y1 - y1) / sy)), j1 = Math.min(t.h - 1, Math.ceil((t.y1 - y0) / sy));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = t.x0 + (i + 0.5) * sx, y = t.y1 - (j + 0.5) * sy;
      if (!inRings(m, x, y)) continue;
      const o = (j * t.w + i) * 3, v = pixelVegetated(t.px[o], t.px[o + 1], t.px[o + 2]);
      if (v === null) counts.shadow++; else if (v) counts.veg++; else counts.bare++;
    }
  }
  return counts;
}

// ------------------------------------------------------------------ per cell

interface CellReport { key: string; candidates: number; interior: number; skippedUnderOsm: number; erfUnknown: number; added: number; removed: number; kept: number; m2: Partial<Record<CourtyardSurface, number>>; bytes: number; ms: number }

interface CellContext { items: BgtItem[]; pands: Vec2[][][]; rays: SegmentIndex; underOsm: (x: number, y: number) => boolean; bounds: number[] }

/** A cell's candidates (BGT terrain touching it) and what the interior test needs (buildings, water and streets around it). */
async function cellContext(key: string): Promise<CellContext> {
  const [lo, la, hi, ha] = cellBounds(index, key);
  const padLng = PAD_M / 68000, padLat = PAD_M / 111300;
  const items: BgtItem[] = [];
  for (const c of CANDIDATES) items.push(...await fetchBgt(key, c, [lo, la, hi, ha]));
  const context: BgtItem[] = [];
  for (const c of CONTEXT) context.push(...await fetchBgt(key, c, [lo - padLng, la - padLat, hi + padLng, ha + padLat]));
  // Ray segments: building edges close, water edges and OSM street centrelines open.
  const segs: Segment[] = [], pands: Vec2[][][] = [];
  for (const it of context) for (const poly of polygonsOf(it.geom)) {
    const local = poly.map(r => r.map(([x, y]) => toLocal(x, y)));
    if (it.c === 'pand') pands.push(local);
    for (const r of local) segs.push(...segmentsOf(r, it.c === 'pand'));
  }
  const around: OsmGroundExtract[] = [];
  const [cx, cy] = key.split('_').map(Number);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const c = readCell(EXTRACT, `${cx + i}_${cy + j}`); if (c) around.push(c); }
  const seenWay = new Set<number>();
  for (const o of around) for (const w of o.ways) {
    if (seenWay.has(w.id) || !OPENING_HIGHWAYS.has(w.tags.highway ?? '') || w.tags.tunnel === 'yes' || w.tags.area === 'yes') continue;
    seenWay.add(w.id);
    segs.push(...segmentsOf(w.g.map(([x, y]) => toLocal(x, y)), false));
  }
  // What the OSM areas already paint is left to them.
  const osmRings = around.flatMap(o => o.areas.flatMap(a => a.rings.map(r => r.map(([x, y]) => toLocal(x, y)))))
    .map(r => ({ r, b: [Math.min(...r.map(p => p[0])), Math.min(...r.map(p => p[1])), Math.max(...r.map(p => p[0])), Math.max(...r.map(p => p[1]))] }));
  const underOsm = (x: number, y: number) => osmRings.some(({ r, b }) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3] && inRings([r], x, y));
  return { items, pands, rays: new SegmentIndex(segs), underOsm, bounds: [lo, la, hi, ha] };
}

async function cell(key: string): Promise<CellReport> {
  const t0 = Date.now();
  const { items, rays, underOsm, bounds: [lo, la, hi, ha] } = await cellContext(key);

  const rep: CellReport = { key, candidates: 0, interior: 0, skippedUnderOsm: 0, erfUnknown: 0, added: 0, removed: 0, kept: 0, m2: {}, bytes: 0, ms: 0 };
  const picked: { it: BgtItem; rings: LngLat[][]; local: Vec2[][]; erf: boolean }[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    if (Number(it.props.relatieve_hoogteligging ?? 0) !== 0) continue;
    polygonsOf(it.geom).forEach((poly, n) => {
      const id = `${it.id}${n ? `.${n}` : ''}`;
      if (seen.has(id)) return;
      seen.add(id);
      const local = poly.map(r => r.map(([x, y]) => toLocal(x, y)));
      const at = interiorPoint(local);
      if (!at) return;
      // The cell of the interior point owns the area (the fetch is by bbox, so straddlers come twice).
      if (cellOfLocal(at) !== key) return;
      // A class we never draw is not a candidate (e.g. 'transitie', 'kering').
      if (courtyardSurface(it.c, it.props as any, 0) === null && courtyardSurface(it.c, it.props as any, 1) === null) return;
      rep.candidates++;
      if (closedRays(rays, at[0], at[1]) < MIN_CLOSED) return;
      if (underOsm(at[0], at[1])) { rep.skippedUnderOsm++; return; }
      rep.interior++;
      picked.push({ it, rings: poly, local, erf: String(it.props.fysiek_voorkomen ?? '') === 'erf' });
    });
  }
  // The aerial, only where a yard needs it (quadrants of the cell).
  const tiles: Tile[] = [];
  if (picked.some(p => p.erf)) {
    const mx = (lo + hi) / 2, my = (la + ha) / 2;
    const quads = [[lo, la, mx, my], [mx, la, hi, my], [lo, my, mx, ha], [mx, my, hi, ha]];
    const pad = 30 / 68000, padY = 30 / 111300;
    for (let q = 0; q < 4; q++) {
      const [a, b, c, d] = quads[q];
      if (!picked.some(p => p.erf && p.rings[0].some(([x, y]) => x >= a - pad && x <= c + pad && y >= b - padY && y <= d + padY))) continue;
      const t = await fetchTile(key, q, [a - pad, b - padY, c + pad, d + padY]);
      if (t) tiles.push(t);
    }
  }
  const fresh: CourtyardsCell['areas'] = [];
  for (const p of picked) {
    const share = p.erf ? vegetatedShare(pixelCounts(p.rings, tiles)) : null;
    const k = courtyardSurface(p.it.c, p.it.props as BgtProps, share);
    if (!k) { if (p.erf) rep.erfUnknown++; continue; }
    const rings = p.local.map(simplifyRing).filter(r => r.length >= 4);
    if (!rings.length) continue;
    rep.m2[k] = (rep.m2[k] ?? 0) + polygonArea(rings);
    fresh.push({ id: p.it.id, k, r: rings.map(encodeLine) });
  }
  // Stage the cell (its courtyards replaced as a whole); the diff is against the published cell.
  const before = new Set(readCourtyards(PUBLISHED, key)?.areas.map(a => `${a.id}:${a.k}`) ?? []), after = new Set(fresh.map(a => `${a.id}:${a.k}`));
  rep.removed = [...before].filter(id => !after.has(id)).length;
  rep.added = [...after].filter(id => !before.has(id)).length;
  rep.kept = [...after].filter(id => before.has(id)).length;
  if (fresh.length) {
    const out: CourtyardsCell = { version: 1, key, areas: fresh };
    mkdirSync(join(STAGING, 'cells'), { recursive: true });
    const bytes = gzipSync(JSON.stringify(out), { level: 9 });
    writeFileSync(join(STAGING, 'cells', `${key}.json.gz`), bytes);
    rep.bytes = bytes.length;
  }
  for (const k of Object.keys(rep.m2) as CourtyardSurface[]) rep.m2[k] = Math.round(rep.m2[k]!);
  rep.ms = Date.now() - t0;
  return rep;
}

const fromLocalLngLat = (x: number, y: number): LngLat => fromLocal(x, y) as LngLat;
const cellOfLocal = (p: Vec2) => { const q = fromLocalLngLat(p[0], p[1]); return cellOf(q[0], q[1]); };

// ------------------------------------------------------------------ main

/**
 * The named regression's probes (check-ground-cells.ts courtyardRegressions): a PROBE_STEP_M grid over a box, kept where
 * the ground is open BGT terrain (any terrain class, not a pand) in a block interior by the same ray test. Whatever the
 * ground draws there is measured: OSM gardens, courtyards, and the land left where an erf stayed unknown.
 */
const PROBE_STEP_M = 4;
async function writeProbes(box: number[], out: string): Promise<void> {
  const [x0, y0] = toLocal(box[0], box[1]), [x1, y1] = toLocal(box[2], box[3]);
  const keys = new Set<string>();
  for (const [lng, lat] of [[box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]]]) keys.add(cellOf(lng, lat));
  const ctx = await Promise.all([...keys].map(cellContext));
  type Poly = { rings: Vec2[][]; b: number[] };
  const bbox = (rings: Vec2[][]) => [Math.min(...rings[0].map(p => p[0])), Math.min(...rings[0].map(p => p[1])), Math.max(...rings[0].map(p => p[0])), Math.max(...rings[0].map(p => p[1]))];
  const terrain: Poly[] = [], pands: Poly[] = [];
  for (const c of ctx) {
    for (const it of c.items) if (Number(it.props.relatieve_hoogteligging ?? 0) === 0) for (const poly of polygonsOf(it.geom)) { const rings = poly.map(r => r.map(([x, y]) => toLocal(x, y))); terrain.push({ rings, b: bbox(rings) }); }
    for (const rings of c.pands) pands.push({ rings, b: bbox(rings) });
  }
  const hit = (list: Poly[], x: number, y: number) => list.some(p => x >= p.b[0] && x <= p.b[2] && y >= p.b[1] && y <= p.b[3] && inRings(p.rings, x, y));
  const probes: [number, number][] = [];
  for (let x = Math.ceil(x0 / PROBE_STEP_M) * PROBE_STEP_M; x <= x1; x += PROBE_STEP_M) for (let y = Math.ceil(y0 / PROBE_STEP_M) * PROBE_STEP_M; y <= y1; y += PROBE_STEP_M) {
    if (!hit(terrain, x, y) || hit(pands, x, y)) continue;
    const c = ctx[[...keys].indexOf(cellOfLocal([x, y]))] ?? ctx[0];
    if (closedRays(c.rays, x, y) >= MIN_CLOSED) probes.push([Math.round(x * 10), Math.round(y * 10)]);
  }
  writeFileSync(out, JSON.stringify({ what: 'J4 courtyard probes: open BGT terrain in block interiors (add-bgt-courtyards.ts --probes), local frame decimetres', box, stepM: PROBE_STEP_M, minClosed: MIN_CLOSED, probes }) + '\n');
  console.log(`${probes.length} probes → ${out}`);
}

async function main(): Promise<void> {
  const probeBox = arg('--probes');
  if (probeBox) { if (!RAW) throw new Error('--raw is required'); await writeProbes(probeBox.split(',').map(Number), arg('--out') ?? 'scripts/own-ground/j4-courtyard-probes.json'); return; }
  if (publish) {
    // The staged extract replaces the published one whole (cells with no courtyard are not written).
    const report = JSON.parse(readFileSync(join(STAGING, 'report.json'), 'utf8')) as { provenance: Record<string, unknown>; cells: CellReport[] };
    rmSync(PUBLISHED, { recursive: true, force: true });
    mkdirSync(join(PUBLISHED, 'cells'), { recursive: true });
    const cells = report.cells.filter(r => r.bytes > 0).map(r => r.key);
    for (const k of cells) copyFileSync(join(STAGING, 'cells', `${k}.json.gz`), join(PUBLISHED, 'cells', `${k}.json.gz`));
    const out: CourtyardsManifest = { version: 1, cells, provenance: report.provenance };
    writeFileSync(join(PUBLISHED, 'cells.json'), JSON.stringify(out, null, 1) + '\n');
    console.log(`published ${cells.length} cells to ${PUBLISHED}`);
    return;
  }
  if (!RAW) throw new Error('--raw <empty download directory> is required');
  const only = arg('--cells')?.split(',');
  const keys = only ?? manifest.cells;
  if (!only) rmSync(STAGING, { recursive: true, force: true });
  const todo = [...keys], reports: CellReport[] = [];
  const t0 = Date.now();
  await Promise.all(Array.from({ length: Number(arg('--concurrency') ?? 4) }, async () => {
    for (let k = todo.shift(); k; k = todo.shift()) {
      const r = await cell(k);
      reports.push(r);
      const veg = COURTYARD_SURFACES.filter(s => VEGETATED.has(s)).reduce((s, c) => s + (r.m2[c] ?? 0), 0), all = Object.values(r.m2).reduce((s, v) => s + v!, 0);
      console.log(`${k.padEnd(7)} ${String(r.candidates).padStart(6)} candidates, ${String(r.interior).padStart(5)} interior, +${r.added} -${r.removed} =${r.kept}, ${(all / 1e4).toFixed(2)} ha (${all ? Math.round(veg / all * 100) : 0} % vegetated), ${r.ms} ms [${reports.length}/${keys.length}, ${Math.round((Date.now() - t0) / 1000)} s, ${requests} requests, ${(bytesIn / 1048576).toFixed(0)} MB]`);
    }
  }));
  reports.sort((a, b) => a.key.localeCompare(b.key));
  const total: Partial<Record<CourtyardSurface, number>> = {};
  for (const r of reports) for (const [k, v] of Object.entries(r.m2)) total[k as CourtyardSurface] = (total[k as CourtyardSurface] ?? 0) + v!;
  const sum = (f: (r: CellReport) => number) => reports.reduce((s, r) => s + f(r), 0);
  const provenance = {
    added: '2026-10-14', script: 'scripts/own-ground/add-bgt-courtyards.ts', doc: 'docs/bgt-courtyards-20261014.md',
    bgt: { source: 'BGT via PDOK OGC API https://api.pdok.nl/lv/bgt/ogc/v1', licence: 'CC0 1.0', datetime: NOW, collections: [...CANDIDATES, ...CONTEXT] },
    imagery: { source: `PDOK Luchtfoto CIR WMS ${WMS}`, layer: IMAGERY_LAYER, metresPerPixel: IMAGE_M_PER_PX, licence: 'CC BY 4.0 (Beeldmateriaal Nederland)', use: 'vegetated share of BGT erf (yard) polygons' },
    osm: '© OpenStreetMap contributors (ODbL): street centrelines for the block-interior test',
  };
  const report = { provenance, cells: reports, totals: { cells: reports.length, candidates: sum(r => r.candidates), interior: sum(r => r.interior), skippedUnderOsm: sum(r => r.skippedUnderOsm), erfUnknown: sum(r => r.erfUnknown), added: sum(r => r.added), removed: sum(r => r.removed), kept: sum(r => r.kept), m2: total, requests, MB: +(bytesIn / 1048576).toFixed(1), extractKB: Math.round(sum(r => r.bytes) / 1024) } };
  mkdirSync(STAGING, { recursive: true });
  writeFileSync(join(STAGING, 'report.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report.totals));
}

void main();
