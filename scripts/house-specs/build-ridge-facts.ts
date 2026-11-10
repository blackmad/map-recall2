// Ridge facts for register gables (lane H5h round 5, #351): does the house's ridge run across its street front (the gable
// faces the street) or along it (a cornice or parapet front with a roof behind)? The round-4 gate (crownRiseM ≥ 2 m)
// cannot tell those apart: a pitched roof behind a cornice rises as high as a gable does (174911, a cornice front that
// drew a street-facing point gable).
//
// Per pand with a register gable (monument-gables.json, monument-facts.json) plus every hand-set pand:
//  - the ridge axis from 3DBAG LoD2.2 roof surfaces (api.3dbag.nl, open data; houseSpec/ridgeFacts.ts ridgeAxis): the
//    area-weighted doubled-angle mean of the downhill directions of the pitched faces (15°–60°), the ridge perpendicular
//    to it, or none (too little pitched face, or faces that disagree: a hipped pyramid, a four-sided mansard);
//  - else the planned ridge: the long axis of the footprint's fitted box, where roofMesh puts a register gable's ridge;
//  - the street front: every footprint edge ≥ 2 m whose wall sees a street straight ahead before another building
//    (streetFronts.ts streetDistance, the test that crowns street gable ends), else the edge nearest a street within the
//    fallback reach, ignoring buildings;
//  - saddle: 0 when 3DBAG's pitched faces all fall on one side of the ridge (a lean-to, often beside a flat deck): no gable
//    stands on its end wall (174911: one 25° face sloping to the neighbour, beside a 7° deck, behind a cornice front);
//  - ridgeToFrontDeg: the smallest angle between the ridge and a street-front edge's normal, 0–90. 0 = the ridge runs
//    straight back from the street and the gable faces it; 90 = the ridge runs along the street.
//
// Writes the staged table `public/data/extracts/amsterdam/staging/ridge-facts.json` that build-house-specs bakes into the
// view (`ridgeToFrontDeg`, `ridgeSrc`), and keeps a resumable compact 3DBAG cache (roof faces as [area, slope, direction], never the CityJSON) at
// artifacts/house-audit/bag3d-ridges.json.
//
//   node --import tsx scripts/house-specs/build-ridge-facts.ts [--offline]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fitRect } from '../../src/canalRecall/roofMesh.ts';
import { axisOff, ridgeAxis, roofFacesFromCityJson, type RoofFace } from '../../src/canalRecall/houseSpec/ridgeFacts.ts';
import { FALLBACK_REACH_M, SegmentGrid, streetDistance, streetSegments, type WallRay } from '../../src/canalRecall/streetFronts.ts';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const EXTRACT = path.join(ROOT, 'public/data/extracts/amsterdam');
const OUT = path.join(EXTRACT, 'staging/ridge-facts.json');
const CACHE = path.join(ROOT, 'artifacts/house-audit/bag3d-ridges.json');
const ORIGIN = { lng: 4.9, lat: 52.37 };
const kx = 111_320 * Math.cos(ORIGIN.lat * Math.PI / 180), KY = 110_540;
const local = (lng: number, lat: number): [number, number] => [(lng - ORIGIN.lng) * kx, (lat - ORIGIN.lat) * KY];
const offline = process.argv.includes('--offline');
const json = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const short = (id: string) => id.slice(-16);

async function fetchRidges(ids: string[], cache: Record<string, RoofFace[] | 0>) {
  const todo = ids.filter(id => !(short(id) in cache));
  console.error(`3DBAG: ${ids.length - todo.length} cached, ${todo.length} to fetch`);
  let done = 0;
  const one = async (id: string) => {
    const pid = `NL.IMBAG.Pand.${short(id)}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`https://api.3dbag.nl/collections/pand/items/${pid}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
        if (res.status === 404) { cache[short(id)] = 0; return; }
        if (!res.ok) continue;
        cache[short(id)] = roofFacesFromCityJson(await res.json());
        return;
      } catch { /* retry */ }
    }
  };
  for (let i = 0; i < todo.length; i += 6) {
    await Promise.all(todo.slice(i, i + 6).map(one));
    done += Math.min(6, todo.length - i);
    if (done % 300 < 6) { console.error(`  ${done}/${todo.length}`); fs.writeFileSync(CACHE, JSON.stringify(cache)); }
  }
  fs.writeFileSync(CACHE, JSON.stringify(cache));
}

async function main() {
  const gables = json(path.join(EXTRACT, 'monument-gables.json')).buildings as Record<string, string>;
  const facts = json(path.join(EXTRACT, 'monument-facts.json')).buildings as Record<string, { gable?: string }>;
  const want = new Set<string>([...Object.keys(gables), ...Object.keys(facts).filter(k => facts[k].gable)].map(short));
  for (const p of json(path.join(ROOT, 'data/house-line/hand-set-v1.json')).pands) want.add(short(String(p.pandId)));
  for (const r of json(path.join(ROOT, 'data/house-line/hand-set-v1.gable-b2.json')).rows) want.add(short(String(r.pandId)));
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  const cache: Record<string, RoofFace[] | 0> = fs.existsSync(CACHE) ? json(CACHE) : {};
  if (!offline) await fetchRidges([...want], cache);

  const routing = json(path.join(EXTRACT, 'streets-routing.json')) as Array<{ highway?: string; path?: number[][]; paths?: number[][][] }>;
  const streets = new SegmentGrid(streetSegments(routing.flatMap(w => (w.paths ?? (w.path ? [w.path] : [])).map(p => ({ highway: w.highway, points: p.map(([lat, lng]) => [lng, lat] as const) }))), ORIGIN), 200);
  const dir = path.join(EXTRACT, 'building-tiles/14');
  const tiles = fs.readdirSync(dir).filter(x => /^\d+$/.test(x)).flatMap(x => fs.readdirSync(path.join(dir, x)).filter(f => f.endsWith('.geojson.gz')).map(f => path.join(dir, x, f)));
  const pands: Record<string, [number, 'b' | 'p'] | [number, 'b', 0]> = {};
  const counts = { wanted: want.size, found: 0, bag3d: 0, plan: 0, noFront: 0, across: 0, along: 0, leanTo: 0 };
  for (const file of tiles) {
    const feats = (JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')).features ?? []) as any[];
    const rings = feats.map(f => { const g = f.geometry; const poly = g?.type === 'Polygon' ? g.coordinates : g?.type === 'MultiPolygon' ? g.coordinates[0] : null; return poly?.[0]?.map(([lng, lat]: number[]) => local(lng, lat)) as [number, number][] | undefined; });
    if (!feats.some(f => want.has(short(String(f.properties?.id ?? ''))))) continue;
    const segs: number[] = [], owners: number[] = [];
    rings.forEach((ring, i) => { if (ring) for (let k = 1; k < ring.length; k++) { segs.push(ring[k - 1][0], ring[k - 1][1], ring[k][0], ring[k][1]); owners.push(i); } });
    const walls = new SegmentGrid(segs, 25, owners);
    feats.forEach((f, i) => {
      const id = short(String(f.properties?.id ?? ''));
      const ring = rings[i];
      if (!want.has(id) || !ring || ring.length < 4 || id in pands) return;
      counts.found++;
      let area2 = 0; for (let k = 1; k < ring.length; k++) area2 += ring[k - 1][0] * ring[k][1] - ring[k][0] * ring[k - 1][1];
      const sign = area2 > 0 ? 1 : -1; // outward normal of a CCW ring is (dy, -dx)
      const edges: Array<{ w: WallRay; d: number; fb: number }> = [];
      for (let k = 1; k < ring.length; k++) {
        const [x0, y0] = ring[k - 1], [x1, y1] = ring[k], len = Math.hypot(x1 - x0, y1 - y0);
        if (len < 2) continue;
        const w: WallRay = { x0, y0, x1, y1, nx: sign * (y1 - y0) / len, ny: -sign * (x1 - x0) / len, len };
        edges.push({ w, d: streetDistance(w, streets, walls, i), fb: streetDistance(w, streets, null, i, FALLBACK_REACH_M) });
      }
      let front = edges.filter(e => e.d < Infinity);
      if (!front.length) { const m = Math.min(...edges.map(e => e.fb)); front = m < Infinity ? edges.filter(e => e.fb === m) : []; }
      if (!front.length) { counts.noFront++; return; }
      const b = cache[id];
      let axis: number | null = null, src: 'b' | 'p' = 'b';
      const bag = b ? ridgeAxis(b) : null;
      if (bag) axis = bag.axis;
      else { const r = fitRect(ring, 40); if (r) { axis = Math.atan2(r.uy, r.ux); src = 'p'; } }
      if (axis === null) return;
      const off = Math.round(Math.min(...front.map(e => axisOff(axis!, Math.atan2(e.w.ny, e.w.nx)))));
      pands[id] = bag && !bag.saddle ? [off, 'b', 0] : [off, src];
      if (bag && !bag.saddle) counts.leanTo++;
      counts[src === 'b' ? 'bag3d' : 'plan']++; counts[off <= 30 ? 'across' : 'along']++;
    });
  }
  fs.writeFileSync(OUT, JSON.stringify({ version: 1, built: new Date().toISOString().slice(0, 10), source: '3DBAG LoD2.2 roof faces (api.3dbag.nl, CC BY 4.0), else the fitted-box long axis; street fronts from streets-routing.json', fields: ['ridgeToFrontDeg', 'src b=3dbag p=plan', 'saddle (0 = a 3DBAG lean-to, absent = a saddle or unknown)'], counts, pands }));
  console.log(JSON.stringify(counts));
}
await main();
