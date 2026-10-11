import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type ShellSource} from './worship-shell';
import {wallsOf, wallTop, type BayOptions, type Wall} from './worship-walls';
import {archBand, disc, frameOf, ringSlab, slab, type Frame} from './nearbar-kit';
import raw from './petrus-en-paulus-kerk-footprints.json';

/**
 * Evenly spaced bays like worship-walls `addBays`, but every solid is sunk 4 cm behind the wall plane and the bars are inset
 * from the glass edge, so no stone/frame face is coplanar with the shell or the pane (the audit counts those as z-fight).
 */
function addBays(b: BuildingTools, w: Wall, o: BayOptions) {
  const margin = o.margin ?? 1, usable = w.length - 2 * margin;
  if (usable < o.wd) return;
  const n = Math.max(1, Math.floor((usable - o.wd) / o.pitch) + 1), f = frameOf(w);
  const start = w.length / 2 - ((n - 1) * o.pitch) / 2, S = 0.04;
  for (let i = 0; i < n; i++) {
    const t = start + i * o.pitch, y = w.base + o.y;
    if (wallTop(w, t - o.wd / 2) < y + o.h + 0.5 || wallTop(w, t + o.wd / 2) < y + o.h + 0.5) continue;
    slab(b, f, t, y - 0.12, o.wd + 0.3, 0.14, 0.16 + S, 'stone', -S);
    slab(b, f, t, y + o.h, o.wd + 0.3, 0.16, 0.16 + S, 'stone', -S);
    slab(b, f, t, y, o.wd, o.h, 0.08, 'glass', 0.02);
    const rows = Math.max(1, Math.round(o.h / 1.2)), cols = o.wd > 1.6 ? 3 : o.wd > 0.9 ? 2 : 1;
    for (let k = 1; k < rows; k++) slab(b, f, t, y + (o.h * k) / rows - 0.03, o.wd - 0.04, 0.06, 0.12, 'frame', 0.02);
    for (let k = 0; k <= cols; k++) {
      const edge = k === 0 ? -1 : k === cols ? 1 : 0;
      slab(b, f, t + (k === 0 || k === cols ? edge * (o.wd / 2 - 0.02) : -o.wd / 2 + (o.wd * k) / cols), y + 0.01, 0.08, o.h - 0.02, 0.12, 'frame', 0.02);
    }
  }
}

/** Round stair turret (Ruysdaelstraat 37/39): centre and radius read from the faceted arc of the 3DBAG ring. */
const TURRET = {x: -0.9, z: -6.2, r: 1.47};
/** 3DBAG extrudes the turret facets up to the gable roof plane (10.4-12.1 m) although the real turret ends in a cone at about 10.6 m; drop those facets and close the gable front with one plane. */
const TURRET_WALLS = new Set([2, 3, 4, 6, 7, 8, 39]);
const TURRET_ROOF_PTS = [[0.7, 9.5, -6.9], [0.6, 9.5, -7.1], [0.4, 9.7, -7.0], [0.3, 9.7, -7.5], [-0.6, 10.4, -8.0], [-1.5, 11.3, -7.7], [-2.1, 12.1, -6.8]];
function reshape(src: ShellSource): ShellSource {
  const surfaces = src.surfaces.map(s => s.type === 'RoofSurface' ? {...s, rings: s.rings.map(r => r.filter(p => !TURRET_ROOF_PTS.some(q => Math.abs(p[0] - q[0]) < 0.06 && Math.abs(p[1] - q[1]) < 0.06 && Math.abs(p[2] - q[2]) < 0.06)))} : s);
  surfaces.push({type: 'WallSurface', rings: [[[0.8, 9.5, -6.4], [0.8, 0, -6.4], [-1.9, 0, -6.3], [-1.9, 12.1, -6.3]]]});
  return {...src, surfaces};
}
const source = reshape(raw as never) as never;

/**
 * Old Catholic church, parsonage and schoolroom (J.W.F. Hartkamp jr., 1914).
 * Massing is the 3DBAG LoD2.2 shell (native east/south metres); detail follows the
 * Wikimedia (Ruysdaelstraat 37/39) and 2025 street panoramas: a steep brick gable
 * (apex 16.7 m) with two tall four-light mullioned windows, a louvred slot under the
 * ridge, a stone-capped cross, a gabled porch with a pointed timber door, and a brick
 * tower (20.7 m) with a stepped corbel-arch cornice, stone clock stage with a clock on
 * the north and west faces, and louvres on the west face.
 */
export function buildPetrusEnPaulusKerk(_w: number, _d: number, b: BuildingTools) {
  addShell(b, source as never, {wall: 'brick', roof: 'slate', skip: (_s, i) => TURRET_WALLS.has(i)});
  const walls = new Map(wallsOf(source as never).map(w => [w.index, w]));
  const wall = (i: number) => walls.get(i)!;
  // Long street wall: triple-light windows in a lower band (municipal panorama), shorter rooms above.
  addBays(b, wall(50), {y: 3.0, h: 3.8, wd: 2.3, pitch: 4.2, margin: 1.2});
  addBays(b, wall(14), {y: 2.4, h: 3.2, wd: 1.5, pitch: 3.0, margin: 1.2});
  addBays(b, wall(21), {y: 2.4, h: 3.2, wd: 1.5, pitch: 3.0, margin: 1.2});
  addBays(b, wall(38), {y: 1.2, h: 2.2, wd: 1.2, pitch: 2.6, margin: 1.0});
  addBays(b, wall(37), {y: 1.2, h: 2.2, wd: 1.2, pitch: 2.6, margin: 1.0});
  addBays(b, wall(28), {y: 1.2, h: 2.2, wd: 1.2, pitch: 2.6, margin: 1.0});
  addBays(b, wall(45), {y: 1.2, h: 3.0, wd: 1.4, pitch: 3.0, margin: 0.8});
  addBays(b, wall(49), {y: 1.2, h: 3.0, wd: 1.4, pitch: 3.0, margin: 0.8});

  // Mullioned window: stone surround, glass, one centre mullion and transom rows.
  const window = (f: Frame, t: number, y: number, w: number, h: number, rows: number, o = 0) => {
    slab(b, f, t, y - 0.14, w + 0.4, 0.16, 0.2, 'stone', o);
    slab(b, f, t, y + h, w + 0.4, 0.2, 0.2, 'stone', o);
    slab(b, f, t, y, w, h, 0.08, 'glass', o + 0.02);
    slab(b, f, t, y, 0.08, h, 0.14, 'frame', o + 0.02);
    for (let k = 1; k < rows; k++) slab(b, f, t, y + (h * k) / rows - 0.04, w, 0.08, 0.14, 'frame', o + 0.02);
  };

  // Gable front (north, bearing 343): frame of wall 35, t=0 at its east end, gable apex at t = -0.65.
  const gf = frameOf(wall(35)), apex = -0.65;
  window(gf, apex - 0.65, 7.6, 1.05, 5.3, 4, -1.3);
  window(gf, apex + 1.55, 7.6, 1.05, 4.6, 4);
  slab(b, gf, apex - 0.3, 13.7, 0.8, 1.3, 0.1, 'dark', -1.23);
  slab(b, gf, apex - 0.3, 13.55, 1.2, 0.16, 0.2, 'stone', -1.25);
  slab(b, gf, apex - 0.3, 15.0, 1.2, 0.2, 0.2, 'stone', -1.25);
  // Stone cross on the apex.
  slab(b, gf, apex, 16.6, 0.2, 1.6, 0.2, 'stone', -1.1);
  slab(b, gf, apex, 17.3, 0.8, 0.2, 0.2, 'stone', -1.1);
  // Gabled porch: stone pointed arch around the red timber double door.
  slab(b, gf, 0.2, 0, 1.6, 2.8, 0.1, 'red', 0.02);
  archBand(b, gf, 0.2, 0, 2.3, 3.6, 0.22, 0.25, 'stone', 0);

  // Tower: north face is wall 31+29 (frame of 31, 2.7 m wide), west face is wall 30.
  const tower = (f: Frame, w: number, clock: boolean, louvres: boolean) => {
    const c = w / 2;
    // stepped brick corbel cornice below the clock stage
    slab(b, f, c, 15.2, w + 0.2, 0.5, 0.2, 'greyBrick');
    slab(b, f, c, 15.7, w + 0.3, 0.5, 0.3, 'greyBrick');
    // stone clock stage: sill band, panel, head cornice
    slab(b, f, c, 16.2, w + 0.3, 0.3, 0.3, 'stone');
    slab(b, f, c, 16.5, w - 0.5, 2.9, 0.12, 'stone');
    slab(b, f, c, 19.4, w + 0.3, 0.35, 0.3, 'stone');
    if (clock) {
      disc(b, f, c, 17.95, 0.62, 0.1, 'white', 0.12);
      ringSlab(b, f, c, 17.95, 0.56, 0.66, 0.12, 'dark', 0.12);
      slab(b, f, c + 0.02, 17.9, 0.07, 0.42, 0.06, 'dark', 0.22);
      slab(b, f, c + 0.2, 17.92, 0.3, 0.07, 0.06, 'dark', 0.22);
    }
    if (louvres) for (const dt of [-0.55, 0.55]) slab(b, f, c + dt, 12.3, 0.55, 2.9, 0.1, 'dark', 0.02);
    // stone corner posts under the cap
    for (const t of [0.15, w - 0.15]) slab(b, f, t, 19.0, 0.5, 1.2, 0.3, 'stone');
  };
  const north = wall(31), west = wall(30);
  tower(frameOf(north), north.length + wall(29).length, true, false);
  tower(frameOf(west), west.length, true, true);

  // Round stair turret with a polygonal oriel and tiled cone (photos: Ruysdaelstraat 37/39, panorama 0).
  const {x: cx, z: cz, r: R} = TURRET;
  const lathe = (r0: number, r1: number, y0: number, y1: number, seg: number, colour: string, rot = 0) => {
    const g = new T.CylinderGeometry(r1, r0, y1 - y0, seg, 1, false, rot);
    g.translate(cx, (y0 + y1) / 2, cz);
    b.add(g, colour as never);
  };
  lathe(R + 0.02, R + 0.02, 0, 5.4, 20, 'brick');            // shaft
  lathe(R + 0.14, R + 0.14, 0, 1.0, 20, 'stone');            // stone plinth
  lathe(R + 0.14, R + 0.02, 1.0, 1.25, 20, 'stone');         // plinth weathering
  lathe(R + 0.02, R + 0.45, 5.4, 6.9, 20, 'brick');          // corbelled-out base of the oriel
  lathe(R + 0.5, R + 0.5, 6.9, 7.15, 8, 'stone', Math.PI / 8); // stone string course
  const AP = 1.88, VR = AP / Math.cos(Math.PI / 8);           // oriel apothem / vertex radius, flat faces at +-22.5 deg
  lathe(VR, VR, 7.15, 9.1, 8, 'brick', Math.PI / 8);          // oriel
  lathe(VR + 0.2, VR + 0.2, 9.1, 9.35, 8, 'white', Math.PI / 8); // white cornice
  lathe(VR + 0.2, 0.06, 9.35, 10.7, 8, 'slate', Math.PI / 8); // tiled pyramid roof
  const at = (deg: number, rad: number): Frame => {
    const a = deg * Math.PI / 180, n: [number, number] = [Math.sin(a), -Math.cos(a)];
    return {origin: [cx + n[0] * rad, cz + n[1] * rad], tangent: [n[1], -n[0]], n};
  };
  const sunk = -0.06;
  // Two ground-floor lights on the shaft with stone heads, jambs and brick-on-edge sills.
  for (const a of [-27, 27]) {
    const f = at(a, R + 0.02);
    slab(b, f, 0, 2.75, 0.62, 1.65, 0.12 + 0.06, 'glass', sunk);
    slab(b, f, 0, 4.4, 0.95, 0.28, 0.16 + 0.06, 'stone', sunk);
    slab(b, f, 0, 2.5, 0.95, 0.25, 0.28 + 0.06, 'stone', sunk);
    for (const dt of [-0.42, 0.42]) slab(b, f, dt, 2.75, 0.2, 1.65, 0.12 + 0.06, 'stone', sunk);
  }
  // Oriel: one window per flat face, stone quoin blocks at the corners and the louvred mullion.
  for (const a of [-22.5, 22.5]) {
    const f = at(a, AP);
    slab(b, f, 0, 7.6, 0.7, 1.15, 0.1 + 0.06, 'glass', sunk);
    slab(b, f, 0, 7.45, 0.98, 0.18, 0.2 + 0.06, 'stone', sunk);
    slab(b, f, 0, 8.75, 0.98, 0.2, 0.2 + 0.06, 'stone', sunk);
    for (const dt of [-0.42, 0.42]) slab(b, f, dt, 7.6, 0.16, 1.15, 0.12 + 0.06, 'stone', sunk);
    slab(b, f, 0, 7.62, 0.07, 1.11, 0.14 + 0.06, 'frame', sunk);
  }
  for (const a of [-45, 0, 45]) for (const [y, hh] of [[7.3, 0.4], [8.55, 0.4]] as const) {
    const f = at(a, VR - 0.02);
    slab(b, f, 0, y, 0.36, hh, 0.16 + 0.06, 'stone', sunk);
  }

  // Gable-front lights between the turret and the porch (panorama 0): two tall lights in a stone-sill surround.
  {
    const f = frameOf(wall(9));
    for (const t of [0.78, 1.18]) slab(b, f, t, 1.75, 0.3, 1.75, 0.1, 'glass', 0.02);
    slab(b, f, 0.98, 1.55, 0.95, 0.2, 0.2, 'stone', 0);
    slab(b, f, 0.98, 3.5, 0.95, 0.2, 0.15, 'stone', 0);
    slab(b, f, 0.98, 1.77, 0.07, 1.71, 0.12, 'frame', 0.02);
  }
  // Parsonage wing (Ruysdaelstraat 37): large white painted sashes upstairs, red-framed small lights and a timber door below.
  const sash = (f: Frame, t: number, y: number, w: number, h: number) => {
    slab(b, f, t, y - 0.12, w + 0.5, 0.14, 0.22, 'stone', 0);
    slab(b, f, t, y, w + 0.2, h + 0.2, 0.07, 'white', 0.01);
    slab(b, f, t, y + 0.1, w, h, 0.1, 'glass', 0.02);
    slab(b, f, t, y + 0.12, 0.07, h - 0.04, 0.13, 'white', 0.02);
    slab(b, f, t, y + 0.1 + h * 0.7, w - 0.04, 0.07, 0.13, 'white', 0.02);
    slab(b, f, t, y + h + 0.3, w + 0.5, 0.18, 0.12, 'stone', 0);
  };
  {
    const f5 = frameOf(wall(5));
    sash(f5, 1.25, 5.9, 1.5, 2.5);
    slab(b, f5, 0.7, 0.6, 1.0, 2.5, 0.12, 'red', 0.02);
    slab(b, f5, 0.7, 3.1, 1.3, 0.2, 0.2, 'stone', 0);
    slab(b, f5, 1.9, 2.7, 0.55, 0.95, 0.1, 'red', 0.02);
    slab(b, f5, 1.9, 2.55, 0.85, 0.15, 0.2, 'stone', 0);
    for (const w of [1, 41]) {
      const f = frameOf(wall(w));
      for (const t of [0.7, 2.0]) {
        sash(f, t, 5.9, 0.8, 2.3);
        slab(b, f, t, 2.4, 0.8, 1.5, 0.1, 'glass', 0.02);
        slab(b, f, t, 2.2, 1.1, 0.2, 0.2, 'stone', 0);
        slab(b, f, t, 3.95, 1.1, 0.2, 0.15, 'stone', 0);
      }
    }
  }
}
