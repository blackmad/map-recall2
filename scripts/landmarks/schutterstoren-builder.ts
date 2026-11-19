import * as T from 'three';
import type {BuildingTools} from './cultural-builders';

/**
 * Schutterstoren, Meer en Oever, Osdorp (BAG pand 0363100012123932, bouwjaar 2007, 54 verblijfsobjecten; nl.wikipedia
 * "Schutterstoren (Amsterdam)"): the round residential tower on a concrete stem, part of the Meer en Oever renewal with 't
 * Waterfort and Het Bastion. Feedback 4b1114 (2026-11-10) asked for a bespoke model: the generic block drew it as a plain
 * extruded disc.
 *
 * Native frame of scripts/landmarks/schutterstoren-footprints.json (x east, z south, y up from the 3DBAG ground -1.30 m NAP;
 * origin = vertex average of the BAG ring). The BAG ring is a circle of radius 14.34 m (min 14.28, max 14.42) round the
 * origin; the 3DBAG LoD2.2 roof parts (CC BY 4.0) give the main roof at 45.78 m over a 525 m2 disc (radius ~12.9 m), a ring
 * of lower roof at 42.9 m round its edge (the eaves), a lift/stair head at 47.2 m (x -3.4..2.6, z -2.3..3.8) and a plant box
 * to 49.2 m.
 *
 * Section, from Gemeente Amsterdam panoramas 2025_09_24_09_11_56_00883 (north, 37 m), _00868 (east), _00926 (south), _00902
 * (west) and TMX7316010203-002508_pano_0000_001214 (2022, the entrance), and the Commons photograph
 * "Schutterstoren in Amsterdam Netherlands.jpg": the drum (diameter 28.6 m) stands on a fair-faced concrete stem 11.5 m across
 * (145 of 360 px on the north view), under a shallow conical concrete soffit that rises from the stem to a thin rim 1.6 m
 * deep, 5.6 m over the landscaped deck the stem rises from. Above the rim, twelve storeys of 2.86 m to the eaves at 42.9 m
 * and a top storey set back to the 3DBAG roof disc: white curtain walling, one tall window per 1.23 m bay between proud white
 * fins, some bays closed white panels so the glazing reads as staggered columns (the photographs' chequer). The tower's name
 * in small steel letters over the entrance door on the stem, facing the street (outward bearing 151, pand-reference wall).
 * INFERRED: the per-bay open/closed pattern (deterministic hash, ~22% closed, from the photos' proportion, not bay by bay);
 * the stem's foot is drawn to street level: the landscaped car-park deck round it (another pand / the ground) hides the
 * lowest ~2.5 m, as on the panoramas.
 */
type Col = Parameters<BuildingTools['add']>[1];
const SEG = 96;
const STEM_R = 5.75, SOFFIT_Y = 7.2, RIM_LOW = 7.95, RIM_TOP = 8.6, R = 14.3, DRUM_R = 14.1;
const STOREYS = 12, STOREY = (42.9 - RIM_TOP) / STOREYS, EAVES = 42.9, TOP = 45.78, TOP_R = 12.95;
const BAYS = 72, TOP_BAYS = 66;
/** Outward bearing of the entrance on the stem (pand-reference wall, the 2022 panorama). */
const ENTRANCE_BEARING = 151;

/** Deterministic 0..1 per storey and bay (the open/closed chequer). */
function hash(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Bearing (degrees from north, clockwise) of a direction at angle `th` round the drum (x = sin th, z = -cos th). */
const at = (th: number, r: number): [number, number] => [Math.sin(th) * r, -Math.cos(th) * r];
/** Box rotation that turns a box's +z face to face outward at bearing angle th. */
const facing = (th: number) => Math.PI - th;

export function buildSchutterstoren(_w: number, _d: number, b: BuildingTools) {
  const add = (g: T.BufferGeometry, c: Col, x = 0, y = 0, z = 0, angle = 0) => b.add(g, c, x, y, z, angle);
  // Stem, from street level to the soffit (sunk into it).
  add(new T.CylinderGeometry(STEM_R, STEM_R, SOFFIT_Y + 0.3, 48), 'concrete', 0, (SOFFIT_Y + 0.3) / 2, 0);
  // Conical soffit and rim: one closed solid of revolution.
  const prof = [[0, SOFFIT_Y], [STEM_R - 0.1, SOFFIT_Y], [R - 0.35, RIM_LOW - 0.08], [R, RIM_LOW], [R, RIM_TOP], [0, RIM_TOP]].map(([x, y]) => new T.Vector2(x, y));
  add(new T.LatheGeometry(prof, SEG), 'concrete');
  // The drum to the eaves, white, and the eaves edge.
  add(new T.CylinderGeometry(DRUM_R, DRUM_R, EAVES - RIM_TOP + 0.1, SEG), 'white', 0, (EAVES + RIM_TOP) / 2, 0);
  add(new T.CylinderGeometry(R, R, 0.35, SEG), 'white', 0, EAVES - 0.1, 0);
  // The set-back top storey and its roof edge.
  add(new T.CylinderGeometry(TOP_R, TOP_R, TOP - EAVES + 0.1, SEG), 'white', 0, (TOP + EAVES) / 2, 0);
  add(new T.CylinderGeometry(TOP_R + 0.15, TOP_R + 0.15, 0.3, SEG), 'white', 0, TOP - 0.05, 0);
  add(new T.CylinderGeometry(R - 0.25, R - 0.25, 0.08, SEG), 'slate', 0, EAVES + 0.1, 0);        // terrace deck round the top storey
  add(new T.CylinderGeometry(TOP_R - 0.2, TOP_R - 0.2, 0.06, SEG), 'slate', 0, TOP + 0.08, 0);  // roofing
  // Lift and stair head (3DBAG 47.2 m) and the plant box (49.2 m).
  add(new T.BoxGeometry(6.0, 47.25 - TOP + 0.1, 6.1), 'white', -0.4, (47.25 + TOP) / 2, 0.75);
  add(new T.BoxGeometry(1.6, 49.2 - 47.2, 1.5), 'slate', 2.9, 48.2, 1.35);

  // Curtain walling: fins between the bays, a tall window per bay unless the bay is a closed panel.
  const glaze = (r: number, bays: number, y0: number, y1: number, storeys: number, seed: number) => {
    const pitch = (2 * Math.PI * r) / bays, fh = (y1 - y0) / storeys;
    for (let i = 0; i < bays; i++) {
      const th = (i / bays) * Math.PI * 2, [fx, fz] = at(th, r + 0.12);
      add(new T.BoxGeometry(0.16, y1 - y0, 0.3), 'white', fx, (y0 + y1) / 2, fz, facing(th));
      const tw = th + Math.PI / bays, [wx, wz] = at(tw, r + 0.03);
      for (let k = 0; k < storeys; k++) {
        // Columns stay open or closed for a few storeys at a time, as on the photographs.
        if (hash(Math.floor((k + (i % 3)) / 3) + seed, i) < 0.22) continue;
        const sill = y0 + k * fh + 0.45;
        add(new T.PlaneGeometry(pitch - 0.34, fh - 0.75), 'glass', wx, sill + (fh - 0.75) / 2, wz, facing(tw));
        const [mx, mz] = at(tw + (0.12 * pitch) / r, r + 0.05);
        add(new T.PlaneGeometry(0.06, fh - 0.75), 'frame', mx, sill + (fh - 0.75) / 2, mz, facing(tw));
      }
    }
  };
  glaze(DRUM_R, BAYS, RIM_TOP, EAVES - 0.25, STOREYS, 0);
  glaze(TOP_R, TOP_BAYS, EAVES + 0.25, TOP - 0.2, 1, 101);

  // Entrance on the stem: a glazed door pair under a steel lintel and the name in small letters over it.
  const te = (ENTRANCE_BEARING * Math.PI) / 180, [dx, dz] = at(te, STEM_R + 0.02);
  add(new T.BoxGeometry(2.4, 2.5, 0.1), 'glass', dx, 2.5 + 1.25, dz, facing(te));        // deck level ~2.5 m
  add(new T.BoxGeometry(2.6, 0.15, 0.14), 'frame', dx, 2.5 + 2.55, dz, facing(te));
  const name = 'SCHUTTERSTOREN', pixel = 0.045, adv = 6 * pixel, span = name.length * adv;
  for (let n = 0; n < name.length; n++) {
    const t = te + (-span / 2 + (n + 0.5) * adv) / STEM_R, [lx, lz] = at(t, STEM_R + 0.04), a = facing(t);
    // sign() lays text along (cos a, -sin a) from its start; centre each glyph on its arc point.
    b.sign(name[n], lx - Math.cos(a) * 2.5 * pixel, 6.0, lz + Math.sin(a) * 2.5 * pixel, pixel, 'frame', undefined, a);
  }
}
