/**
 * City-wide search for building designs that repeat exactly (lane repeated-buildings, 2026-11-15).
 *
 *   node --max-old-space-size=8192 --import tsx scripts/repeated-buildings/detect.ts [--routes=800] [--seed=7] [--top=60]
 *     [--out=docs/reports/repeated-buildings-20261115.json] [--include-covered]
 *
 * Every BAG pand of the game's tiles (`bag-tiles/14`: ring, 3DBAG height/eaves/ridge/roof, BAG year) gets a pose-free
 * footprint signature (`src/canalRecall/repeatedBuildings/signature.ts`). Two pands are copies when their roof code is
 * equal, years within 3, height within 1.3 m, MRR sides within 0.8 m, area within 7 % and the canonical footprint
 * Hausdorff distance within max(0.9 m, 2 % of the long side). Plain footprints (a rectangle says little) only pair with
 * pands within 250 m (one estate or one row); footprints with notches or arms pair city-wide (a standard design).
 * Copies join by union-find; each group reports its medoid, every member's distance to the medoid, the spreads, the
 * streets, the architect from building-facts (when the register names one) and the ride exposure.
 *
 * Ride exposure: `sampleRoutes` from `ride-visibility.ts` (seeded teachable-destination pairs ≤ 6 km of the Dam over the
 * bike graph, 5 m samples with a pass count); a pand's exposure is Σ 5 m × passes over route samples within 35 m of
 * its footprint. Groups rank by Σ exposure over the copies (= copies × mean exposure).
 *
 * Pands already drawn by a model (covers.json, building-types instances, block-face chunks) are skipped unless
 * `--include-covered`; a group keeps a `coveredShare` from the members that were dropped for that reason.
 * Panorama per group: the nearest Amsterdam panorama (data.amsterdam.nl, CC BY 4.0) to the medoid, looked up for the
 * top groups only (cached under .cache/repeated-buildings/).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {lngLatToRd, rdToLngLat} from '../../src/canalRecall/facade/rdNew.ts';
import {complexity, DEFAULT_TOLERANCE as T, shapeDistance, shapeTolerance, signature, type P, type Signature} from '../../src/canalRecall/repeatedBuildings/signature.ts';
import {sampleRoutes} from '../building-recipes/ride-visibility.ts';

const arg = (n: string, d: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const nRoutes = Number(arg('routes', '800')), seed = Number(arg('seed', '7')), TOP = Number(arg('top', '60'));
const OUT = arg('out', 'docs/reports/repeated-buildings-20261115.json');
const includeCovered = process.argv.includes('--include-covered');
const UA = 'MapRecall/1.0 (+https://github.com/blackmad/map-recall2)';
const LOCAL_M = 250, EXPOSURE_M = 35, STEP_M = 5;

// ---- pands ---------------------------------------------------------------------------------------------------------
interface Pand {
  id: string; ring: P[]; c: P; lngLat: [number, number]; height: number; eaves: number | null; ridge: number | null; roof: number; year: number;
  sig: Signature; cx: number; bbox: [number, number, number, number];
}
const TILES = 'public/data/extracts/amsterdam/bag-tiles/14';
const pands: Pand[] = [], seen = new Set<string>();
let read = 0, skipped = {minor: 0, noYear: 0, noSig: 0, covered: 0};

const covered = new Set<string>();
{
  const covers = JSON.parse(fs.readFileSync('public/canal-drive/models/covers.json', 'utf8')).models as Record<string, {p?: string[]}>;
  for (const m of Object.values(covers)) for (const p of m.p ?? []) covered.add(p);
  for (const i of JSON.parse(fs.readFileSync('public/canal-drive/building-types/instances.json', 'utf8')) as any[]) { covered.add(i.pand); for (const a of i.alsoSuppress ?? []) covered.add(a); }
  for (const c of JSON.parse(fs.readFileSync('public/canal-drive/ordinary-buildings-data/chunks.json', 'utf8')).chunks as any[]) for (const s of c.suppress ?? []) covered.add(String(s).replace('NL.IMBAG.Pand.', ''));
}
const coveredHit = new Map<string, number>(); // signature-matching covered pands are kept aside to report coveredShare
const coveredPands: Pand[] = [];

for (const x of fs.readdirSync(TILES)) for (const f of fs.readdirSync(path.join(TILES, x))) {
  const gj = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(TILES, x, f))).toString());
  for (const ft of gj.features) {
    const pr = ft.properties, id = String(pr.id).replace('NL.IMBAG.Pand.', '');
    if (seen.has(id)) continue; seen.add(id); read++;
    const g = ft.geometry;
    const rings: number[][][] = g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map((p: number[][][]) => p[0]) : [];
    if (!rings.length) continue;
    const ll = rings.sort((a, b) => b.length - a.length)[0];
    const ring: P[] = ll.map(([lng, lat]) => { const r = lngLatToRd([lng, lat]); return [r.x, r.y] as P; });
    const height = Number(pr.height ?? 0), year = Number(pr.year ?? 0);
    if (!(year >= 1100 && year <= 2100)) { skipped.noYear++; continue; }
    const sig = signature(ring);
    if (!sig) { skipped.noSig++; continue; }
    if (height < 3.5 || sig.area < 25) { skipped.minor++; continue; }
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const [px, py] of ring) { bx0 = Math.min(bx0, px); by0 = Math.min(by0, py); bx1 = Math.max(bx1, px); by1 = Math.max(by1, py); }
    const c: P = [(bx0 + bx1) / 2, (by0 + by1) / 2], ll0 = rdToLngLat({x: c[0], y: c[1]});
    const p: Pand = {id, ring, c, lngLat: [+ll0[0].toFixed(6), +ll0[1].toFixed(6)], height, eaves: pr.eaves ?? null, ridge: pr.ridge ?? null, roof: Number(pr.roof ?? 0), year, sig, cx: complexity(sig), bbox: [bx0, by0, bx1, by1]};
    if (covered.has(id) && !includeCovered) { skipped.covered++; coveredPands.push(p); continue; }
    pands.push(p);
  }
}
console.log(`read ${read} pands; candidates ${pands.length}; skipped`, skipped);

// ---- pairing --------------------------------------------------------------------------------------------------------
const COMPLEX = 0.25;
function compatible(a: Pand, b: Pand): boolean {
  return a.roof === b.roof && Math.abs(a.year - b.year) <= T.years && Math.abs(a.height - b.height) <= T.heightM
    && Math.abs(a.sig.L - b.sig.L) <= T.sideM && Math.abs(a.sig.W - b.sig.W) <= T.sideM
    && Math.abs(a.sig.area - b.sig.area) <= T.areaShare * Math.max(a.sig.area, b.sig.area);
}
const parent = pands.map((_, i) => i);
const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
const pairD = new Map<string, number>();
let tested = 0, joined = 0;
function tryPair(i: number, j: number) {
  const a = pands[i], b = pands[j];
  if (!compatible(a, b)) return;
  tested++;
  const tol = shapeTolerance(Math.max(a.sig.L, b.sig.L));
  const {d} = shapeDistance(a.sig, b.sig, tol);
  if (d <= tol) { parent[find(i)] = find(j); joined++; if (pairD.size < 2e6) pairD.set(i < j ? `${i},${j}` : `${j},${i}`, d); }
}
// (a) local pairs: every pand against pands within LOCAL_M (spatial grid)
{
  const grid = new Map<string, number[]>(), C = LOCAL_M;
  pands.forEach((p, i) => { const k = `${Math.floor(p.c[0] / C)},${Math.floor(p.c[1] / C)}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(i); });
  pands.forEach((p, i) => {
    if (i % 20000 === 0) console.log(`local ${i}/${pands.length} tested ${tested} joined ${joined}`);
    const gx = Math.floor(p.c[0] / C), gy = Math.floor(p.c[1] / C);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const j of grid.get(`${gx + dx},${gy + dy}`) ?? []) {
      if (j <= i) continue;
      const q = pands[j];
      if (Math.hypot(p.c[0] - q.c[0], p.c[1] - q.c[1]) > LOCAL_M) continue;
      tryPair(i, j);
    }
  });
  console.log(`local: tested ${tested}, joined ${joined}`);
}
// (b) city-wide pairs for footprints with notches/arms: bins on roof, year/4, L and W at 0.8 m
{
  const bins = new Map<string, number[]>(), key = (r: number, y: number, l: number, w: number) => `${r}|${y}|${l}|${w}`;
  pands.forEach((p, i) => { if (p.cx < COMPLEX) return; const k = key(p.roof, Math.floor(p.year / 4), Math.floor(p.sig.L / T.sideM), Math.floor(p.sig.W / T.sideM)); (bins.get(k) ?? bins.set(k, []).get(k)!).push(i); });
  const before = tested;
  pands.forEach((p, i) => {
    if (p.cx < COMPLEX) return;
    const y = Math.floor(p.year / 4), l = Math.floor(p.sig.L / T.sideM), w = Math.floor(p.sig.W / T.sideM);
    for (let dy = -1; dy <= 1; dy++) for (let dl = -1; dl <= 1; dl++) for (let dw = -1; dw <= 1; dw++) for (const j of bins.get(key(p.roof, y + dy, l + dl, w + dw)) ?? []) {
      if (j <= i) continue;
      if (Math.hypot(p.c[0] - pands[j].c[0], p.c[1] - pands[j].c[1]) <= LOCAL_M) continue; // done in (a)
      tryPair(i, j);
    }
  });
  console.log(`city-wide: tested ${tested - before}, joined total ${joined}`);
}

// ---- exposure --------------------------------------------------------------------------------------------------------
const groupsRaw = new Map<number, number[]>();
pands.forEach((_, i) => { const r = find(i); (groupsRaw.get(r) ?? groupsRaw.set(r, []).get(r)!).push(i); });
const multi = [...groupsRaw.values()].filter(g => g.length >= 3);
console.log(`groups with ≥3 copies: ${multi.length}`);

const t0 = Date.now();
const routesFile = `.cache/repeated-buildings/routes-${nRoutes}-${seed}.json`;
const routes: {samples: {x: number; y: number; passes: number}[]; routes: number; metres: number} = fs.existsSync(routesFile) ? JSON.parse(fs.readFileSync(routesFile, 'utf8')) : (() => {
  const r = sampleRoutes(nRoutes, seed), out = {samples: r.samples.map(s => ({x: s.x, y: s.y, passes: s.passes})), routes: r.routes, metres: r.metres};
  fs.mkdirSync(path.dirname(routesFile), {recursive: true}); fs.writeFileSync(routesFile, JSON.stringify(out)); return out;
})();
console.log(`routes ${routes.routes}, ${(routes.metres / 1000).toFixed(0)} km, ${routes.samples.length} samples, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const SG = 50, sgrid = new Map<string, {x: number; y: number; passes: number}[]>();
for (const s of routes.samples) { const k = `${Math.floor(s.x / SG)},${Math.floor(s.y / SG)}`; (sgrid.get(k) ?? sgrid.set(k, []).get(k)!).push(s); }
function distToRing(x: number, y: number, ring: P[]): number {
  let inside = false, best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    const dx = xj - xi, dy = yj - yi, L2 = dx * dx + dy * dy, t = L2 ? Math.max(0, Math.min(1, ((x - xi) * dx + (y - yi) * dy) / L2)) : 0;
    best = Math.min(best, Math.hypot(x - (xi + t * dx), y - (yi + t * dy)));
  }
  return inside ? 0 : best;
}
const exposureOf = (p: Pand): number => {
  let e = 0;
  const [x0, y0, x1, y1] = p.bbox;
  for (let gx = Math.floor((x0 - EXPOSURE_M) / SG); gx <= Math.floor((x1 + EXPOSURE_M) / SG); gx++)
    for (let gy = Math.floor((y0 - EXPOSURE_M) / SG); gy <= Math.floor((y1 + EXPOSURE_M) / SG); gy++)
      for (const s of sgrid.get(`${gx},${gy}`) ?? []) if (distToRing(s.x, s.y, p.ring) <= EXPOSURE_M) e += STEP_M * s.passes;
  return e;
};

// ---- streets and architects -----------------------------------------------------------------------------------------
const streetSegs: {name: string; a: P; b: P}[] = [];
for (const f of JSON.parse(fs.readFileSync('public/data/extracts/amsterdam/streets-routing.json', 'utf8')) as any[]) {
  if (!f.name) continue;
  for (const pth of f.paths ?? (f.path ? [f.path] : [])) for (let i = 1; i < pth.length; i++) {
    const a = lngLatToRd([pth[i - 1][1], pth[i - 1][0]]), b = lngLatToRd([pth[i][1], pth[i][0]]);
    streetSegs.push({name: f.name, a: [a.x, a.y], b: [b.x, b.y]});
  }
}
const SSG = 100, streetGrid = new Map<string, number[]>();
streetSegs.forEach((s, i) => { for (const p of [s.a, s.b]) { const k = `${Math.floor(p[0] / SSG)},${Math.floor(p[1] / SSG)}`; const l = streetGrid.get(k) ?? streetGrid.set(k, []).get(k)!; if (l[l.length - 1] !== i) l.push(i); } });
function nearestStreet(p: Pand): string | null {
  let best = Infinity, name: string | null = null;
  const gx = Math.floor(p.c[0] / SSG), gy = Math.floor(p.c[1] / SSG);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const i of streetGrid.get(`${gx + dx},${gy + dy}`) ?? []) {
    const s = streetSegs[i], d = segDist(p.c, s.a, s.b);
    if (d < best) { best = d; name = s.name; }
  }
  return name;
}
function segDist(p: P, a: P, b: P): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy, t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
const facts = new Map<string, {n?: string; a?: string; y?: string}>();
{
  const BF = 'public/data/extracts/amsterdam/building-facts';
  const walk = (d: string) => { for (const e of fs.readdirSync(d, {withFileTypes: true})) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.json.gz')) {
    const j = JSON.parse(zlib.gunzipSync(fs.readFileSync(p)).toString());
    for (const [k, v] of Object.entries(j.buildings ?? {}) as [string, any[]][]) if (v[3] && typeof v[3] === 'object') facts.set(k.replace(/^P/, ''), v[3]);
  } } };
  if (fs.existsSync(BF)) walk(BF);
}

// ---- groups ---------------------------------------------------------------------------------------------------------
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
interface Group {
  group: string; copies: number; exposure: number; meanExposure: number; score: number;
  medoid: string; medoidLngLat: [number, number]; medoidStreet: string | null;
  signature: {L: number; W: number; area: number; vertices: number; reflex: number; rectangularity: number; complexity: number; height: number; eaves: number | null; ridge: number | null; roof: number; years: [number, number]};
  spread: {maxShapeM: number; medianShapeM: number; heightM: number; years: number; mirroredShare: number; spanKm: number};
  streets: {name: string; n: number}[]; architects: string[]; names: string[];
  coveredCopies: number; local: boolean; archetypeGuess: string;
  confidence: number; confidenceWhy: string[];
  samplePanorama?: {id: string; url: string; date?: string; distanceM: number} | null;
  members: {pand: string; lngLat: [number, number]; street: string | null; year: number; height: number; shapeM: number; mirrored: boolean; exposure: number}[];
}
const groups: Group[] = [];
for (const g of multi) {
  const ms = g.map(i => pands[i]);
  // medoid on up to 40 members (by exposure-independent order: sorted id), distance of every member to it
  const probe = g.length > 40 ? g.filter((_, k) => k % Math.ceil(g.length / 40) === 0) : g;
  let medoid = probe[0], bestSum = Infinity;
  for (const i of probe) { let s = 0; for (const j of probe) if (i !== j) s += shapeDistance(pands[i].sig, pands[j].sig, 5).d; if (s < bestSum) { bestSum = s; medoid = i; } }
  const m = pands[medoid];
  const members = g.map(i => { const p = pands[i], sd = i === medoid ? {d: 0, mirrored: false} : shapeDistance(m.sig, p.sig); return {pand: p.id, lngLat: p.lngLat, street: nearestStreet(p), year: p.year, height: round(p.height, 1), shapeM: round(sd.d), mirrored: sd.mirrored, exposure: Math.round(exposureOf(p))}; });
  const exposure = members.reduce((s, x) => s + x.exposure, 0);
  const streets = new Map<string, number>(); for (const x of members) if (x.street) streets.set(x.street, (streets.get(x.street) ?? 0) + 1);
  const arch = new Set<string>(), names = new Set<string>(); for (const p of ms) { const f = facts.get(p.id); if (f?.a) arch.add(f.a); if (f?.n) names.add(f.n); }
  const xs = ms.map(p => p.c[0]), ys = ms.map(p => p.c[1]), spanKm = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 1000;
  const years = ms.map(p => p.year), hs = ms.map(p => p.height);
  // confidence that the copies share one design from the footprint evidence alone (photos decide the verdict)
  const why: string[] = [];
  let conf = 0.3;
  if (m.cx >= COMPLEX) { conf += 0.25 * m.cx / 1; why.push(`footprint has ${m.sig.reflex} notch corner(s), complexity ${m.cx}`); } else why.push('plain footprint: a shape match says little');
  const ySpread = Math.max(...years) - Math.min(...years); if (ySpread === 0) { conf += 0.15; why.push('one BAG build year'); } else why.push(`build years spread ${ySpread}`);
  const hSpread = Math.max(...hs) - Math.min(...hs); if (hSpread <= 0.6) { conf += 0.1; why.push(`heights within ${round(hSpread, 1)} m`); }
  if (arch.size === 1) { conf += 0.1; why.push(`one architect in the register (${[...arch][0]})`); }
  if (streets.size >= 3 && spanKm > 1) { conf += 0.05; why.push(`${streets.size} streets, ${round(spanKm, 1)} km apart: a standard design`); }
  const medShape = median(members.map(x => x.shapeM));
  if (medShape <= 0.3) { conf += 0.05; why.push(`median shape distance ${medShape} m`); }
  const archetype = m.sig.area > 1500 && m.roof !== 3 ? 'large-flat' : m.height > 25 ? 'tower' : m.sig.area > 400 ? (m.year < 1940 ? 'pre-war block' : 'post-war block') : m.sig.area < 60 && m.height < 6 ? 'kiosk / utility' : m.year < 1940 ? 'pre-war house' : 'post-war house';
  groups.push({
    group: `${archetype.replace(/[^a-z]+/g, '-')}-${m.year}-${m.id.slice(-6)}`, copies: g.length, exposure, meanExposure: Math.round(exposure / g.length), score: exposure,
    medoid: m.id, medoidLngLat: m.lngLat, medoidStreet: nearestStreet(m),
    signature: {L: round(m.sig.L, 1), W: round(m.sig.W, 1), area: Math.round(m.sig.area), vertices: m.sig.vertices, reflex: m.sig.reflex, rectangularity: round(m.sig.rectangularity), complexity: m.cx, height: round(m.height, 1), eaves: m.eaves, ridge: m.ridge, roof: m.roof, years: [Math.min(...years), Math.max(...years)]},
    spread: {maxShapeM: Math.max(...members.map(x => x.shapeM)), medianShapeM: medShape, heightM: round(hSpread, 1), years: ySpread, mirroredShare: round(members.filter(x => x.mirrored).length / members.length), spanKm: round(spanKm, 2)},
    streets: [...streets].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({name, n})), architects: [...arch], names: [...names].slice(0, 8),
    coveredCopies: 0, local: spanKm <= LOCAL_M / 1000 * 2, archetypeGuess: archetype,
    confidence: round(Math.min(1, conf)), confidenceWhy: why,
    members: members.sort((a, b) => b.exposure - a.exposure),
  });
}
// covered copies: covered pands that would have joined a group (same tolerance against the medoid)
for (const g of groups) {
  const m = pands.find(p => p.id === g.medoid)!;
  for (const c of coveredPands) if (compatible(m, c) && Math.hypot(m.c[0] - c.c[0], m.c[1] - c.c[1]) < (m.cx >= COMPLEX ? 1e9 : 2000) && shapeDistance(m.sig, c.sig, shapeTolerance(m.sig.L)).d <= shapeTolerance(m.sig.L)) g.coveredCopies++;
}
groups.sort((a, b) => b.score - a.score);

// ---- sample panorama for the top groups -------------------------------------------------------------------------------
async function nearestPano(lng: number, lat: number): Promise<Group['samplePanorama']> {
  const file = `.cache/repeated-buildings/pano/${lng.toFixed(6)}_${lat.toFixed(6)}.json`;
  let j: any;
  if (fs.existsSync(file)) j = JSON.parse(fs.readFileSync(file, 'utf8'));
  else {
    const url = `https://api.data.amsterdam.nl/panorama/panoramas/?near=${lng},${lat}&radius=40&srid=4326&page_size=5&newest_in_range=true`;
    try {
      const r = await fetch(url, {headers: {'User-Agent': UA, Accept: 'application/json'}, signal: AbortSignal.timeout(30000)});
      if (!r.ok) return null;
      j = await r.json();
      fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, JSON.stringify(j));
    } catch { return null; }
  }
  const items = j?._embedded?.panoramas ?? [];
  if (!items.length) return null;
  const it = items[0], [plng, plat] = it.geometry?.coordinates ?? [lng, lat];
  const dm = Math.hypot((plng - lng) * 111320 * Math.cos((lat * Math.PI) / 180), (plat - lat) * 110540);
  return {id: it.pano_id, url: it._links?.equirectangular_small?.href ?? it._links?.self?.href ?? '', date: it.timestamp, distanceM: Math.round(dm)};
}
for (const g of groups.slice(0, TOP)) {
  const best = g.members[0]; // the most-ridden copy
  g.samplePanorama = await nearestPano(best.lngLat[0], best.lngLat[1]);
}

const report = {
  version: 1, generatedAt: new Date().toISOString(),
  method: {
    signature: 'src/canalRecall/repeatedBuildings/signature.ts: BAG ring in RD New, collinear-simplified (0.15 m), centroid + MRR long axis frame; symmetric Hausdorff over 4 poses (8 when square-ish), mirrored copies match',
    tolerance: {...T, shape: 'max(0.9 m, 2 % of L)', localPairsM: LOCAL_M, cityWidePairsComplexityMin: COMPLEX},
    exposure: `ride-visibility.ts sampleRoutes(${routes.routes} routes, seed ${seed}), Σ 5 m × passes of samples within ${EXPOSURE_M} m of the footprint`,
    skipped, candidates: pands.length, coveredSkipped: coveredPands.length,
    sources: 'bag-tiles/14 (BAG CC0 + 3DBAG CC BY 4.0), building-facts (RCE register), streets-routing (OSM ODbL), panoramas data.amsterdam.nl (CC BY 4.0)',
  },
  totals: {groups: groups.length, pandsInGroups: groups.reduce((s, g) => s + g.copies, 0)},
  groups,
};
fs.mkdirSync(path.dirname(OUT), {recursive: true});
fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
console.log(`wrote ${OUT}: ${groups.length} groups, ${report.totals.pandsInGroups} pands`);
for (const g of groups.slice(0, 25)) console.log(`${String(g.copies).padStart(4)} × ${String(g.meanExposure).padStart(6)}  conf ${g.confidence}  ${g.group}  ${g.medoidStreet}  L${g.signature.L}×W${g.signature.W} h${g.signature.height} ${g.signature.years.join('-')} streets ${g.streets.length} cov ${g.coveredCopies}`);
