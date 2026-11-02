import * as T from 'three';
import {ConvexGeometry} from 'three/examples/jsm/geometries/ConvexGeometry.js';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism, upwardRoofPlane} from './house-geometry';
import {poly, slab, type Frame} from './nearbar-kit';
import source from './ziggo-dome-footprints.json';

type Colour = Parameters<BuildingTools['add']>[1];
type Pt = [number, number];

/**
 * Ziggo Dome, De Passage 100, Amsterdam Zuidoost (BAG pand 0363100012238052, bouwjaar 2012; Benthem Crouwel Architekten;
 * nl.wikipedia "Ziggo Dome", CC BY-SA 4.0: a square black block, no round forms, 30 m high, clad all round with LEDs on a
 * black ground). Native east/south metres from the BAG vertex average (scripts/landmarks/ziggo-dome-footprints.json,
 * citroen-zuid-prepare.ts --id=ziggo-dome), y above the 3DBAG ground (-3.16 m NAP).
 *
 * Massing from the 3DBAG LoD2.2 roof parts: the box roof at 31.4 m over the whole ring except a 5.7 m strip along the SW
 * face, which is the loading-dock canopy at 5.3 m; four plant housings on the roof (flat tops at 34.0 m, 12 x 6.8 m, sloped
 * ends running down to the roof). The NE corners keep the BAG sawtooth.
 *
 * Elevations from the rectified Gemeente Amsterdam panoramas (CC BY 4.0) and Commons "2020 Ziggodome.jpg" (CC BY-SA 4.0):
 *  - the skin: charcoal perforated panels with the vertical LED rods on a 1.2 m pitch (w01-331: 85 panels on 102.8 m),
 *    8.2-31.4 m; a grey base band 6.0-8.2 m (dark panels and service doors on the NE deck, w04-61; doors on the SE, w02-151);
 *    the pale concrete podium / deck wall 0-6.0 m (w01-331, w06-331);
 *  - windows behind the perforated skin on the SW and NE faces only (w03-241, w04-61, Commons 2020): a top ribbon
 *    26.5-28.9 m and three rows of 4 m window groups at 22.1-23.4, 16.9-18.2 and 11.8-13.0 m (12 groups on a 5.9 m pitch on
 *    the SW); NW and SE are blank;
 *  - SW: loading docks under the 5.3 m canopy, the piers striped yellow and black (Commons 2020);
 *  - NE: two glazed bridges to the neighbouring pand 0363100012239295, 24.9 m across (w04-61).
 * The LED content (the Ziggo logos and video of the Commons night photos) is screen content and not modelled.
 */
const src = source as unknown as {facadeRing: number[][]; surfaces: {type: string; rings: number[][][]}[]};
const R = src.facadeRing.map(p => [p[0], p[1]] as Pt);
// The SW strip (ring[14..18]) is the dock canopy; the box ring runs straight from the W corner to the S corner.
const W_CORNER = R[14], S_CORNER = R[18];
const BOX: Pt[] = [...R.slice(0, 15), S_CORNER, R[19]];
const DOCK: Pt[] = [W_CORNER, R[16], R[17], S_CORNER];

const ROOF = 31.4, PODIUM = 6.0, SKIN0 = 8.2;

const shape = (pts: Pt[]) => new T.Shape(pts.map(([x, z]) => new T.Vector2(x, z)));
const area = (pts: Pt[]) => pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
/** Mitred outward offset of a simple polygon. */
function offset(pts: Pt[], d: number): Pt[] {
  const s = area(pts) > 0 ? 1 : -1, n = pts.length;
  const nrm = (a: Pt, q: Pt): Pt => { const dx = q[0] - a[0], dz = q[1] - a[1], l = Math.hypot(dx, dz); return [s * dz / l, -s * dx / l]; };
  return pts.map((p, i) => {
    const a = nrm(pts[(i - 1 + n) % n], p), c = nrm(p, pts[(i + 1) % n]);
    const k = d / Math.max(0.35, 1 + a[0] * c[0] + a[1] * c[1]);
    return [p[0] + (a[0] + c[0]) * k, p[1] + (a[1] + c[1]) * k] as Pt;
  });
}
/** A closed band round the box: outer face `out` m proud, inner face hidden 0.3 m inside, from y to y + h. */
function band(b: BuildingTools, pts: Pt[], y: number, h: number, out: number, colour: Colour) {
  const s = shape(offset(pts, out));
  s.holes.push(new T.Path(offset(pts, -0.3).map(([x, z]) => new T.Vector2(x, z))));
  const g = new T.ExtrudeGeometry(s, {depth: h, bevelEnabled: false});
  g.rotateX(Math.PI / 2); g.translate(0, y + h, 0);
  b.add(g, colour);
}
/** Frame on the box edge a -> b (ring order keeps n = (-t.z, t.x) pointing out); t runs from a, the viewer's left. */
function edge(a: Pt, c: Pt): Frame & {len: number} {
  const len = Math.hypot(c[0] - a[0], c[1] - a[1]), t: Pt = [(c[0] - a[0]) / len, (c[1] - a[1]) / len];
  return {origin: a, tangent: t, n: [-t[1], t[0]], len};
}
const NE = edge(R[6], R[7]);          // 66.9 m straight part of the NE face, from the E sawtooth
const SW = edge(W_CORNER, S_CORNER);  // 90.7 m, from the W corner

/** Window rows behind the perforated skin, in metres above the street. */
const RIBBON = {y: 26.5, h: 2.4};
const ROWS = [{y: 22.1, h: 1.3}, {y: 16.9, h: 1.3}, {y: 11.8, h: 1.2}];
const glassAt = (b: BuildingTools, f: Frame, t0: number, t1: number, y: number, h: number) => slab(b, f, (t0 + t1) / 2, y, t1 - t0, h, 0.09, 'glass');

export function buildZiggoDome(_w: number, _d: number, b: BuildingTools) {
  // ---- the box: skin walls to the roof, the roof, a coping rim; podium and base bands ----
  b.add(openTopPrism(shape(BOX), 0, ROOF), 'greyBrick');
  b.add(upwardRoofPlane(shape(BOX), ROOF), 'slate');
  band(b, BOX, ROOF - 0.35, 0.55, 0.14, 'bronze');
  band(b, BOX, 0, PODIUM, 0.3, 'concrete');
  band(b, BOX, PODIUM, SKIN0 - PODIUM, 0.1, 'stone');

  // ---- the LED rods: vertical fins on a 1.2 m pitch on every face longer than 8 m ----
  for (let i = 0; i < BOX.length; i++) {
    const f = edge(BOX[i], BOX[(i + 1) % BOX.length]);
    if (f.len < 8) continue;
    const n = Math.floor((f.len - 0.6) / 1.2);
    const t0 = (f.len - (n - 1) * 1.2) / 2;
    for (let k = 0; k < n; k++) slab(b, f, t0 + k * 1.2, SKIN0, 0.12, ROOF - 0.35 - SKIN0, 0.13, 'bronze');
  }

  // ---- windows behind the skin (SW: w03-241 + Commons 2020; NE: w04-61) ----
  glassAt(b, SW, 9.5, 85.0, RIBBON.y, RIBBON.h);
  for (const r of ROWS) for (let k = 0; k < 12; k++) glassAt(b, SW, 10.3 + k * 5.9, 14.3 + k * 5.9, r.y, r.h);
  glassAt(b, NE, 18.8, 42.2, RIBBON.y, RIBBON.h);
  glassAt(b, NE, 49.7, 62.4, RIBBON.y, RIBBON.h);
  for (const r of ROWS) for (const [t0, t1] of [[46.0, 50.0], [51.7, 55.7]]) glassAt(b, NE, t0, t1, r.y, r.h);
  glassAt(b, NE, 11.0, 14.8, ROWS[2].y, ROWS[2].h);

  // ---- service doors in the base band: NE deck (w04-61, two pairs), SE (w02-151, 14 doors) ----
  for (const t of [13.6, 16.4, 31.3, 33.3, 52.4, 55.3]) slab(b, NE, t, PODIUM + 0.05, 1.8, 2.1, 0.21, 'dark');
  const SE = edge(R[19], R[0]);  // 102.8 m, from the S corner
  for (let k = 0; k < 14; k++) slab(b, SE, 8 + k * 6.6, PODIUM + 0.05, 1.6, 2.1, 0.21, 'dark');

  // ---- SW loading docks: the canopy slab at 5.3 m on piers striped yellow and black, dock doors behind ----
  {
    const g = new T.ExtrudeGeometry(shape(DOCK), {depth: 0.8, bevelEnabled: false});
    g.rotateX(Math.PI / 2); g.translate(0, 5.3, 0);
    b.add(g, 'concrete');
    const out = edge(R[16], R[17]);
    const bays = 15, pitch = (out.len - 2) / bays;
    for (let k = 0; k <= bays; k++) {
      const t = 1 + k * pitch;
      // Pier 0.1 m behind the canopy edge (Commons 2020), stripes on its street face.
      slab(b, out, t, 0, 1.0, 4.5, 1.1, 'gold', -1.2);
      for (let s = 0; s < 3; s++) poly(b, out, t - 0.45, 0.4 + s * 1.4, [[0, 0], [0.45, 0], [0.9, 0.5], [0.9, 0.95]], 0.08, 'bronze', -0.12);
      if (k < bays) slab(b, SW, (k + 0.5) * (SW.len / bays), 0, SW.len / bays - 2.0, 4.0, 0.13, 'dark', 0.25);
    }
    // Concrete end walls close the dock row under both ends of the canopy.
    for (const f of [edge(W_CORNER, R[16]), edge(R[17], S_CORNER)]) slab(b, f, f.len / 2, 0, f.len - 0.2, 4.5, 0.4, 'concrete', -0.4);
  }

  // ---- roof plant: the four 3DBAG housings (flat top at 34.0 m, sloped ends), hulls sunk to 31.0 m ----
  const roofs = src.surfaces.filter(s => s.type === 'RoofSurface').map(s => s.rings[0]);
  const near = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[2] - q[2]) < 0.3;
  for (const top of roofs.filter(r => r.length === 4 && r.every(p => p[1] > 33.8))) {
    const parts = [top, ...roofs.filter(r => r !== top && r.length <= 6 && Math.min(...r.map(p => p[1])) > 31 && r.filter(p => top.some(q => near(p, q))).length >= 2)];
    const pts: T.Vector3[] = [];
    for (const r of parts) for (const p of r) {
      pts.push(new T.Vector3(p[0], p[1], p[2]));
      if (p[1] < 32) pts.push(new T.Vector3(p[0], ROOF - 0.4, p[2]));
    }
    for (const p of top) pts.push(new T.Vector3(p[0], ROOF - 0.4, p[2]));
    b.add(new ConvexGeometry(pts), 'frame');
  }

  // ---- NE: the two glazed bridges to pand 0363100012239295 (24.9 m across, w04-61) ----
  const span = 25.2;
  for (const br of [{t: 23.75, w: 4.5, y: 11.0, levels: 2, h: 7.4}, {t: 42.25, w: 3.5, y: 21.0, levels: 1, h: 3.2}]) {
    // Back faces 0.3 m inside the skin, far ends 0.3 m inside the neighbour; the glass runs 0.1 m shorter at both ends.
    slab(b, NE, br.t, br.y, br.w, 0.8, span + 0.3, 'white', -0.3);
    slab(b, NE, br.t, br.y + br.h - 0.6, br.w, 0.6, span + 0.3, 'white', -0.3);
    slab(b, NE, br.t, br.y + 0.75, br.w - 0.2, br.h - 1.3, span + 0.1, 'canopyGlass', -0.2);
    if (br.levels === 2) slab(b, NE, br.t, br.y + br.h / 2 - 0.2, br.w + 0.1, 0.4, span + 0.2, 'white', -0.25);
  }
}
