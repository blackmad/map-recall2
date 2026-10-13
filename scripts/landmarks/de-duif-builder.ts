import type {BuildingTools} from './cultural-builders';
import {block, door, extrude, face, gable, lathe, local, octagon, onWall, rect, tris, win, type Kit, type V2, type Win} from './church-kit';
import {archBand, archSlab, poly} from './nearbar-kit';
// Material slots: 'stone' grey sandstone front and cornices, 'concrete' the darker plinth, 'greyBrick' niche backs,
// 'gold' the tympanum mosaic and cross, 'blue' the inscription tablet, 'bronze' the lead lantern, 'white' statues.

/**
 * De Duif, Prinsengracht 756 (1857, T. Molkenboer). Built from intent on the BAG plan and 3DBAG heights.
 *
 * Plan (BAG 0363100012171729; local x along the church axis, 287.2 degrees counter-clockwise from east, so the
 * canal front is at -x facing north-north-east and Kerkstraat behind at +x): an 18.6 m wide grey sandstone front;
 * an 11.2 m nave under a low pitched roof (eaves 22 m, ridge 25.6 m) with lean-to aisles (14.6-15.6 m), a transept
 * of the same height crossing it, a low lead lantern over the crossing (27.2 m in 3DBAG), and lower annexes at the
 * back. Front (photos): a 12.6 m lower storey of three bays between pilasters, an attic band to 15.8 m, a raised
 * centre of nave width with paired pilasters, one tall round-arched window, an entablature and a pediment to the
 * 3DBAG top (27.3 m), joined to the attic by concave scrolls with obelisks at the ends.
 * Facade rhythm per wall: scripts/landmarks/de-duif-research.json.
 */
const XF = -23, XB = -22, XE = 22.9; // front face, back of the front slab, back gable
const ZN0 = -2.5, ZN1 = 8.7; // nave walls
const ZA0 = -5.9, ZA1 = 12.7; // aisle and transept outer walls
const XT0 = -4.5, XT1 = 8.0; // transept
const ZC = (ZA0 + ZA1) / 2; // front centre line (3.4)
const EAVE = 22, RIDGE = 25.6, LOW = 12.6, ATTIC = 15.8, UPPER = 23, APEX = 27.3, HALF_UP = 5.7;

/** Lean-to roof from the outer eave (z = zo, y0) up to the wall at z = zi (y1), between x0 and x1, with brick end triangles. */
function leanTo(k: Kit, x0: number, x1: number, zo: number, zi: number, y0: number, y1: number) {
  tris(k, [[[x0, y0, zo], [x1, y0, zo], [x1, y1, zi]], [[x0, y0, zo], [x1, y1, zi], [x0, y1, zi]]], 'slate', (_c, n) => n.y > 0);
  for (const [x, s] of [[x0, -1], [x1, 1]] as const) tris(k, [[[x, y0, zo], [x, y1, zi], [x, y0, zi]]], 'brick', (_c, n) => n.x * s > 0);
}

const CLERE: Win = {w: 1.8, y0: 16.6, y1: 20.6, bars: 2, rowM: 0.9, surround: 'stone', glass: 'glass', bar: 'frame'};

export function buildDeDuif(_w: number, _d: number, b: BuildingTools) {
  const k = local(b, 287.2);

  // ---- Massing ------------------------------------------------------------------------------------------------------
  extrude(k, rect(XB, XE, ZN0, ZN1), 0, EAVE, 'brick'); // nave and choir
  extrude(k, rect(XT0, XT1, ZA0, ZA1), 0, EAVE, 'brick'); // transept
  for (const [z0, z1] of [[ZA0, ZN0], [ZN1, ZA1]]) extrude(k, rect(XB, XT0, z0, z1), 0, 14.6, 'brick'); // aisles
  extrude(k, rect(12.1, XE, -12.9, ZN0), 0, 8.0, 'brick'); // back annex, Kerkstraat side
  extrude(k, rect(XT1, XE, ZN1, 12.4), 0, 10.8, 'brick');
  extrude(k, rect(1.6, 12.1, -8.6, ZA0), 0, 3.7, 'brick');

  // ---- Roofs from intent ------------------------------------------------------------------------------------------------
  extrude(k, rect(XB - 0.01, XE + 0.3, ZN0 - 0.3, ZN1 + 0.3), EAVE - 0.5, EAVE, 'stone');
  extrude(k, rect(XT0 - 0.3, XT1 + 0.3, ZA0 - 0.3, ZA1 + 0.3), EAVE - 0.5, EAVE - 0.02, 'stone');
  gable(k, XB, XE + 0.3, ZN0 - 0.3, ZN1 + 0.3, EAVE, RIDGE - EAVE, 'x', 'slate', 'brick');
  gable(k, XT0 - 0.3, XT1 + 0.3, ZA0 - 0.3, ZA1 + 0.3, EAVE, RIDGE - EAVE - 0.1, 'z', 'slate', 'brick');
  leanTo(k, XB, XT0, ZA0, ZN0, 14.6, 15.6);
  leanTo(k, XB, XT0, ZA1, ZN1, 14.6, 15.6);
  block(k, 12.1, XE, -12.9, ZN0, 8.0, 8.6, 'slate');
  block(k, XT1, XE, ZN1, 12.4, 10.8, 11.3, 'slate');
  // Crossing lantern: low lead octagon and cap.
  const cx = (XT0 + XT1) / 2, cz = (ZN0 + ZN1) / 2;
  octagon(k, cx, cz, 3.6, RIDGE - 1.8, 26.4, 'bronze');
  lathe(k, cx, cz, [[1.6, 26.3], [1.95, 26.45], [1.6, 26.8], [0.9, 27.1], [0, 27.25]], 'bronze');

  // ---- Clerestory and transept windows (inferred from the interior and the 3DBAG wall heights) ---------------------
  for (const [n, plane] of [[[0, -1], ZN0], [[0, 1], ZN1]] as [V2, number][]) {
    const fr = face(n, plane);
    for (const x of [-18.5, -13.8, -9.1]) win(k, fr.f, fr.at(x), CLERE);
  }
  for (const [n, plane] of [[[0, -1], ZA0], [[0, 1], ZA1]] as [V2, number][]) {
    const fr = face(n, plane);
    win(k, fr.f, fr.at((XT0 + XT1) / 2), {w: 3.2, y0: 14.2, y1: 20.4, bars: 3, rowM: 1.0, surround: 'stone', glass: 'glass', bar: 'frame'});
    win(k, fr.f, fr.at((XT0 + XT1) / 2), {w: 2.4, y0: 6.0, y1: 11.4, bars: 2, rowM: 1.0, surround: 'stone', glass: 'glass', bar: 'frame'});
  }
  // Back gable on Kerkstraat: corner strips, one tall round-arched window, a cornice line.
  {
    const fr = face([1, 0], XE), t = fr.at(cz);
    for (const z of [ZN0 + 0.5, ZN1 - 0.5]) onWall(k, fr.f, fr.at(z), 8.6, 0.9, 13.0, 0.2, 'brick');
    win(k, fr.f, t, {w: 2.6, y0: 12.6, y1: 20.2, bars: 2, rowM: 1.0, surround: 'brick', glass: 'glass', bar: 'frame'});
  }
  for (const [n, plane, u] of [[[1, 0], XE, -7.7], [[0, -1], -12.9, 17.5]] as [V2, number, number][]) {
    const fr = face(n, plane);
    for (const s of [-2.2, 0, 2.2]) win(k, fr.f, fr.at(u + s), {w: 1.2, y0: 1.2, y1: 3.6, bars: 1, rowM: 0.8, surround: 'stone', bar: 'frame'});
    for (const s of [-2.2, 0, 2.2]) win(k, fr.f, fr.at(u + s), {w: 1.2, y0: 4.6, y1: 6.8, head: 'flat', bars: 1, rowM: 0.8, surround: 'stone', bar: 'frame'});
  }

  // ---- Front: grey sandstone ----------------------------------------------------------------------------------------------
  extrude(k, rect(XF, XB, ZA0, ZA1), 0, ATTIC, 'stone');
  extrude(k, rect(XF, XB, ZC - HALF_UP, ZC + HALF_UP), ATTIC, UPPER, 'stone');
  const fr = face([-1, 0], XF), tc = fr.at(ZC), W = ZA1 - ZA0;
  onWall(k, fr.f, tc, 0, W - 0.1, 1.0, 0.25, 'concrete'); // plinth
  // Lower storey: single pilasters at the ends, pairs either side of the centre bay.
  for (const s of [-1, 1]) for (const o of [3.4, 4.9, 8.65]) {
    onWall(k, fr.f, tc + s * o, 1.0, 0.9, 10.4, 0.22, 'stone');
    onWall(k, fr.f, tc + s * o, 11.4, 1.1, 0.4, 0.34, 'stone');
  }
  onWall(k, fr.f, tc, 11.8, W - 0.1, 0.8, 0.42, 'stone'); // entablature
  onWall(k, fr.f, tc, 15.35, W - 0.1, 0.4, 0.3, 'stone'); // attic cornice
  // Centre bay: the great door, the mosaic tympanum, the inscription tablet.
  door(k, fr.f, tc, {w: 3.0, y0: 0.6, y1: 5.8, leaf: 'dark', surround: 'stone'});
  archSlab(k, fr.f, tc, 6.1, 3.0, 1.55, 0.08, 'gold', -0.04);
  archBand(k, fr.f, tc, 5.9, 3.8, 2.15, 0.4, 0.22, 'stone', -0.04);
  onWall(k, fr.f, tc, 9.4, 3.8, 1.0, 0.1, 'blue');
  // Side bays: a statue niche over a small pedimented door.
  for (const s of [-1, 1]) {
    door(k, fr.f, tc + s * 6.8, {w: 1.3, y0: 0.6, y1: 3.9, leaf: 'dark', surround: 'stone', pediment: true});
    archSlab(k, fr.f, tc + s * 6.8, 6.6, 1.5, 3.4, 0.06, 'greyBrick', -0.04);
    onWall(k, fr.f, tc + s * 6.8, 6.3, 1.9, 0.3, 0.3, 'stone');
    lathe(k, XF - 0.25, ZC + s * 6.8, [[0.32, 6.6], [0.3, 7.9], [0.2, 8.9], [0.12, 9.0], [0.14, 9.2], [0, 9.45]], 'white', 10);
  }
  // Raised centre: paired pilasters, the tall window, entablature, pediment, cross.
  for (const s of [-1, 1]) for (const o of [4.0, 5.1]) onWall(k, fr.f, tc + s * o, ATTIC, 0.8, UPPER - 0.8 - ATTIC, 0.2, 'stone');
  win(k, fr.f, tc, {w: 3.0, y0: 16.4, y1: 21.6, bars: 3, rowM: 1.0, surround: 'stone', glass: 'glass', bar: 'frame'});
  onWall(k, fr.f, tc, UPPER - 0.8, 2 * HALF_UP - 0.1, 0.8, 0.4, 'stone');
  poly(k, fr.f, tc, UPPER, [[-HALF_UP - 0.3, 0], [HALF_UP + 0.3, 0], [0, APEX - UPPER]], 1.4, 'stone', -1.0);
  block(k, XF + 0.2, XF + 1.1, ZC - 0.5, ZC + 0.5, APEX - 0.6, APEX + 0.5, 'stone');
  block(k, XF + 0.6, XF + 0.72, ZC - 0.06, ZC + 0.06, APEX + 0.5, APEX + 2.4, 'gold');
  block(k, XF + 0.6, XF + 0.72, ZC - 0.5, ZC + 0.5, APEX + 1.65, APEX + 1.77, 'gold');
  // Concave scrolls from the attic ends up to the raised centre, and obelisks at the ends.
  for (const s of [-1, 1]) {
    const r = 3.0, pts: [number, number][] = [[-s * 0.1, 0], [s * r, 0]];
    for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; pts.push([s * (r - Math.sin(a) * r), r + 0.6 - Math.cos(a) * r]); }
    poly(k, fr.f, tc + s * HALF_UP, ATTIC, s > 0 ? pts : pts.reverse(), 0.9, 'stone', -0.95);
    lathe(k, XF + 0.5, ZC + s * 8.65, [[0.38, ATTIC], [0.38, ATTIC + 0.5], [0.22, ATTIC + 0.6], [0.06, ATTIC + 2.6], [0, ATTIC + 2.7]], 'stone', 4);
  }
}
