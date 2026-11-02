import polygonClipping, {type MultiPolygon, type Polygon, type Ring} from 'polygon-clipping';

/**
 * Nested flat-roof tiers from many 3DBAG LoD2.2 roof planes (WTC Amsterdam lane, 2026-11-02).
 *
 * A complex of towers on a podium arrives from 3DBAG as a couple of hundred roof planes, one prism each. Extruding every
 * plane from the ground (roofPrism) leaves back-to-back coplanar walls wherever two planes meet and splits each tower
 * face into many short pieces, so a facade system cannot run along it. Here the planes are snapped to a few levels and
 * unioned into nested tiers: tier k is the plan of everything at least as high as level k and is a slab from level
 * k-1 to level k, so every slab wall is an outside wall and the long tower faces come out whole. The roof of level k is
 * that tier minus the tier above it, so roofs never overlap a slab bottom.
 *
 * Plan coordinates are [x, z] (native east/south metres). Pure geometry: no three.js, so it is unit-tested.
 */
export type PlanPoint = [number, number];
export type PlanPolygon = PlanPoint[][];   // outer ring first, then holes; rings open (first point not repeated)
export type RoofPlane = {ring: PlanPoint[]; height: number};
export type Tier = {
  /** Slab bottom and top (metres above ground). */
  bottom: number; top: number;
  /** Plan of the slab: everything at least this high. */
  plan: PlanPolygon[];
  /** Exposed roof at `top`: the plan minus the next tier's plan. */
  roof: PlanPolygon[];
};
export type TierOptions = {
  /** Heights closer than this merge into one level (area-weighted mean). */
  mergeM?: number;
  /** Rings (and holes) smaller than this are dropped after every boolean step. */
  minAreaM2?: number;
  /** Douglas-Peucker tolerance for the tier outlines. */
  simplifyM?: number;
  /** Cuts removed from every plane before tiering (volumes the builder authors itself). */
  cuts?: PlanPolygon[];
  /** Explicit levels (measured storey heights): every plane snaps to the nearest one instead of merging by gaps. */
  levels?: number[];
};

export const ringArea = (r: PlanPoint[]) => r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;

const close = (r: PlanPoint[]): Ring => (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1]) ? [...r, r[0]] : r) as Ring;
const open = (r: Ring): PlanPoint[] => {
  const q = r.map(p => [p[0], p[1]] as PlanPoint);
  return q.length > 1 && q[0][0] === q[q.length - 1][0] && q[0][1] === q[q.length - 1][1] ? q.slice(0, -1) : q;
};

/** Douglas-Peucker on an open ring (keeps the two points farthest apart as anchors). */
export function simplifyRing(r: PlanPoint[], tol: number): PlanPoint[] {
  if (r.length <= 4 || tol <= 0) return r;
  const dp = (pts: PlanPoint[]): PlanPoint[] => {
    if (pts.length < 3) return pts;
    const a = pts[0], b = pts[pts.length - 1], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1e-9;
    let worst = -1, at = -1;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.abs((pts[i][0] - a[0]) * dz - (pts[i][1] - a[1]) * dx) / L;
      if (d > worst) { worst = d; at = i; }
    }
    if (worst <= tol) return [a, b];
    return [...dp(pts.slice(0, at + 1)).slice(0, -1), ...dp(pts.slice(at))];
  };
  let i0 = 0, i1 = 0, best = -1;
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
    const d = Math.hypot(r[i][0] - r[j][0], r[i][1] - r[j][1]);
    if (d > best) { best = d; i0 = i; i1 = j; }
  }
  const first = dp(r.slice(i0, i1 + 1)), second = dp([...r.slice(i1), ...r.slice(0, i0 + 1)]);
  const out = [...first.slice(0, -1), ...second.slice(0, -1)];
  return out.length >= 3 ? out : r;
}

/** Clean a boolean result: drop small rings, simplify, outer rings counter-clockwise in (x, z), holes clockwise. */
export function cleanPlan(mp: MultiPolygon, minArea: number, tol: number): PlanPolygon[] {
  const out: PlanPolygon[] = [];
  for (const poly of mp) {
    const rings = poly.map(open).map(r => simplifyRing(r, tol)).filter(r => r.length >= 3);
    if (!rings.length || Math.abs(ringArea(rings[0])) < minArea) continue;
    const outer = ringArea(rings[0]) > 0 ? rings[0] : [...rings[0]].reverse();
    const holes = rings.slice(1).filter(h => Math.abs(ringArea(h)) >= minArea).map(h => (ringArea(h) < 0 ? h : [...h].reverse()));
    out.push([outer, ...holes]);
  }
  return out;
}

const toMulti = (plans: PlanPolygon[]): MultiPolygon => plans.map(p => p.map(close) as Polygon);

/** Snap heights to levels: sorted, consecutive heights within mergeM share one level (area-weighted mean). */
export function snapLevels(planes: RoofPlane[], mergeM: number): {levels: number[]; levelOf: number[]} {
  const order = planes.map((p, i) => ({i, h: p.height, a: Math.abs(ringArea(p.ring))})).sort((p, q) => p.h - q.h);
  const levels: number[] = [], levelOf = new Array<number>(planes.length);
  let group: typeof order = [];
  const flush = () => {
    if (!group.length) return;
    const a = group.reduce((s, g) => s + g.a, 0) || 1;
    levels.push(group.reduce((s, g) => s + g.h * g.a, 0) / a);
    for (const g of group) levelOf[g.i] = levels.length - 1;
    group = [];
  };
  for (const o of order) {
    if (group.length && o.h - group[group.length - 1].h > mergeM) flush();
    group.push(o);
  }
  flush();
  return {levels, levelOf};
}

/** Every plane takes the nearest of the given levels; unused levels are dropped. */
export function snapToLevels(planes: RoofPlane[], given: number[]): {levels: number[]; levelOf: number[]} {
  const sorted = [...given].sort((a, b) => a - b);
  const near = planes.map(p => sorted.reduce((best, l, i) => (Math.abs(l - p.height) < Math.abs(sorted[best] - p.height) ? i : best), 0));
  const used = [...new Set(near)].sort((a, b) => a - b);
  return {levels: used.map(i => sorted[i]), levelOf: near.map(i => used.indexOf(i))};
}

export function roofTiers(planes: RoofPlane[], opts: TierOptions = {}): Tier[] {
  const mergeM = opts.mergeM ?? 1.5, minArea = opts.minAreaM2 ?? 3, tol = opts.simplifyM ?? 0.25;
  const cut = opts.cuts?.length ? toMulti(opts.cuts) : null;
  const usable = planes.filter(p => p.ring.length >= 3 && Math.abs(ringArea(p.ring)) > 1e-3 && p.height > 0.5);
  const {levels, levelOf} = opts.levels?.length ? snapToLevels(usable, opts.levels) : snapLevels(usable, mergeM);
  // Top-down: each plan is the plan above unioned with this level's planes, so a lower plan contains the upper one
  // exactly (shared boundaries keep the same vertices and every slab wall meets the wall or roof above it). Only the
  // planes themselves are simplified, never the unions.
  const simple = usable.map(p => simplifyRing(p.ring, tol));
  const plans: PlanPolygon[][] = new Array(levels.length);
  let above: MultiPolygon = [];
  for (let k = levels.length - 1; k >= 0; k--) {
    const members = simple.filter((r, i) => levelOf[i] === k && r.length >= 3).map(r => [close(r)] as Polygon);
    let u: MultiPolygon = members.length ? polygonClipping.union(above.length ? above : members[0], ...(above.length ? members : members.slice(1))) : above;
    if (cut && u.length) u = polygonClipping.difference(u, cut);
    plans[k] = cleanPlan(u, minArea, 0);
    above = toMulti(plans[k]);
  }
  const tiers: Tier[] = [];
  for (let k = 0; k < levels.length; k++) {
    if (!plans[k].length) continue;
    const above = plans[k + 1]?.length ? toMulti(plans[k + 1]) : null;
    const roof = above ? cleanPlan(polygonClipping.difference(toMulti(plans[k]), above), minArea, 0) : plans[k];
    tiers.push({bottom: tiers.length ? tiers[tiers.length - 1].top : 0, top: levels[k], plan: plans[k], roof});
  }
  return tiers;
}

/** Outward unit normal [nx, nz] of edge a->b on a ring wound as cleanPlan winds it (outer CCW in x,z; holes CW). */
export const edgeNormal = (a: PlanPoint, b: PlanPoint): PlanPoint => {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
  return [dz / L, -dx / L];
};
