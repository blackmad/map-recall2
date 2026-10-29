/**
 * Ride visibility of the dominant-building candidates: how much of a building a rider actually sees on the routes the
 * game plans, replacing the old "footprint ÷ distance from the Dam" ranking (plan "Large tier to photo likeness",
 * Part 1 lane D; batch 7's Nieuwe Hemweg / Isolatorweg sheds are what that ranking produced).
 *
 *   node --max-old-space-size=8192 --import tsx scripts/building-recipes/ride-visibility.ts [--routes=600] [--seed=7] [--write] [--top=20]
 *
 * Destinations: the game's teachable route destinations (the extract landmarks merged with the modelled-landmark and
 * manual POI catalogues, `mergeManualPoiFeatures` + `isTeachableRouteDestination`, as `sim-home-picks.ts`), within
 * 6 km of the Dam. Routes: `--routes` seeded random destination pairs 1–6 km apart, shortest paths over the bike graph
 * (`streets-routing.json` without motor-only roads, `roadGraph.ts`, RD metres), sampled every 5 m and pooled on a 5 m
 * grid with a pass count. Per candidate (`public/canal-drive/dominant-building-backlog.json`) and its BAG footprint:
 * every outer-ring edge of at least 2 m is a wall; a route sample sees a wall when the sample is on the wall's outer side,
 * within 60 m of the wall's midpoint, and the 2D sightline to the midpoint does not cross a footprint interior
 * (`footprintOcclusion` from `neighbourhood-core.ts`, every BAG pand within reach as an occluder, the candidate itself
 * included). Measures per candidate:
 *   - `routeMetres`: route metres (5 m × passes) within 60 m from which some wall is visible;
 *   - `score`: Σ over those samples of 5 m × passes × the visible facing-wall length (m²; the ranking key);
 *   - `walls`: the visible wall length (m), `routes`: how many of the sampled routes see it.
 * `--write` puts `rideVisibility: {score, routeMetres, wallM, routes, rank, method}` on every candidate of the backlog
 * (the ranking leaves the file's order alone); the run summary, the top `--top` by the new key against the old, goes to
 * `artifacts/building-recipes/ride-visibility.json`. Installed large houses (catalogue `building-recipes-large`) are
 * scored the same way into that file, for the likeness triage.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {buildRoadGraph, nearestRoadGraphNode, reconstructRoadPath, shortestRoadPaths, type RoadGraphPoint} from '../../src/canalRecall/routing/roadGraph.ts';
import {isMotorOnlyHighway, motorOnlyNames} from '../../src/canalRecall/routing/bikeAccess.ts';
import {lngLatToRd} from '../../src/canalRecall/facade/rdNew.ts';
import * as R from '../../src/canalRecall/game/routeSelection.ts';
import {footprintOcclusion} from '../da-costa-block/neighbourhood-core.ts';

const BACKLOG = 'public/canal-drive/dominant-building-backlog.json', CATALOGUE = 'public/canal-drive/ordinary-buildings-data/catalogue.json';
const BAG = 'public/data/extracts/amsterdam/bag-tiles/14';
const SIGHT_M = 60, STEP_M = 5, MIN_WALL_M = 2;
const DAM = {lng: 4.8932, lat: 52.3731};
export const METHOD = `ride-visibility/v1: teachable destinations ≤ 6 km of the Dam, seeded pairs 1–6 km, bike graph shortest paths, ${STEP_M} m samples, walls ≥ ${MIN_WALL_M} m within ${SIGHT_M} m on their outer side with a 2D footprint sightline; score = Σ sample m × passes × visible facing-wall m`;

const arg = (n: string, d: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;

/** Mulberry32: a small seeded PRNG so the sampled routes are reproducible. */
export function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

type XY = [number, number];
interface Wall {a: XY; b: XY; mid: XY; n: XY; len: number}
/** Walls of a footprint (outer rings, RD): edges ≥ MIN_WALL_M with the outward normal (ring orientation by signed area). */
export function wallsOf(rings: XY[][]): Wall[] {
  const out: Wall[] = [];
  for (const ring of rings) {
    let area = 0;
    for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; area += p[0] * q[1] - q[0] * p[1]; }
    const ccw = area > 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      if (len < MIN_WALL_M) continue;
      // CCW ring: the outside is to the right of travel
      const n: XY = ccw ? [dy / len, -dx / len] : [-dy / len, dx / len];
      out.push({a, b, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], n, len});
    }
  }
  return out;
}

/** Every BAG pand footprint in RD (outer rings plus holes per polygon) with its bbox, gridded at 100 m. */
export function loadFootprints() {
  const index = JSON.parse(fs.readFileSync(path.join(BAG, '..', 'index-z14.json'), 'utf8'));
  const tiles: string[] = index.tileList.map((t: string) => t.replace(/^14\//, ''));
  const pands = new Map<string, {polys: XY[][][]; box: [number, number, number, number]}>();
  for (const t of tiles) {
    const file = path.join(BAG, `${t}.geojson.gz`);
    if (!fs.existsSync(file)) continue;
    for (const f of JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString()).features) {
      const id = f.properties?.id; if (!id || pands.has(id)) continue;
      const polys: XY[][][] = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [])
        .map((poly: number[][][]) => poly.map(ring => ring.map(c => { const p = lngLatToRd([c[0], c[1]]); return [p.x, p.y] as XY; })));
      if (!polys.length) continue;
      const xs = polys.flat(2).map(p => p[0]), ys = polys.flat(2).map(p => p[1]);
      pands.set(id, {polys, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]});
    }
  }
  const grid = new Map<string, string[]>(), C = 100;
  for (const [id, p] of pands) for (let gx = Math.floor(p.box[0] / C); gx <= Math.floor(p.box[2] / C); gx++) for (let gy = Math.floor(p.box[1] / C); gy <= Math.floor(p.box[3] / C); gy++) {
    const k = `${gx},${gy}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(id);
  }
  const near = (box: [number, number, number, number]) => {
    const ids = new Set<string>();
    for (let gx = Math.floor(box[0] / C); gx <= Math.floor(box[2] / C); gx++) for (let gy = Math.floor(box[1] / C); gy <= Math.floor(box[3] / C); gy++) for (const id of grid.get(`${gx},${gy}`) ?? []) ids.add(id);
    return [...ids].filter(id => { const b = pands.get(id)!.box; return b[0] <= box[2] && b[2] >= box[0] && b[1] <= box[3] && b[3] >= box[1]; });
  };
  return {pands, near};
}

function bikeGraph() {
  const streets = JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/streets-routing.json', 'utf8'));
  const motor = motorOnlyNames(streets);
  const segs = streets.filter((f: any) => !isMotorOnlyHighway(f.highway) && !motor.has(f.name))
    .flatMap((f: any) => (f.paths ?? (f.path ? [f.path] : [])).map((p: number[][]) => ({points: p.map(([lat, lng]) => lngLatToRd([lng, lat])), metadata: {name: f.name}})));
  return buildRoadGraph(segs, {mergeSize: 2, junctionStitchRadius: 3, gridCellSize: 80, gridPadding: 8});
}

function destinations() {
  const features = R.mergeManualPoiFeatures(JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/landmarks.json', 'utf8')), 'amsterdam');
  const out: {name: string; p: RoadGraphPoint}[] = [], seen = new Set<string>();
  for (const f of features as any[]) {
    const c = f.routeCenter || f.center;
    if (!c || !f.name || !R.isTeachableRouteDestination(f) || seen.has(f.name)) continue;
    if (R.kmBetween({lat: c[0], lng: c[1]}, DAM) > 6) continue;
    seen.add(f.name); out.push({name: f.name, p: lngLatToRd([c[1], c[0]])});
  }
  return out;
}

/** Route samples pooled on a STEP_M grid: key -> [x, y, passes, routeIds]. */
export function sampleRoutes(nRoutes: number, seed: number) {
  const graph = bikeGraph(), dests = destinations(), rand = rng(seed);
  const samples = new Map<string, {x: number; y: number; passes: number; routes: Set<number>}>();
  let made = 0, tries = 0, metres = 0;
  // group pairs by start so one shortest-path tree serves several routes
  while (made < nRoutes && tries < nRoutes * 20) {
    const a = dests[Math.floor(rand() * dests.length)], tree = shortestRoadPaths(graph, a.p);
    tries++;
    if (!tree) continue;
    for (let k = 0; k < 6 && made < nRoutes; k++) {
      const b = dests[Math.floor(rand() * dests.length)], d = Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y);
      if (d < 1000 || d > 6000) continue;
      const end = nearestRoadGraphNode(graph, b.p);
      if (!end || !tree.distances.has(end.key)) continue;
      const route = reconstructRoadPath(tree.previous, end), id = made++;
      for (let i = 1; i < route.length; i++) {
        const p = route[i - 1], q = route[i], len = Math.hypot(q.x - p.x, q.y - p.y);
        metres += len;
        for (let s = 0; s < len; s += STEP_M) {
          const t = len ? s / len : 0, x = p.x + (q.x - p.x) * t, y = p.y + (q.y - p.y) * t, key = `${Math.round(x / STEP_M)},${Math.round(y / STEP_M)}`;
          const e = samples.get(key) ?? samples.set(key, {x: Math.round(x / STEP_M) * STEP_M, y: Math.round(y / STEP_M) * STEP_M, passes: 0, routes: new Set()}).get(key)!;
          if (!e.routes.has(id)) { e.passes++; e.routes.add(id); }
        }
      }
    }
  }
  return {samples: [...samples.values()], routes: made, metres, destinations: dests.length};
}

export interface RideVisibility {score: number; routeMetres: number; wallM: number; routes: number}

export function scorer(samples: ReturnType<typeof sampleRoutes>['samples'], fp: ReturnType<typeof loadFootprints>) {
  const C = 50, grid = new Map<string, number[]>();
  samples.forEach((s, i) => { const k = `${Math.floor(s.x / C)},${Math.floor(s.y / C)}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(i); });
  return (id: string): RideVisibility | null => {
    const me = fp.pands.get(id);
    if (!me) return null;
    const walls = wallsOf(me.polys.map(p => p[0]));
    const box: [number, number, number, number] = [me.box[0] - SIGHT_M, me.box[1] - SIGHT_M, me.box[2] + SIGHT_M, me.box[3] + SIGHT_M];
    const near: number[] = [];
    for (let gx = Math.floor(box[0] / C); gx <= Math.floor(box[2] / C); gx++) for (let gy = Math.floor(box[1] / C); gy <= Math.floor(box[3] / C); gy++) near.push(...(grid.get(`${gx},${gy}`) ?? []));
    if (!near.length) return {score: 0, routeMetres: 0, wallM: 0, routes: 0};
    const occluders = fp.near(box).map(o => ({box: fp.pands.get(o)!.box, polys: fp.pands.get(o)!.polys}));
    let score = 0, routeMetres = 0;
    const seenWalls = new Set<number>(), routes = new Set<number>();
    for (const si of near) {
      const s = samples[si];
      let visible = 0;
      walls.forEach((w, wi) => {
        const dx = s.x - w.mid[0], dy = s.y - w.mid[1], d = Math.hypot(dx, dy);
        if (d > SIGHT_M || dx * w.n[0] + dy * w.n[1] <= 0.5) return;
        const lo = [Math.min(s.x, w.mid[0]), Math.min(s.y, w.mid[1])], hi = [Math.max(s.x, w.mid[0]), Math.max(s.y, w.mid[1])];
        const polys = occluders.filter(o => o.box[0] <= hi[0] && o.box[2] >= lo[0] && o.box[1] <= hi[1] && o.box[3] >= lo[1]).flatMap(o => o.polys);
        if (polys.length && footprintOcclusion([s.x, s.y], w.mid, polys).blocked) return;
        visible += w.len; seenWalls.add(wi);
      });
      if (!visible) continue;
      routeMetres += STEP_M * s.passes; score += STEP_M * s.passes * visible;
      for (const r of s.routes) routes.add(r);
    }
    return {score: Math.round(score), routeMetres: Math.round(routeMetres), wallM: Math.round([...seenWalls].reduce((t, i) => t + walls[i].len, 0)), routes: routes.size};
  };
}

if (process.argv[1]?.endsWith('ride-visibility.ts')) {
  const nRoutes = Number(arg('routes', '600')), seed = Number(arg('seed', '7')), top = Number(arg('top', '20'));
  const t0 = performance.now();
  const fp = loadFootprints();
  console.log(`footprints ${fp.pands.size} (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
  const routes = sampleRoutes(nRoutes, seed);
  console.log(`routes ${routes.routes} from ${routes.destinations} destinations, ${(routes.metres / 1000).toFixed(0)} km, ${routes.samples.length} pooled samples (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
  const score = scorer(routes.samples, fp);
  const backlog = JSON.parse(fs.readFileSync(BACKLOG, 'utf8'));
  const damRd = lngLatToRd([DAM.lng, DAM.lat]);
  const rows = backlog.candidates.map((c: any) => {
    const p = lngLatToRd([c.center[0], c.center[1]]), dist = Math.hypot(p.x - damRd.x, p.y - damRd.y);
    return {id: c.id, name: c.name ?? c.poiNames?.[0] ?? null, footprint: c.footprintSquareMetres, height: c.heightMetres, distM: Math.round(dist), old: c.footprintSquareMetres / Math.max(dist, 100), ride: score(c.id)};
  });
  console.log(`scored ${rows.length} candidates (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
  const catalogue = JSON.parse(fs.readFileSync(CATALOGUE, 'utf8'));
  const byOld = [...rows].filter(r => r.distM <= 3000).sort((a, b) => b.old - a.old), byNew = [...rows].sort((a, b) => (b.ride?.score ?? 0) - (a.ride?.score ?? 0));
  byNew.forEach((r, i) => { if (r.ride) (r as any).rank = i + 1; });
  const installed = catalogue.models.filter((m: any) => m.source === 'building-recipes-large').map((m: any) => ({id: m.recipe.id, pand: m.buildingId, ride: score(m.buildingId)}))
    .sort((a: any, b: any) => (b.ride?.score ?? 0) - (a.ride?.score ?? 0));
  // already modelled since the backlog was built (an ordinary-catalogue entry or a suppressed host): marked, not dropped
  const modelled = new Set<string>(catalogue.models.flatMap((m: any) => [m.buildingId, ...(m.suppress ?? [])]).filter(Boolean));
  const fmt = (r: any) => ({id: r.id, name: r.name, footprint: r.footprint, height: r.height, distM: r.distM, modelled: modelled.has(r.id), ...r.ride});
  const summary = {method: METHOD, seed, routes: routes.routes, routeKm: Math.round(routes.metres / 1000), destinations: routes.destinations, candidates: rows.length,
    topNew: byNew.slice(0, top).map(fmt), topOld: byOld.slice(0, top).map(r => ({...fmt(r), newRank: (r as any).rank ?? null})), installed};
  fs.mkdirSync('artifacts/building-recipes', {recursive: true});
  fs.writeFileSync('artifacts/building-recipes/ride-visibility.json', JSON.stringify(summary, null, 1) + '\n');
  console.log(`\ntop ${top} by ride visibility (new) | by footprint ÷ distance from the Dam within 3 km (old)`);
  for (let i = 0; i < top; i++) {
    const n = byNew[i], o = byOld[i];
    const tag = (r: any) => (fmt(r).modelled ? '*' : ' ');
    console.log(`${String(i + 1).padStart(2)}.${tag(n)}${(n.name ?? n.id.slice(-10)).slice(0, 34).padEnd(34)} ${String(n.ride?.score ?? 0).padStart(9)} m² ${String(n.ride?.routeMetres ?? 0).padStart(6)} m |${tag(o)}${(o.name ?? o.id.slice(-10)).slice(0, 34).padEnd(34)} ${o.footprint} m² ${o.distM} m (new rank ${(o as any).rank ?? '-'})`);
  }
  if (process.argv.includes('--write')) {
    const byId = new Map(rows.map((r: any) => [r.id, r]));
    for (const c of backlog.candidates) { const r: any = byId.get(c.id); c.rideVisibility = r?.ride ? {...r.ride, rank: r.rank} : null; }
    backlog.rideVisibility = {method: METHOD, seed, routes: routes.routes, routeKm: Math.round(routes.metres / 1000), generatedBy: 'scripts/building-recipes/ride-visibility.ts'};
    fs.writeFileSync(BACKLOG, JSON.stringify(backlog, null, 2) + '\n');
    console.log(`wrote rideVisibility into ${BACKLOG}`);
  }
}
