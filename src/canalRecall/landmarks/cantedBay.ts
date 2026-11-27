/**
 * A canted bay (three-sided oriel, "erker" on a trapezoid plan): a front facet parallel to the wall and two splayed side
 * facets running back to the wall. Pure plan geometry in a wall frame, no three.js, the convention of cornerTurret.ts:
 *   t  along the wall, from the viewer's left end, facing the wall from outside;
 *   o  out of the wall (0 = the wall plane);
 *   y  up (not used here).
 *
 * Why (2026-11-27, landmarks r20-A): Dikker & Thijs on the Leidsestraat corner carries six two-storey canted oriels with
 * stone colonnettes at the facet corners and paned windows on all three facets; Raadhuisstraat 52 has a one-storey canted
 * oriel on a corbel. Builders drew such bays inline (het-sieraad polyBay, droogbak, atlanta's bowed oriel), each with its
 * own facet maths, and cornerTurret.ts only does regular polygons, so a bay whose sides are short and steep could not be
 * said. This module gives the facets (ends, centre, width, outward normal), the plan outline and an outward offset of
 * that outline (for base slabs, sill and lintel bands and caps that stand proud of the bay). Nothing changes for models
 * that do not call it.
 */
export type TO = [number, number];

export interface CantedBayPlan {
  /** Centre of the bay along the wall (m). */
  t: number;
  /** Width where the bay meets the wall (m). */
  base: number;
  /** Width of the front facet (m), 0 < front <= base. */
  front: number;
  /** Projection of the front facet from the wall (m). */
  out: number;
}

export interface BayFacet {
  /** 0 = left side, 1 = front, 2 = right side (left to right facing the wall). */
  index: number;
  /** Facet ends, left then right, in (t, o). */
  a: TO;
  b: TO;
  centre: TO;
  width: number;
  /** Outward unit normal (dt, do). */
  normal: TO;
  /** Angle of the normal from the wall normal (radians, + towards +t). */
  angle: number;
}

function check(p: CantedBayPlan) {
  if (!(p.base > 0 && p.front > 0 && p.out > 0)) throw new Error('cantedBay: base, front and out must be positive');
  if (p.front > p.base + 1e-9) throw new Error('cantedBay: the front facet cannot be wider than the base');
}

/** The plan outline from the wall at the left, round the front, to the wall at the right (four points). */
export function cantedBayOutline(p: CantedBayPlan): TO[] {
  check(p);
  return [[p.t - p.base / 2, 0], [p.t - p.front / 2, p.out], [p.t + p.front / 2, p.out], [p.t + p.base / 2, 0]];
}

/** The three facets, left to right. */
export function cantedBayFacets(p: CantedBayPlan): BayFacet[] {
  const pts = cantedBayOutline(p);
  const out: BayFacet[] = [];
  for (let i = 0; i < 3; i++) {
    const a = pts[i], b = pts[i + 1], dt = b[0] - a[0], d = b[1] - a[1], width = Math.hypot(dt, d);
    // outward normal: the facet direction turned to the viewer's side (+o) - for left-to-right travel that is (-d, dt)
    const normal: TO = [-d / width, dt / width];
    out.push({index: i, a, b, centre: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], width, normal, angle: Math.atan2(normal[0], normal[1])});
  }
  return out;
}

/**
 * The outline offset outward by `d` on every facet (mitred corners), its ends carried along the wall line (o = 0), so a
 * band or slab `d` proud of the bay meets the wall. With d = 0 it is the outline itself.
 */
export function offsetOutline(p: CantedBayPlan, d: number): TO[] {
  const f = cantedBayFacets(p);
  const line = (k: number): [TO, TO] => [[f[k].a[0] + f[k].normal[0] * d, f[k].a[1] + f[k].normal[1] * d], [f[k].b[0] - f[k].a[0], f[k].b[1] - f[k].a[1]]];
  const meet = ([p0, v0]: [TO, TO], [p1, v1]: [TO, TO]): TO => {
    const den = v0[0] * v1[1] - v0[1] * v1[0];
    const s = ((p1[0] - p0[0]) * v1[1] - (p1[1] - p0[1]) * v1[0]) / den;
    return [p0[0] + v0[0] * s, p0[1] + v0[1] * s];
  };
  const wall: [TO, TO] = [[0, 0], [1, 0]];
  const L = line(0), F = line(1), R = line(2);
  return [meet(wall, L), meet(L, F), meet(F, R), meet(R, wall)];
}

/** Clear width of a window centred on a facet, leaving `margin` at each end (never below 0). */
export function facetOpening(f: BayFacet, margin: number): number {
  return Math.max(0, f.width - 2 * margin);
}
