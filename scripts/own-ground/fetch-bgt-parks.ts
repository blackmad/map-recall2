// Build the parks-v1 extract (lane parks 2026-10-13, docs/handoffs/lane-parks-20261013.md):
// BGT park surfaces, hedges, fences, lamps and OSM benches / playground equipment inside
// OSM parks, public gardens and playgrounds, per own-ground 1 km cell, only for cells
// that hold a park. Staged first, published after review:
//
//   npx tsx scripts/own-ground/fetch-bgt-parks.ts             # osmium + PDOK fetch (cached) + build
//   npx tsx scripts/own-ground/fetch-bgt-parks.ts --offline   # cached responses only
//   # review artifacts/own-ground/staging/parks-v1/report.json, then
//   rm -rf public/data/extracts/amsterdam/parks-v1 && cp -R artifacts/own-ground/staging/parks-v1 public/data/extracts/amsterdam/
//
// Sources (open data only):
//   BGT (Kadaster, CC0 1.0) via the PDOK OGC API https://api.pdok.nl/lv/bgt/ogc/v1:
//     begroeidterreindeel, onbegroeidterreindeel, wegdeel, waterdeel, vegetatieobject_vlak (haag),
//     scheiding_lijn (hek, muur), paal (lichtmast), pand (vetoes placed furniture)
//   OSM (ODbL) from the cached .cache/osm-source/Amsterdam.osm.pbf via osmium: leisure=park|garden|playground,
//     barrier=hedge|fence|wall, amenity=bench, playground=*, highway paths.
// Caches (not committed): artifacts/own-ground/raw/parks/ (osmium), artifacts/own-ground/raw/bgt-parks/ (PDOK).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { cellBounds, elevationIndex } from './game-cells.ts';
import { cellKey, lngLatToLocal } from '../../src/canalRecall/elevation/elevationData.ts';
import { fromLocal, toLocal } from '../../src/canalRecall/ownGround/groundStore.ts';
import { benchesAlong, bgtParkSurface, encodeLine, distToLine, inRings, interiorPoint, playgroundKit, playgroundPiece, polygonArea, type ParkPointKind, type ParkSurface, type ParksCell, type ParksManifest } from '../../src/canalRecall/ownGround/parks.ts';

type Vec2 = [number, number];
type LngLat = [number, number];

const OSM_SOURCE = '.cache/osm-source/Amsterdam.osm.pbf';
const RAW = 'artifacts/own-ground/raw/parks';
const BGT_RAW = 'artifacts/own-ground/raw/bgt-parks';
const OUT = 'artifacts/own-ground/staging/parks-v1';
const API = 'https://api.pdok.nl/lv/bgt/ogc/v1/collections';
const COLLECTIONS = ['begroeidterreindeel', 'onbegroeidterreindeel', 'wegdeel', 'waterdeel', 'vegetatieobject_vlak', 'scheiding_lijn', 'paal', 'pand'] as const;
type Collection = typeof COLLECTIONS[number];
const offline = process.argv.includes('--offline');
const onlyCells = (() => { const i = process.argv.indexOf('--cells'); return i > 0 ? new Set(process.argv[i + 1].split(',')) : null; })();
const NOW = new Date().toISOString().slice(0, 10) + 'T00:00:00Z';

// ------------------------------------------------------------------ OSM

interface GeoFeature { id: string; properties: Record<string, string>; geometry: { type: string; coordinates: any } }

function osmFeatures(): GeoFeature[] {
  const file = `${RAW}/park-osm.geojson`;
  if (!existsSync(file)) {
    mkdirSync(RAW, { recursive: true });
    const index = JSON.parse(readFileSync('public/data/extracts/amsterdam/own-ground-osm-v1/cells.json', 'utf8')) as { bbox: number[] };
    const run = (args: string[]) => execFileSync('osmium', args, { stdio: 'inherit' });
    run(['extract', OSM_SOURCE, '-b', index.bbox.map(v => v.toFixed(4)).join(','), '-o', `${RAW}/area.pbf`, '--overwrite']);
    run(['tags-filter', `${RAW}/area.pbf`, 'wr/leisure=park,garden,playground', 'nwr/barrier=hedge,fence,wall', 'nwr/amenity=bench', 'nwr/playground',
      'nw/highway=footway,path,cycleway,pedestrian,bridleway,track', 'nwr/amenity=toilets', '-o', `${RAW}/park-osm.pbf`, '--overwrite']);
    run(['export', `${RAW}/park-osm.pbf`, '-u', 'type_id', '-o', file, '--overwrite']);
  }
  return (JSON.parse(readFileSync(file, 'utf8')) as { features: GeoFeature[] }).features;
}

const polygonsOf = (g: GeoFeature['geometry']): LngLat[][][] => g.type === 'MultiPolygon' ? g.coordinates : g.type === 'Polygon' ? [g.coordinates] : [];
const linesOf = (g: GeoFeature['geometry']): LngLat[][] => g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];

/** A public garden: municipal / public / community / street-side, open access, or named; never a back garden or a roof. */
function publicGarden(t: Record<string, string>): boolean {
  if (['private', 'no', 'customers'].includes(t.access)) return false;
  const type = t['garden:type'];
  if (['residential', 'roof_garden', 'rooftop', 'private'].includes(type)) return false;
  return ['municipal', 'public', 'community', 'street_side', 'botanical'].includes(type) || ['yes', 'permissive'].includes(t.access) || !!t.name;
}

// ------------------------------------------------------------------ geometry

interface Park { id: string; name?: string; kind: 'park' | 'garden' | 'playground'; rings: Vec2[][]; bbox: [number, number, number, number]; area: number; lngLat: [number, number, number, number] }

const bboxOf = (rings: readonly Vec2[][]): [number, number, number, number] => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rings) for (const [x, y] of r) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0, y0, x1, y1];
};

/** Douglas–Peucker on an open polyline (rings: call with the closing point included). */
function simplify(pts: Vec2[], tol: number): Vec2[] {
  if (pts.length <= 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let best = -1, at = -1;
    for (let i = a + 1; i < b; i++) { const d = distToLine([pts[a], pts[b]], pts[i][0], pts[i][1]); if (d > best) { best = d; at = i; } }
    if (best > tol) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

const ringOut = (r: Vec2[], tol = 0.1): number[] => encodeLine(simplify(r, tol));

/** Bucketed spatial index of items with a local bbox. */
class Grid<T extends { bbox: [number, number, number, number] }> {
  private readonly cells = new Map<string, T[]>();
  constructor(private readonly size = 100) {}
  add(item: T): void {
    const [x0, y0, x1, y1] = item.bbox, s = this.size;
    for (let i = Math.floor(x0 / s); i <= Math.floor(x1 / s); i++) for (let j = Math.floor(y0 / s); j <= Math.floor(y1 / s); j++) {
      const k = `${i}:${j}`; (this.cells.get(k) ?? this.cells.set(k, []).get(k)!).push(item);
    }
  }
  near(x: number, y: number, r = 0): T[] {
    const s = this.size, out = new Set<T>();
    for (let i = Math.floor((x - r) / s); i <= Math.floor((x + r) / s); i++) for (let j = Math.floor((y - r) / s); j <= Math.floor((y + r) / s); j++) for (const t of this.cells.get(`${i}:${j}`) ?? []) out.add(t);
    return [...out];
  }
}

// ------------------------------------------------------------------ BGT fetch

interface BgtItem { id: string; c: Collection; props: Record<string, any>; geom: { type: string; coordinates: any } }

async function getJson(url: string): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'map-recall-own-ground/1 (build script)' } });
      if (res.ok) return await res.json();
      if (attempt > 6 || (res.status < 500 && res.status !== 429)) throw new Error(`${res.status} ${url}`);
    } catch (e) { if (attempt > 6) throw e; }
    await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
  }
}

const KEEP_PROPS = ['lokaal_id', 'fysiek_voorkomen', 'plus_fysiek_voorkomen', 'functie', 'bgt_type', 'plus_type', 'type', 'relatieve_hoogteligging', 'eind_registratie', 'bag_pnd'];

async function fetchBgt(key: string, c: Collection, bbox: [number, number, number, number]): Promise<BgtItem[]> {
  const file = `${BGT_RAW}/${key}/${c}.json.gz`;
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
      out.push({ id: p.lokaal_id ?? f.id, c, props: Object.fromEntries(KEEP_PROPS.filter(k => p[k] !== undefined && p[k] !== null).map(k => [k, p[k]])), geom: f.geometry });
    }
    url = (j.links as any[]).find(l => l.rel === 'next')?.href ?? null;
  }
  mkdirSync(`${BGT_RAW}/${key}`, { recursive: true });
  writeFileSync(file, gzipSync(JSON.stringify(out)));
  return out;
}

// ------------------------------------------------------------------ main

async function main(): Promise<void> {
  const index = elevationIndex();
  const manifest = JSON.parse(readFileSync('public/data/extracts/amsterdam/own-ground-osm-v1/cells.json', 'utf8')) as { cells: string[] };
  const gameCells = new Set(manifest.cells);
  const ownerCell = (p: Vec2): string => {
    const [lng, lat] = fromLocal(p[0], p[1]);
    const [x, y] = lngLatToLocal(index, lng, lat);
    return cellKey(Math.floor(x / index.cellSizeM), Math.floor(y / index.cellSizeM));
  };
  const project = (q: LngLat): Vec2 => toLocal(q[0], q[1]);

  // Parks, gardens, playgrounds.
  const osm = osmFeatures();
  const parks: Park[] = [];
  const seenPark = new Set<string>();
  for (const f of osm) {
    const t = f.properties;
    if (!f.id.startsWith('a')) continue;
    const kind = t.leisure === 'park' ? 'park' : t.leisure === 'playground' ? 'playground' : t.leisure === 'garden' && publicGarden(t) ? 'garden' : null;
    if (!kind) continue;
    for (const poly of polygonsOf(f.geometry)) {
      const rings = poly.map(r => r.map(project));
      const area = polygonArea(rings);
      if (area < 40) continue;
      const bbox = bboxOf(rings);
      const id = `${f.id}`;
      if (seenPark.has(id + bbox.join())) continue;
      seenPark.add(id + bbox.join());
      const [lo, la] = fromLocal(bbox[0], bbox[1]), [hi, ha] = fromLocal(bbox[2], bbox[3]);
      parks.push({ id, name: t.name, kind, rings, bbox, area, lngLat: [lo, la, hi, ha] });
    }
  }
  const parkGrid = new Grid<Park>(200);
  // Cells touched by each park (game cells only).
  const parkCells = new Map<string, Park[]>();
  for (const p of parks) {
    const keys = new Set<string>();
    const [x0, y0, x1, y1] = p.bbox;
    for (let x = x0; x <= x1 + 999; x += 500) for (let y = y0; y <= y1 + 999; y += 500) keys.add(ownerCell([Math.min(x, x1), Math.min(y, y1)]));
    let inGame = false;
    for (const k of keys) if (gameCells.has(k) && (!onlyCells || onlyCells.has(k))) { (parkCells.get(k) ?? parkCells.set(k, []).get(k)!).push(p); inGame = true; }
    if (inGame) parkGrid.add(p);
  }
  const inPark = (x: number, y: number, kinds?: Park['kind'][]): Park | null => {
    for (const p of parkGrid.near(x, y)) if ((!kinds || kinds.includes(p.kind)) && x >= p.bbox[0] && x <= p.bbox[2] && y >= p.bbox[1] && y <= p.bbox[3] && inRings(p.rings, x, y)) return p;
    return null;
  };
  const nearPark = (x: number, y: number, r: number): Park | null => {
    const hit = inPark(x, y);
    if (hit) return hit;
    for (const p of parkGrid.near(x, y, r)) if (x >= p.bbox[0] - r && x <= p.bbox[2] + r && y >= p.bbox[1] - r && y <= p.bbox[3] + r && p.rings.some(ring => distToLine(ring, x, y, true) <= r)) return p;
    return null;
  };
  console.log(JSON.stringify({ parks: parks.length, inGameCells: [...parkCells.values()].reduce((s, v) => s + v.length, 0), cells: parkCells.size }));

  // Only what can end up in a park is kept in memory (a city-wide run holds ~0.5 M raw features otherwise and runs out of heap):
  // the drawn classes, with a bbox within 3 m of some park's bbox.
  const relevant = (it: BgtItem): boolean => {
    const p = it.props;
    if ((p.relatieve_hoogteligging ?? 0) !== 0) return false;
    if (it.c === 'paal' && p.plus_type !== 'lichtmast') return false;
    if (it.c === 'scheiding_lijn' && !['hek', 'muur'].includes(p.bgt_type ?? p.type)) return false;
    if (it.c === 'vegetatieobject_vlak' && p.plus_type !== 'haag') return false;
    if (['begroeidterreindeel', 'onbegroeidterreindeel', 'wegdeel', 'waterdeel'].includes(it.c) && !bgtParkSurface(it.c, p)) return false;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const walk = (c: any): void => { if (typeof c[0] === 'number') { const [x, y] = project(c as LngLat); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } else for (const q of c) walk(q); };
    walk(it.geom.coordinates);
    const r = 3;
    return parkGrid.near((x0 + x1) / 2, (y0 + y1) / 2, Math.max(x1 - x0, y1 - y0) / 2 + r).some(pk => !(pk.bbox[2] < x0 - r || pk.bbox[0] > x1 + r || pk.bbox[3] < y0 - r || pk.bbox[1] > y1 + r));
  };

  // BGT per park cell: the union of its parks' bboxes clipped to the cell, padded ~30 m.
  const items = new Map<string, BgtItem>();
  const keys = [...parkCells.keys()].sort();
  let done = 0;
  const queue = [...keys];
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (let key = queue.shift(); key; key = queue.shift()) {
      const [cx0, cy0, cx1, cy1] = cellBounds(index, key);
      let b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
      for (const p of parkCells.get(key)!) b = [Math.min(b[0], p.lngLat[0]), Math.min(b[1], p.lngLat[1]), Math.max(b[2], p.lngLat[2]), Math.max(b[3], p.lngLat[3])];
      const bbox: [number, number, number, number] = [Math.max(b[0], cx0) - 0.0004, Math.max(b[1], cy0) - 0.00027, Math.min(b[2], cx1) + 0.0004, Math.min(b[3], cy1) + 0.00027];
      for (const c of COLLECTIONS) for (const it of await fetchBgt(key, c, bbox)) if (relevant(it)) items.set(`${c}:${it.id}`, it);
      if (++done % 10 === 0) console.log(`${done}/${keys.length} cells fetched, ${items.size} BGT features`);
    }
  }));

  // Classify BGT.
  type Surf = { k: ParkSurface; rings: Vec2[][]; bbox: [number, number, number, number]; park: Park; at: Vec2; area: number };
  const surfaces: Surf[] = [];
  const hedgePolys: { rings: Vec2[][]; bbox: [number, number, number, number]; at: Vec2 }[] = [];
  const lines: { k: 'hedge' | 'fence' | 'wall'; g: Vec2[]; src: 'bgt' | 'osm' }[] = [];
  const points: { k: ParkPointKind; p: Vec2; a?: number; gen?: 1; park: Park }[] = [];
  const pands: { rings: Vec2[][]; bbox: [number, number, number, number]; id: string }[] = [];
  const counts: Record<string, number> = {};
  const bump = (k: string, n = 1) => { counts[k] = (counts[k] ?? 0) + n; };
  for (const it of items.values()) {
    if ((it.props.relatieve_hoogteligging ?? 0) !== 0) continue;
    if (it.c === 'pand') { for (const poly of polygonsOf(it.geom)) { const rings = poly.map(r => r.map(project)); pands.push({ rings, bbox: bboxOf(rings), id: it.props.bag_pnd ?? it.id }); } continue; }
    if (it.c === 'paal') {
      if (it.props.plus_type !== 'lichtmast' || it.geom.type !== 'Point') continue;
      const p = project(it.geom.coordinates), park = nearPark(p[0], p[1], 2);
      if (park) { points.push({ k: 'lamp', p, park }); bump('lamp.bgt'); }
      continue;
    }
    if (it.c === 'scheiding_lijn') {
      const type = it.props.bgt_type ?? it.props.type;
      const k = type === 'hek' ? 'fence' : type === 'muur' ? 'wall' : null;
      if (!k) continue;
      for (const l of linesOf(it.geom)) {
        const g = l.map(project), mid = g[g.length >> 1];
        if (nearPark(mid[0], mid[1], 2)) { lines.push({ k, g, src: 'bgt' }); bump(`${k}.bgt`); }
      }
      continue;
    }
    for (const poly of polygonsOf(it.geom)) {
      const rings = poly.map(r => r.map(project));
      const at = interiorPoint(rings);
      if (!at) continue;
      if (it.c === 'vegetatieobject_vlak') {
        if (it.props.plus_type !== 'haag') continue;
        if (nearPark(at[0], at[1], 2)) { hedgePolys.push({ rings, bbox: bboxOf(rings), at }); bump('hedge.bgtPolygon'); }
        continue;
      }
      const k = bgtParkSurface(it.c, it.props);
      if (!k) continue;
      const park = inPark(at[0], at[1]);
      if (!park) continue;
      const area = polygonArea(rings);
      if (area < 1) continue;
      surfaces.push({ k, rings, bbox: bboxOf(rings), park, at, area });
      bump(`surface.${k}`);
    }
  }
  const pandGrid = new Grid<typeof pands[number]>(100); pands.forEach(p => pandGrid.add(p));
  const inPand = (x: number, y: number, r = 0) => pandGrid.near(x, y, r).some(p => inRings(p.rings, x, y) || (r > 0 && p.rings.some(ring => distToLine(ring, x, y, true) <= r)));
  const surfGrid = new Grid<Surf>(100); surfaces.forEach(s => surfGrid.add(s));
  const surfAt = (x: number, y: number, ks: ParkSurface[]) => surfGrid.near(x, y).some(s => ks.includes(s.k) && inRings(s.rings, x, y));
  const hedgeGrid = new Grid<typeof hedgePolys[number]>(100); hedgePolys.forEach(h => hedgeGrid.add(h));
  const PATHLIKE: ParkSurface[] = ['path', 'paving', 'gravel', 'cycle'];

  // OSM barriers (where BGT has none within 1 m), benches, playground equipment, paths.
  const bgtLineGrid = new Grid<{ g: Vec2[]; k: string; bbox: [number, number, number, number] }>(100);
  for (const l of lines) bgtLineGrid.add({ g: l.g, k: l.k, bbox: bboxOf([l.g]) });
  const sample = (g: Vec2[], step = 2): Vec2[] => {
    const out: Vec2[] = [];
    for (let i = 1; i < g.length; i++) { const a = g[i - 1], b = g[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
    if (g.length) out.push(g[g.length - 1]);
    return out;
  };
  const coveredBy = (g: Vec2[], test: (x: number, y: number) => boolean) => { const s = sample(g); return s.filter(p => test(p[0], p[1])).length / Math.max(1, s.length); };
  const paths: { id: number; g: Vec2[]; tags: Record<string, string> }[] = [];
  for (const f of osm) {
    const t = f.properties;
    if (t.highway && f.id.startsWith('w') && f.geometry.type === 'LineString') {
      if (t.footway === 'sidewalk' || t.footway === 'crossing' || t.cycleway === 'crossing' || (t.bridge && t.bridge !== 'no') || (t.tunnel && t.tunnel !== 'no')) continue;
      paths.push({ id: Number(f.id.slice(1)), g: f.geometry.coordinates.map(project), tags: t });
      continue;
    }
    if (t.barrier === 'hedge' || t.barrier === 'fence' || t.barrier === 'wall') {
      const k = t.barrier as 'hedge' | 'fence' | 'wall';
      if (k === 'hedge' && f.id.startsWith('a') && t.area === 'yes') {
        for (const poly of polygonsOf(f.geometry)) { const rings = poly.map(r => r.map(project)); const at = interiorPoint(rings); if (at && nearPark(at[0], at[1], 2)) { hedgePolys.push({ rings, bbox: bboxOf(rings), at }); bump('hedge.osmPolygon'); } }
        continue;
      }
      const ls = f.id.startsWith('a') ? polygonsOf(f.geometry).map(p => p[0]) : linesOf(f.geometry);
      for (const l of ls) {
        const g = l.map(project), mid = g[g.length >> 1];
        if (g.length < 2 || !nearPark(mid[0], mid[1], 2)) continue;
        const dup = coveredBy(g, (x, y) => (k === 'hedge' ? hedgeGrid.near(x, y, 1).some(h => inRings(h.rings, x, y) || h.rings.some(r => distToLine(r, x, y, true) <= 1)) : false)
          || bgtLineGrid.near(x, y, 1).some(b => (b.k === k || (k !== 'hedge' && b.k !== 'hedge')) && distToLine(b.g, x, y) <= 1));
        if (dup >= 0.5) { bump(`${k}.osmDuplicate`); continue; }
        lines.push({ k, g, src: 'osm' }); bump(`${k}.osm`);
      }
      continue;
    }
    if (t.amenity === 'bench') {
      const p = f.geometry.type === 'Point' ? project(f.geometry.coordinates) : interiorPoint(polygonsOf(f.geometry)[0]?.map(r => r.map(project)) ?? []) ?? (linesOf(f.geometry)[0] ? project(linesOf(f.geometry)[0][0]) : null);
      if (!p) continue;
      const park = nearPark(p[0], p[1], 1);
      if (park) { points.push({ k: 'bench', p, park }); bump('bench.osm'); }
      continue;
    }
    const piece = playgroundPiece(t.playground);
    if (piece) {
      const poly = polygonsOf(f.geometry)[0];
      const p = f.geometry.type === 'Point' ? project(f.geometry.coordinates) : poly ? interiorPoint(poly.map(r => r.map(project))) : linesOf(f.geometry)[0] ? project(linesOf(f.geometry)[0][0]) : null;
      if (!p) continue;
      const park = nearPark(p[0], p[1], 2);
      if (!park) continue;
      // A mapped sandpit area is its own sand surface; the kit adds the kerb ring only when the pit is small and round enough.
      if (piece === 'sandpit' && poly) {
        const rings = poly.map(r => r.map(project));
        surfaces.push({ k: 'sand', rings, bbox: bboxOf(rings), park, at: p, area: polygonArea(rings) }); bump('surface.sand.osm');
        if (polygonArea(rings) > 30) continue;
      }
      points.push({ k: piece, p, park }); bump(`play.${piece}.osm`);
    }
  }
  const pathGrid = new Grid<{ id: number; g: Vec2[]; bbox: [number, number, number, number] }>(100);
  for (const p of paths) pathGrid.add({ id: p.id, g: p.g, bbox: bboxOf([p.g]) });

  // Benches face the nearest path.
  for (const pt of points) if (pt.k === 'bench' && pt.a === undefined) {
    let best = Infinity, dir = 0;
    for (const l of pathGrid.near(pt.p[0], pt.p[1], 15)) for (let i = 1; i < l.g.length; i++) {
      const a = l.g[i - 1], b = l.g[i], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((pt.p[0] - a[0]) * dx + (pt.p[1] - a[1]) * dy) / l2)) : 0;
      const qx = a[0] + t * dx, qy = a[1] + t * dy, d = Math.hypot(qx - pt.p[0], qy - pt.p[1]);
      if (d < best && d > 0.05) { best = d; dir = Math.atan2(qy - pt.p[1], qx - pt.p[0]); }
    }
    pt.a = dir;
  }

  // Path length inside each park (OSM path centrelines, 2 m samples) and the measured bench / lamp spacing.
  const pathM = new Map<Park, number>(), parkLines = new Map<Park, Vec2[][]>();
  for (const l of paths) {
    let run: Vec2[] = [], owner: Park | null = null;
    const flush = () => { if (owner && run.length > 1) (parkLines.get(owner) ?? parkLines.set(owner, []).get(owner)!).push(run); run = []; owner = null; };
    for (const q of sample(l.g, 2)) {
      const p = inPark(q[0], q[1], ['park']);
      if (p && (owner === p || !owner)) { owner = p; run.push(q); pathM.set(p, (pathM.get(p) ?? 0) + 2); } else flush();
    }
    flush();
  }
  const perPark = (k: ParkPointKind) => { const m = new Map<Park, number>(); for (const pt of points) if (pt.k === k && pt.park.kind === 'park') m.set(pt.park, (m.get(pt.park) ?? 0) + 1); return m; };
  const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; };
  const quart = (v: number[], q: number) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.floor(q * (s.length - 1))] : null; };
  const spacingOf = (k: ParkPointKind, min: number) => {
    const n = perPark(k), v: number[] = [];
    for (const [park, c] of n) { const m = pathM.get(park) ?? 0; if (c >= min && m >= 200) v.push(m / c); }
    return { parks: v.length, median: median(v), p25: quart(v, 0.25), p75: quart(v, 0.75) };
  };
  const benchSpacing = spacingOf('bench', 3), lampSpacing = spacingOf('lamp', 3);
  const allPointsGrid = new Grid<{ p: Vec2; bbox: [number, number, number, number] }>(50);
  for (const pt of points) allPointsGrid.add({ p: pt.p, bbox: [pt.p[0], pt.p[1], pt.p[0], pt.p[1]] });
  const freeSpot = (park: Park, kinds: Park['kind'][] | undefined, clearM: number) => (x: number, y: number) =>
    inPark(x, y, kinds) === park && !surfAt(x, y, [...PATHLIKE, 'pond']) && !inPand(x, y, 1) && !allPointsGrid.near(x, y, clearM).some(q => Math.hypot(q.p[0] - x, q.p[1] - y) < clearM);
  const generate = (k: 'bench' | 'lamp', spacing: number | null, offset: number) => {
    if (!spacing) return 0;
    const have = perPark(k);
    let n = 0;
    for (const [park, m] of pathM) {
      if (park.kind !== 'park' || (have.get(park) ?? 0) > 0 || m < spacing * 2) continue;
      for (const s of benchesAlong(parkLines.get(park) ?? [], spacing, offset, freeSpot(park, ['park'], 3))) {
        points.push({ k, p: s.p, a: s.a, gen: 1, park }); allPointsGrid.add({ p: s.p, bbox: [s.p[0], s.p[1], s.p[0], s.p[1]] }); n++;
      }
    }
    return n;
  };
  const benchesGenerated = generate('bench', benchSpacing.median, 2.0);
  // Lamps are not generated: BGT surveys every municipal light mast, and a park without one is unlit on purpose
  // (a first run that filled them at the measured spacing invented 1,376 masts). The spacing is reported only.
  const lampsGenerated = 0;

  // Playground kit where a playground maps no equipment.
  let kits = 0, kitPieces = 0;
  const playPieces = new Set<ParkPointKind>(['swing', 'slide', 'sandpit', 'climb', 'seesaw', 'springy', 'playhouse', 'structure']);
  for (const park of parks) {
    if (park.kind !== 'playground' || !parkGrid.near(park.bbox[0], park.bbox[1]).includes(park)) continue;
    const mapped = points.some(pt => playPieces.has(pt.k) && inRings(park.rings, pt.p[0], pt.p[1]));
    if (mapped || park.area < 80) continue;
    const kit = playgroundKit(park.rings, (x, y) => !surfAt(x, y, [...PATHLIKE, 'pond']) && !inPand(x, y, 1));
    if (!kit.length) continue;
    kits++;
    for (const piece of kit) {
      points.push({ k: piece.k, p: piece.p, a: piece.a, gen: 1, park }); kitPieces++;
      if (piece.k === 'sandpit') {
        const ring: Vec2[] = Array.from({ length: 17 }, (_, i) => [piece.p[0] + Math.cos(i / 16 * Math.PI * 2) * 2.1, piece.p[1] + Math.sin(i / 16 * Math.PI * 2) * 2.1] as Vec2);
        surfaces.push({ k: 'sand', rings: [ring], bbox: bboxOf([ring]), park, at: piece.p, area: 13.9 });
      }
    }
  }

  // OSM path ways the BGT path polygons cover (≥ 80 % of 2 m samples on a path-like surface, inside a park).
  const dropWays = new Map<string, number[]>();
  for (const l of paths) {
    if (coveredBy(l.g, (x, y) => !!inPark(x, y)) < 0.8) continue;
    if (coveredBy(l.g, (x, y) => surfAt(x, y, PATHLIKE)) < 0.8) continue;
    const mid = l.g[l.g.length >> 1];
    const key = ownerCell(mid);
    (dropWays.get(key) ?? dropWays.set(key, []).get(key)!).push(l.id);
  }

  // Write cells: a feature belongs to the cell of its interior point / midpoint / point.
  const cells = new Map<string, ParksCell>();
  const cellOf = (key: string): ParksCell | null => {
    if (!gameCells.has(key) || (onlyCells && !onlyCells.has(key))) return null;
    return cells.get(key) ?? cells.set(key, { version: 2, key, parks: [], surfaces: [], hedges: [], lines: [], points: [], dropWays: [] }).get(key)!;
  };
  for (const p of parks) {
    const c = cellOf(ownerCell([(p.bbox[0] + p.bbox[2]) / 2, (p.bbox[1] + p.bbox[3]) / 2]));
    if (c && parkGrid.near(p.bbox[0], p.bbox[1]).includes(p)) c.parks.push({ id: p.id, ...(p.name ? { name: p.name } : {}), kind: p.kind });
  }
  for (const s of surfaces) cellOf(ownerCell(s.at))?.surfaces.push({ k: s.k, r: s.rings.map(r => ringOut(r)) });
  for (const h of hedgePolys) cellOf(ownerCell(h.at))?.hedges.push(h.rings.map(r => ringOut(r)));
  for (const l of lines) cellOf(ownerCell(l.g[l.g.length >> 1]))?.lines.push({ k: l.k, g: ringOut(l.g) });
  for (const pt of points) cellOf(ownerCell(pt.p))?.points.push({ k: pt.k, p: [Math.round(pt.p[0] * 10), Math.round(pt.p[1] * 10)], ...(pt.a !== undefined ? { a: Math.round(pt.a * 1000) / 1000 } : {}), ...(pt.gen ? { gen: 1 as const } : {}) });
  for (const [key, ids] of dropWays) { const c = cellOf(key); if (c) c.dropWays.push(...ids); }

  // Coverage per park: BGT surface area over park area.
  const covered = new Map<Park, number>();
  for (const s of surfaces) covered.set(s.park, (covered.get(s.park) ?? 0) + s.area);
  const inGameParks = parks.filter(p => parkGrid.near(p.bbox[0], p.bbox[1]).includes(p));
  const byKind = (k: Park['kind']) => {
    const ps = inGameParks.filter(p => p.kind === k);
    const withBgt = ps.filter(p => (covered.get(p) ?? 0) > 0);
    const ratio = ps.map(p => Math.min(1, (covered.get(p) ?? 0) / p.area));
    return { found: ps.length, withBgtPolygons: withBgt.length, areaHa: +(ps.reduce((s, p) => s + p.area, 0) / 1e4).toFixed(1), surfaceCoverageMedian: median(ratio) && +median(ratio)!.toFixed(2) };
  };
  const named = ['Vondelpark', 'Oosterpark', 'Sarphatipark', 'Westerpark', 'Bellamyplein', 'J.J. Cremerplein'].map(n => {
    const ps = inGameParks.filter(p => p.name === n);
    const area = ps.reduce((s, p) => s + p.area, 0), cov = ps.reduce((s, p) => s + (covered.get(p) ?? 0), 0);
    const pts = (k: ParkPointKind) => points.filter(pt => ps.includes(pt.park) && pt.k === k).length;
    return { name: n, polygons: ps.length, areaM2: Math.round(area), bgtCoverage: area ? +(cov / area).toFixed(2) : 0, benches: pts('bench'), lamps: pts('lamp') };
  });

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(`${OUT}/cells`, { recursive: true });
  let bytes = 0;
  const written: string[] = [];
  for (const [key, c] of [...cells].sort()) {
    if (!c.surfaces.length && !c.hedges.length && !c.lines.length && !c.points.length) continue;
    const gz = gzipSync(Buffer.from(JSON.stringify(c)), { level: 9 });
    writeFileSync(`${OUT}/cells/${key}.json.gz`, gz); bytes += gz.length; written.push(key);
  }
  const report = {
    parks: { park: byKind('park'), garden: byKind('garden'), playground: byKind('playground') },
    named, counts,
    benchSpacingM: benchSpacing, lampSpacingM: lampSpacing, benchesGenerated, lampsGenerated, playgroundKits: kits, kitPieces,
    dropWays: [...dropWays.values()].reduce((s, v) => s + v.length, 0),
    pandsInParkCells: pands.length,
    cells: written.length, gzipKB: Math.round(bytes / 1024),
  };
  const out: ParksManifest = { version: 1, cells: written, fetched: NOW, attribution: 'BGT © Kadaster (CC0 1.0); © OpenStreetMap contributors (ODbL)', report };
  writeFileSync(`${OUT}/cells.json`, JSON.stringify(out));
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
}

main().catch(e => { console.error(e); process.exit(1); });
