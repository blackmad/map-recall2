/**
 * Block-face discovery: every BAG pand on one side of a street between two
 * cross streets (or any other break: an alley, a gap, a detached building).
 *
 * Input is the decoded 3DBAG items of an area (LoD0 = BAG footprint, LoD2.2 =
 * ground/roof) plus the routing street extract. A pand belongs to the face when
 *   1. it has a frontage on the named street (`findFrontage`), whose sightline
 *      to the street centreline crosses no other pand (rear buildings fail),
 *   2. it shares a party wall (a BAG footprint edge, within `partyToleranceM`,
 *      at least `minPartyM` long) with another member, and
 *   3. its frontage faces the same way as the seed's (corner houses included:
 *      their street front faces the same way even when they turn the corner).
 * Members are ordered left to right as seen from the street.
 */
import {buildFacts, decodeThreeDBag, type BuildingFacts, type CityJsonItem, type RD, type StreetPath} from '../buildingRecipe/facts.ts';

export interface DiscoveredPand { pandId: string; facts: BuildingFacts; item: CityJsonItem; alongM: number }
export interface DiscoveryReport {
  street: string;
  seed: string;
  members: string[];
  /** Why the run stops at each end: the next pand along the street that is not a member (if any) and the reason. */
  ends: {side: 'left' | 'right'; reason: string}[];
  rejected: {pandId: string; reason: string}[];
}

const open = (ring: RD[]) => ring.length > 1 && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1] ? ring.slice(0, -1) : ring;

/** Shared BAG footprint edge length between two rings (antiparallel, collinear within tol). */
export function sharedEdgeLength(a: RD[], b: RD[], tolM = 0.1): number {
  let total = 0;
  const A = open(a), B = open(b);
  for (let i = 0; i < A.length; i++) {
    const p0 = A[i], p1 = A[(i + 1) % A.length], la = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    if (la < 0.2) continue;
    const dx = (p1[0] - p0[0]) / la, dy = (p1[1] - p0[1]) / la;
    for (let j = 0; j < B.length; j++) {
      const q0 = B[j], q1 = B[(j + 1) % B.length], lb = Math.hypot(q1[0] - q0[0], q1[1] - q0[1]);
      if (lb < 0.2 || Math.abs(((q1[0] - q0[0]) * dx + (q1[1] - q0[1]) * dy) / lb) < 0.995) continue;
      const off = (q: RD) => Math.abs((q[0] - p0[0]) * -dy + (q[1] - p0[1]) * dx);
      if (off(q0) > tolM || off(q1) > tolM) continue;
      const t = (q: RD) => (q[0] - p0[0]) * dx + (q[1] - p0[1]) * dy;
      const s0 = Math.max(0, Math.min(t(q0), t(q1))), s1 = Math.min(la, Math.max(t(q0), t(q1)));
      if (s1 > s0) total += s1 - s0;
    }
  }
  return total;
}

function segmentsCross(p: number[], q: number[], a: number[], b: number[]) {
  const c = (o: number[], u: number[], v: number[]) => (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]);
  return c(p, q, a) * c(p, q, b) < 0 && c(a, b, p) * c(a, b, q) < 0;
}

/** Closest point of a named street to an RD point. */
export function nearestOnStreet(streets: StreetPath[], name: string, toRD: (ll: [number, number]) => RD, p: RD): {point: RD; distance: number} | null {
  let best: {point: RD; distance: number} | null = null;
  for (const s of streets) {
    if (s.name.toLowerCase() !== name.toLowerCase()) continue;
    for (const path of s.paths) {
      const pts = path.map(([lat, lng]) => toRD([lng, lat]));
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], den = dx * dx + dy * dy;
        const t = den ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / den)) : 0;
        const q: RD = [a[0] + t * dx, a[1] + t * dy], d = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (!best || d < best.distance) best = {point: q, distance: d};
      }
    }
  }
  return best;
}

export interface DiscoverOptions {
  street: string;
  seed: string;
  /** Optional ends (inclusive): trim the run to the pands between these two. */
  from?: string; to?: string;
  partyToleranceM?: number; minPartyM?: number; maxStreetDistanceM?: number;
  toRD: (ll: [number, number]) => RD;
  meta: (pandId: string) => BuildingFacts['source'];
}

/** `pands` = the (optionally trimmed) face; `whole` = the full run between the breaks, for evidence that needs neighbours (business assignment). */
export function discoverBlockFace(items: CityJsonItem[], streets: StreetPath[], o: DiscoverOptions): {pands: DiscoveredPand[]; whole: DiscoveredPand[]; report: DiscoveryReport} {
  const tol = o.partyToleranceM ?? 0.1, minParty = o.minPartyM ?? 1, maxDist = o.maxStreetDistanceM ?? 30;
  const idOf = (item: CityJsonItem) => Object.entries(item.feature.CityObjects).find(([, c]) => c.type === 'Building')![0].replace('NL.IMBAG.Pand.', '');
  const rejected: DiscoveryReport['rejected'] = [];
  const all = items.map(item => ({pandId: idOf(item), item, rings: decodeThreeDBag(item).bag}));
  const cands: {pandId: string; item: CityJsonItem; rings: RD[][]; facts: BuildingFacts}[] = [];
  for (const c of all) {
    let facts: BuildingFacts;
    try { facts = buildFacts(c.pandId, c.item, streets, [o.street], o.toRD, o.meta(c.pandId)); } catch (e) { rejected.push({pandId: c.pandId, reason: `no frontage on ${o.street}: ${(e as Error).message.slice(0, 80)}`}); continue; }
    const f = facts.fronts[0], mid: RD = [(f.endpointsRD[0][0] + f.endpointsRD[1][0]) / 2, (f.endpointsRD[0][1] + f.endpointsRD[1][1]) / 2];
    const near = nearestOnStreet(streets, o.street, o.toRD, mid);
    if (!near || near.distance > maxDist) { rejected.push({pandId: c.pandId, reason: `frontage ${near?.distance.toFixed(1)} m from ${o.street}`}); continue; }
    const start = [mid[0] + f.outwardNormalRD[0] * 0.2, mid[1] + f.outwardNormalRD[1] * 0.2];
    const blocked = all.find(x => x.pandId !== c.pandId && x.rings.some(r => open(r).some((p, i, ring) => segmentsCross(start, near.point, p, ring[(i + 1) % ring.length]))));
    if (blocked) { rejected.push({pandId: c.pandId, reason: `sightline to ${o.street} crosses ${blocked.pandId}`}); continue; }
    cands.push({...c, facts});
  }
  const seed = cands.find(c => c.pandId === o.seed);
  if (!seed) throw Error(`Seed ${o.seed} has no frontage on ${o.street}: ${rejected.find(r => r.pandId === o.seed)?.reason ?? 'not in the area'}`);
  const n0 = seed.facts.fronts[0].outwardNormalRD;
  const facing = cands.filter(c => { const n = c.facts.fronts[0].outwardNormalRD; const ok = n[0] * n0[0] + n[1] * n0[1] > 0.9; if (!ok) rejected.push({pandId: c.pandId, reason: 'fronts the other side / another direction'}); return ok; });
  const linked = (a: typeof facing[number], b: typeof facing[number]) => a.rings.some(ra => b.rings.some(rb => sharedEdgeLength(ra, rb, tol) >= minParty));
  const member = new Set([seed.pandId]), queue = [seed];
  while (queue.length) { const cur = queue.shift()!; for (const c of facing) if (!member.has(c.pandId) && linked(cur, c)) { member.add(c.pandId); queue.push(c); } }
  const u: RD = [-n0[1], n0[0]];
  const along = (c: typeof facing[number]) => { const f = c.facts.fronts[0]; return ((f.endpointsRD[0][0] + f.endpointsRD[1][0]) / 2) * u[0] + ((f.endpointsRD[0][1] + f.endpointsRD[1][1]) / 2) * u[1]; };
  const s0 = along(seed);
  let run = facing.filter(c => member.has(c.pandId)).map(c => ({pandId: c.pandId, facts: c.facts, item: c.item, alongM: +(along(c) - s0).toFixed(2)})).sort((a, b) => a.alongM - b.alongM);
  // Why the face ends: the nearest non-member pand that fronts the street beyond each end.
  const ends: DiscoveryReport['ends'] = [];
  const lo = run[0].alongM, hi = run.at(-1)!.alongM;
  const beyond = facing.filter(c => !member.has(c.pandId)).map(c => ({c, a: along(c) - s0}));
  const left = beyond.filter(x => x.a < lo).sort((a, b) => b.a - a.a)[0], right = beyond.filter(x => x.a > hi).sort((a, b) => a.a - b.a)[0];
  ends.push({side: 'left', reason: left ? `next fronting pand ${left.c.pandId} ${(lo - left.a).toFixed(1)} m on shares no party wall (cross street or gap)` : 'no further pand fronts the street in the fetched area'});
  ends.push({side: 'right', reason: right ? `next fronting pand ${right.c.pandId} ${(right.a - hi).toFixed(1)} m on shares no party wall (cross street or gap)` : 'no further pand fronts the street in the fetched area'});
  const whole = run;
  if (o.from || o.to) {
    const i0 = o.from ? run.findIndex(p => p.pandId === o.from) : 0, i1 = o.to ? run.findIndex(p => p.pandId === o.to) : run.length - 1;
    if (i0 < 0 || i1 < 0) throw Error(`--from/--to not on the face (${run.map(p => p.pandId.slice(-6)).join(' ')})`);
    const [a, b] = [Math.min(i0, i1), Math.max(i0, i1)];
    if (a > 0) ends[0] = {side: 'left', reason: `trimmed at ${run[a].pandId} (face continues: ${run.slice(0, a).map(p => p.pandId.slice(-6)).join(' ')})`};
    if (b < run.length - 1) ends[1] = {side: 'right', reason: `trimmed at ${run[b].pandId} (face continues: ${run.slice(b + 1).map(p => p.pandId.slice(-6)).join(' ')})`};
    run = run.slice(a, b + 1);
  }
  return {pands: run, whole, report: {street: o.street, seed: o.seed, members: run.map(p => p.pandId), ends, rejected}};
}
