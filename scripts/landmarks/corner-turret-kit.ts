import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {archSlab, put, slab, type Frame} from './nearbar-kit';
import {circumradius, turretFacets, turretStack, type TurretFacet, type TurretPlan, type TurretStages} from '../../src/canalRecall/landmarks/cornerTurret';

/**
 * Builder adapter for src/canalRecall/landmarks/cornerTurret.ts: a corbelled polygonal corner turret on a wall frame
 * (nearbar-kit Frame: t along the wall, y up, o out of the wall). The body, drum and cone are full prisms (their buried
 * half is hidden in the building); windows, quoins and drum lights go only on the facets the plan reports as exposed.
 */
export interface TurretWindowRow {y0: number; y1: number; arched?: boolean; width?: number}
export interface CornerTurretDraw {
  plan: TurretPlan;
  stages: TurretStages;
  /** Drum apothem (default 0.82 x the body apothem) and cone eave apothem (default 1.12 x the drum's). */
  drumApothem?: number;
  coneApothem?: number;
  /** Window rows on every exposed body facet. */
  windows?: TurretWindowRow[];
  /** Small arched lights on the exposed drum facets: [y0, y1]. */
  drumLights?: [number, number];
  /** Which exposed drum facets get a light (default all). */
  drumLightOn?: (f: TurretFacet) => boolean;
  /** Which exposed body facets get the window rows (default all; absent = byte-identical to before). */
  windowOn?: (f: TurretFacet) => boolean;
  /** Stone band heights on the body and drum (each 0.16 m, 4 cm proud). */
  bands?: number[];
  /** Stone quoin strips at the exposed body corners. */
  quoins?: boolean;
  colours: {wall: string; trim: string; glass: string; frame: string; roof: string; finial: string};
}

const prism = (apothem: number, h: number, sides: number, facing: number, rTop?: number) =>
  new T.CylinderGeometry(rTop ?? circumradius(apothem, sides), circumradius(apothem, sides), h, sides).rotateY(facing + Math.PI / sides).translate(0, h / 2, 0);

/** The wall frame of one facet (t = 0 at the facet centre, o out of the facet). */
export function facetFrame(F: Frame, f: TurretFacet): Frame {
  const W = (t: number, o: number): [number, number] => [F.origin[0] + F.tangent[0] * t + F.n[0] * o, F.origin[1] + F.tangent[1] * t + F.n[1] * o];
  const [s, c] = [Math.sin(f.angle), Math.cos(f.angle)];
  return {
    origin: W(f.centre[0], f.centre[1]),
    n: [F.tangent[0] * s + F.n[0] * c, F.tangent[1] * s + F.n[1] * c],
    tangent: [F.tangent[0] * c - F.n[0] * s, F.tangent[1] * c - F.n[1] * s],
  };
}

export function cornerTurretOn(b: BuildingTools, F: Frame, o: CornerTurretDraw) {
  const st = turretStack(o.stages), P = o.plan, n = P.sides, face = P.facing ?? 0, C = o.colours;
  const at = (g: T.BufferGeometry, y: number, c: string) => put(b, F, g, P.centre[0], y, P.centre[1], c);
  const A = P.apothem, Ad = o.drumApothem ?? A * 0.82, Ac = o.coneApothem ?? Ad * 1.12;
  // corbel: an inverted frustum from a quarter of the body down at its foot, with a moulded ring at the top
  at(prism(A * 0.25, st.corbel[1] - st.corbel[0], n, face, circumradius(A, n)), st.corbel[0], C.trim);
  at(prism(A + 0.06, 0.18, n, face), st.corbel[1] - 0.18, C.trim);
  // body, bands and the cornice ring at its top
  at(prism(A, st.body[1] - st.body[0], n, face), st.body[0], C.wall);
  for (const y of o.bands ?? []) if (y > st.body[0] && y < st.body[1]) at(prism(A + 0.04, 0.16, n, face), y, C.trim);
  at(prism(A + 0.1, 0.22, n, face), st.body[1] - 0.22, C.trim);
  at(prism(A + 0.2, 0.18, n, face), st.body[1] - 0.04, C.trim);
  const facets = turretFacets(P).filter(f => f.exposed);
  for (const f of facets) {
    const ff = facetFrame(F, f), w = Math.min(f.width * 0.5, f.width - 0.36);
    for (const r of o.windowOn && !o.windowOn(f) ? [] : o.windows ?? []) {
      const ww = r.width ?? w;
      if (r.arched) {
        archSlab(b, ff, 0, r.y0 - 0.06, ww + 0.16, r.y1 - r.y0 + 0.14, 0.06, C.frame);
        archSlab(b, ff, 0, r.y0, ww, r.y1 - r.y0, 0.11, C.glass);
      } else {
        slab(b, ff, 0, r.y0 - 0.06, ww + 0.16, r.y1 - r.y0 + 0.12, 0.06, C.frame);
        slab(b, ff, 0, r.y0, ww, r.y1 - r.y0, 0.11, C.glass);
      }
      slab(b, ff, 0, r.y0 + (r.y1 - r.y0) * 0.62, ww, 0.05, 0.15, C.frame);
      slab(b, ff, 0, r.y0 - 0.14, ww + 0.3, 0.1, 0.16, C.trim);
    }
    if (o.quoins) {
      // stone strips at the facet's two edges (each shared with a neighbour; drawn once from the left edge of every facet)
      for (let y = st.body[0] + 0.1, k = 0; y < st.body[1] - 0.4; y += 0.32, k++) {
        const qw = k % 2 ? 0.08 : 0.14;
        slab(b, ff, -f.width / 2 + qw / 2 - 0.02, y, qw, 0.26, 0.08, C.trim);
        slab(b, ff, f.width / 2 - qw / 2 + 0.02, y, qw, 0.26, 0.08, C.trim);
      }
    }
  }
  // drum, bands, eave ring
  let top = st.body[1] + 0.14;
  if (st.drum) {
    at(prism(Ad, st.drum[1] - st.drum[0], n, face), st.drum[0], C.wall);
    for (const y of o.bands ?? []) if (y > st.drum[0] && y < st.drum[1]) at(prism(Ad + 0.04, 0.14, n, face), y, C.trim);
    at(prism(Ad + 0.08, 0.16, n, face), st.drum[1] - 0.16, C.trim);
    if (o.drumLights) {
      const [y0, y1] = o.drumLights;
      for (const f of turretFacets({...P, apothem: Ad}).filter(x => x.exposed && (o.drumLightOn?.(x) ?? true))) {
        const ff = facetFrame(F, f), w = f.width * 0.45;
        archSlab(b, ff, 0, y0 - 0.05, w + 0.14, y1 - y0 + 0.12, 0.05, C.trim);
        archSlab(b, ff, 0, y0, w, y1 - y0, 0.09, C.glass, 0, 4);
      }
    }
    top = st.drum[1];
  }
  // cone spire with an eave ring and a spike finial with a ball
  at(prism(Ac + 0.04, 0.12, n, face), Math.max(top, st.cone[0]) - 0.06, C.trim);
  at(new T.CylinderGeometry(0, circumradius(Ac, n), st.cone[1] - st.cone[0], n).rotateY(face + Math.PI / n).translate(0, (st.cone[1] - st.cone[0]) / 2, 0), st.cone[0], C.roof);
  if (st.top > st.cone[1]) {
    const L = st.top - st.cone[1];
    at(new T.CylinderGeometry(0.012, 0.04, L, 6).translate(0, L / 2, 0), st.cone[1] - 0.1, C.finial);
    at(new T.SphereGeometry(0.07, 8, 6).translate(0, 0, 0), st.cone[1] + L * 0.35, C.finial);
  }
  return {stack: st, exposed: facets.length};
}
