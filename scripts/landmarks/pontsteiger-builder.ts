import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {staggeredOpenings, type StaggerOptions} from '../../src/canalRecall/landmarks/staggeredOpenings';
import {warrenTruss} from '../../src/canalRecall/landmarks/warrenTruss';

/**
 * Pontsteiger, Houthavens (Arons en Gelauff, 2019): a 90 m gate of light glazed brick over the Houthaven pier.
 *
 * Read from Wikimedia Commons (Choinowski 2022 "Pontsteiger in 2022", Kleon3 2022 "Pontsteigergebouw", Ceescamel 2020
 * "Gebouw Pontsteiger mei 2020" 01/03/05/08, Alf van Beem "Pontsteiger foto 1"; CC BY-SA 4.0 / public domain) and
 * Gemeente Amsterdam panoramas (CC BY 4.0; recording_2025-06-17_10-16-05_00470 and _00487 under the bridge and in the
 * courtyard). Rebuilt 2026-11-14 for feedback a4013653 / 10ada6d9 (chequered window patches where the old grid boxes
 * overlapped; a uniform 3.7 m office grid where the building has varied openings).
 *  - Massing: a low U of seven storeys on white round columns (6.6 m open ground floor with recessed glazed pavilions
 *    and a timber soffit) and, at the U's open tips, two legs. The +x leg is the tower, one face from the ground to the
 *    roof (26 storeys of 3.15 m); the -x leg stops at the bridge soffit (about 51 m, 14 storeys, against OSM's 58 m
 *    min_height; counted storeys on the 2022 photo). Legs 26 m wide: the three photos put leg : gap : leg near
 *    1 : 1.2 : 1 (OSM draws the legs at 21 m), the bridge 12 storeys deep from soffit to roof.
 *  - Skybridge: its lowest four storeys are one glazed band crossed by a white Warren truss (17 diagonals, no
 *    verticals) that runs from the short leg's outer face to the tower; above it eight storeys of wide openings of
 *    three to seven modules, with mullions, the top (penthouse) storey widest. Light metal soffit.
 *  - Leg and tower faces: punched dark windows of two or three 1.3 m modules, the run shifted every storey (the
 *    "pixel" front); the short leg's openings are narrower. The tower's end face is a deep brick frame of two cells a
 *    storey, each half recessed loggia with a glass balustrade, the halves swapping every storey.
 *  - Low U: long openings of four to eight modules, a third of them loggias, staggered per storey.
 *  - Colour: the glazed brick reads #cdccc0 in sunlight on the 2022 photo (palette concrete #d4d5d0); glass dark.
 * The model frame: x along the bridge (+x the tower, south-east), +z the front (south-west, the Houthaven basin).
 */
type Colour = Parameters<BuildingTools['box']>[6];
type Face = {axis: 'x' | 'z'; sign: 1 | -1; plane: number; u0: number; u1: number};
type Rect = {u0: number; u1: number; y0: number; y1: number};
type Style = {sill: number; h: number; mullion?: number};

export function buildPontsteiger(w: number, d: number, b: BuildingTools) {
  const {add, box} = b;
  const X = w * .96 / 2, leg = 26, zr0 = -d * .445, zr1 = zr0 + d * .31, zf1 = d * .47, zf0 = zf1 - d * .18;
  const st = 3.154, g = 6.6, low = g + 7 * st, soffit = g + 14 * st, band = soffit + 4 * st, top = g + 26 * st;
  const wing = 17, xi = X - leg; // leg inner faces at +-xi; wing inner faces at +-(X - wing)
  // A flat member on a face: u along the face, y bottom, `out` its centre off the wall, `t` its thickness.
  function onFace(f: Face, u0: number, u1: number, y: number, h: number, out: number, t: number, c: Colour) {
    const m = (u0 + u1) / 2, n = f.plane + f.sign * out;
    if (f.axis === 'z') box(m, y, n, u1 - u0, h, t, c); else box(n, y, m, t, h, u1 - u0, c);
  }
  function wall(f: Face, y0: number, storeys: number, o: Omit<StaggerOptions, 'length' | 'storeys'>, s: Style, skip: Rect[] = []) {
    for (const op of staggeredOpenings({...o, length: f.u1 - f.u0, storeys})) {
      const u0 = f.u0 + op.u0, u1 = f.u0 + op.u1, y = y0 + op.storey * st + s.sill;
      if (skip.some(r => u1 > r.u0 && u0 < r.u1 && y + s.h > r.y0 && y < r.y1)) continue;
      opening(f, u0, u1, y, s, op.kind === 'loggia');
    }
  }
  function opening(f: Face, u0: number, u1: number, y: number, s: Style, loggia: boolean) {
    onFace(f, u0, u1, y, s.h, .06, .12, 'dark');
    if (loggia) onFace(f, u0 + .05, u1 - .05, y, 1.1, .22, .06, 'glass');
    else if (s.mullion) for (let k = 1, n = Math.round((u1 - u0) / s.mullion); k < n; k++) {
      const u = u0 + (u1 - u0) * k / n;
      onFace(f, u - .04, u + .04, y, s.h, .14, .05, 'frame');
    }
  }
  const zFace = (sign: 1 | -1, plane: number, u0: number, u1: number): Face => ({axis: 'z', sign, plane, u0, u1});
  const xFace = (sign: 1 | -1, plane: number, u0: number, u1: number): Face => ({axis: 'x', sign, plane, u0, u1});
  const pixel = {module: .65, widths: [2, 3, 4], piers: [1, 1, 2], edge: 2};
  const narrow = {module: .65, widths: [2, 3], piers: [1, 2], edge: 2};
  const ribbon = {module: 1.3, widths: [5, 6, 7, 8, 9], piers: [1, 2], edge: 1, loggia: .4};
  const wide = {module: 1.3, widths: [3, 4, 5], piers: [1, 2], edge: 1, widthsFor: (s: number) => (s === 7 ? [5, 7] : undefined)};
  const punched: Style = {sill: .35, h: 2.45}, slot: Style = {sill: .35, h: 2.45}, long: Style = {sill: .5, h: 2.15}, bridgeWin: Style = {sill: .3, h: 2.45, mullion: 1.3};

  // Bodies (concrete = the light glazed brick), roofs.
  box(X - leg / 2, g, (zr0 + zr1) / 2, leg, top - g, zr1 - zr0, 'concrete');
  box(-X + leg / 2, g, (zr0 + zr1) / 2, leg, soffit - g, zr1 - zr0, 'concrete');
  box((-X + xi) / 2, soffit, (zr0 + zr1) / 2, X + xi, top - soffit, zr1 - zr0, 'concrete');
  box(0, top, (zr0 + zr1) / 2, 2 * X - .6, .25, zr1 - zr0 - .6, 'slate');
  box(0, g, (zf0 + zf1) / 2, 2 * X, low - g, zf1 - zf0, 'concrete');
  box(0, low, (zf0 + zf1) / 2, 2 * X - .6, .25, zf1 - zf0 - .6, 'slate');
  for (const s of [-1, 1]) {
    box(s * (X - wing / 2), g, (zr1 + zf0) / 2, wing, low - g, zf0 - zr1, 'concrete');
    box(s * (X - wing / 2), low, (zr1 + zf0) / 2, wing - .6, .25, zf0 - zr1 + .6, 'slate');
  }

  // Tower (+x leg): pixel fronts, the loggia frame on its end face; the wing abuts its front below the low roof.
  wall(zFace(1, zr1, xi, X), g, 26, {...pixel, seed: 11}, punched, [{u0: X - wing, u1: X, y0: 0, y1: low}]);
  wall(zFace(-1, zr0, xi, X), g, 26, {...pixel, seed: 12}, punched);
  wall(xFace(-1, xi, zr0, zr1), g, 14, {...pixel, seed: 13}, punched);
  { const f = xFace(1, X, zr0, zr1), half = (zr1 - zr0) / 2;
    for (let k = 0; k < 26; k++) for (const c of [0, 1]) {
      const a = zr0 + c * half + .9, e = zr0 + (c + 1) * half - .9, mid = (a + e) / 2, y = g + k * st + .35;
      opening(f, (k + c) % 2 ? a : mid + .15, (k + c) % 2 ? mid - .15 : e, y, {sill: 0, h: 2.45}, true);
      opening(f, (k + c) % 2 ? mid + .15 : a, (k + c) % 2 ? e : mid - .15, y, {sill: 0, h: 2.45, mullion: 1.4}, false);
    } }
  // Short leg (-x): narrower openings, up to the soffit.
  wall(zFace(1, zr1, -X, -xi), g, 14, {...narrow, seed: 21}, slot, [{u0: -X, u1: -X + wing, y0: 0, y1: low}]);
  wall(zFace(-1, zr0, -X, -xi), g, 14, {...narrow, seed: 22}, slot);
  wall(xFace(1, -xi, zr0, zr1), g, 14, {...narrow, seed: 23}, slot);
  wall(xFace(-1, -X, zr0, zr1), g, 14, {...pixel, seed: 24}, punched);

  // Skybridge: the glazed truss band (four storeys), then eight storeys of wide openings.
  const bandFaces = [zFace(1, zr1, -X, xi), zFace(-1, zr0, -X, xi)];
  for (const f of bandFaces) {
    onFace(f, f.u0, f.u1, soffit, band - soffit, .06, .1, 'glass');
    for (let k = 1; k < 4; k++) onFace(f, f.u0, f.u1, soffit + k * st - .15, .3, .12, .1, 'dark');
    for (const m of warrenTruss({length: f.u1 - f.u0, height: band - soffit, diagonals: 17, member: .9})) {
      const dx = m.x1 - m.x0, dy = m.y1 - m.y0, len = Math.hypot(dx, dy) + (m.kind === 'diagonal' ? .6 : 0);
      const beam = new T.BoxGeometry(m.kind === 'post' ? m.w : len, m.kind === 'post' ? len : m.w, .45);
      if (m.kind === 'diagonal') beam.rotateZ(Math.atan2(dy, dx));
      const cu = f.u0 + (m.x0 + m.x1) / 2, cy = soffit + (m.y0 + m.y1) / 2, n = f.plane + f.sign * .32;
      add(beam, 'white', cu, cy, n);
    }
  }
  { const f = xFace(-1, -X, zr0, zr1);
    onFace(f, f.u0, f.u1, soffit, band - soffit, .06, .1, 'glass');
    for (let k = 1; k < 4; k++) onFace(f, f.u0, f.u1, soffit + k * st - .15, .3, .12, .1, 'dark');
    for (let k = 1; k < 10; k++) { const u = f.u0 + k * (f.u1 - f.u0) / 10; onFace(f, u - .05, u + .05, soffit, band - soffit, .14, .05, 'frame'); }
    for (const u of [f.u0 + .45, f.u1 - .45]) onFace(f, u - .45, u + .45, soffit, band - soffit, .3, .45, 'white');
    for (const y of [soffit, band - .9]) onFace(f, f.u0, f.u1, y, .9, .3, .45, 'white'); }
  wall(zFace(1, zr1, -X, xi), band, 8, {...wide, seed: 31}, bridgeWin);
  wall(zFace(-1, zr0, -X, xi), band, 8, {...wide, seed: 32}, bridgeWin);
  wall(xFace(-1, -X, zr0, zr1), band, 8, {...wide, seed: 33}, bridgeWin);
  box(0, soffit - .12, (zr0 + zr1) / 2, 2 * xi, .12, zr1 - zr0, 'frame');

  // Low U: long openings and loggias; the bar's ends and the wings' outer faces are one wall each side.
  wall(zFace(1, zf1, -X, X), g, 7, {...ribbon, seed: 41}, long);
  wall(zFace(-1, zf0, -X + wing, X - wing), g, 7, {...ribbon, seed: 42}, long);
  for (const s of [-1, 1] as const) {
    wall(xFace(s, s * X, zr1, zf1), g, 7, {...ribbon, seed: 43 + s}, long);
    wall(xFace(s === 1 ? -1 : 1, s * (X - wing), zr1, zf0), g, 7, {...ribbon, seed: 46 + s}, long);
  }

  // Open ground floor: white round columns on the low U's outer lines, recessed glazed pavilions, timber soffit.
  const column = (x: number, z: number) => add(new T.CylinderGeometry(.42, .42, g, 10), 'white', x, g / 2, z);
  for (let k = 0; k <= 10; k++) column(-X + 1.4 + k * (2 * X - 2.8) / 10, zf1 - 1.4);
  for (const s of [-1, 1]) for (let k = 0; k < 6; k++) column(s * (X - 1.4), zr1 + 2 + k * (zf1 - 1.4 - zr1 - 2) / 6);
  box(0, 0, (zf0 + zf1) / 2 - 1, 2 * X - 8, 4.4, zf1 - zf0 - 6, 'glass');
  for (const s of [-1, 1]) box(s * (X - wing / 2), 0, (zr1 + zf0) / 2, wing - 7, 4.4, zf0 - zr1, 'glass');
  box(0, g - .12, (zf0 + zf1) / 2, 2 * X - .2, .12, zf1 - zf0 - .2, 'ochre');
  for (const s of [-1, 1]) box(s * (X - wing / 2), g - .12, (zr1 + zf0) / 2, wing - .2, .12, zf0 - zr1, 'ochre');
  // Lobbies under the legs, set back behind the leg faces, with corner columns.
  for (const s of [-1, 1]) {
    box(s * (X - leg / 2), 0, (zr0 + zr1) / 2, leg - 3, g, zr1 - zr0 - 3, 'glass');
    for (const x of [s * (X - .6), s * (xi + .6)]) for (const z of [zr0 + .6, zr1 - .6]) column(x, z);
  }
}
