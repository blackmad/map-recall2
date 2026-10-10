import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {letters, type Frame} from './nearbar-kit';
import source from './odessa-footprints.json';

/**
 * Odessa (Veemkade 259): a former Ukrainian cargo ship moored on the north side of the Veemkade quay, used as a restaurant and
 * party/dance venue. It is a vessel, not a BAG pand, so the model sits on the OSM way w277087161 (note 'ship "Odessa"') fitted with
 * an oriented rectangle, native east/south metres from its centre; the stern points east (bearing 106 degrees), the quay is on the
 * south (+v) side. Measured by eye from the 2025-06-16 municipal panoramas (ref-*.jpg):
 *  - black tarred-plank hull, bluff bow, flat transom stern, five small white-framed windows along the stern half, gold ODESSA
 *    lettering near the stern, funnel on the stern deck;
 *  - tall woven-bamboo screens round the bow and stern decks with barrels of climbing plants and thin wire arches over them;
 *    a glass geodesic dome on the bow block and a flag mast;
 *  - between them a low glazed lounge on a green-painted hull section, roofed with six shallow scalloped slate segments.
 * Authored in a hull frame (x = u toward the stern, z = v toward the quay, y up above the waterline), turned into native axes
 * once by rotating each geometry about Y.
 */
const A = source.hull.halfLongMetres, B = source.hull.halfShortMetres;
const TH = (source.hull.bearingDegrees - 90) * Math.PI / 180;
type Col = Parameters<BuildingTools['add']>[1];

export function buildOdessa(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const ad = (g: T.BufferGeometry, c: Col) => { g.rotateY(-TH); b.add(g, c); };
  const bx = (u: number, y0: number, v: number, w: number, h: number, d: number, c: Col) => ad(new T.BoxGeometry(w, h, d).translate(u, y0 + h / 2, v), c);
  const FREEBOARD = 3.0;

  // ---- Hull: plan polygon (bluff bow, flat transom), extruded up from just below the waterline ----
  const plan: [number, number][] = [[A, -B + 0.35], [A - 0.35, -B], [-A * 0.45, -B], [-A + 1.2, -B * 0.62], [-A, -B * 0.28], [-A, B * 0.28], [-A + 1.2, B * 0.62], [-A * 0.45, B], [A - 0.35, B], [A, B - 0.35]];
  const hullShape = (pts: [number, number][], y0: number, y1: number, c: Col) => {
    const s = new T.Shape(pts.map(p => new T.Vector2(p[0], -p[1])));
    const g = new T.ExtrudeGeometry(s, {depth: y1 - y0, bevelEnabled: false});
    g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
    ad(g, c);
  };
  hullShape(plan, 0, FREEBOARD, 'dark');
  // Green-painted hull section under the glazed lounge, standing a hair proud of the black hull on both sides.
  const U0 = -6.5, U1 = 5.5;
  for (const sg of [-1, 1]) bx((U0 + U1) / 2, 0, sg * (B + 0.02), U1 - U0, 1.2, 0.06, 'green');
  b.mark?.('shell');
  // Plank lines along the black hull (straight run of both sides).
  for (const sg of [-1, 1]) for (const y of [0.55, 1.0, 1.45, 1.9, 2.35, 2.8]) {
    bx(4.0, y, sg * (B + 0.015), 21.4, 0.035, 0.03, 'slate');
  }

  // ---- Stern block: bamboo screens round the aft deck, five windows, lettering, funnel ----
  const screen = (u0: number, u1: number, hgt: number, roof = false) => {
    const w = u1 - u0, uc = (u0 + u1) / 2, vv = B - 0.3;
    bx(uc, FREEBOARD, 0, w, 0.12, 2 * vv, 'dark');            // deck
    for (const sg of [-1, 1]) bx(uc, FREEBOARD, sg * vv, w, hgt, 0.16, 'ochre');
    bx(u0, FREEBOARD, 0, 0.16, hgt, 2 * vv, 'ochre');
    bx(u1, FREEBOARD, 0, 0.16, hgt, 2 * vv, 'ochre');
    for (const sg of [-1, 1]) {
      for (let u = u0; u <= u1 + 0.01; u += 1.3) bx(u, FREEBOARD, sg * (vv + 0.1), 0.09, hgt, 0.08, 'bronze');
      for (const y of [FREEBOARD + 0.9, FREEBOARD + hgt - 0.1]) bx(uc, y, sg * (vv + 0.1), w, 0.09, 0.08, 'bronze');
    }
    if (roof) bx(uc, FREEBOARD + hgt - 0.1, 0, w + 0.16, 0.12, 2 * vv + 0.16, 'dark');
    return {u0, u1};
  };
  const STERN = screen(6.2, A - 0.2, 3.1);
  for (const u of [7.2, 8.8, 10.4, 12.0, 13.6]) {
    bx(u, 1.15, B + 0.015, 0.9, 1.55, 0.05, 'white');
    bx(u, 1.28, B + 0.03, 0.34, 1.25, 0.04, 'glass');
    bx(u - 0.22, 1.28, B + 0.03, 0.34, 1.25, 0.04, 'glass');
  }
  // Gold ODESSA lettering high on the hull side near the stern (quay side).
  {
    const s = Math.sin(TH), c = Math.cos(TH), u = 13.9, v = B + 0.04;
    const f: Frame = {origin: [u * c - v * s, u * s + v * c], tangent: [c, s], n: [-s, c]};
    letters(b, f, 'ODESSA', 0, 2.0, 0, 0.055, 0.03, 'gold');
  }
  // Barrels of climbing plants hung on the quay-side screen.
  for (const u of [7.0, 8.9, 10.6, 12.3, 14.0]) {
    const g = new T.CylinderGeometry(0.34, 0.3, 0.55, 8).translate(u, FREEBOARD + 0.55, B + 0.16); ad(g, 'bronze');
    ad(new T.CylinderGeometry(0.28, 0.28, 0.06, 8).translate(u, FREEBOARD + 0.85, B + 0.16), 'green');
  }
  // Funnel.
  ad(new T.CylinderGeometry(0.34, 0.4, 5.5, 10).translate(13.3, FREEBOARD + 0.12 + 2.75, -1.5), 'frame');
  ad(new T.CylinderGeometry(0.46, 0.4, 0.14, 10).translate(13.3, FREEBOARD + 0.12 + 5.5, -1.5), 'frame');

  // ---- Bow block with the glass dome ----
  const BOW = screen(-A + 2.7, -7.2, 2.9, true);
  const dome = new T.IcosahedronGeometry(2.2, 1).scale(1, 0.82, 1).translate(-10.0, FREEBOARD + 2.9, 0); ad(dome, 'glass');
  ad(new T.CylinderGeometry(2.3, 2.3, 0.14, 12).translate(-10.0, FREEBOARD + 2.85, 0), 'frame');
  // Flag mast.
  ad(new T.CylinderGeometry(0.05, 0.05, 5.2, 6).translate(-4.2, FREEBOARD + 2.6, -1.2), 'frame');
  bx(-4.2 - 0.38, FREEBOARD + 4.5, -1.2, 0.7, 0.45, 0.03, 'dark');

  // ---- Wire arches over both decks ----
  for (const [uc, r] of [[8.0, 2.7], [10.0, 2.7], [12.0, 2.7], [14.0, 2.7], [-9.0, 2.5], [-11.0, 2.4]] as [number, number][]) {
    const g = new T.TorusGeometry(r, 0.025, 4, 10, Math.PI); g.rotateY(Math.PI / 2); g.translate(uc, FREEBOARD + (uc > 0 ? 3.1 : 2.9) - 0.3, 0); ad(g, 'frame');
  }

  // ---- Glazed lounge amidships on the green hull section ----
  const LV = B - 0.15, LY0 = 1.2, LY1 = FREEBOARD + 0.35;
  bx((U0 + U1) / 2, FREEBOARD - 0.05, 0, U1 - U0, 0.1, 2 * LV, 'dark');
  for (const sg of [-1, 1]) {
    bx((U0 + U1) / 2, LY0, sg * LV, U1 - U0, LY1 - LY0, 0.07, 'glass');
    for (let u = U0; u <= U1 + 0.01; u += 1.3) bx(u, LY0, sg * (LV + 0.02), 0.09, LY1 - LY0 + 0.1, 0.1, 'frame');
    bx((U0 + U1) / 2, LY0, sg * (LV + 0.02), U1 - U0, 0.08, 0.1, 'frame');
  }
  for (const u of [U0, U1]) bx(u, LY0, 0, 0.07, LY1 - LY0, 2 * LV, 'glass');
  // Six scalloped roof segments with dark seams.
  bx((U0 + U1) / 2, LY1, 0, U1 - U0 + 0.2, 0.1, 2 * LV + 0.5, 'frame');
  const seg = (U1 - U0) / 6;
  for (let i = 0; i < 6; i++) {
    const uc = U0 + seg * (i + 0.5);
    bx(uc, LY1 + 0.1, 0, seg - 0.12, 0.18, 2 * LV + 0.5, 'slate');
    bx(uc, LY1 + 0.28, 0, seg - 0.5, 0.12, 2 * LV - 0.2, 'slate');
  }
}
