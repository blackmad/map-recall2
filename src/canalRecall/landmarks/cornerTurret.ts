/**
 * A corbelled corner turret (hoektorentje): a polygonal oriel engaged in a canted building corner, standing on a corbel
 * at the top of the ground storey, carried past the cornice as a drum and capped by a cone spire with a finial. Pure plan
 * and stage geometry in a wall frame, no three.js, the convention of holedWall.ts and scrollDormer.ts:
 *   t  along the wall, from the viewer's left end, facing the wall from outside;
 *   o  out of the wall (0 = the wall plane, the canted corner's face);
 *   y  up.
 *
 * Why (2026-11-23, landmarks r18-E, Muntplein 1 / Amstel 2, A.L. van Gendt 1892): the building's signature is the turret
 * on its canted corner, a three-faceted oriel on carved consoles through two storeys, then an octagonal drum with small
 * arched lights under a slate cone and spike. Builders drew such turrets inline (droogbak-builder.ts, effectenbeurs,
 * stationsplein-paviljoens, the zevenlandenhuizen domed oriel), each with its own facet maths; none places windows on the
 * facets that actually stand in front of the wall, so a turret either glazed facets buried in the building or drew only
 * a front panel. This module gives the facet list (centre, width, outward normal, exposed or buried) and validates the
 * stage stack, so a builder can glaze exactly the facets a rider sees. Nothing changes for models that do not call it.
 */
export interface TurretFacet {
  /** Facet index, 0 = the facet facing straight along `facing`, counting towards +t. */
  index: number;
  /** Angle of the facet normal from the wall normal (radians, + towards +t). */
  angle: number;
  /** Facet centre in the wall frame (t, o). */
  centre: [number, number];
  /** Facet width (edge length of the polygon). */
  width: number;
  /** Outward unit normal in the wall frame (dt, do). */
  normal: [number, number];
  /** True when the facet centre stands at least `minOut` in front of the wall plane (visible from the street). */
  exposed: boolean;
}

export interface TurretPlan {
  /** Number of polygon sides (>= 3; 8 for the usual octagonal turret). */
  sides: number;
  /** Centre to facet distance (m). */
  apothem: number;
  /** Plan centre in the wall frame (t, o); o < 0 sets the polygon partly into the building. */
  centre: [number, number];
  /** Direction of facet 0's normal from the wall normal (radians, + towards +t); default 0 (facing straight out). */
  facing?: number;
  /** A facet counts as exposed when its centre's o is at least this (default 0.05 m). */
  minOut?: number;
}

/** Facets of a regular polygon turret in the wall frame, facet 0 facing `facing`. */
export function turretFacets(p: TurretPlan): TurretFacet[] {
  if (!(p.sides >= 3) || !Number.isInteger(p.sides)) throw new Error('turretFacets: sides must be an integer >= 3');
  if (!(p.apothem > 0)) throw new Error('turretFacets: apothem must be positive');
  const step = (2 * Math.PI) / p.sides, width = 2 * p.apothem * Math.tan(Math.PI / p.sides), minOut = p.minOut ?? 0.05;
  const out: TurretFacet[] = [];
  for (let i = 0; i < p.sides; i++) {
    // wrap to (-pi, pi] so facet indices read symmetrically about the front
    let a = (p.facing ?? 0) + i * step;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    const normal: [number, number] = [Math.sin(a), Math.cos(a)];
    const centre: [number, number] = [p.centre[0] + normal[0] * p.apothem, p.centre[1] + normal[1] * p.apothem];
    out.push({index: i, angle: a, centre, width, normal, exposed: centre[1] >= minOut - 1e-9});
  }
  return out;
}

/** The vertical stages of the turret (heights above the model's ground). */
export interface TurretStages {
  /** Corbel under the oriel: [bottom, top]; the corbel narrows downward to `corbelFoot` of the body apothem. */
  corbel: [number, number];
  /** Oriel body: [bottom, top]; bottom must equal corbel top. */
  body: [number, number];
  /** Drum above the cornice: [bottom, top] (optional); bottom must not lie below the body top. */
  drum?: [number, number];
  /** Cone (or pyramid) spire: base height and rise. */
  cone: {y: number; rise: number};
  /** Finial length above the cone apex (default 0). */
  finial?: number;
}

export interface TurretStack {
  corbel: [number, number];
  body: [number, number];
  drum: [number, number] | null;
  cone: [number, number];
  /** Height of the finial tip (the top of the turret). */
  top: number;
}

/** Validate the stage stack (each stage starts where the one below ends or above it) and return the resolved ranges. */
export function turretStack(s: TurretStages): TurretStack {
  const ok = (r: [number, number], name: string) => { if (!(r[1] > r[0])) throw new Error(`turretStack: ${name} must rise`); };
  ok(s.corbel, 'corbel');
  ok(s.body, 'body');
  if (Math.abs(s.body[0] - s.corbel[1]) > 1e-6) throw new Error('turretStack: the body must stand on the corbel');
  if (s.drum) {
    ok(s.drum, 'drum');
    if (s.drum[0] < s.body[1] - 1e-6) throw new Error('turretStack: the drum must not start inside the body');
  }
  const base = s.drum ? s.drum[1] : s.body[1];
  if (s.cone.y < base - 1e-6) throw new Error('turretStack: the cone must sit on the stage below');
  if (!(s.cone.rise > 0)) throw new Error('turretStack: the cone must rise');
  const coneTop = s.cone.y + s.cone.rise;
  return {corbel: s.corbel, body: s.body, drum: s.drum ?? null, cone: [s.cone.y, coneTop], top: coneTop + Math.max(0, s.finial ?? 0)};
}

/** Circumradius of a regular polygon from its apothem (what a CylinderGeometry radius needs). */
export const circumradius = (apothem: number, sides: number) => apothem / Math.cos(Math.PI / sides);
