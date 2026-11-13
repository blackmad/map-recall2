/**
 * Landmark discovery by street front (2026-11-13): the pure half of `discovery-front.ts`.
 *
 * Why: the factory queue's dominant-building rule (footprint >= 2,500 m2 or height >= 35 m) never found the curved
 * Winkelgalerij on the Raadhuisstraat (Rijksmonument 46505), a long, curved, ornamented street front of moderate size.
 * This rule nominates monument groups (one register record and all its BAG pands) whose street front is long, curved
 * or ornamented, on a ride route. Everything here is plan geometry in RD metres (x east, y north) plus text matching;
 * the CLI loads the register, BAG tiles, routing streets and buurten and passes them in.
 *
 * Street front: every footprint edge of a member pand is sampled every SAMPLE_STEP_M. A sample is a party or interior
 * wall when a point PARTY_PROBE_M outside it lies in another pand (member or not). An exposed sample faces a ride street
 * when a ray along the outward normal reaches a ride-route segment (within ROUTE_HIT_M of the ray) within RAY_MAX_M
 * without first entering a footprint. An edge is a street edge when at least half its samples face a street.
 * Street edges chain end-to-start across pands (rings normalised counter-clockwise, gap <= CHAIN_GAP_M); a chain breaks
 * at a corner (|turn| > CORNER_DEG). Measures per group:
 *   frontM        the longest corner-free run of street edges (one street side), metres;
 *   streetFrontM  all street-facing sample metres;
 *   curveDeg      the largest range of accumulated heading along a corner-free run of at least CURVE_MIN_RUN_M,
 *                 counting only edges >= HEADING_MIN_EDGE_M; it counts only when no single turn carries more than
 *                 half of it (a curve, not one kink) and at least CURVE_MIN_TURNS turns of >= 1.5 deg contribute.
 */

export type XY = [number, number];
export interface Pand { id: string; ring: XY[]; height?: number; year?: number }
export interface RouteSeg { a: XY; b: XY; name: string }

export const SAMPLE_STEP_M = 2;
export const PARTY_PROBE_M = 0.6;
export const RAY_STEP_M = 1;
export const RAY_MAX_M = 30;
export const ROUTE_HIT_M = 2.5;
export const CHAIN_GAP_M = 1.2;
export const CORNER_DEG = 35;
export const HEADING_MIN_EDGE_M = 2;
export const CURVE_MIN_RUN_M = 20;
export const CURVE_MIN_TURNS = 3;

// ---- spatial index ------------------------------------------------------------------------------------------------
/** A uniform hash grid over bounding boxes. */
export class Grid<T> {
  private cells = new Map<string, T[]>();
  constructor(readonly cell: number) {}
  private key(i: number, j: number) { return `${i},${j}`; }
  insert(item: T, minX: number, minY: number, maxX: number, maxY: number) {
    for (let i = Math.floor(minX / this.cell); i <= Math.floor(maxX / this.cell); i++)
      for (let j = Math.floor(minY / this.cell); j <= Math.floor(maxY / this.cell); j++) {
        const k = this.key(i, j); let a = this.cells.get(k); if (!a) this.cells.set(k, a = []); a.push(item);
      }
  }
  near(x: number, y: number, r = 0): T[] {
    const out = new Set<T>();
    for (let i = Math.floor((x - r) / this.cell); i <= Math.floor((x + r) / this.cell); i++)
      for (let j = Math.floor((y - r) / this.cell); j <= Math.floor((y + r) / this.cell); j++) for (const t of this.cells.get(this.key(i, j)) ?? []) out.add(t);
    return [...out];
  }
}

export interface World {
  pands: Grid<Pand & {box: [number, number, number, number]}>;
  routes: Grid<RouteSeg>;
}
export function buildWorld(pands: Pand[], routes: RouteSeg[]): World {
  const pg = new Grid<Pand & {box: [number, number, number, number]}>(25), rg = new Grid<RouteSeg>(25);
  for (const p of pands) {
    const xs = p.ring.map(q => q[0]), ys = p.ring.map(q => q[1]);
    const box: [number, number, number, number] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    pg.insert({...p, box}, ...box);
  }
  for (const s of routes) rg.insert(s, Math.min(s.a[0], s.b[0]), Math.min(s.a[1], s.b[1]), Math.max(s.a[0], s.b[0]), Math.max(s.a[1], s.b[1]));
  return {pands: pg, routes: rg};
}

// ---- geometry -------------------------------------------------------------------------------------------------------
export const signedArea = (ring: XY[]) => { let a = 0; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
/** Counter-clockwise, without a closing duplicate vertex. */
export function normaliseRing(ring: XY[]): XY[] {
  let r = ring.slice();
  if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop();
  if (signedArea(r) < 0) r = r.reverse();
  return r;
}
export function pointInRing([x, y]: XY, ring: XY[]): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > y) !== (ring[j][1] > y) && x < ((ring[j][0] - ring[i][0]) * (y - ring[i][1])) / (ring[j][1] - ring[i][1]) + ring[i][0]) c = !c;
  return c;
}
export function segDist(p: XY, a: XY, b: XY): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
const wrap = (deg: number) => ((deg + 540) % 360) - 180;

function insideAny(world: World, p: XY, skip?: string): string | null {
  for (const q of world.pands.near(p[0], p[1])) {
    if (q.id === skip) continue;
    if (p[0] < q.box[0] || p[0] > q.box[2] || p[1] < q.box[1] || p[1] > q.box[3]) continue;
    if (pointInRing(p, q.ring)) return q.id;
  }
  return null;
}
function nearestRoute(world: World, p: XY, r: number): RouteSeg | null {
  let best: RouteSeg | null = null, bd = r;
  for (const s of world.routes.near(p[0], p[1], r)) { const d = segDist(p, s.a, s.b); if (d <= bd) { bd = d; best = s; } }
  return best;
}

export type SampleKind = 'party' | 'street' | 'blocked' | 'open';
export interface SampleHit { kind: SampleKind; street?: string; distM?: number }
/** Classify one edge sample: party wall, facing a ride street (ray hits a route first), blocked by a footprint, or open. */
export function classifySample(world: World, pandId: string, p: XY, n: XY): SampleHit {
  const probe: XY = [p[0] + n[0] * PARTY_PROBE_M, p[1] + n[1] * PARTY_PROBE_M];
  if (insideAny(world, probe, pandId)) return {kind: 'party'};
  for (let d = RAY_STEP_M; d <= RAY_MAX_M; d += RAY_STEP_M) {
    const q: XY = [p[0] + n[0] * d, p[1] + n[1] * d];
    const hit = nearestRoute(world, q, ROUTE_HIT_M);
    if (hit) return {kind: 'street', street: hit.name, distM: d};
    if (d > 1 && insideAny(world, q, pandId)) return {kind: 'blocked'};
  }
  return {kind: 'open'};
}

export interface FrontEdge { pand: string; a: XY; b: XY; len: number; heading: number; street: boolean; streetM: number; streets: Record<string, number>; ring: number; index: number }
/** Every edge of every member pand with its street-facing share. */
export function frontEdges(world: World, members: Pand[]): FrontEdge[] {
  const out: FrontEdge[] = [];
  members.forEach((m, mi) => {
    const ring = normaliseRing(m.ring);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      const n: XY = [dy / len, -dx / len]; // CCW ring: outside is to the right of travel
      const k = Math.max(1, Math.round(len / SAMPLE_STEP_M));
      let street = 0; const streets: Record<string, number> = {};
      for (let s = 0; s < k; s++) {
        const t = (s + 0.5) / k, p: XY = [a[0] + dx * t, a[1] + dy * t];
        const h = classifySample(world, m.id, p, n);
        if (h.kind === 'street') { street++; if (h.street) streets[h.street] = (streets[h.street] ?? 0) + len / k; }
      }
      out.push({pand: m.id, a, b, len, heading: Math.atan2(dy, dx) * 180 / Math.PI, street: street * 2 >= k, streetM: (street / k) * len, streets, ring: mi, index: i});
    }
  });
  return out;
}

/** Street edges chained end-to-start (gap <= CHAIN_GAP_M), longest chains first. */
export function chainStreetEdges(edges: FrontEdge[]): FrontEdge[][] {
  const st = edges.filter(e => e.street);
  const used = new Set<FrontEdge>();
  const next = (e: FrontEdge) => st.filter(f => f !== e && !used.has(f) && Math.hypot(f.a[0] - e.b[0], f.a[1] - e.b[1]) <= CHAIN_GAP_M).sort((f, g) => Math.hypot(f.a[0] - e.b[0], f.a[1] - e.b[1]) - Math.hypot(g.a[0] - e.b[0], g.a[1] - e.b[1]))[0];
  const prev = (e: FrontEdge) => st.filter(f => f !== e && !used.has(f) && Math.hypot(f.b[0] - e.a[0], f.b[1] - e.a[1]) <= CHAIN_GAP_M).sort((f, g) => Math.hypot(f.b[0] - e.a[0], f.b[1] - e.a[1]) - Math.hypot(g.b[0] - e.a[0], g.b[1] - e.a[1]))[0];
  const chains: FrontEdge[][] = [];
  for (const e of [...st].sort((x, y) => y.len - x.len)) {
    if (used.has(e)) continue;
    used.add(e);
    const chain = [e];
    for (let f = next(e); f; f = next(chain[chain.length - 1])) { used.add(f); chain.push(f); }
    for (let f = prev(e); f; f = prev(chain[0])) { used.add(f); chain.unshift(f); }
    chains.push(chain);
  }
  return chains.sort((x, y) => y.reduce((s, e) => s + e.len, 0) - x.reduce((s, e) => s + e.len, 0));
}

export interface RunMeasure { lengthM: number; curveDeg: number; rangeDeg: number; maxTurnDeg: number; turns: number; edges: number; curved: boolean; street: string | null; from: XY; to: XY; mid: XY; normalDeg: number }
/** Corner-free runs of a chain, each with its curvature. */
export function measureRuns(chain: FrontEdge[]): RunMeasure[] {
  const runs: FrontEdge[][] = [];
  let cur: FrontEdge[] = [], lastHeading: number | null = null;
  for (const e of chain) {
    if (e.len >= HEADING_MIN_EDGE_M && lastHeading !== null && Math.abs(wrap(e.heading - lastHeading)) > CORNER_DEG) { runs.push(cur); cur = []; }
    cur.push(e);
    if (e.len >= HEADING_MIN_EDGE_M) lastHeading = e.heading;
  }
  if (cur.length) runs.push(cur);
  return runs.map(run => {
    const lengthM = run.reduce((s, e) => s + e.len, 0);
    const heads = run.filter(e => e.len >= HEADING_MIN_EDGE_M).map(e => e.heading);
    let cum = 0, lo = 0, hi = 0, maxTurn = 0, turns = 0;
    for (let i = 1; i < heads.length; i++) { const t = wrap(heads[i] - heads[i - 1]); cum += t; lo = Math.min(lo, cum); hi = Math.max(hi, cum); maxTurn = Math.max(maxTurn, Math.abs(t)); if (Math.abs(t) >= 1.5) turns++; }
    const range = hi - lo;
    const curved = lengthM >= CURVE_MIN_RUN_M && turns >= CURVE_MIN_TURNS && maxTurn <= 0.5 * range;
    const streets: Record<string, number> = {};
    for (const e of run) for (const [k, v] of Object.entries(e.streets)) streets[k] = (streets[k] ?? 0) + v;
    const street = Object.entries(streets).filter(([k]) => k).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    // the run's midpoint by arc length and the outward normal there (for panorama aiming)
    let acc = 0, mid: XY = run[0].a, nDeg = 0;
    for (const e of run) { if (acc + e.len >= lengthM / 2) { const t = (lengthM / 2 - acc) / e.len; mid = [e.a[0] + (e.b[0] - e.a[0]) * t, e.a[1] + (e.b[1] - e.a[1]) * t]; nDeg = e.heading - 90; break; } acc += e.len; }
    return {lengthM, curveDeg: curved ? range : 0, rangeDeg: range, maxTurnDeg: maxTurn, turns, edges: run.length, curved, street, from: run[0].a, to: run[run.length - 1].b, mid, normalDeg: wrap(nDeg)};
  });
}

export interface FrontMeasure { frontM: number; streetFrontM: number; curveDeg: number; rawCurveRangeDeg: number; street: string | null; streets: string[]; best: RunMeasure | null; curveRun: RunMeasure | null }
export function measureFront(world: World, members: Pand[]): FrontMeasure {
  const edges = frontEdges(world, members);
  const runs = chainStreetEdges(edges).flatMap(measureRuns);
  const best = [...runs].sort((a, b) => b.lengthM - a.lengthM)[0] ?? null;
  const curveRun = [...runs].filter(r => r.curved).sort((a, b) => b.curveDeg - a.curveDeg)[0] ?? null;
  const streetSet = new Map<string, number>();
  for (const e of edges) for (const [k, v] of Object.entries(e.streets)) if (k) streetSet.set(k, (streetSet.get(k) ?? 0) + v);
  return {
    frontM: best?.lengthM ?? 0,
    streetFrontM: edges.reduce((s, e) => s + e.streetM, 0),
    curveDeg: curveRun?.curveDeg ?? 0,
    rawCurveRangeDeg: Math.max(0, ...runs.filter(r => r.lengthM >= CURVE_MIN_RUN_M).map(r => r.rangeDeg)),
    street: best?.street ?? null,
    streets: [...streetSet.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]),
    best, curveRun,
  };
}

// ---- ornament terms -------------------------------------------------------------------------------------------------
/**
 * Register description terms (Dutch, RCE and municipal texts) per ornament class. A class counts once however often it
 * is named. Plain gables are everywhere in the register, so the gable class asks for the decorated kinds or several
 * gables on one front ("topgevels", "geveltoppen").
 */
export const ORNAMENT_TERMS: Record<string, RegExp> = {
  sculpture: /\b(beeldhouwwerk\w*|gebeeldhouwd\w*|beeld(en|engroep\w*|je|jes)?|sculptu\w*|fabeldier\w*|kariatide\w*|atlant(en)?|putti|putto|maskers?|maskerons?|leeuwenkop\w*|koppen)\b/i,
  relief: /\b(reli[eë]f\w*|bas-reli[eë]f\w*|beeldhouwwerkreli\w*)\b/i,
  tower: /\b(toren\w*|koepel\w*|dakruiter\w*|lantaarn\w*|spits(en)?|belvedere|belvédère|klokkentoren)\b/i,
  gables: /\b(topgevels|geveltoppen|trapgevel\w*|klokgevel\w*|halsgevel\w*|puntgevels|dakvensters? met (fronton|topgevel)|tuitgevel\w*)\b/i,
  ornament: /\b(ornament\w*|siermetselwerk|sierankers|versiering\w*|decoratie\w*|festoen\w*|guirlande\w*|cartouche\w*|tympa(a)?n\w*|timpa(a)?n\w*|gevelsteen|gevelstenen|gedenksteen|gedenkstenen|mozaïek\w*|mozaiek\w*|tegeltableau\w*|wapen(schild\w*|s)?|vazen|pinakel\w*|bekroning\w*|kuifstuk\w*|klauwstuk\w*)\b/i,
};
export function ornamentClasses(text: string): {classes: string[]; terms: Record<string, string>} {
  const classes: string[] = [], terms: Record<string, string> = {};
  for (const [k, re] of Object.entries(ORNAMENT_TERMS)) { const m = re.exec(text); if (m) { classes.push(k); terms[k] = m[0].toLowerCase(); } }
  return {classes, terms};
}

// ---- the rule -------------------------------------------------------------------------------------------------------
export interface Thresholds { longFrontM: number; curveDeg: number; ornamentClasses: number; ornamentMinFrontM: number; outsideRideWeight: number }
/**
 * Defaults, set from the 2026-11-13 distribution over the 8,254 monument groups with a street front on a ride route:
 *   longFrontM 40      front run p50 6.5 m, p75 12.6, p90 28.2, p95 45.9, p98 76.4, p99 104.3; 40 m sits at ~p94, past
 *                      the canal-house monuments (5-12 m) and double houses (to ~20 m): three to six houses of one design.
 *   curveDeg 20        accumulated heading range over corner-free runs >= 20 m: p50 1.3 deg, p75 2.4 (BAG jitter on
 *                      straight rows), p90 12.1 (mostly single kinks, which the distributed-turn test rejects); the
 *                      Raadhuisstraat arc measures 34 deg. 17 groups pass.
 *   ornamentClasses 3  of sculpture, relief, tower, gables, ornament (0: 4,058 groups, 1: 2,795, 2: 964, 3: 336, 4: 89,
 *                      5: 12), with a front of at least 15 m (ornamentMinFrontM) so a single decorated canal house
 *                      (the house line's work) is not a landmark nomination.
 *   outsideRideWeight  score weight outside the ride-priority gebieden (src/canalRecall/ridePriority.ts).
 */
export const DEFAULT_THRESHOLDS: Thresholds = {longFrontM: 40, curveDeg: 20, ornamentClasses: 3, ornamentMinFrontM: 15, outsideRideWeight: 0.35};

export interface GroupFacts { frontM: number; streetFrontM: number; curveDeg: number; ornament: string[] }
export function reasons(g: GroupFacts, t: Thresholds = DEFAULT_THRESHOLDS): string[] {
  const out: string[] = [];
  if (g.frontM >= t.longFrontM) out.push('long-front');
  if (g.curveDeg >= t.curveDeg) out.push('curved-front');
  if (g.ornament.length >= t.ornamentClasses && g.frontM >= t.ornamentMinFrontM) out.push('ornamented-front');
  return out;
}
/**
 * Ride-weighted score. Base: the group's ride visibility (scripts/building-recipes/ride-visibility.ts `scorer`, summed
 * over the member pands, in thousands of m2: route metres x passes x visible facing-wall metres over the seeded 2,000
 * routes) when the caller has it; without it (tests, `--no-ride-routes`) the front metres a rider passes, capped at
 * 150 m (the v1 base, 2026-11-13: it ranked long quiet housing estates first, precision 20 %). Times a bonus for curve
 * and ornament, times the ride weight (1 inside the ride-priority gebieden, `outsideRideWeight` outside).
 */
export function score(g: GroupFacts, ridePriority: boolean, t: Thresholds = DEFAULT_THRESHOLDS, rideVisibility?: number | null): number {
  const curve = Math.min(g.curveDeg / t.curveDeg, 3) * 0.5;
  const orn = Math.min(g.ornament.length, 5) * 0.15;
  const base = rideVisibility == null ? Math.min(g.frontM, 150) : rideVisibility / 1000;
  return Math.round(base * (1 + curve + orn) * (ridePriority ? 1 : t.outsideRideWeight) * 10) / 10;
}
