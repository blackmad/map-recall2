import type {BuildingTools} from './cultural-builders';
import {balustrade, block, column, extrude, face, gable, hipRoof, lathe, local, onWall, rect, win, type Col, type Kit, type V2, type Win} from './church-kit';
import {archSlab, disc} from './nearbar-kit';
// Material slots: 'stone' cream stucco, 'concrete' grey stone columns and entablature, 'greyBrick' the grey portico wall,
// 'pink' the grey stone plinths, 'copper' the white statues, 'blue' the slate-blue tower panels, 'bronze' the tower caps.

/**
 * Mozes en Aaronkerk, Waterlooplein (T. F. Suys, 1837-1841). Built from intent on the BAG plan and 3DBAG heights.
 *
 * Plan (BAG 0363100012253765, native east/south metres from the BAG centroid; local x along the church axis, 56 degrees
 * counter-clockwise from east, the front at the south-west end): a 23 m wide brick hall, two 5 m stuccoed tower blocks
 * at the front corners with a portico of four columns between them standing 1 m proud, and at the back (Jodenbreestraat)
 * a stuccoed frontispiece between two lower brick corner blocks.
 * Heights (3DBAG + the head-on Commons front, scaled by the 36.5 m tower caps): hall eaves 21.2 m under a hipped slate
 * roof to 27.8 m; front cornice 16 m, pediment 19.7 m, tower blocks 20.8 m; each tower an open stage to 28.4 m with a
 * pediment on every face, a narrower open stage to 35.5 m and a slate ogee cap (37.7 m), ball and cross.
 * Facade rhythm per wall: scripts/landmarks/mozes-en-aaronkerk-research.json.
 */
const XF = -16.2, XP = -17.25, XR = -13.3, XB = -10.5, XH = 23.5, XBACK = 27.6, XCB = 27.1; // front, portico front, recess, body front, hall back, frontispiece, corner blocks
const ZA0 = -12.95, ZA1 = -7.9, ZB0 = 5.41, ZB1 = 10.0; // tower blocks A (north-west) and B (south-east)
const ZP = (ZA1 + ZB0) / 2; // portico centre line
const EAVE = 21.2, RIDGE = 27.8, CORNICE = 16.0, TOWER_BLOCK = 20.8, ATTIC = 20.4;
const ZC0 = -7.8, ZC1 = 5.1; // back frontispiece

function tower(k: Kit, x: number, z: number) {
  const st = (w: number, y0: number, y1: number, op: {w: number; y0: number; y1: number}, bal: number) => {
    block(k, x - w / 2, x + w / 2, z - w / 2, z + w / 2, y0, y1, 'stone');
    for (const [n, plane, u] of [[[-1, 0], x - w / 2, z], [[1, 0], x + w / 2, z], [[0, -1], z - w / 2, x], [[0, 1], z + w / 2, x]] as [V2, number, number][]) {
      const fr = face(n, plane), t = fr.at(u);
      archSlab(k, fr.f, t, op.y0, op.w, op.y1 - op.y0, 0.1, 'dark', -0.04);
      for (const s of [-1, 1]) onWall(k, fr.f, t + s * (op.w / 2 + 0.45), y0 + 0.3, 0.42, y1 - y0 - 0.7, 0.06, 'blue');
      onWall(k, fr.f, t, op.y0, op.w + 0.2, bal, 0.14, 'stone');
    }
  };
  st(4.8, TOWER_BLOCK, 28.4, {w: 1.8, y0: 22.0, y1: 26.6}, 0.9);
  block(k, x - 2.7, x + 2.7, z - 2.7, z + 2.7, 28.3, 28.75, 'stone');
  gable(k, x - 2.7, x + 2.7, z - 2.7, z + 2.7, 28.75, 1.25, 'x', 'slate', 'stone');
  gable(k, x - 2.65, x + 2.65, z - 2.7, z + 2.7, 28.74, 1.24, 'z', 'slate', 'stone');
  st(3.8, 28.9, 35.1, {w: 1.4, y0: 30.4, y1: 34.3}, 0.7);
  block(k, x - 2.2, x + 2.2, z - 2.2, z + 2.2, 35.0, 35.5, 'stone');
  lathe(k, x, z, [[2.0, 35.5], [1.9, 35.9], [1.4, 36.3], [0.8, 36.6], [0.45, 37.0], [0.3, 37.5], [0, 37.7]], 'bronze', 4);
  lathe(k, x, z, [[0.02, 37.7], [0.22, 37.78], [0.3, 38.0], [0.22, 38.22], [0.02, 38.3]], 'gold', 10);
  block(k, x - 0.06, x + 0.06, z - 0.06, z + 0.06, 38.25, 40.3, 'gold');
  block(k, x - 0.06, x + 0.06, z - 0.55, z + 0.55, 39.4, 39.55, 'gold');
}

const FLANK: Win = {w: 2.8, y0: 5.5, y1: 15.2, bars: 3, rowM: 1.1, surround: 'brick', sill: 'stone', bar: 'frame'};
const SMALL: Win = {w: 1.3, y0: 6.7, y1: 9.7, head: 'flat', bars: 1, rowM: 0.8, surround: 'stone', bar: 'frame'};
const SMALL_UP: Win = {...SMALL, y0: 11.2, y1: 13.6};

/** A standing figure (Christ on the attic, the saint in the back niche): plinth, robed body, head. */
function statue(k: Kit, x: number, z: number, y: number, h: number, c: Col = 'copper') {
  lathe(k, x, z, [[0.36 * h / 2.4, y], [0.34 * h / 2.4, y + h * 0.5], [0.24 * h / 2.4, y + h * 0.78], [0.12 * h / 2.4, y + h * 0.82], [0.14 * h / 2.4, y + h * 0.9], [0.1 * h / 2.4, y + h], [0, y + h]], c, 10);
}

export function buildMozesEnAaronkerk(_w: number, _d: number, b: BuildingTools) {
  const k = local(b, 56);

  // ---- Hall, tower blocks, attic, back blocks -------------------------------------------------------------------
  extrude(k, rect(XB, XH, ZA0, ZB1), 0, EAVE, 'brick');
  for (const [z0, z1] of [[ZA0, ZA1], [ZB0, ZB1]]) extrude(k, rect(XF, XB, z0, z1), 0, TOWER_BLOCK, 'stone');
  extrude(k, rect(XR, XB, ZA1, ZB0), 0, ATTIC, 'stone');
  extrude(k, rect(XH, XBACK, ZC0, ZC1), 0, 17.3, 'stone');
  for (const [z0, z1] of [[ZA0, ZC0], [ZC1, ZB1]]) extrude(k, rect(XH, XCB, z0, z1), 0, 15.0, 'brick');

  // ---- Cornices and plinths ----------------------------------------------------------------------------------------
  extrude(k, rect(XB - 0.35, XH + 0.35, ZA0 - 0.35, ZB1 + 0.35), EAVE - 0.55, EAVE, 'stone');
  for (const [z0, z1] of [[ZA0, ZA1], [ZB0, ZB1]]) {
    extrude(k, rect(XF - 0.4, XB, z0 - 0.4, z1 + 0.4), CORNICE - 0.8, CORNICE - 0.05, 'stone');
    extrude(k, rect(XF - 0.15, XB, z0 - 0.15, z1 + 0.15), 0, 1.1, 'pink');
  }
  for (const [z0, z1] of [[ZA0, ZC0], [ZC1, ZB1]]) extrude(k, rect(XH, XCB + 0.3, z0 - (z0 === ZA0 ? 0.3 : 0), z1 + (z1 === ZB1 ? 0.3 : 0)), 14.5, 15.0, 'stone');
  for (const [n, plane] of [[[0, -1], ZA0], [[0, 1], ZB1]] as [V2, number][]) { const fr = face(n, plane); onWall(k, fr.f, fr.at((XB + XH) / 2), 0, XH - XB, 1.0, 0.08, 'pink'); }

  // ---- Roofs from intent ---------------------------------------------------------------------------------------------
  hipRoof(k, XB, XH, ZA0, ZB1, EAVE, RIDGE - EAVE, 'slate');
  for (const [z0, z1] of [[ZA0, ZC0], [ZC1, ZB1]]) hipRoof(k, XH, XCB, z0, z1, 15.0, 1.9, 'slate');
  gable(k, XH, XBACK, ZC0, ZC1, 17.3, 3.7, 'x', 'slate', 'stone');

  // ---- Portico: four columns, entablature, pediment, door and niche on the recessed wall --------------------------
  const cols = [ZA1 + 0.9, ZA1 + 0.9 + (ZB0 - ZA1 - 1.8) / 3, ZA1 + 0.9 + 2 * (ZB0 - ZA1 - 1.8) / 3, ZB0 - 0.9];
  for (const z of cols) { block(k, XP, XP + 1.6, z - 0.8, z + 0.8, 0, 1.1, 'pink'); column(k, XP + 0.8, z, 1.35, 1.1, 13.0, 'concrete', 'stone'); }
  block(k, XP - 0.15, XR, ZA1 - 0.4, ZB0 + 0.4, 13.0, 14.4, 'stone'); // architrave
  block(k, XP - 0.25, XR, ZA1 - 0.45, ZB0 + 0.45, 14.4, 15.4, 'concrete'); // grey frieze with the inscription
  block(k, XP - 0.55, XR, ZA1 - 0.6, ZB0 + 0.6, 15.4, 16.1, 'stone');
  {
    const fr = face([-1, 0], XR - 0.001);
    const rr = face([-1, 0], XP - 0.55);
    disc(k, rr.f, rr.at(ZP), 17.6, 0.7, 0.08, 'stone', 0);
    onWall(k, fr.f, fr.at(ZP), 0, ZB0 - ZA1 - 0.02, 13.0, 0.03, 'greyBrick'); // grey portico wall
    const dw = face([-1, 0], XR - 0.03);
    onWall(k, dw.f, dw.at(ZP), 0, 2.7, 5.2, 0.08, 'dark');
    onWall(k, dw.f, dw.at(ZP), 5.2, 3.3, 0.4, 0.2, 'stone');
    archSlab(k, dw.f, dw.at(ZP), 6.6, 1.3, 2.9, 0.06, 'dark', -0.02);
    statue(k, XR - 0.45, ZP, 6.7, 2.2);
  }
  // Pitched slate roof over the pediment, ridge front to back.
  gable(k, XP - 0.55, XR, ZA1 - 0.6, ZB0 + 0.6, 16.1, 3.6, 'x', 'slate', 'stone');
  // Attic balustrade and the statue of Christ above the pediment.
  { const fr = face([-1, 0], XR); balustrade(k, fr.f, fr.at(ZA1) + 0.1, fr.at(ZB0) - 0.1, ATTIC, {out: -0.4, h: 0.9}); }
  block(k, XR + 0.3, XR + 1.5, ZP - 0.6, ZP + 0.6, ATTIC, ATTIC + 1.3, 'stone');
  statue(k, XR + 0.9, ZP, ATTIC + 1.3, 2.6);

  // ---- Tower-block fronts: Ionic pilasters, blind arched niche over a sunk panel --------------------------------------
  for (const [z0, z1] of [[ZA0, ZA1], [ZB0, ZB1]]) {
    const fr = face([-1, 0], XF), zc = (z0 + z1) / 2;
    for (const z of [z0 + 0.5, z1 - 0.5]) { onWall(k, fr.f, fr.at(z), 1.1, 0.85, 11.5, 0.18, 'stone'); onWall(k, fr.f, fr.at(z), 12.6, 1.15, 0.45, 0.3, 'stone'); }
    win(k, fr.f, fr.at(zc), {w: 2.3, y0: 7.7, y1: 12.4, blind: true, surround: 'stone', fill: 'stone'});
    onWall(k, fr.f, fr.at(zc), 2.9, 2.3, 4.1, 0.06, 'stone');
    onWall(k, fr.f, fr.at(zc), 7.0, 2.7, 0.25, 0.12, 'stone');
  }
  for (const [x, z] of [[-13.35, (ZA0 + ZA1) / 2], [-13.35, (ZB0 + ZB1) / 2]]) tower(k, x, z);

  // ---- Flanks: three tall round-arched windows each ------------------------------------------------------------------
  const flankX = [-2.0, 6.5, 15.0];
  for (const [n, plane] of [[[0, -1], ZA0], [[0, 1], ZB1]] as [V2, number][]) {
    const fr = face(n, plane);
    for (const x of flankX) win(k, fr.f, fr.at(x), FLANK);
  }

  // ---- Back: corner blocks with two windows over a door on each outer face; the stucco frontispiece -----------------
  for (const [n, plane, us] of [[[0, -1], ZA0, [25.3]], [[0, 1], ZB1, [25.3]], [[1, 0], XCB, [(ZA0 + ZC0) / 2, (ZC1 + ZB1) / 2]]] as [V2, number, number[]][]) {
    const fr = face(n, plane);
    for (const u of us) { win(k, fr.f, fr.at(u), SMALL); win(k, fr.f, fr.at(u), SMALL_UP); onWall(k, fr.f, fr.at(u), 0, 1.1, 2.6, 0.08, 'dark'); }
  }
  {
    const fr = face([1, 0], XBACK), zc = (ZC0 + ZC1) / 2;
    onWall(k, fr.f, fr.at(zc), 0, ZC1 - ZC0, 1.6, 0.1, 'pink');
    for (const z of [ZC0 + 0.75, ZC0 + 2.6, ZC1 - 2.6, ZC1 - 0.75]) { onWall(k, fr.f, fr.at(z), 1.6, 1.2, 14.0, 0.3, 'stone'); onWall(k, fr.f, fr.at(z), 15.2, 1.5, 0.4, 0.42, 'stone'); }
    onWall(k, fr.f, fr.at(zc), 15.6, ZC1 - ZC0 + 0.3, 1.7, 0.5, 'stone');
    archSlab(k, fr.f, fr.at(zc), 8.0, 2.2, 5.6, 0.06, 'greyBrick', -0.02);
    statue(k, XBACK + 0.35, zc, 8.6, 3.6);
    disc(k, face([1, 0], XBACK).f, fr.at(zc), 19.0, 0.85, 0.1, 'stone', 0);
  }
}
