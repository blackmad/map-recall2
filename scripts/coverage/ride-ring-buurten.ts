/**
 * Ride-ring ranking of buurten: where riders actually pass, per buurt, with the tier mix and the block-face library
 * that already exists for it. Reuses the seeded route sampling of `ride-visibility.ts` (the same routes the dominant
 * backlog is scored on) and pools the sampled route points per coverage-v1 buurt polygon.
 *
 *   node --max-old-space-size=8192 --import tsx scripts/coverage/ride-ring-buurten.ts [--routes=2000] [--seed=7] [--top=40]
 *
 * Writes `docs/reports/ride-ring-buurten-<date>.json` and `.md` (date from `--date`, default today). Per buurt:
 *   - `routeMetres`: pooled route samples inside the polygon, each sample counted as STEP_M × passes;
 *   - `pands`, `nonGenericShare` (1 − generic/pands), `tiers` (pands per tier), `repetition`, `decade`
 *     (from coverage-v1 `buurten.json`);
 *   - `library`: the block-face type library directory (`scripts/block-face/types/<district>/`) the buurt's type
 *     districts point at, with the type-JSON count, or `null` when no library exists.
 * Rows are sorted by `routeMetres` descending. This file only reads; the publish step is the integrator's.
 */
import fs from 'node:fs';
import path from 'node:path';
import {lngLatToRd} from '../../src/canalRecall/facade/rdNew.ts';
import {sampleRoutes} from '../building-recipes/ride-visibility.ts';

const STEP_M = 5; // ride-visibility samples every 5 m (its STEP_M is not exported)

const BUURTEN = 'public/data/extracts/amsterdam/coverage-v1/buurten.json';
const TYPES_DIR = 'scripts/block-face/types';
const CELL = 200;

const arg = (n: string, d: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const nRoutes = Number(arg('routes', '2000')), seed = Number(arg('seed', '7')), top = Number(arg('top', '40'));
const date = arg('date', new Date().toISOString().slice(0, 10).replace(/-/g, ''));
const TIERS = ['bespoke', 'chunk', 'largeRecipe', 'houseRecipe', 'ordinaryGlb', 'buildingType', 'landmarkKit', 'generic'] as const;

type XY = [number, number];
interface Ring { rd: XY[][]; box: [number, number, number, number] }

const buurten = JSON.parse(fs.readFileSync(BUURTEN, 'utf8'));
const libraryNames = new Set<string>(fs.readdirSync(TYPES_DIR, {withFileTypes: true}).filter(d => d.isDirectory()).map(d => d.name));

// Polygons in RD metres. Features are GeoJSON [lng, lat]; a multi-ring polygon keeps every ring (even-odd test).
const rings: Ring[] = buurten.features.map((f: any) => {
  const polys: number[][][][] = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const rd = polys.flatMap(poly => poly.map(ring => ring.map(c => { const p = lngLatToRd([c[0], c[1]]); return [p.x, p.y] as XY; })));
  const xs = rd.flat().map(p => p[0]), ys = rd.flat().map(p => p[1]);
  return {rd, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]};
});

// Grid index: CELL-metre cells -> buurt indices whose bbox touches the cell.
const grid = new Map<string, number[]>();
rings.forEach((r, i) => {
  for (let gx = Math.floor(r.box[0] / CELL); gx <= Math.floor(r.box[2] / CELL); gx++)
    for (let gy = Math.floor(r.box[1] / CELL); gy <= Math.floor(r.box[3] / CELL); gy++) {
      const k = `${gx},${gy}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(i);
    }
});

function inside(rd: XY[][], x: number, y: number): boolean {
  let hit = false;
  for (const ring of rd) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function buurtAt(x: number, y: number): number {
  for (const i of grid.get(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`) ?? []) {
    const r = rings[i];
    if (x >= r.box[0] && x <= r.box[2] && y >= r.box[1] && y <= r.box[3] && inside(r.rd, x, y)) return i;
  }
  return -1;
}

const t0 = performance.now();
const routes = sampleRoutes(nRoutes, seed);
console.log(`routes ${routes.routes} from ${routes.destinations} destinations, ${(routes.metres / 1000).toFixed(0)} km, ${routes.samples.length} pooled samples (${((performance.now() - t0) / 1000).toFixed(1)} s)`);

const metres = new Array<number>(rings.length).fill(0);
let unassigned = 0;
for (const s of routes.samples) {
  const i = buurtAt(s.x, s.y);
  if (i < 0) { unassigned += s.passes * STEP_M; continue; }
  metres[i] += s.passes * STEP_M;
}

const rows = buurten.features.map((f: any, i: number) => {
  const p = f.properties, pands = p.pands || 0, generic = p.tiers?.generic ?? 0;
  const districts: string[] = (p.types?.districts ?? []).filter((d: string) => libraryNames.has(d));
  const library = districts.length
    ? districts.map(d => ({district: d, types: fs.readdirSync(path.join(TYPES_DIR, d)).filter(n => n.endsWith('.json')).length}))
    : null;
  return {
    code: p.code, name: p.name, stadsdeel: p.stadsdeel, wijk: p.wijk,
    routeMetres: Math.round(metres[i]), pands,
    nonGenericShare: pands ? +(1 - generic / pands).toFixed(3) : 0,
    tiers: Object.fromEntries(TIERS.map(t => [t, p.tiers?.[t] ?? 0])),
    repetition: p.repetition ?? 0, decade: p.decade ?? null, modelledShare: p.share ?? 0,
    library,
  };
}).sort((a: any, b: any) => b.routeMetres - a.routeMetres);

const ring = rows.slice(0, top);
const sumTiers = (rs: any[]) => Object.fromEntries(TIERS.map(t => [t, rs.reduce((n, r) => n + r.tiers[t], 0)]));
const summary = {
  method: 'ride-ring-buurten/v1: ride-visibility sampled routes (seed ' + seed + ', ' + routes.routes + ' routes), pooled 5 m samples assigned to coverage-v1 buurt polygons; routeMetres = Σ passes × STEP_M',
  generatedBy: 'scripts/coverage/ride-ring-buurten.ts', seed, routes: routes.routes, routeKm: Math.round(routes.metres / 1000),
  unassignedRouteMetres: Math.round(unassigned), buurten: rows.length, top,
  ringPands: ring.reduce((n, r) => n + r.pands, 0), ringTiers: sumTiers(ring), inBuurtTiers: sumTiers(rows),
  rows,
};
const dir = 'docs/reports';
fs.mkdirSync(dir, {recursive: true});
const base = path.join(dir, `ride-ring-buurten-${date}`);
fs.writeFileSync(`${base}.json`, JSON.stringify(summary, null, 1) + '\n');

const pct = (n: number, d: number) => (d ? `${Math.round(100 * n / d)} %` : '–');
const md = [
  `# Ride-ring buurten (${date})`, '',
  `Sampled routes: ${routes.routes} seeded pairs (seed ${seed}), ${Math.round(routes.metres / 1000)} km, pooled at ${STEP_M} m. Route metres inside a buurt: Σ passes × ${STEP_M} m. Unassigned (outside every buurt): ${Math.round(unassigned)} m.`, '',
  `Top ${top} by route metres cover ${ring.reduce((n, r) => n + r.pands, 0)} pands. Tier mix of that ring: ${TIERS.map(t => `${t} ${summary.ringTiers[t]}`).join(', ')}.`, '',
  `| # | buurt | code | stadsdeel | route m | pands | non-generic | repetition | decade | library |`,
  `|---|---|---|---|---:|---:|---:|---:|---:|---|`,
  ...ring.map((r, i) => `| ${i + 1} | ${r.name} | ${r.code} | ${r.stadsdeel} | ${r.routeMetres} | ${r.pands} | ${pct(r.pands - r.tiers.generic, r.pands)} | ${r.repetition.toFixed(2)} | ${r.decade ?? '–'} | ${r.library ? r.library.map((l: any) => `${l.district} (${l.types})`).join(', ') : 'none'} |`),
  '',
];
fs.writeFileSync(`${base}.md`, md.join('\n'));

console.log(`wrote ${base}.json and .md; ${rows.length} buurten, top ${top} = ${ring.reduce((n, r) => n + r.pands, 0)} pands, unassigned ${Math.round(unassigned)} m`);
for (const r of ring.slice(0, 15)) console.log(`${String(rows.indexOf(r) + 1).padStart(3)} ${r.code.padEnd(5)} ${r.name.slice(0, 32).padEnd(32)} ${String(r.routeMetres).padStart(7)} m ${String(r.pands).padStart(5)} pands lib=${r.library ? r.library.map((l: any) => l.district).join('+') : 'none'}`);
