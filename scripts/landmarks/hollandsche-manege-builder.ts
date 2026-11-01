/**
 * Hollandsche Manege, Vondelstraat 140 (BAG 0363100012074454; 1882, A.L. van Gendt; Rijksmonument 5908: "een inpandig
 * gelegen complex bestaande uit een gang onder de huizen van de Vondelstraat door, een piste met ijzeren kap, omgeven
 * door stallen ..."). Every part below comes from the register text quoted in scripts/landmarks/hollandsche-manege-brief.md
 * or from the rectified Gemeente Amsterdam panoramas (CC BY 4.0) listed in scripts/landmarks/hollandsche-manege-inventory.json;
 * nothing is described from memory.
 *
 *  - Vondelstraat gateway (w10-157, 50 px/m): a white stucco ground storey with a round-arched passage between
 *    pilasters, a rusticated base, lanterns and blue enamel plaques, an entablature with MANEGE in the frieze and a
 *    keystone cartouche; above it three bays of brick with white stone surrounds, segmental hoods on the first floor,
 *    timber frames, and a stone cornice under the brick attic.
 *  - Hall north gable on the square (w04-338): white rendered base with DE HOLLANDSCHE MANEGE on a stone band,
 *    arched timber double doors, brick gable above with five oculi (white cross keystones) and a broad white raking
 *    cornice with returns, a chimney at the apex.
 *  - Hall east wall on the alley (w01-69, 44 px/m): rendered white, eleven round-headed windows with circle-tracery
 *    fanlights at 3 m centres, wall lanterns, downpipes, a plinth and a coping.
 *  - Everything else (the hall roof with its raised ridge boxes, the stables, the wings behind the Vondelstraat houses)
 *    is the 3DBAG LoD2.2 shell (CC BY 4.0); those walls are not photographed (party walls or hidden behind houses).
 *
 * Heights: the rectified crops compress vertically against 3DBAG (the east wall reads 8.6 m in w01, 3DBAG 10.35 m), so
 * photo heights are scaled to the 3DBAG eaves; widths are taken at the crops' metric horizontal scale.
 *
 * Frame: x east, z south, y up from the 3DBAG ground, origin = vertex average of the BAG outer ring (RD)
 * (scripts/landmarks/hollandsche-manege-prepare.ts writes hollandsche-manege-footprints.json).
 */
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {raisedLettering} from './ornament-kit';
import {planarPolygon} from './worship-shell';
import {setSink, slab, ledgeStrip, archSlab, archBand, put, poly, ringSlab, disc, segBand, type Frame} from './nearbar-kit';
import plan from './hollandsche-manege-footprints.json';

type V = [number, number];
type W3 = {id: string; ring: number[][]; top: number; bearing: number};
let b: BuildingTools;

const ring = plan.ring as V[];
const sub = (p: V, q: V): V => [p[0] - q[0], p[1] - q[1]];
const unit = (p: V): V => { const l = Math.hypot(p[0], p[1]); return [p[0] / l, p[1] / l]; };
/** Frame on ring edge i: origin at ring[i] (the viewer's left end), t towards ring[i + 1], n outward. */
function edge(i: number): {fr: Frame; L: number} {
  const p = ring[i], q = ring[(i + 1) % ring.length], d = unit(sub(q, p));
  return {fr: {origin: p, n: [-d[1], d[0]], tangent: d}, L: Math.hypot(...sub(q, p))};
}
/** Is a 3DBAG wall on ring edge i (all its vertices within 0.4 m of the edge line)? */
function onEdge(w: W3, i: number) {
  const {fr, L} = edge(i), o = fr.origin as V, u = fr.tangent as V;
  return w.ring.every(v => {
    const a: V = [v[0] - o[0], v[2] - o[1]], t = a[0] * u[0] + a[1] * u[1], s = Math.abs(a[0] * u[1] - a[1] * u[0]);
    return s < 0.4 && t > -0.3 && t < L + 0.3;
  });
}
/** The 3DBAG wall outline on edge i as (t, y) points. */
function outline(w: W3, i: number): V[] {
  const {fr} = edge(i), o = fr.origin as V, u = fr.tangent as V;
  return w.ring.map(v => [+(((v[0] - o[0]) * u[0] + (v[2] - o[1]) * u[1])).toFixed(3), v[1]] as V);
}
function wall(fr: Frame, pts: V[], colour = 'brick', out = 0) {
  const g = new T.ShapeGeometry(new T.Shape(pts.map(([x, y]) => new T.Vector2(x, y))));
  put(b, fr, g, 0, 0, out, colour);
}
function rake(fr: Frame, t0: number, y0: number, t1: number, y1: number, th: number, d: number, colour: string, out = 0) {
  poly(b, fr, 0, 0, [[t0, y0], [t1, y1], [t1, y1 + th], [t0, y0 + th]], d, colour, out);
}
function letters(fr: Frame, text: string, t: number, y: number, h: number, maxW: number, colour: string, out = 0) {
  const L = raisedLettering({text, heightM: h, maxWidthM: maxW, depthM: 0.04});
  L.geometry.translate(-L.widthM / 2, 0, 0);
  put(b, fr, L.geometry, t, y, out, colour);
}

const N_GABLE = 2, E_WALL = 1, GATE = 12;
const walls = plan.walls as W3[];

// ---------------------------------------------------------------------------------------------------- shell
function shell() {
  for (const w of walls) {
    if (onEdge(w, N_GABLE) || onEdge(w, GATE)) continue;                  // redrawn below
    const g = planarPolygon([w.ring]);
    if (g) b.add(g, (onEdge(w, E_WALL) ? 'concrete' : 'brick') as never); // the east wall is rendered white (w01-69)
  }
  for (const r of plan.roofs) {
    const g = planarPolygon(r.rings);
    if (g) b.add(g, 'slate' as never);
  }
}

// ---------------------------------------------------------------------------------------------------- east wall
/** w01-69: eleven round-headed windows at 3 m centres from 8 m, fanlights with a circle, lanterns between. */
function eastWall() {
  const {fr, L} = edge(E_WALL), H = 10.35, k = H / 8.6;                    // photo 8.6 m to the coping, 3DBAG 10.35 m
  slab(b, fr, L / 2, 0, L, 0.45, 0.06, 'stone');                          // plinth
  slab(b, fr, L / 2, H - 0.3, L, 0.3, 0.14, 'stone');                     // coping band
  const y0 = 5.1 * k, h = 2.2 * k, w = 1.05;
  for (let i = 0; i < 11; i++) {
    const t = 8.0 + 3.0 * i;
    archSlab(b, fr, t, y0 - 0.08, w + 0.2, h + 0.14, 0.06, 'white', 0, 8);
    archSlab(b, fr, t, y0, w, h, 0.1, 'glass', 0, 8);
    const spring = y0 + h - w / 2;
    ledgeStrip(b, fr, t, spring - 0.04, w, 0.08, 0.14, 'white');          // transom under the fanlight
    ringSlab(b, fr, t, spring + w / 4, 0.2, 0.25, 0.14, 'white', 0, 14);   // the circle in the fanlight
    ledgeStrip(b, fr, t, y0, 0.06, spring - y0 - 0.04, 0.14, 'white');     // mullion
    slab(b, fr, t, y0 - 0.2, w + 0.3, 0.12, 0.16, 'stone');               // sill
  }
  slab(b, fr, 3.15, 6.3, 0.75, 1.0, 0.06, 'white'); slab(b, fr, 3.15, 6.36, 0.6, 0.88, 0.1, 'glass');
  // wall lanterns under the coping, skipping the downpipes
  for (const t of [6.4, 9.45, 15.6, 18.6, 21.7, 27.6, 30.6, 33.7, 36.7, 39.8]) {
    slab(b, fr, t, H - 1.75, 0.08, 0.5, 0.25, 'bronze');
    slab(b, fr, t, H - 2.05, 0.22, 0.32, 0.4, 'bronze', 0.1);
  }
  for (const t of [12.5, 24.8, 36.9]) slab(b, fr, t, 0.45, 0.1, H - 0.75, 0.12, 'bronze'); // downpipes
}

// ---------------------------------------------------------------------------------------------------- north gable
/** w04-338: rendered base with the name, arched doors, brick gable with five oculi and a broad white raking cornice. */
function northGable() {
  const {fr, L} = edge(N_GABLE);
  const pts = walls.filter(w => onEdge(w, N_GABLE) && w.bearing > 300).flatMap(w => outline(w, N_GABLE));
  const top = pts.filter(p => p[1] > 1).sort((a, c) => a[0] - c[0]);
  const apexT = top.reduce((a, p) => (p[1] > a[1] ? p : a))[0], apexY = Math.max(...top.map(p => p[1]));
  const eave = 10.38, base = 6.0;                                         // photo 5.0 m of render, scaled 1.2
  wall(fr, [[0, 0], [L, 0], [L, base], [0, base]], 'concrete');
  wall(fr, [[0, base], [L, base], [L, eave], [apexT, apexY], [0, eave]], 'brick');
  slab(b, fr, L / 2, 0, L, 0.4, 0.05, 'stone');                           // plinth
  // name band and lettering (only "LLANDSCHE MANEG" reads in w04 behind the posts; the rest from the register name)
  slab(b, fr, L / 2, base - 0.75, 8.2, 0.7, 0.05, 'stone');
  letters(fr, 'DE HOLLANDSCHE MANEGE', L / 2, base - 0.6, 0.42, 7.6, 'bronze', 0.05);
  // arched timber double doors in a stone surround
  const dw = 3.0, dh = 4.45;
  archBand(b, fr, L / 2, 0, dw + 0.5, dh + 0.25, 0.25, 0.1, 'stone', 0, 10);
  archSlab(b, fr, L / 2, 0, dw, dh, 0.12, 'frame', 0, 10);
  for (const s of [-1, 1]) for (const y of [0.4, 1.5, 2.6]) slab(b, fr, L / 2 + s * dw / 4, y, dw / 2 - 0.3, 0.9, 0.17, 'frame');
  ledgeStrip(b, fr, L / 2, 0.05, 0.06, dh - dw / 2 - 0.1, 0.19, 'dark');           // meeting stiles
  for (const s of [-1, 1]) slab(b, fr, L / 2 + s * (dw / 2 + 0.4), dh - dw / 2 - 0.2, 0.3, 0.2, 0.12, 'bronze'); // hinge brackets
  // five oculi with four white keystones each
  for (const k of [-2, -1, 0, 1, 2]) {
    const t = apexT + k * 2.9, y = 10.0;
    ringSlab(b, fr, t, y, 0.45, 0.68, 0.05, 'brick', 0, 18);
    disc(b, fr, t, y, 0.45, 0.06, 'white', 0);
    disc(b, fr, t, y, 0.38, 0.1, 'glass', 0);
    ledgeStrip(b, fr, t, y - 0.38, 0.05, 0.76, 0.12, 'white'); ledgeStrip(b, fr, t, y - 0.025, 0.76, 0.05, 0.12, 'white');
    for (const [dt, dy, w, h] of [[0, 0.6, 0.24, 0.3], [0, -0.9, 0.24, 0.3], [0.6, -0.12, 0.3, 0.24], [-0.6, -0.12, 0.3, 0.24]]) slab(b, fr, t + dt, y + dy, w, h, 0.09, 'stone');
  }
  // broad white raking cornice and its returns at the eaves
  rake(fr, -0.25, eave - 0.1, apexT, apexY - 0.1, 0.55, 0.4, 'stone');
  rake(fr, apexT, apexY - 0.1, L + 0.25, eave - 0.1, 0.55, 0.4, 'stone');
  for (const t of [0.85, L - 0.85]) slab(b, fr, t, eave - 0.75, 1.5, 0.45, 0.4, 'stone');
  // chimney stack just behind the apex
  slab(b, fr, apexT, apexY - 0.6, 1.3, 1.6, 0.8, 'brick', -1.2);
  slab(b, fr, apexT, apexY + 0.95, 1.45, 0.15, 0.95, 'stone', -1.27);
}

// ---------------------------------------------------------------------------------------------------- Vondelstraat gateway
/** w10-157: stucco ground storey with the arched passage, MANEGE frieze, lanterns; three brick bays above. */
function gateway() {
  const {fr, L} = edge(GATE);
  const outlines = walls.filter(w => onEdge(w, GATE));
  for (const w of outlines) {
    const pts = outline(w, GATE);
    const g = new T.Shape(pts.map(([x, y]) => new T.Vector2(x, y)));
    put(b, fr, new T.ShapeGeometry(g), 0, 0, 0, 'brick');
  }
  const mid = L / 2, E = 5.7;                                             // entablature top
  slab(b, fr, mid, 0, L - 0.3, E, 0.12, 'concrete');                            // stucco storey
  slab(b, fr, mid, 0, L - 0.42, 0.9, 0.2, 'stone');                       // rusticated base
  for (let y = 1.3; y < 4.6; y += 0.45) for (const s of [-1, 1]) slab(b, fr, mid + s * (1.94 + (mid - 0.25 - 1.94) / 2), y, mid - 0.25 - 1.94, 0.05, 0.18, 'stone'); // rustication joints
  // the arched passage: deep dark opening, stone archivolt and keystone cartouche
  const aw = 3.2, ah = 4.4;
  archSlab(b, fr, mid, 0, aw, ah, 0.16, 'dark', 0, 12);
  archBand(b, fr, mid, 0, aw + 0.64, ah + 0.32, 0.3, 0.24, 'stone', 0, 12);
  slab(b, fr, mid, ah - 0.05, 0.55, 0.75, 0.32, 'stone');                 // keystone
  slab(b, fr, mid, ah + 0.15, 0.4, 0.45, 0.4, 'white');                    // cartouche on the keystone
  // pilasters, lanterns, plaques
  for (const t of [0.3, L - 0.3, mid - 2.05, mid + 2.05]) {
    if (t < 0.25 || t > L - 0.25) continue;
    slab(b, fr, t, 0.9, 0.5, 3.9, 0.3, 'stone');
    slab(b, fr, t, 4.8, 0.62, 0.22, 0.36, 'stone');
  }
  for (const s of [-1, 1]) {
    const t = mid + s * 2.05;
    slab(b, fr, t, 1.25, 0.34, 0.42, 0.36, 'blue');                       // enamel plaque
    slab(b, fr, t, 3.3, 0.06, 0.06, 0.5, 'bronze', 0.3);                 // lantern arm
    slab(b, fr, t, 2.9, 0.34, 0.55, 0.34, 'glass', 0.6);                   // lantern
    slab(b, fr, t, 3.45, 0.42, 0.14, 0.42, 'bronze', 0.56);
  }
  // entablature with MANEGE in the frieze, cornice
  slab(b, fr, mid, 4.95, L - 0.14, 0.12, 0.3, 'stone');
  slab(b, fr, mid, 5.07, L - 0.2, 0.48, 0.2, 'stone');
  letters(fr, 'MANEGE', mid, 5.17, 0.28, 1.8, 'bronze', 0.2);
  slab(b, fr, mid, E - 0.15, L - 0.1, 0.3, 0.45, 'stone');
  // three bays above: first floor with segmental hoods, second floor with straight heads, timber frames
  for (const t of [mid - 2.1, mid, mid + 2.1]) {
    for (const [y, h, hood] of [[6.3, 2.5, true], [10.0, 2.2, false]] as [number, number, boolean][]) {
      slab(b, fr, t, y - 0.15, 1.6, h + 0.3, 0.06, 'stone');               // stone surround
      slab(b, fr, t, y, 1.2, h, 0.1, 'glass');
      slab(b, fr, t, y - 0.03, 1.2, 0.1, 0.15, 'frame');
      slab(b, fr, t, y + h - 0.07, 1.2, 0.1, 0.15, 'frame');
      for (const s of [-1, 0, 1]) ledgeStrip(b, fr, t + s * 0.565, y, 0.07, h, 0.15, 'frame');
      ledgeStrip(b, fr, t, y + h * 0.66, 1.2, 0.06, 0.15, 'frame');
      slab(b, fr, t, y - 0.3, 1.8, 0.15, 0.2, 'stone');                    // sill
      if (hood) {
        slab(b, fr, t, y + h + 0.15, 1.8, 0.18, 0.22, 'stone');
        segBand(b, fr, t, y + h + 0.33, 1.9, 0.38, 0.16, 0.3, 'stone');
        slab(b, fr, t, y + h + 0.15, 1.2, 0.12, 0.27, 'ochre');           // the gilt-looking ornament under the hood
      } else slab(b, fr, t, y + h + 0.15, 1.75, 0.25, 0.18, 'stone');
    }
  }
  slab(b, fr, mid, 13.0, L - 0.3, 0.3, 0.2, 'stone');                           // frieze
  slab(b, fr, mid, 13.3, L - 0.14, 0.32, 0.5, 'stone');                    // cornice
}

export function buildHollandscheManege(_w: number, _d: number, tools: BuildingTools) {
  b = tools; setSink(0.12, true);
  shell();
  eastWall();
  northGable();
  gateway();
  setSink(0);
}
