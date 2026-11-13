/**
 * Landmark discovery by street front (2026-11-13): nominates monument groups the factory queue's dominant-building rule
 * misses (the curved Winkelgalerij on the Raadhuisstraat was the case). Writes a staging file, never the queue.
 *
 *   node --import tsx scripts/landmarks/discovery-front.ts [--out=artifacts/landmarks/discovery-2026-11-13.json]
 *        [--only=rce:46505,...] [--no-exclude] [--long=40] [--curve=20] [--ornament=3] [--top=40]
 *
 * A nomination meets all of:
 *   (a) a national or municipal monument: one record of scripts/data/amsterdam-monument-register/records.json.gz (RCE
 *       records joined with the municipal register's pand links by monument number; municipal-only monuments by their
 *       own record), all its BAG pands as one group;
 *   (b) on or beside a ride route: its street front faces a bike-routable street of streets-routing.json (motor-only,
 *       service and busway ways left out) within 30 m, and its score carries the ride-priority weight of
 *       src/canalRecall/ridePriority.ts (the buurt gebied, coverage-v1/buurten.json);
 *   (c) a long front, a curved front, or an ornamented front (discovery-front-core.ts: measures, terms, thresholds).
 * Groups whose street front is mostly on pands already drawn (covers.json, ordinary catalogue, manualCatalogue suppress
 * ids, building-type instances: factory-queue.ts `coveredPands`) or already queued are left out (`--no-exclude` keeps
 * them, for the regression pins). One row per group, keyed by its primary pand (the member with the most front metres).
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {lngLatToRd, rdToLngLat} from '../../src/canalRecall/facade/rdNew.ts';
import {isMotorOnlyHighway} from '../../src/canalRecall/routing/bikeAccess.ts';
import {isRidePriority} from '../../src/canalRecall/ridePriority.ts';
import {coveredPands, QUEUE_FILE} from './factory-queue.ts';
import {loadFootprints, sampleRoutes, scorer} from '../building-recipes/ride-visibility.ts';
import {buildWorld, DEFAULT_THRESHOLDS, measureFront, ornamentClasses, pointInRing, reasons, score, frontEdges, type Pand, type RouteSeg, type Thresholds, type XY} from './discovery-front-core.ts';

const EXTRACT = 'public/data/extracts/amsterdam';
const REGISTER = 'scripts/data/amsterdam-monument-register/records.json.gz';
const NOT_RIDE_HIGHWAYS = new Set(['service', 'busway']);
const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
const pandOf = (s: unknown): string | null => { const m = /(\d{16})/.exec(String(s ?? '')); return m ? m[1] : null; };

export interface MonumentGroup { key: string; keys?: string[]; kind: 'national' | 'municipal'; nr: string; title: string | null; url: string; pands: string[]; text: string; point: [number, number] | null }

/** One group per monument: RCE records joined with the municipal register's pand links by number; municipal-only records alone. */
export function monumentGroups(): MonumentGroup[] {
  const snap = JSON.parse(zlib.gunzipSync(fs.readFileSync(REGISTER)).toString('utf8'));
  const muniByNr = new Map<string, any[]>();
  for (const m of snap.municipal) if (m.monumentNumber && !m.withdrawnAt) { const a = muniByNr.get(m.monumentNumber) ?? []; a.push(m); muniByNr.set(m.monumentNumber, a); }
  const out: MonumentGroup[] = [], seen = new Set<string>();
  const textOf = (r: any) => (r.descriptions ?? []).map((d: any) => d.text ?? '').join(' ').trim();
  for (const r of snap.rce) {
    if (!(r.status ?? []).includes('rijksmonument')) continue;
    const muni = muniByNr.get(r.monumentNumber) ?? [];
    const pands = [...new Set([...(r.bagPandIds ?? []), ...muni.flatMap((m: any) => m.bagPandIds ?? [])])];
    const pt = (r.locations ?? []).map((l: any) => /Point\s*\(\s*([\d.]+)\s+([\d.]+)/i.exec(l.value)).find(Boolean);
    out.push({key: `rce:${r.monumentNumber}`, kind: 'national', nr: r.monumentNumber, title: muni[0]?.metadata?._links?.self?.title ?? null, url: r.recordUrl, pands, text: [textOf(r), ...muni.map(textOf)].join(' ').trim(), point: pt ? [Number(pt[1]), Number(pt[2])] : null});
    seen.add(r.monumentNumber);
  }
  for (const m of snap.municipal) {
    if (m.withdrawnAt || (m.monumentNumber && seen.has(m.monumentNumber))) continue;
    const national = m.status === 'Rijksmonument';
    if (m.monumentNumber) seen.add(m.monumentNumber);
    const group = m.monumentNumber ? muniByNr.get(m.monumentNumber) ?? [m] : [m];
    out.push({key: `${national ? 'rce' : 'gm'}:${m.monumentNumber ?? m.sourceId}`, kind: national ? 'national' : 'municipal', nr: m.monumentNumber ?? m.sourceId, title: m.metadata?._links?.self?.title ?? null, url: m.recordUrl, pands: [...new Set(group.flatMap((g: any) => g.bagPandIds ?? []))] as string[], text: group.map(textOf).join(' ').trim(), point: null});
  }
  return out;
}

/**
 * Register records that share a BAG pand are one building on the street (a warehouse row drawn as one pand but listed
 * house by house, Entrepotdok 58-84, gave fourteen identical rows in v1): merge them, union-find over pand ids.
 * The merged group keeps the first record's key and title, every key in `keys`, all texts.
 */
export function mergeSharedPands(groups: MonumentGroup[]): MonumentGroup[] {
  const parent = groups.map((_, i) => i);
  const find = (i: number): number => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const owner = new Map<string, number>();
  groups.forEach((g, i) => { for (const p of g.pands) { const o = owner.get(p); if (o === undefined) owner.set(p, i); else parent[find(i)] = find(o); } });
  const merged = new Map<number, MonumentGroup>();
  groups.forEach((g, i) => {
    const r = find(i), m = merged.get(r);
    if (!m) merged.set(r, {...g, keys: [g.key], pands: [...g.pands]});
    else { m.keys!.push(g.key); m.pands = [...new Set([...m.pands, ...g.pands])]; if (g.text && !m.text.includes(g.text)) m.text = `${m.text} ${g.text}`.trim(); m.title ??= g.title; }
  });
  return [...merged.values()];
}

export interface BagPand extends Pand { lngLat: [number, number] }
let bagCache: Map<string, BagPand> | null = null;
/** Every BAG pand of the game's bag tiles (z14), ring in RD metres. */
export function bagPands(): Map<string, BagPand> {
  if (bagCache) return bagCache;
  const out = new Map<string, BagPand>();
  const index = read(`${EXTRACT}/bag-tiles/index-z14.json`);
  for (const t of index.tileList as string[]) {
    const f = `${EXTRACT}/bag-tiles/${t}.geojson.gz`;
    if (!fs.existsSync(f)) continue;
    for (const ft of JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString('utf8')).features) {
      const id = pandOf(ft.properties.id); if (!id || out.has(id)) continue;
      const g = ft.geometry, ring = (g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0]) as number[][];
      out.set(id, {id, ring: ring.map(p => { const r = lngLatToRd([p[0], p[1]]); return [r.x, r.y] as XY; }), height: ft.properties.height, year: ft.properties.year, lngLat: [ring[0][0], ring[0][1]]});
    }
  }
  return bagCache = out;
}

/** Ride-route segments (RD): streets-routing.json minus motor-only, service and busway ways. */
export function rideRoutes(): RouteSeg[] {
  const out: RouteSeg[] = [];
  for (const s of read(`${EXTRACT}/streets-routing.json`) as any[]) {
    if (isMotorOnlyHighway(s.highway) || NOT_RIDE_HIGHWAYS.has(s.highway)) continue;
    for (const p of (s.paths ?? [s.path]) as number[][][]) {
      const rd = p.map(q => { const r = lngLatToRd([q[1], q[0]]); return [r.x, r.y] as XY; });
      for (let i = 1; i < rd.length; i++) out.push({a: rd[i - 1], b: rd[i], name: s.name ?? ''});
    }
  }
  return out;
}

type Buurt = {name: string; gebied?: string; rings: number[][][]};
let buurtCache: Buurt[] | null = null;
export function buurtAt(lngLat: [number, number]): Buurt | null {
  buurtCache ??= (read(`${EXTRACT}/coverage-v1/buurten.json`).features as any[]).map(f => ({name: f.properties.name, gebied: f.properties.gebied, rings: (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map((p: number[][][]) => p[0])}));
  return buurtCache.find(b => b.rings.some(r => pointInRing(lngLat as XY, r as XY[]))) ?? null;
}

export function queuedPands(file = QUEUE_FILE): Set<string> {
  const out = new Set<string>();
  if (fs.existsSync(file)) for (const i of read(file).items ?? []) { const p = pandOf(i.pand); if (p) out.add(p); }
  return out;
}

export interface Nomination {
  id: string; pand: string; pands: string[]; key: string; kind: 'national' | 'municipal'; nr: string; name: string | null; register: string;
  reasons: string[]; score: number; rank?: number; rideVisibility: {score: number; routes: number} | null; keys: string[];
  measures: {frontM: number; streetFrontM: number; curveDeg: number; curveRangeDeg: number; ornament: string[]; ornamentTerms: Record<string, string>; footprintM2: number; heightM: number; year: number | null};
  street: string | null; streets: string[]; buurt: string | null; gebied: string | null; ridePriority: boolean;
  center: [number, number]; aim: {lngLat: [number, number]; normalDeg: number; runM: number} | null;
  coveredShare: number; queued: boolean;
}

/** Ride visibility per pand id (16 digits): ride-visibility.ts `scorer` over its seeded routes, or null without routes. */
export type RideScorer = (pand: string) => {score: number; routes: number} | null;
export function rideScorer(routes = 2000, seed = 7): RideScorer {
  const fp = loadFootprints(), r = sampleRoutes(routes, seed), s = scorer(r.samples, fp);
  return (pand: string) => { const v = s(`NL.IMBAG.Pand.${pand}`); return v ? {score: v.score, routes: v.routes} : null; };
}

export interface DiscoverOptions { only?: Set<string>; exclude?: boolean; thresholds?: Thresholds; log?: (s: string) => void; ride?: RideScorer | null }
export interface DiscoverResult { nominations: Nomination[]; measured: {key: string; frontM: number; curveDeg: number; curveRangeDeg: number; ornament: number}[]; excluded: {covered: number; queued: number}; groups: number; withPands: number }

const areaRd = (r: XY[]) => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); };

export function discover(opts: DiscoverOptions = {}): DiscoverResult {
  const t = opts.thresholds ?? DEFAULT_THRESHOLDS, log = opts.log ?? (() => {});
  let groups = monumentGroups().filter(g => !opts.only || opts.only.has(g.key) || g.pands.length);
  log(`register groups: ${groups.length}`);
  const bag = bagPands();
  log(`bag pands: ${bag.size}`);
  // the pand-point fallback for a register record without pand links (as build-monument-facts.ts)
  for (const g of groups) if (!g.pands.length && g.point) {
    const rd = lngLatToRd(g.point); const p: XY = [rd.x, rd.y];
    for (const b of bag.values()) if (Math.abs(b.ring[0][0] - p[0]) < 80 && Math.abs(b.ring[0][1] - p[1]) < 80 && pointInRing(p, b.ring)) { g.pands = [b.id]; break; }
  }
  // merge after the point fallback: two records whose points fall in one pand are one building too
  groups = mergeSharedPands(groups).filter(g => !opts.only || (g.keys ?? [g.key]).some(k => opts.only!.has(k)));
  const world = buildWorld([...bag.values()], rideRoutes());
  log('world indexed');
  const covered = opts.exclude === false ? new Set<string>() : coveredPands();
  const queued = opts.exclude === false ? new Set<string>() : queuedPands();
  const nominations: Nomination[] = [], measured: DiscoverResult['measured'] = [];
  let withPands = 0, exCovered = 0, exQueued = 0, n = 0;
  for (const g of groups) {
    if (++n % 1000 === 0) log(`  ${n}/${groups.length}`);
    const members = g.pands.map(p => bag.get(p)).filter((p): p is BagPand => !!p);
    if (!members.length) continue;
    withPands++;
    const m = measureFront(world, members);
    const orn = ornamentClasses(g.text);
    measured.push({key: g.key, frontM: +m.frontM.toFixed(1), curveDeg: +m.curveDeg.toFixed(1), curveRangeDeg: +m.rawCurveRangeDeg.toFixed(1), ornament: orn.classes.length});
    const facts = {frontM: m.frontM, streetFrontM: m.streetFrontM, curveDeg: m.curveDeg, ornament: orn.classes};
    const why = reasons(facts, t);
    if (!why.length || m.streetFrontM <= 0) continue;
    // front metres per member pand, for the primary pand and the covered share
    const perPand = new Map<string, number>();
    for (const e of frontEdges(world, members)) perPand.set(e.pand, (perPand.get(e.pand) ?? 0) + e.streetM);
    const total = [...perPand.values()].reduce((a, b) => a + b, 0) || 1;
    const coveredShare = [...perPand].filter(([p]) => covered.has(p)).reduce((a, [, v]) => a + v, 0) / total;
    const isQueued = members.some(p => queued.has(p.id));
    if (coveredShare >= 0.5) { exCovered++; continue; }
    if (isQueued) { exQueued++; continue; }
    const primary = [...perPand].sort((a, b) => b[1] - a[1])[0][0];
    const allX = members.flatMap(p => p.ring.map(q => q[0])), allY = members.flatMap(p => p.ring.map(q => q[1]));
    const c = rdToLngLat({x: (Math.min(...allX) + Math.max(...allX)) / 2, y: (Math.min(...allY) + Math.max(...allY)) / 2});
    const buurt = buurtAt([c[0], c[1]]);
    const ride = isRidePriority(buurt);
    let ridePasses: {score: number; routes: number} | null = null;
    if (opts.ride) {
      ridePasses = {score: 0, routes: 0};
      for (const p of members) { const v = opts.ride(p.id); if (v) { ridePasses.score += v.score; ridePasses.routes = Math.max(ridePasses.routes, v.routes); } }
      if (!ridePasses.routes) continue; // (b): not seen from any sampled ride route
    }
    const run = m.curveRun ?? m.best;
    const aim = run ? {lngLat: (() => { const l = rdToLngLat({x: run.mid[0], y: run.mid[1]}); return [+l[0].toFixed(7), +l[1].toFixed(7)] as [number, number]; })(), normalDeg: +run.normalDeg.toFixed(1), runM: +run.lengthM.toFixed(1)} : null;
    const years = members.map(p => p.year).filter((y): y is number => !!y);
    nominations.push({
      id: primary, pand: primary, pands: members.map(p => p.id), key: g.key, kind: g.kind, nr: g.nr, name: g.title, register: g.url,
      reasons: why, score: score(facts, ride, t, ridePasses?.score ?? null), rideVisibility: ridePasses, keys: g.keys ?? [g.key],
      measures: {frontM: +m.frontM.toFixed(1), streetFrontM: +m.streetFrontM.toFixed(1), curveDeg: +m.curveDeg.toFixed(1), curveRangeDeg: +m.rawCurveRangeDeg.toFixed(1), ornament: orn.classes, ornamentTerms: orn.terms,
        footprintM2: Math.round(members.reduce((s, p) => s + areaRd(p.ring), 0)), heightM: +Math.max(...members.map(p => p.height ?? 0)).toFixed(1), year: years.length ? Math.min(...years) : null},
      street: m.street, streets: m.streets.slice(0, 4), buurt: buurt?.name ?? null, gebied: buurt?.gebied ?? null, ridePriority: ride,
      center: [+c[0].toFixed(6), +c[1].toFixed(6)], aim, coveredShare: +coveredShare.toFixed(2), queued: isQueued,
    });
  }
  nominations.sort((a, b) => b.score - a.score).forEach((x, i) => { x.rank = i + 1; });
  return {nominations, measured, excluded: {covered: exCovered, queued: exQueued}, groups: groups.length, withPands};
}

export const percentiles = (xs: number[], ps = [50, 75, 90, 95, 98, 99]) => { const s = [...xs].sort((a, b) => a - b); return Object.fromEntries(ps.map(p => [`p${p}`, s.length ? +s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))].toFixed(1) : 0])); };

if (process.argv[1]?.endsWith('landmarks/discovery-front.ts')) {
  const arg = (k: string, d = '') => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
  const date = new Date().toISOString().slice(0, 10);
  const out = arg('out', `artifacts/landmarks/discovery-${date}.json`);
  const t: Thresholds = {...DEFAULT_THRESHOLDS, longFrontM: Number(arg('long', String(DEFAULT_THRESHOLDS.longFrontM))), curveDeg: Number(arg('curve', String(DEFAULT_THRESHOLDS.curveDeg))), ornamentClasses: Number(arg('ornament', String(DEFAULT_THRESHOLDS.ornamentClasses)))};
  const only = arg('only') ? new Set(arg('only').split(',')) : undefined;
  let ride: RideScorer | null = null;
  if (!process.argv.includes('--no-ride-routes')) { ride = rideScorer(Number(arg('routes', '2000')), Number(arg('seed', '7'))); console.log('ride routes sampled'); }
  const r = discover({only, exclude: !process.argv.includes('--no-exclude'), thresholds: t, log: s => console.log(s), ride});
  const fronts = r.measured.filter(m => m.frontM > 0);
  const distribution = {
    groupsWithFront: fronts.length,
    frontM: percentiles(fronts.map(m => m.frontM)),
    curveRangeDeg_runsOver20m: percentiles(fronts.filter(m => m.curveRangeDeg > 0).map(m => m.curveRangeDeg)),
    curveDeg_curvedOnly: percentiles(fronts.filter(m => m.curveDeg > 0).map(m => m.curveDeg)),
    ornamentClasses: Object.fromEntries([0, 1, 2, 3, 4, 5].map(k => [k, fronts.filter(m => m.ornament === k).length])),
    passing: {long: fronts.filter(m => m.frontM >= t.longFrontM).length, curved: fronts.filter(m => m.curveDeg >= t.curveDeg).length, ornamented: fronts.filter(m => m.ornament >= t.ornamentClasses && m.frontM >= t.ornamentMinFrontM).length},
  };
  const byReason: Record<string, number> = {};
  for (const x of r.nominations) for (const k of x.reasons) byReason[k] = (byReason[k] ?? 0) + 1;
  const doc = {version: 1, generatedAt: new Date().toISOString(), method: 'scripts/landmarks/discovery-front.ts (rule in discovery-front-core.ts): monument group (register record + its BAG pands) with a street front on a ride route that is long, curved or ornamented; score = ride visibility (ride-visibility.ts scorer, 2000 seeded routes, summed over members) x curve/ornament bonus x ride-priority gebied weight; pands already drawn or queued left out', thresholds: t, distribution, groups: r.groups, withPands: r.withPands, excluded: r.excluded, byReason, nominations: r.nominations};
  fs.mkdirSync(path.dirname(out), {recursive: true});
  fs.writeFileSync(out, JSON.stringify(doc, null, 1) + '\n');
  console.log(JSON.stringify({distribution, excluded: r.excluded, nominations: r.nominations.length, byReason}, null, 1));
  for (const x of r.nominations.slice(0, Number(arg('top', '40')))) console.log(`${String(x.rank).padStart(3)} ${x.score.toFixed(0).padStart(5)} ${x.pand} ${(x.name ?? '-').slice(0, 44).padEnd(44)} ${x.reasons.join('+').padEnd(36)} front ${x.measures.frontM} m curve ${x.measures.curveDeg} orn ${x.measures.ornament.length} ${x.gebied ?? ''}`);
  console.log(`wrote ${out}`);
}
