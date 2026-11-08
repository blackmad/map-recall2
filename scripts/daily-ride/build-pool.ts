// Builds Today's ride's pool (#279): the buurt centroids and the tour stops,
// each snapped to a routable point on a street that answers no question, and
// writes it as a typed list the landing and the ride both bundle
// (src/canalRecall/game/dailyRidePool.ts). Nothing is fetched at runtime.
//
// Snapping, measured against the graph the game routes on:
// - the street extract as the browser loads it (roads-v2 binary by default,
//   ROADS=json for streets-routing.json), motor-only roads dropped, ways
//   Douglas-Peucker simplified and merged on the 18 px grid, then stitched at
//   10 px — the same steps as scripts/check-road-reachability.ts;
// - a point qualifies when its node is in the largest component (a route can
//   be planned to it), every way through it is unnamed (so the plaque has
//   nothing to print and no route question can settle on it), and no named way
//   passes within NAMED_CLEARANCE_M (the game's own snap and the route
//   question must not pick up a neighbouring named street);
// - a buurt centroid takes the nearest qualifying node inside its polygon,
//   within MAX_SNAP_M of the centroid; a tour stop the nearest within
//   MAX_STOP_SNAP_M of the stop.
//
// The card names every place by its buurt, never by a stop's own name: a
// tour stop's name can be a quiz answer. A buurt name that is itself a street,
// water or bridge name (Rapenburg) falls back to the quarter around it, or the
// place is rejected.
//
// Run: node --import tsx scripts/daily-ride/build-pool.ts [--out path]
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadSnapGraph, NAMED_CLEARANCE_M } from './snapGraph.ts';

const MAX_SNAP_M = 600;
const MAX_STOP_SNAP_M = 200;
/** Boundary kinds that name a buurt on the card. */
const BUURT_KINDS = new Set(['quarter', 'neighbourhood', 'neighborhood', 'city_block']);

type LatLon = [number, number];
type Boundary = { id: string; name: string; kind: string; geometry: LatLon[][][] };

const directory = path.resolve('public/data/extracts/amsterdam');
const args = process.argv.slice(2);
const outPath = path.resolve(args.includes('--out') ? args[args.indexOf('--out') + 1]! : 'src/canalRecall/game/dailyRidePool.ts');

const graph = await loadSnapGraph(directory);
const { features, project, unproject, nearestSnap } = graph;
const readJson = async <T>(file: string): Promise<T> => JSON.parse(await readFile(path.join(directory, file), 'utf8')) as T;
const boundaries = await readJson<Boundary[]>('boundaries.json');
const tours = (await readJson<{ tours: Array<{ id: string; stops: Array<{ name: string; lngLat: [number, number] }> }> }>('tours.json')).tours;
const water = await readJson<Array<{ name?: string }>>('water.json');
const bridges = await readJson<Array<{ name?: string }>>('bridges.json');

// ---- buurten ----
function ringArea(ring: LatLon[]): { area: number; cx: number; cy: number } {
  let area = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const [y0, x0] = ring[i]!, [y1, x1] = ring[(i + 1) % ring.length]!;
    const cross = x0 * y1 - x1 * y0;
    area += cross; cx += (x0 + x1) * cross; cy += (y0 + y1) * cross;
  }
  area /= 2;
  return { area, cx: area ? cx / (6 * area) : 0, cy: area ? cy / (6 * area) : 0 };
}
function inRing([lat, lon]: LatLon, ring: LatLon[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i]!, [yj, xj] = ring[j]!;
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inBoundary = (point: LatLon, b: Boundary) => b.geometry.some(poly => poly[0] && inRing(point, poly[0]) && !poly.slice(1).some(hole => inRing(point, hole)));
const boundaryArea = (b: Boundary) => b.geometry.reduce((sum, poly) => sum + Math.abs(ringArea(poly[0] || []).area), 0);

const quizNames = new Set<string>();
for (const item of [...features, ...water, ...bridges]) if (item.name) quizNames.add(item.name.trim().toLowerCase());

// Unique buurten (the extract lists Chassébuurt twice): keep the larger polygon.
const byName = new Map<string, Boundary>();
for (const b of boundaries) {
  if (!BUURT_KINDS.has(b.kind)) continue;
  const prior = byName.get(b.name);
  if (!prior || boundaryArea(b) > boundaryArea(prior)) byName.set(b.name, b);
}
const buurten = [...byName.values()];
const quarters = buurten.filter(b => b.kind === 'quarter');
/** The quarter around a neighbourhood (largest overlap by centroid), else none. */
function quarterAround(point: LatLon, self?: Boundary): Boundary | null {
  return quarters.filter(q => q !== self && inBoundary(point, q)).sort((a, b) => boundaryArea(a) - boundaryArea(b))[0] ?? null;
}
/** The finest buurt holding a point. */
function finestAt(point: LatLon): Boundary | null {
  return buurten.filter(b => inBoundary(point, b)).sort((a, b) => boundaryArea(a) - boundaryArea(b))[0] ?? null;
}
const slug = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

type Place = { id: string; name: string; buurt: string; lat: number; lng: number; source: 'buurt' | 'tour'; snapM: number };
const places: Place[] = [];
const rejected: Array<{ what: string; why: string }> = [];

/** Card name and repeat key for a point: the finest buurt, unless its name is a quiz name. */
function labelFor(point: LatLon, finest: Boundary | null): { name: string; buurt: string } | { why: string } {
  if (!finest) return { why: 'outside every buurt polygon' };
  const quarter = finest.kind === 'quarter' ? finest : quarterAround(point, finest);
  let label: Boundary | null = finest;
  if (quizNames.has(finest.name.toLowerCase())) label = quarter && !quizNames.has(quarter.name.toLowerCase()) ? quarter : null;
  if (!label) return { why: `buurt name "${finest.name}" is a street/water/bridge name and no quarter around it` };
  return { name: label.name, buurt: slug((quarter ?? label).name) };
}

for (const b of buurten.sort((x, y) => (x.name < y.name ? -1 : 1))) {
  const outers = b.geometry.map(poly => ({ ring: poly[0] || [], ...ringArea(poly[0] || []) }));
  const total = outers.reduce((s, o) => s + o.area, 0);
  const centroid: LatLon = total
    ? [outers.reduce((s, o) => s + o.cy * o.area, 0) / total, outers.reduce((s, o) => s + o.cx * o.area, 0) / total]
    : b.geometry[0]![0]![0]!;
  const snap = nearestSnap(project(centroid), MAX_SNAP_M, latLon => inBoundary(latLon, b));
  if (!snap) { rejected.push({ what: `buurt ${b.name}`, why: `no unnamed routable street ≥${NAMED_CLEARANCE_M} m from a named one within ${MAX_SNAP_M} m of the centroid, inside the buurt` }); continue; }
  const [lat, lng] = unproject(snap.node);
  const label = labelFor([lat, lng], b);
  if ('why' in label) { rejected.push({ what: `buurt ${b.name}`, why: label.why }); continue; }
  places.push({ id: `buurt-${slug(b.name)}`, ...label, lat, lng, source: 'buurt', snapM: snap.metres });
}
for (const tour of tours) {
  tour.stops.forEach((stop, index) => {
    const point: LatLon = [stop.lngLat[1], stop.lngLat[0]];
    const snap = nearestSnap(project(point), MAX_STOP_SNAP_M);
    if (!snap) { rejected.push({ what: `tour ${tour.id} stop ${index + 1}`, why: `no unnamed routable street ≥${NAMED_CLEARANCE_M} m from a named one within ${MAX_STOP_SNAP_M} m` }); return; }
    const [lat, lng] = unproject(snap.node);
    const label = labelFor([lat, lng], finestAt([lat, lng]));
    if ('why' in label) { rejected.push({ what: `tour ${tour.id} stop ${index + 1}`, why: label.why }); return; }
    places.push({ id: `tour-${slug(tour.id)}-${index + 1}`, ...label, lat, lng, source: 'tour', snapM: snap.metres });
  });
}
// Two tours sharing a stop snap to the same node: keep the first id.
const seenAt = new Set<string>();
const unique = places.filter((place) => {
  const key = `${place.lat.toFixed(6)},${place.lng.toFixed(6)}`;
  if (seenAt.has(key)) { rejected.push({ what: place.id, why: 'same snapped point as an earlier place' }); return false; }
  seenAt.add(key);
  return true;
}).sort((a, b) => (a.id < b.id ? -1 : 1));

const round = (v: number) => Math.round(v * 1e6) / 1e6;
const rows = unique.map(p => `  { id: ${JSON.stringify(p.id)}, name: ${JSON.stringify(p.name)}, buurt: ${JSON.stringify(p.buurt)}, lat: ${round(p.lat)}, lng: ${round(p.lng)}, source: '${p.source}' },`);
const source = `// GENERATED by scripts/daily-ride/build-pool.ts — do not edit by hand; rerun the script.
// Today's ride's pool (#279): buurt centroids and tour stops, each snapped to an
// unnamed street in the largest component of the routing graph, at least
// ${NAMED_CLEARANCE_M} m from any named street, so a ride's ends answer no question.
// Source: ${graph.source} routing extract, boundaries.json, tours.json. ${unique.length} places.

export interface DailyPoolPlace {
  /** Stable id: \`buurt-<slug>\` or \`tour-<tour>-<stop>\`. */
  id: string;
  /** What the card prints: the buurt, never a stop's own name. */
  name: string;
  /** The repeat key: the quarter around the place (or the buurt itself). */
  buurt: string;
  lat: number;
  lng: number;
  source: 'buurt' | 'tour';
}

export const DAILY_RIDE_POOL: readonly DailyPoolPlace[] = [
${rows.join('\n')}
];
`;
await writeFile(outPath, source);

const snaps = unique.map(p => p.snapM).sort((a, b) => a - b);
console.log(`graph: ${graph.nodeCount} nodes, largest component ${graph.mainSize} (${(100 * graph.mainSize / graph.nodeCount).toFixed(1)}%), ${graph.snapCount} qualifying snap nodes`);
console.log(`pool: ${unique.length} places (${unique.filter(p => p.source === 'buurt').length} buurt, ${unique.filter(p => p.source === 'tour').length} tour), ${new Set(unique.map(p => p.buurt)).size} buurt keys; snap median ${snaps[snaps.length >> 1]?.toFixed(0)} m, max ${snaps[snaps.length - 1]?.toFixed(0)} m`);
console.log(`rejected ${rejected.length}:`);
for (const r of rejected) console.log(`  ${r.what}: ${r.why}`);
console.log(`wrote ${path.relative(process.cwd(), outPath)}`);
