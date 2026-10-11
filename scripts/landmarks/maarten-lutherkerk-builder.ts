import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, planarPolygon, type ShellSource} from './worship-shell';
import {wallsOf} from './worship-walls';
import {archSlab, frameOf, poly, slab, type Frame} from './nearbar-kit';
import {addBaysClean} from './clean-bays';
import raw from './maarten-lutherkerk-footprints.json';

/**
 * Maarten Lutherkerk (F. Jantzen, Amsterdam School, 1937). Massing is the 3DBAG LoD2.2 shell (native east/south metres, grid rotated 5 deg).
 * Detail follows the 2025 street panoramas (Jacob van Lennepkade side): the east front is a plain gable with three arched, recessed bays,
 * each with a pair of timber doors, a hanging lamp and a slit window, reached over a brick podium; the tower at the south-east corner has
 * a belfry of arched slits, a dark overhanging hip roof and a green copper spire; the long north wall has five tall pale windows in brick
 * reveals over a band of small lights, and a small canopied door near the west end; the west gable carries a large timber cross.
 */
const FRONT_X0 = 11.23, FRONT_Z0 = 0.135, FRONT_SLOPE = 0.0912; // east front plane through the BAG ring: x = FRONT_X0 + (FRONT_Z0 - z) * FRONT_SLOPE
const xf = (z: number) => FRONT_X0 + (FRONT_Z0 - z) * FRONT_SLOPE;
const Z_SOUTH = 0.7, Z_NORTH = -10.47, Z_RIDGE = -3.26;
// 3DBAG cuts the three niches as full-height rectangular slots (and into the roof edge); replace them with arched niches.
const FRONT_WALLS = new Set([1, 2, 4, 5, 6, 7, 8, 27, 29, 41, 42, 66, 73, 88]);
const TOWER_ROOFS = new Set([91, 92, 93]);
const SLOT_ROOF = (p: number[]) => p[0] < 12.1 && p[0] > 10.3 && p[2] < 0.3 && p[2] > -6.8 && p[1] > 12;

function reshape(src: ShellSource): ShellSource {
  const surfaces = src.surfaces.map(s => {
    if (s.type !== 'RoofSurface' || !s.rings[0].some(SLOT_ROOF)) return s;
    // Drop the slot-tooth vertices of the east roof edge; the ridge vertex moves out to the front plane so both slopes meet the new wall.
    const ring = s.rings[0].filter(p => !SLOT_ROOF(p) || (Math.abs(p[1] - 15.85) < 0.02 && Math.abs(p[2] - Z_RIDGE) < 0.02));
    return {...s, rings: [ring.map(p => (Math.abs(p[1] - 15.85) < 0.02 && Math.abs(p[2] - Z_RIDGE) < 0.02 ? [xf(Z_RIDGE), p[1], p[2]] : p))]};
  });
  return {...src, surfaces};
}
const source = reshape(raw as never) as never;

export function buildMaartenLutherkerk(_w: number, _d: number, b: BuildingTools) {
  addShell(b, source, {
    wall: 'brick', roof: 'slate',
    skip: (_s, i) => FRONT_WALLS.has(i),
    roofFor: (_s, i) => (TOWER_ROOFS.has(i) ? 'dark' : 'slate'),
  });
  const walls = new Map(wallsOf(raw as never).map(w => [w.index, w]));
  const wall = (i: number) => walls.get(i)!;
  const S = 0.04;
  // slab sunk S behind its plane so nothing is coplanar with the wall it stands on
  const sl = (f: Frame, t: number, y: number, w: number, h: number, d: number, c: string, out = 0) => slab(b, f, t, y, w, h, d + S, c, out - S);

  // ---- East front: gable wall with three arched niches ------------------------------------------------------------------
  const nrm: [number, number] = [0.9959, 0.0908], tan: [number, number] = [nrm[1], -nrm[0]];
  const F: Frame = {origin: [xf(Z_SOUTH), Z_SOUTH], tangent: tan, n: nrm};
  const P = (t: number, y: number, out = 0): number[] => [F.origin[0] + tan[0] * t + nrm[0] * out, y, F.origin[1] + tan[1] * t + nrm[1] * out];
  const tN = (Z_SOUTH - Z_NORTH) / -tan[1], tR = (Z_SOUTH - Z_RIDGE) / -tan[1];
  const tc = [-0.68, -3.1, -5.51].map(z => (Z_SOUTH - z) / -tan[1]); // niche centres (BAG slot centres)
  const HW = 0.82, Y0 = 3.7, CROWN = 11.95, SPR = CROWN - HW, DEPTH = 0.95;
  const arch = (c: number): [number, number][] => {
    const pts: [number, number][] = [[c - HW, Y0], [c + HW, Y0], [c + HW, SPR]];
    for (let k = 1; k < 12; k++) { const a = (k * Math.PI) / 12; pts.push([c + HW * Math.cos(a), SPR + HW * Math.sin(a)]); }
    pts.push([c - HW, SPR]);
    return pts;
  };
  {
    const outer: number[][] = [P(0, 0), P(tN, 0), P(tN, 11.51), P(tR, 15.85), P(0, 13.62)];
    const holes = tc.map(c => arch(c).map(([t, y]) => P(t, y)));
    const g = planarPolygon([outer, ...holes]);
    if (g) b.add(g, 'brick' as never);
  }
  const quad = (a: number[], b2: number[], c: number[], d: number[], towards: number[]) => {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute([...a, ...b2, ...c, ...d], 3));
    const n = new T.Vector3(...b2).sub(new T.Vector3(...a)).cross(new T.Vector3(...c).sub(new T.Vector3(...a)));
    const mid = new T.Vector3(...a).add(new T.Vector3(...c)).multiplyScalar(0.5);
    g.setIndex(n.dot(new T.Vector3(...towards).sub(mid)) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
    g.computeVertexNormals();
    b.add(g, 'brick' as never);
  };
  for (const c of tc) {
    const ring = arch(c), inside = P(c, 8, -DEPTH / 2);
    // back plate and reveals
    const back = planarPolygon([ring.map(([t, y]) => P(t, y, -DEPTH))]);
    if (back) b.add(back, 'brick' as never);
    for (let i = 0; i < ring.length; i++) {
      const [t0, y0] = ring[i], [t1, y1] = ring[(i + 1) % ring.length];
      if (i === 0) continue; // the sill edge is the floor, drawn below
      quad(P(t0, y0, 0), P(t1, y1, 0), P(t1, y1, -DEPTH), P(t0, y0, -DEPTH), inside);
    }
    quad(P(c - HW, Y0, 0), P(c + HW, Y0, 0), P(c + HW, Y0, -DEPTH), P(c - HW, Y0, -DEPTH), P(c, 9, -0.4));
    // timber double doors in a stone surround, hanging lamp, slit window
    sl(F, c, Y0 - 0.04, 1.5, 2.49, 0.1, 'ochre', -DEPTH);
    sl(F, c, Y0 - 0.04, 0.05, 2.49, 0.14, 'dark', -DEPTH);
    for (const dt of [-0.37, 0.37]) sl(F, c + dt, Y0 + 0.9, 0.28, 0.95, 0.15, 'glass', -DEPTH);
    sl(F, c, Y0 + 2.45, 1.7, 0.18, 0.22, 'stone', -DEPTH);
    sl(F, c, 7.1, 0.27, 3.6, 0.1, 'dark', -DEPTH);
    sl(F, c, 6.55, 0.06, 0.06, 0.5, 'dark', -DEPTH);
    sl(F, c, 6.0, 0.22, 0.58, 0.22, 'ochre', -0.67);
  }
  // Slit at the apex of the gable.
  sl(F, tR, 12.7, 0.18, 1.0, 0.12, 'dark', 0);
  // Brick podium in front of the niches with three steps up to the door landing.
  {
    const t0 = 0.55, t1 = 7.25;
    sl(F, (t0 + t1) / 2, 0, t1 - t0, 2.0, 2.6, 'greyBrick', 0);
    for (let k = 0; k < 3; k++) sl(F, (t0 + t1) / 2, 1.96, 6.0 - 0.03 * k, 0.59 + 0.55 * k, 2.1 - 0.5 * k, 'stone', 0);
  }

  // ---- Tower (south-east corner) ------------------------------------------------------------------------------------
  const east = frameOf(wall(31)), north = frameOf(wall(50)), south = frameOf(wall(25));
  const slit = (f: Frame, t: number, y: number, w: number, h: number) => archSlab(b, f, t, y, w, h, 0.2 + S, 'dark', -S);
  for (const dt of [-0.95, 0, 0.95]) {
    slit(east, 2.0 + dt, 16.9, 0.44, 2.1);
    slit(north, 2.1 + dt, 16.9, 0.44, 2.1);
  }
  for (const t of [0.45, 1.2]) slit(south, t, 16.9, 0.44, 2.1);
  for (const y of [3.5, 8.3]) sl(east, 1.7, y, 0.2, 1.1, 0.12, 'dark', 0);
  // overhanging dark hip-roof eave
  {
    const g = new T.BoxGeometry(5.0, 0.22, 5.0);
    g.rotateY(Math.atan2(nrm[0], nrm[1]));
    g.translate(11.05, 19.62, 2.85);
    b.add(g, 'dark' as never);
  }
  // green copper spire: flared octagonal base, then a needle
  {
    const base = new T.CylinderGeometry(0.4, 0.8, 1.4, 8); base.translate(11.2, 20.5 + 0.7, 3.0); b.add(base, 'copper' as never);
    const needle = new T.CylinderGeometry(0.05, 0.4, 4.7, 8); needle.translate(11.2, 21.5 + 2.35, 3.0); b.add(needle, 'copper' as never);
  }

  // ---- North wall: five tall windows over the band of small lights, canopied door ----------------------------------------
  const nw = wall(56);
  const tOf = (x: number) => 12.2 - x;
  addBaysClean(b, nw, {at: [7.8, 3.6, -0.6, -4.8, -8.7].map(tOf), y: 4.7, h: 5.4, wd: 1.2, pitch: 4.2, cols: 1, rows: 4, jamb: 0.28, trim: 'brick', proud: 0.14, glass: 'glass'});
  addBaysClean(b, nw, {y: 1.0, h: 1.4, wd: 0.7, pitch: 1.2, margin: 1.7, cols: 1, rows: 1, trim: 'stone'});
  {
    const f = frameOf(nw), t = tOf(-8.8);
    sl(f, t, 0, 1.0, 2.3, 0.1, 'ochre', 0.02);
    sl(f, t, 2.3, 1.4, 0.15, 0.2, 'stone', 0);
    for (const sg of [-1, 1]) sl(f, t + sg * 0.62, 0, 0.18, 2.4, 0.16, 'stone', 0);
    poly(b, f, t, 2.5, [[-0.75, 0], [0.75, 0], [0, 0.5]], 0.75, 'slate', 0);
  }
  // south hall wall: same rhythm (no photograph, inferred)
  addBaysClean(b, wall(17), {at: [-4.8, -0.6, 3.6, 7.6].map(x => x + 6.5), y: 4.7, h: 5.4, wd: 1.2, pitch: 4.2, cols: 1, rows: 4, jamb: 0.28, trim: 'brick', proud: 0.14});
  addBaysClean(b, wall(17), {y: 1.0, h: 1.4, wd: 0.7, pitch: 1.2, margin: 1.7, cols: 1, rows: 1, trim: 'stone'});
  // ---- West gable: large timber cross -------------------------------------------------------------------------------------
  {
    const f = frameOf(wall(39));
    sl(f, 3.6, 5.6, 0.45, 8.6, 0.18, 'frame', 0);
    sl(f, 3.6, 11.4, 2.6, 0.45, 0.18, 'frame', 0);
  }
  // lower-wing and west-block windows from the earlier pass (BAG ground-floor lights)
  for (const i of [10, 30, 34, 37, 33]) addBaysClean(b, wall(i), {y: 3.1, h: 1.6, wd: 0.8, pitch: 1.9, margin: 0.8, trim: 'stone'});
}
