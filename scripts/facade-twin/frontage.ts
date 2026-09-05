/**
 * Choosing which wall of a building is its street frontage.
 *
 * The pipeline used to pick the elevation nearest a proposal inherited from a
 * measurement run, and that proposal was itself chosen by geometry: which edge
 * faces roughly the right way, how wide the plot is. Geometry cannot tell a
 * frontage from a courtyard wall, and it routinely got it wrong — of 62 badly
 * registering buildings, 42 had a wall with **no unobstructed view from any of
 * about 188 candidate camera positions**, and 22 of those had another elevation
 * of the same pand with a median of 220 clear views.
 *
 * Herengracht 45 is the shape of it: the measured wall faces 121° and can be
 * seen from nowhere; the frontage faces 301° and can be seen from 261 places.
 * That is not a judgement call, it is a count.
 *
 * So visibility chooses the wall. An elevation earns its place by being
 * *seeable*: how many survey positions have an unobstructed line to it, at a
 * usable range and squareness. Address points break ties — a front door is on
 * the frontage — and length breaks what is left.
 *
 * A building whose every elevation is unseeable has no frontage, and this says
 * so rather than returning the least bad wall. That is the rule the project
 * turns on: no certified street observation, massing only.
 */
import { buildElevations, inFrontOf, obliquityDeg, standoffM, type Elevation } from '../../src/canalRecall/facade/elevations.ts';
import type { ProjectedPoint } from '../../src/canalRecall/facade/sources.ts';

export interface FrontageChoice {
  elevation: Elevation | null;
  clearViews: number;
  /** How the choice was made, so a card can say and a gate can branch. */
  reason: 'visible' | 'visible-and-addressed' | 'no-visible-elevation';
  /** What the stale proposal pointed at, for comparison. */
  proposed: Elevation | null;
  changed: boolean;
}

export interface VisibilityProbe {
  /** Camera positions worth considering near a point. */
  near(x: number, y: number): ProjectedPoint[];
  /** Is the straight line from a camera to a wall point crossed by a footprint? */
  blocked(from: ProjectedPoint, to: ProjectedPoint, pandId: string): boolean;
}

const MIN_STANDOFF_M = 8, MAX_STANDOFF_M = 45, MAX_OBLIQUITY_DEG = 35;

/** Camera positions with an unobstructed, usable line to this elevation. */
export function countClearViews(elevation: Elevation, pandId: string, probe: VisibilityProbe): number {
  let clear = 0;
  for (const p of probe.near(elevation.midpoint.x, elevation.midpoint.y)) {
    if (!inFrontOf(elevation, p)) continue;
    const standoff = standoffM(elevation, p);
    if (standoff < MIN_STANDOFF_M || standoff > MAX_STANDOFF_M) continue;
    if (obliquityDeg(elevation, p) > MAX_OBLIQUITY_DEG) continue;
    if (probe.blocked(p, elevation.midpoint, pandId)) continue;
    clear++;
  }
  return clear;
}

/** The elevation an existing proposal points at, by distance to the segment. */
export function elevationNearest(elevations: Elevation[], point: ProjectedPoint): Elevation | null {
  if (!elevations.length) return null;
  return elevations
    .map(e => {
      const ux = (e.end.x - e.start.x) / e.lengthM, uy = (e.end.y - e.start.y) / e.lengthM;
      const along = Math.max(0, Math.min(e.lengthM, (point.x - e.start.x) * ux + (point.y - e.start.y) * uy));
      return { e, d: Math.hypot(point.x - (e.start.x + ux * along), point.y - (e.start.y + uy * along)) };
    })
    .sort((a, b) => a.d - b.d)[0].e;
}

export function chooseFrontage(
  ring: ProjectedPoint[], pandId: string, probe: VisibilityProbe,
  { proposal = null as readonly number[] | null, addressPoints = [] as ProjectedPoint[], minLengthM = 3 } = {},
): FrontageChoice {
  const elevations = buildElevations(ring);
  const proposed = proposal
    ? elevationNearest(elevations, { x: (proposal[0] + proposal[2]) / 2, y: (proposal[1] + proposal[3]) / 2 })
    : null;
  if (!elevations.length) return { elevation: null, clearViews: 0, reason: 'no-visible-elevation', proposed, changed: false };

  const scored = elevations
    .filter(e => e.lengthM >= minLengthM)
    .map(e => {
      const clear = countClearViews(e, pandId, probe);
      // How close the nearest address point sits to this wall. A front door is
      // on the frontage, and BAG's point is inside the building behind it, so
      // this is a nudge and never a decision on its own.
      const nearestAddress = addressPoints.length
        ? Math.min(...addressPoints.map(a => {
            const ux = (e.end.x - e.start.x) / e.lengthM, uy = (e.end.y - e.start.y) / e.lengthM;
            const along = Math.max(0, Math.min(e.lengthM, (a.x - e.start.x) * ux + (a.y - e.start.y) * uy));
            return Math.hypot(a.x - (e.start.x + ux * along), a.y - (e.start.y + uy * along));
          }))
        : Infinity;
      return { e, clear, nearestAddress };
    })
    .filter(s => s.clear > 0);

  if (!scored.length) return { elevation: null, clearViews: 0, reason: 'no-visible-elevation', proposed, changed: false };

  // Visibility first, in coarse bands so a 210-vs-230 difference does not
  // outvote a door; then the address; then length.
  scored.sort((a, b) => {
    const band = (n: number) => (n >= 100 ? 3 : n >= 30 ? 2 : 1);
    if (band(b.clear) !== band(a.clear)) return band(b.clear) - band(a.clear);
    if (Number.isFinite(a.nearestAddress) || Number.isFinite(b.nearestAddress)) {
      const d = (a.nearestAddress || 0) - (b.nearestAddress || 0);
      if (Math.abs(d) > 2) return d;
    }
    if (Math.abs(b.e.lengthM - a.e.lengthM) > 1) return b.e.lengthM - a.e.lengthM;
    return b.clear - a.clear;
  });
  const best = scored[0];
  return {
    elevation: best.e,
    clearViews: best.clear,
    reason: Number.isFinite(best.nearestAddress) ? 'visible-and-addressed' : 'visible',
    proposed,
    changed: !proposed || Math.hypot(best.e.midpoint.x - proposed.midpoint.x, best.e.midpoint.y - proposed.midpoint.y) > 1.5,
  };
}


/**
 * A visibility probe over a set of footprints and camera positions.
 *
 * Both the renderers and the registration instrument need the same answer to
 * "can this wall be seen from anywhere", and getting a different answer in two
 * places would mean a reviewer's verdict was about a different wall from the
 * one measured. Built once, here.
 */
export function buildProbe(
  footprints: Map<string, ProjectedPoint[]>, cameras: ProjectedPoint[],
  { cellM = 50, ignoreBeyondM = 90 } = {},
): VisibilityProbe {
  const index = new Map<string, ProjectedPoint[]>();
  for (const p of cameras) {
    const key = `${Math.floor(p.x / cellM)}:${Math.floor(p.y / cellM)}`;
    (index.get(key) ?? index.set(key, []).get(key)!).push(p);
  }
  const hit = (a: ProjectedPoint, b: ProjectedPoint, c: ProjectedPoint, d: ProjectedPoint) => {
    const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
    const denominator = rx * sy - ry * sx;
    if (Math.abs(denominator) < 1e-12) return null;
    const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / denominator;
    const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / denominator;
    return u > 1e-9 && u < 1 - 1e-9 ? t : null;
  };
  return {
    near(x, y) {
      const cx = Math.floor(x / cellM), cy = Math.floor(y / cellM);
      const out: ProjectedPoint[] = [];
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push(...(index.get(`${cx + i}:${cy + j}`) ?? []));
      return out;
    },
    blocked(from, to, pandId) {
      for (const [otherId, ring] of footprints) {
        if (otherId === pandId) continue;
        if (Math.hypot(ring[0].x - to.x, ring[0].y - to.y) > ignoreBeyondM) continue;
        for (let i = 0; i < ring.length; i++) {
          const j = (i + 1) % ring.length;
          const t = hit(from, to, ring[i], ring[j]);
          // A crossing right at the target is the wall's own party wall.
          if (t !== null && t > 0.02 && t < 0.94) return true;
        }
      }
      return false;
    },
  };
}
