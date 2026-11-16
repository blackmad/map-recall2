/**
 * Centrum looks, phase 1 (lane centrum-looks, 2026-11-15): per-wijk feasibility of a district look for the Centrum wijken,
 * from local data only (Node, no browser). Per wijk: pands and generic share (coverage-v1), BAG build-year mix by period,
 * monument-register coverage (monument-facts / monument-gables), D1 read coverage, published HouseSpecs, block-face faces
 * and intents, street surveys, shops, repetition clusters, the 20th-century block share (buurt-generator territory) and
 * ride exposure (route metres of seeded bike routes between teachable destinations, ride-visibility.ts sampleRoutes).
 *
 *   node --max-old-space-size=8192 --import tsx scripts/centrum-looks/feasibility.ts [--routes=600] [--out=artifacts/centrum-looks/feasibility.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { districtPands, describedPands } from '../buurt-generators/generate.ts';
import { sampleRoutes } from '../building-recipes/ride-visibility.ts';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';

const EXTRACT = 'public/data/extracts/amsterdam';
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const norm = (s: string) => String(s).replace(/^NL\.IMBAG\.Pand\./, '');
const D1 = process.env.ROW_D1_ROOT ?? JSON.parse(fs.readFileSync('scripts/house-specs/rows/rows.json', 'utf8')).d1Root;

export const PERIODS = [
  ['pre1700', 1400, 1699], ['1700s', 1700, 1799], ['1800-1869', 1800, 1869], ['1870-1914', 1870, 1914],
  ['1915-1944', 1915, 1944], ['1945-1979', 1945, 1979], ['1980+', 1980, 2100],
] as const;
export const periodOf = (y: number | null) => y === null || y < 1400 ? 'unknown' : PERIODS.find(p => y >= p[1] && y <= p[2])?.[0] ?? 'unknown';

function ringArea(ring: readonly (readonly [number, number])[]): number {
  const pts = ring.map(c => lngLatToRd([c[0], c[1]]));
  let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; }
  return Math.abs(a) / 2;
}

function d1Reads(): Map<string, string> {
  const out = new Map<string, string>();
  for (const [dir, tag] of [['answers', 'd1'], ['answers-ah07', 'ah07'], ['belt-20261114/answers-kept', 'belt'], ['ring-20261114/answers', 'ring']] as const) {
    const d = path.join(D1, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (!f.endsWith('.json')) continue;
      try { const a = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); if (a.readable !== false && a.pandId) out.set(norm(a.pandId), tag); } catch { /* skip */ }
    }
  }
  return out;
}

function specPands(): Set<string> {
  const s = new Set<string>(), dir = `${EXTRACT}/house-specs/14`;
  for (const x of fs.readdirSync(dir)) for (const f of fs.readdirSync(path.join(dir, x))) {
    const buf = fs.readFileSync(path.join(dir, x, f));
    for (const id of Object.keys(JSON.parse((f.endsWith('.gz') ? zlib.gunzipSync(buf) : buf).toString('utf8')).buildings ?? {})) s.add(norm(id));
  }
  return s;
}

function facePands(): { any: Map<string, string>; intent: Map<string, string> } {
  const any = new Map<string, string>(), intent = new Map<string, string>(), root = 'scripts/block-face/faces';
  for (const face of fs.readdirSync(root)) {
    const pd = path.join(root, face, 'pands');
    if (!fs.existsSync(pd)) continue;
    const typed = fs.existsSync(path.join(root, face, 'intent.json'));
    for (const id of fs.readdirSync(pd)) { any.set(norm(id), face); if (typed) intent.set(norm(id), face); }
  }
  return { any, intent };
}

function surveyPands(): Set<string> {
  const s = new Set<string>(), root = 'scripts/street-surveys/streets';
  for (const f of fs.readdirSync(root)) for (const p of JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')).pands ?? []) s.add(norm(p.pandId));
  return s;
}

type Poly = { rings: [number, number][][]; box: number[] };
function inside(rings: [number, number][][], x: number, y: number): boolean {
  let hit = false;
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

async function main() {
  const out = arg('out') ?? 'artifacts/centrum-looks/feasibility.json';
  const fc = JSON.parse(fs.readFileSync(`${EXTRACT}/coverage-v1/buurten.json`, 'utf8'));
  const centrum = fc.features.filter((f: any) => f.properties.stadsdeel === 'Centrum');
  const wijken = new Map<string, any[]>();
  for (const f of centrum) (wijken.get(f.properties.wijk) ?? wijken.set(f.properties.wijk, []).get(f.properties.wijk)!).push(f);
  const facts = JSON.parse(fs.readFileSync(`${EXTRACT}/monument-facts.json`, 'utf8')).buildings as Record<string, any>;
  const factsBy = new Map(Object.entries(facts).map(([k, v]) => [norm(k), v]));
  const gables = JSON.parse(fs.readFileSync(`${EXTRACT}/monument-gables.json`, 'utf8')).buildings as Record<string, string>;
  const gablesBy = new Map(Object.entries(gables).map(([k, v]) => [norm(k), v]));
  const shops = new Set(Object.keys(JSON.parse(fs.readFileSync(`${EXTRACT}/shopfronts.json`, 'utf8')).buildings ?? {}).map(norm));
  const reads = d1Reads(), specs = specPands(), faces = facePands(), surveys = surveyPands(), described = describedPands();
  console.error(`reads ${reads.size}, specs ${specs.size}, face pands ${faces.any.size} (intent ${faces.intent.size}), surveys ${surveys.size}, described ${described.size}`);

  // Ride exposure: route metres (5 m samples x passes) inside each wijk.
  const nRoutes = Number(arg('routes') ?? 600);
  const routes = sampleRoutes(nRoutes, 7);
  const polys = new Map<string, Poly[]>();
  for (const [w, fs_] of wijken) polys.set(w, fs_.map((f: any) => {
    const g = f.geometry, rings = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).flat().map((r: number[][]) => r.map(c => { const p = lngLatToRd([c[0], c[1]]); return [p.x, p.y] as [number, number]; }));
    const xs = rings.flat().map((c: number[]) => c[0]), ys = rings.flat().map((c: number[]) => c[1]);
    return { rings, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
  }));
  const rideM = new Map<string, number>(); let rideTotal = 0;
  for (const s of routes.samples) {
    rideTotal += 5 * s.passes;
    for (const [w, ps] of polys) if (ps.some(q => s.x >= q.box[0] && s.x <= q.box[2] && s.y >= q.box[1] && s.y <= q.box[3] && inside(q.rings, s.x, s.y))) { rideM.set(w, (rideM.get(w) ?? 0) + 5 * s.passes); break; }
  }

  const table: any[] = [];
  for (const [wijk, feats] of wijken) {
    const codes = feats.map((f: any) => f.properties.code);
    const cov = feats.map((f: any) => f.properties);
    const pands = districtPands({ buurten: codes } as never);
    const ids = pands.map(p => norm(p.id));
    const periods: Record<string, number> = {};
    for (const p of pands) periods[periodOf(p.year)] = (periods[periodOf(p.year)] ?? 0) + 1;
    const n = pands.length;
    const area = new Map(pands.map(p => [norm(p.id), ringArea(p.ring)]));
    const minor = (id: string) => (area.get(id) ?? 0) < 20;
    const main_ = ids.filter(id => !minor(id));
    const f = main_.filter(id => factsBy.has(id));
    const gab = main_.filter(id => gablesBy.has(id) || (factsBy.get(id)?.gable && factsBy.get(id).gable !== 'plain'));
    const corn = main_.filter(id => { const x = factsBy.get(id); return x && (x.gable === 'cornice' || (x.elements ?? []).some((e: any) => e.key === 'crownCornice' || e.key === 'corniceConsoles')); });
    const dorm = main_.filter(id => (factsBy.get(id)?.elements ?? []).some((e: any) => e.key === 'dormer' || e.key === 'attic'));
    const crownMix: Record<string, number> = {};
    for (const id of main_) { const g = gablesBy.get(id) ?? factsBy.get(id)?.gable; if (g) crownMix[g] = (crownMix[g] ?? 0) + 1; }
    const y = (id: string) => pands.find(p => norm(p.id) === id)?.year ?? null;
    const yearOf = new Map(pands.map(p => [norm(p.id), p.year]));
    const c20 = main_.filter(id => (yearOf.get(id) ?? 0) >= 1915);
    const c20Block = c20.filter(id => (area.get(id) ?? 0) >= 300);
    const pre1915 = main_.filter(id => { const yy = yearOf.get(id); return yy !== null && yy !== undefined && yy >= 1400 && yy < 1915; });
    const faceNames = new Set(main_.map(id => faces.any.get(id)).filter(Boolean));
    const intentNames = new Set(main_.map(id => faces.intent.get(id)).filter(Boolean));
    const generic = cov.reduce((t: number, p: any) => t + (p.tiers?.generic ?? 0), 0), covPands = cov.reduce((t: number, p: any) => t + p.pands, 0);
    const clusters = cov.flatMap((p: any) => p.clusters ?? []).sort((a: any, b: any) => b.n - a.n).slice(0, 5);
    void y;
    table.push({
      wijk, code: codes[0].slice(0, 2), buurten: codes, pands: n, nonMinor: main_.length, coveragePands: covPands, generic, genericShare: +(generic / Math.max(1, covPands)).toFixed(3),
      periods, pre1915: pre1915.length, c20: c20.length, c20Block: c20Block.length,
      register: { facts: f.length, gable: gab.length, cornice: corn.length, dormer: dorm.length, crownMix },
      d1: main_.filter(id => reads.has(id)).length, d1ByTranche: main_.reduce((o: Record<string, number>, id) => { const t = reads.get(id); if (t) o[t] = (o[t] ?? 0) + 1; return o; }, {}),
      houseSpecs: main_.filter(id => specs.has(id)).length, described: main_.filter(id => described.has(id)).length,
      faces: faceNames.size, facePands: main_.filter(id => faces.any.has(id)).length, intentFaces: intentNames.size, intentPands: main_.filter(id => faces.intent.has(id)).length,
      surveyPands: main_.filter(id => surveys.has(id)).length, shops: main_.filter(id => shops.has(id)).length,
      repetitiveGeneric: cov.reduce((t: number, p: any) => t + (p.repetitiveGeneric ?? 0), 0), topClusters: clusters,
      rideM: Math.round(rideM.get(wijk) ?? 0), rideShare: +((rideM.get(wijk) ?? 0) / rideTotal).toFixed(4),
    });
  }
  table.sort((a, b) => b.rideM - a.rideM);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), routes: routes.routes, rideKm: Math.round(rideTotal / 1000), d1Root: D1, table }, null, 1));
  for (const r of table) console.log(JSON.stringify(r));
}
if (process.argv[1]?.endsWith('feasibility.ts')) await main();
