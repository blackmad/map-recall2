/**
 * Fabric canopy (Dutch "markies") over a round-arched window: the cloth follows the arch instead of a straight head.
 * Pure geometry in a wall's local frame (t along the wall from the viewer's left, y up, o out of the wall), no three.js;
 * polygons in the same form as `stripedAwning` (`AwningPolygon`, both windings, `stripe` 0 or 1), so the same adapter
 * draws them.
 *
 * Why (2026-11-23, landmark lane r18-D): the three tall round-arched ground-floor windows of the former Cafe-Restaurant
 * Riche on the Rokin (A.L. van Gendt, 1883) each carry a red markies whose cloth runs round the arch from jamb to jamb,
 * hangs a scalloped valance inside the arch and comes down the jambs a little below the springing (Gemeente Amsterdam
 * panoramas recording_2025-06-19_03-28-47_01404, 2025, and TMX7316010203-002857_pano_0002_000054, 2022). `stripedAwning`
 * takes its head as a straight plan polyline at one height, so it can only draw a canopy over a square head; an arched
 * head lies in the wall's elevation, not its plan.
 *
 * The head is the arch on the wall (radius `r` about (t, ySpring), o = 0); the lip is the same arch `drop` smaller and `proj`
 * out from the wall; the valance hangs `valance` further in (towards the arch centre), each segment ending in a tongue
 * `scallop` deep. `segs` segments span the half circle, alternating stripes. `legs` > 0 continues the cloth straight down
 * both jambs below the springing (vertical bands from the wall to the lip, with the valance on their inner edge).
 */
import type {AwningPolygon} from './stripedAwning';

export type ArchAwningOpts = {
  /** Arch centre along the wall, m. */
  t: number;
  /** Springing height of the arch (centre of the half circle), m. */
  ySpring: number;
  /** Radius of the head on the wall, m (> 0). */
  r: number;
  /** Segments over the half circle (>= 2); each is one stripe. */
  segs: number;
  /** Projection of the lip from the wall, m (> 0). */
  proj: number;
  /** Radial drop from the head to the lip, m (0 < drop < r). */
  drop: number;
  /** Valance depth inside the lip, m (0 = none). */
  valance?: number;
  /** Tongue depth of each valance segment, m (at most the valance). */
  scallop?: number;
  /** Straight cloth down both jambs below the springing, m (0 = none). */
  legs?: number;
  /** Colour index of the first stripe (default 0). */
  first?: 0 | 1;
};

export type ArchAwning = {cloth: AwningPolygon[]; valance: AwningPolygon[]; legs: AwningPolygon[]; stripes: number};

type P3 = [number, number, number];
const both = (pts: P3[], stripe: 0 | 1): AwningPolygon[] => [{pts, stripe}, {pts: pts.slice().reverse(), stripe}];

export function archAwning(o: ArchAwningOpts): ArchAwning {
  const {t, ySpring, r, proj, drop} = o;
  const segs = Math.round(o.segs);
  if (!(r > 0 && proj > 0 && drop > 0 && drop < r)) throw Error('archAwning: positive radius, projection and drop (< radius) required');
  if (!(segs >= 2)) throw Error('archAwning: at least two segments');
  const val = Math.min(r - drop, Math.max(0, o.valance ?? 0)), sc = Math.min(val, Math.max(0, o.scallop ?? 0));
  const rl = r - drop, rh = rl - val;
  // angle from the left springing (pi) over the crown to the right springing (0), so the run reads left to right
  const at = (rad: number, k: number, out: number): P3 => {
    const a = Math.PI * (1 - k / segs);
    return [t + rad * Math.cos(a), ySpring + rad * Math.sin(a), out];
  };
  const cloth: AwningPolygon[] = [], valance: AwningPolygon[] = [], legs: AwningPolygon[] = [];
  let s = o.first ?? 0;
  for (let k = 0; k < segs; k++) {
    const c = s as 0 | 1;
    cloth.push(...both([at(r, k, 0), at(r, k + 1, 0), at(rl, k + 1, proj), at(rl, k, proj)], c));
    if (val > 0) {
      const tip = at(rh, k + 0.5, proj);
      valance.push(...both(sc > 0
        ? [at(rl, k, proj), at(rl, k + 1, proj), at(rh + sc, k + 1, proj), tip, at(rh + sc, k, proj)]
        : [at(rl, k, proj), at(rl, k + 1, proj), at(rh, k + 1, proj), at(rh, k, proj)], c));
    }
    s = (1 - s) as 0 | 1;
  }
  const leg = Math.max(0, o.legs ?? 0);
  if (leg > 0) {
    const y0 = ySpring - leg;
    // left jamb carries the first stripe's colour, the right jamb the last's, so the cloth reads continuous round the arch
    for (const [side, c] of [[-1, (o.first ?? 0)], [1, ((o.first ?? 0) + segs - 1) % 2]] as [number, number][]) {
      const tw = t + side * r, tl = t + side * rl;
      legs.push(...both([[tw, ySpring, 0], [tl, ySpring, proj], [tl, y0, proj], [tw, y0, 0]], c as 0 | 1));
      if (val > 0) legs.push(...both([[tl, ySpring, proj], [t + side * rh, ySpring, proj], [t + side * rh, y0, proj], [tl, y0, proj]], c as 0 | 1));
    }
  }
  return {cloth, valance, legs, stripes: segs};
}
