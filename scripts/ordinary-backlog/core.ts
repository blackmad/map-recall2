/**
 * Ordinary-building backlog (2026-11-20): the pure, tested part of `build.ts`. Which mid-to-large ordinary buildings near
 * the Dam repay work most: what draws them today and how bad that is, how much of their street wall a rider sees, whether a
 * panorama can show the front, which route fits, and which groups one kit fix would lift.
 *
 * No disk, no network: unit-tested in core.test.ts.
 */

export type XY = [number, number];

/** Footprint bands the report counts by (m²). */
export const BANDS = [[300, 1000, '300-1k'], [1000, 2500, '1k-2.5k'], [2500, Infinity, '2.5k+']] as const;
export type Band = (typeof BANDS)[number][2];
export function bandOf(areaM2: number): Band | null {
  for (const [lo, hi, name] of BANDS) if (areaM2 >= lo && areaM2 < hi) return name;
  return null;
}

/** Rings the report separates: the core (≤ CORE_M from the Dam) and the outer ring (CORE_M–OUTER_M). */
export const CORE_M = 3000, OUTER_M = 5000;
export const ringOf = (distM: number): 'core' | 'outer' | null => distM <= CORE_M ? 'core' : distM <= OUTER_M ? 'outer' : null;

// --- what draws today ------------------------------------------------------------------------------------------------

/**
 * The ordinary paths a pand can draw by today, worst first:
 *  - `bare`: no facade at all (a coloured box);
 *  - `plain-kit`: a kit host whose walls are the plain cell (`kitWall: plain|flat`), windows only as near-tier geometry;
 *  - `large-blank-side`: an installed large recipe whose unlisted walls (`otherWalls: 'blank'` without a cited photo) draw
 *    the shader window grid, not the building, on a street side;
 *  - `generic`: the area-palette family (`facade: <style>-<colour>`), nothing taken from its own photo.
 */
export type DrawKind = 'bare' | 'plain-kit' | 'large-blank-side' | 'generic';

export interface DrawState {
  kind: DrawKind;
  /** share of the wall area the aerial (coarse) tier draws in the plain cell, 0-1 */
  plainFromAir: number;
  /** the drawn period style differs from the designed period (monument register or ordekaart year) */
  wrongPeriod: boolean;
  /** large recipes: share of the street-facing walls no photographed wall group covers, 0-1 */
  blankSideShare?: number;
}

/**
 * Badness 0-1: how far today's drawing is from the building. Bounded and explainable: a base per path, plus the aerial
 * plain share (the "flat block" from the air) and a wrong period for the generic family.
 *   bare 1.0 · plain kit 0.85 · large recipe 0.15 + 0.45 × blank street share · generic 0.35 + 0.3 × plain share (+0.25 wrong period)
 */
export function badness(s: DrawState): number {
  let b: number;
  switch (s.kind) {
    case 'bare': b = 1; break;
    case 'plain-kit': b = 0.85; break;
    case 'large-blank-side': b = 0.15 + 0.45 * (s.blankSideShare ?? 1); break;
    case 'generic': b = 0.35 + 0.3 * clamp01(s.plainFromAir) + (s.wrongPeriod ? 0.25 : 0); break;
  }
  return Math.round(clamp01(b) * 1000) / 1000;
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

/** The game's period styles (genericFacades.ts facadeStyleFor), by year alone. */
export type Period = 'canal' | 'c19' | 'school' | 'postwar' | 'modern';
export function periodOf(year: number | null | undefined): Period | null {
  if (!year || year < 1200 || year > 2100) return null;
  if (year < 1860) return 'canal';
  if (year < 1915) return 'c19';
  if (year < 1945) return 'school';
  if (year < 1985) return 'postwar';
  return 'modern';
}
/** Two adjacent styles that the generic family draws much alike; a jump of one between them is not "wrong". */
const NEAR: Record<string, true> = { 'postwar|modern': true, 'modern|postwar': true, 'canal|c19': true, 'c19|canal': true };
/**
 * A drawn generic style is the wrong period when the designed year (register or ordekaart) puts the building in a
 * different period than the drawn style, beyond the near pairs. `tower` is a size style, never wrong by period alone.
 */
export function isWrongPeriod(drawnStyle: string | undefined, designedYear: number | null | undefined): boolean {
  const want = periodOf(designedYear);
  if (!want || !drawnStyle || drawnStyle === 'tower') return false;
  const drawn = drawnStyle.split('-')[0];
  if (!['canal', 'c19', 'school', 'postwar', 'modern'].includes(drawn)) return false;
  return drawn !== want && !NEAR[`${drawn}|${want}`];
}

// --- exposed street wall ---------------------------------------------------------------------------------------------

export interface WallEdge { a: XY; b: XY; len: number; n: XY; mid: XY }

/** Outer-ring edges of at least `minM` with their outward normals (RD metres; ring orientation by signed area). */
export function ringEdges(ring: XY[], minM = 2): WallEdge[] {
  const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; area += p[0] * q[1] - q[0] * p[1]; }
  const ccw = area > 0, out: WallEdge[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    if (len < minM) continue;
    out.push({ a, b, len, n: ccw ? [dy / len, -dx / len] : [-dy / len, dx / len], mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] });
  }
  return out;
}

export function pointInRing(p: XY, ring: XY[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

export function segmentDistance(p: XY, a: XY, b: XY): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/**
 * Exposed street wall: edges not against a neighbour (two of three probes 0.6 m outside are free of other footprints) whose
 * outer side faces a road within `roadM` (the nearest road point lies in front: cosine with the normal ≥ 0.5).
 * `roads` are RD segments near the pand; `neighbours` are the other footprints' outer rings.
 */
export function exposedStreetWalls(ring: XY[], neighbours: XY[][], roads: Array<[XY, XY]>, roadM = 40): { walls: WallEdge[]; exposedM: number; streetM: number } {
  const edges = ringEdges(ring, 2);
  const free = edges.filter(e => [0.2, 0.5, 0.8].filter(t => {
    const p: XY = [e.a[0] + (e.b[0] - e.a[0]) * t + e.n[0] * 0.6, e.a[1] + (e.b[1] - e.a[1]) * t + e.n[1] * 0.6];
    return !neighbours.some(r => pointInRing(p, r));
  }).length >= 2);
  const street = free.filter(e => {
    let best = Infinity, q: XY = e.mid;
    for (const [a, b] of roads) {
      const d = segmentDistance(e.mid, a, b);
      if (d < best) { best = d; const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((e.mid[0] - a[0]) * dx + (e.mid[1] - a[1]) * dy) / l)) : 0; q = [a[0] + t * dx, a[1] + t * dy]; }
    }
    if (best > roadM) return false;
    const vx = q[0] - e.mid[0], vy = q[1] - e.mid[1], vl = Math.hypot(vx, vy);
    return vl < 1 || (vx * e.n[0] + vy * e.n[1]) / vl >= 0.5;
  });
  const sum = (l: WallEdge[]) => Math.round(l.reduce((s, e) => s + e.len, 0));
  return { walls: street, exposedM: sum(free), streetM: sum(street) };
}

// --- evidence ---------------------------------------------------------------------------------------------------------

/**
 * Photo evidence for the street front, as house:crops judges a panorama before it downloads one: the best-ranked
 * Gemeente Amsterdam panorama (pand-reference/select.ts rankPanos: camera 5-35 m, ≤ 55°), its obliquity and whether the
 * camera ray crosses another footprint (flags.ts rayBlocked).
 *   straight: ≤ 35°, ray clear · oblique: 35-55°, ray clear (house:crops makes it, from a strip) · blocked · none.
 */
export type Evidence = 'straight' | 'oblique' | 'blocked' | 'none' | 'unchecked';
export function evidenceClass(pick: { obliquityDeg: number; blocked: boolean } | null): Evidence {
  if (!pick) return 'none';
  if (pick.blocked) return 'blocked';
  return pick.obliquityDeg <= 35 ? 'straight' : 'oblique';
}
/** The gate: a straight usable front counts in full, an oblique one at 0.6, no front or a blocked one drops out of the ranking. */
export const EVIDENCE_GATE: Record<Evidence, number> = { straight: 1, oblique: 0.6, blocked: 0, none: 0, unchecked: 0 };

// --- payoff -------------------------------------------------------------------------------------------------------------

/**
 * Payoff before the gate: ride visibility × visible wall area × badness, as
 *   rideVisibility.score (Σ route m × passes × visible facing-wall m) × wall height (m, capped at 40) × badness / 1e6.
 * The ride score already weights each route sample by the wall length it sees; multiplying by the height turns that
 * into visible wall area. Unit: "M ride-m³" (a million route-metre × square-metre of wall).
 */
export function rawPayoff(rideScore: number, heightM: number, bad: number): number {
  return Math.round(rideScore * Math.min(Math.max(heightM, 3), 40) * bad / 1e4) / 100;
}

// --- clusters and routes ----------------------------------------------------------------------------------------------

export type Form = 'tower' | 'slab' | 'hall' | 'courtyard-block' | 'block';
/**
 * Building form from size and plan: tower ≥ 30 m; hall ≤ 9 m high over ≥ 1,000 m²; slab: long and thin (minimum
 * rotated-rectangle aspect ≥ 3); courtyard block: a ring with a hole; otherwise block.
 */
export function formOf(heightM: number, areaM2: number, aspect: number, holes: number): Form {
  if (heightM >= 30) return 'tower';
  if (heightM <= 9 && areaM2 >= 1000) return 'hall';
  if (aspect >= 3) return 'slab';
  if (holes > 0) return 'courtyard-block';
  return 'block';
}

/** Aspect of the minimum-area bounding rectangle over the hull edges' directions (≥ 1). */
export function planAspect(ring: XY[]): number {
  let best = { area: Infinity, aspect: 1 };
  const pts = ring;
  for (let i = 0; i + 1 < pts.length; i++) {
    const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], l = Math.hypot(dx, dy);
    if (l < 0.5) continue;
    const ux = dx / l, uy = dy / l;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of pts) { const u = p[0] * ux + p[1] * uy, v = -p[0] * uy + p[1] * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const w = u1 - u0, h = v1 - v0, area = w * h;
    if (area < best.area) best = { area, aspect: Math.max(w, h) / Math.max(Math.min(w, h), 0.1) };
  }
  return Math.round(best.aspect * 10) / 10;
}

const BAG_USE: Record<string, string> = {
  woonfunctie: 'housing', kantoorfunctie: 'office', onderwijsfunctie: 'school', winkelfunctie: 'retail', gezondheidszorgfunctie: 'care',
  logiesfunctie: 'hotel', industriefunctie: 'industrial', bijeenkomstfunctie: 'assembly', sportfunctie: 'sport', celfunctie: 'civic', overige: 'other',
};
const OSM_USE: Array<[RegExp, string]> = [[/school|college|university|kindergarten/, 'school'], [/office|commercial|government|civic|public/, 'office'],
  [/industrial|warehouse/, 'industrial'], [/hospital/, 'care'], [/hotel/, 'hotel'], [/retail/, 'retail'], [/church|chapel|mosque|synagogue|temple/, 'worship'], [/museum|theatre/, 'assembly']];
/**
 * Use family for clustering: the BAG units inside the footprint, weighted by floor area (a unit with several uses splits
 * its area). A family with ≥ 60 % of the area wins; housing wins from 50 % (shops under flats are the rule);
 * otherwise `mixed`. Without units: the OSM building tag, else `no-units` (car parks, sheds, plant).
 */
export function useOf(units: Array<{ use: string; m2: number }>, osmType?: string): string {
  const share = new Map<string, number>();
  let total = 0;
  for (const u of units) {
    const uses = u.use.split(',').map(x => x.trim()).filter(Boolean);
    const m2 = Math.max(u.m2, 1);
    for (const x of uses) { const k = BAG_USE[x] ?? 'other'; share.set(k, (share.get(k) ?? 0) + m2 / uses.length); }
    total += m2;
  }
  if (total > 0) {
    if ((share.get('housing') ?? 0) / total >= 0.5) return 'housing';
    const [top, v] = [...share].sort((a, b) => b[1] - a[1])[0];
    return v / total >= 0.6 ? top : 'mixed';
  }
  for (const [re, use] of OSM_USE) if (re.test(osmType ?? '')) return use;
  return 'no-units';
}

/** Height band for clustering (m): low < 12, mid 12-24, high ≥ 24. */
export const heightBand = (h: number) => h < 12 ? 'low' : h < 24 ? 'mid' : 'high';

/** Era bucket for clustering, from the designed year when known. */
export function eraOf(year: number | null | undefined): string {
  if (!year) return 'undated';
  if (year < 1860) return 'pre-1860';
  if (year < 1915) return '1860-1914';
  if (year < 1945) return '1915-1944';
  if (year < 1965) return '1945-1964';
  if (year < 1985) return '1965-1984';
  if (year < 2005) return '1985-2004';
  return '2005+';
}

export const clusterKey = (c: { era: string; use: string; form: Form; heightM: number; kind: DrawKind }) => `${c.era} · ${c.use} · ${c.form} · ${heightBand(c.heightM)} · ${c.kind}`;

/** Clusters with at least this many members (within OUTER_M) are a kit-fix candidate. */
export const KIT_CLUSTER_MIN = 8;

export type Route = 'landmark' | 'design-units' | 'kit-fix' | 'large-recipe';
/**
 * Suggested route, first match:
 *  - landmark: a named, listed or POI building (rijks/municipal monument with a register name, a landmark id, a POI
 *    inside), or ≥ 2,500 m² and ≥ 30 m: one bespoke model;
 *  - design-units: housing in a design-unit segment of the Ring, or terraced pre-1940 housing: the house/rows programme
 *    (marked for the design-units integrator);
 *  - kit-fix: a member of a cluster with ≥ KIT_CLUSTER_MIN buildings: one systemic kit change lifts them all;
 *  - large-recipe: one building with its own design.
 */
export function routeOf(c: { named: boolean; landmark: boolean; areaM2: number; heightM: number; use: string; inDesignUnit: boolean; terraced: boolean; year: number | null; clusterSize: number }): Route {
  if (c.landmark || c.named || (c.areaM2 >= 2500 && c.heightM >= 30)) return 'landmark';
  if (c.use === 'housing' && (c.inDesignUnit || (c.terraced && (c.year ?? 9999) < 1940))) return 'design-units';
  if (c.clusterSize >= KIT_CLUSTER_MIN) return 'kit-fix';
  return 'large-recipe';
}

/**
 * A short address from a pand's BAG verblijfsobjecten: the street with the most units, its number range
 * ("Kinkerstraat 32-54"), "+N" other streets.
 */
export function formatAddress(units: Array<{ street: string; nr: number }>): string | null {
  const byStreet = new Map<string, number[]>();
  for (const u of units) if (u.street && Number.isFinite(u.nr)) (byStreet.get(u.street) ?? byStreet.set(u.street, []).get(u.street)!).push(u.nr);
  if (!byStreet.size) return null;
  const [street, nrs] = [...byStreet].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0];
  const lo = Math.min(...nrs), hi = Math.max(...nrs);
  return `${street} ${lo === hi ? lo : `${lo}-${hi}`}${byStreet.size > 1 ? ` (+${byStreet.size - 1} street${byStreet.size > 2 ? 's' : ''})` : ''}`;
}
