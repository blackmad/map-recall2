import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
type C = Parameters<BuildingTools['add']>[1];

/**
 * Muiderpoort (1770, stadsbouwmeester Cornelis Rauws), Alexanderplein, Amsterdam.
 *
 * A flat-roofed rectangular building whose low brick guard-house wings flank a
 * raised sandstone centre framed as a Roman triumphal arch (one tall carriage
 * arch, two lower pedestrian arches) and crowned by an octagonal slate dome
 * tower with a clock lantern and a tall spire.
 *
 * Authored in native metres, glTF Y-up, with the facade width along +X and the
 * gate passage along +Z. +Z faces the city (north-west). The model origin is
 * the building centre; the surveyed spec places it at scale 1 on its BAG
 * footprint. Reference photographs guide silhouette only — no imported mesh or
 * photo pixels.
 *
 * Corrections after the first review pass against references
 * (RCE ca.1900, Commons 2010s/2020s, RCE monument 5139):
 *  - the dome is grey slate with light stone ribs, NOT oxidised copper green;
 *  - the lantern is a grey clock lantern with a tall spire/finial, not a knob;
 *  - the centre has a flat balustraded terrace with a triangular facade
 *    pediment, not a full-width sloped roof;
 *  - both gate elevations are stone-faced; brick belongs on the side walls.
 */
export function buildMuiderpoort(_w: number, _d: number, b: BuildingTools): void {
  const { add, box, prism } = b;

  // --- Surveyed plan (BAG pand 0363100012169095 / OSM w45038672) ---
  // Oriented extent 24.4 m (facade) x 17.6 m (passage). Central section 10.6 m
  // wide between two 6.9 m wings. Heights from 3DBAG AHN5: wing eaves ~10.6 m,
  // dome max ~20.35 m above ground; OSM height=28.2 m includes the spire/finial
  // (LoD2.2 omits the thin spire). Dome, lantern and spire proportions are
  // approximate from photographs.
  const depth = 17.6;
  const halfZ = depth / 2;
  const wingHalf = 6.9 / 2;          // 3.45
  const wingInner = 5.3;             // central half-width
  const wingCentre = wingInner + wingHalf; // 8.75
  const wingOuter = wingInner + wingHalf;  // 8.75 half -> outer wall x 12.2
  const wingTop = 11;                // flat wing roof
  const atticTop = 13;               // central attic / entablature top (flat terrace)
  const pedimentApex = 15.4;         // fronton apex above the arch bay
  const pedimentHalf = 4.1;          // fronton half-width

  // Sloped bar between two points in the XY plane at a fixed z (raking cornices).
  function sloped(x0: number, y0: number, x1: number, y1: number, z: number, depthZ: number, thick: number, c: C) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
    const g = new T.BoxGeometry(L, thick, depthZ);
    g.rotateZ(Math.atan2(dy, dx));
    add(g, c, (x0 + x1) / 2, (y0 + y1) / 2, z);
  }

  // ---- Wings: brick side walls, stone-faced gate elevations. ----
  for (const sx of [-1, 1]) {
    const cx = sx * wingCentre;
    box(cx, 0, 0, 6.9, wingTop, depth, 'brick');
    // stone facing on both gate elevations (city + land)
    for (const z of [-halfZ, halfZ]) {
      const zz = z + Math.sign(z) * 0.045;
      box(cx, 0, zz, 6.9, wingTop, 0.09, 'stone');
      // base plinth band
      box(cx, 0, zz + Math.sign(z) * 0.03, 7.0, 0.9, 0.06, 'frame');
      // tall sash windows on both exposed gate elevations
      for (let i = 0; i < 3; i++) {
        const wx = sx * (wingInner + 0.9 + i * 2.3);
        box(wx, 1.6, zz + Math.sign(z) * 0.05, 1.05, 2.6, 0.16, 'dark');
        box(wx, 1.6, zz + Math.sign(z) * 0.05, 0.05, 2.6, 0.34, 'stone');
        box(wx, 4.2, zz + Math.sign(z) * 0.05, 1.35, 0.22, 0.3, 'stone'); // lintel
      }
    }
    // brick side wall: stone string courses and round portholes (as built)
    for (const y of [0, 4.0, 8.6]) {
      box(sx * wingOuter, y, 0, 0.06, 0.42, depth, 'stone');
    }
    for (const z of [-4.6, 4.6]) {
      add(new T.CylinderGeometry(0.56, 0.56, 0.2, 14).rotateZ(Math.PI / 2), 'stone', sx * wingOuter, 6.3, z);
      add(new T.CylinderGeometry(0.42, 0.42, 0.26, 14).rotateZ(Math.PI / 2), 'dark', sx * (wingOuter + 0.03), 6.3, z);
    }
    // cornice band under the flat roof
    box(cx, wingTop - 0.5, 0, 7.1, 0.5, depth + 0.3, 'stone');
    box(cx, wingTop, 0, 7.1, 0.35, depth + 0.3, 'stone');
    // flat roof cap (owns the top so the walls do not read as open boxes)
    box(cx, wingTop + 0.35, 0, 7.1, 0.12, depth + 0.3, 'slate');
  }

  // ---- Central raised section: sandstone triumphal arch, extruded with three
  // genuine open passages so the gate reads through, never as a solid slab. The
  // top is a flat balustraded terrace; the fronton is a separate facade piece. ----
  function archHole(x0: number, x1: number, h: number): T.Path {
    const w = x1 - x0;
    const p = new T.Path();
    p.moveTo(x0, 0);
    p.lineTo(x1, 0);
    p.lineTo(x1, h - w / 2);
    p.absarc((x0 + x1) / 2, h - w / 2, w / 2, 0, Math.PI, false);
    p.closePath();
    return p;
  }
  const centreShape = new T.Shape();
  centreShape.moveTo(-5.3, 0);
  centreShape.lineTo(-5.3, atticTop);
  centreShape.lineTo(5.3, atticTop);
  centreShape.lineTo(5.3, 0);
  centreShape.closePath();
  centreShape.holes.push(archHole(-2.0, 2.0, 5.8));      // carriage arch
  centreShape.holes.push(archHole(-4.35, -2.55, 3.4));   // left pedestrian arch
  centreShape.holes.push(archHole(2.55, 4.35, 3.4));     // right pedestrian arch
  const centreGeo = new T.ExtrudeGeometry(centreShape, { depth, bevelEnabled: false, curveSegments: 16 });
  add(centreGeo, 'stone', 0, 0, -halfZ);

  // Sandstone voussoir rims around each arch opening, on both facades.
  function archRim(cx: number, h: number, r0: number, r1: number, z: number) {
    const n = 15;
    const spring = h - (r0 + r1) / 2;
    for (let i = 0; i < n; i++) {
      const lo = i * Math.PI / n + 0.02, hi = (i + 1) * Math.PI / n - 0.02;
      const s = new T.Shape();
      s.moveTo(r0 * Math.cos(lo), spring + r0 * Math.sin(lo));
      s.lineTo(r1 * Math.cos(lo), spring + r1 * Math.sin(lo));
      s.lineTo(r1 * Math.cos(hi), spring + r1 * Math.sin(hi));
      s.lineTo(r0 * Math.cos(hi), spring + r0 * Math.sin(hi));
      s.closePath();
      add(new T.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: false }), 'white', cx, 0, z);
    }
    // impost blocks at the springing line
    for (const sx of [-1, 1]) {
      box(cx + sx * (r0 + r1) / 2, spring - 0.28, z, 0.55, 0.5, 0.3, 'white');
    }
  }
  for (const z of [-halfZ, halfZ]) {
    archRim(0, 5.8, 2.0, 2.42, z - Math.sign(z) * 0.04);
    archRim(-3.45, 3.4, 0.9, 1.18, z - Math.sign(z) * 0.04);
    archRim(3.45, 3.4, 0.9, 1.18, z - Math.sign(z) * 0.04);
  }

  // Corner pilasters of the central section: rusticated sandstone.
  for (const sx of [-1, 1]) {
    for (const z of [-halfZ, halfZ]) {
      box(sx * 5.15, 0, z, 0.62, atticTop, 0.6, 'stone');
      for (let y = 2.2; y < atticTop - 1; y += 2.1) box(sx * 5.15, y, z, 0.64, 0.08, 0.66, 'frame');
    }
  }

  // Entablature: triglyph frieze band around the top of the central section.
  for (const z of [-halfZ, halfZ]) {
    box(0, atticTop - 1.15, z, 10.7, 0.28, 0.3, 'white');
    for (let x = -4.9; x <= 4.9; x += 1.4) {
      box(x, atticTop - 1.45, z, 0.42, 0.85, 0.26, 'white');
      box(x, atticTop - 1.72, z, 0.5, 0.1, 0.28, 'frame');
    }
    box(0, atticTop - 0.62, z, 10.9, 0.28, 0.34, 'white');
  }

  // Balustraded terrace along the top edge of the central block.
  for (const z of [-halfZ + 0.3, halfZ - 0.3]) {
    box(0, atticTop + 0.9, z, 10.5, 0.22, 0.3, 'stone');
    for (let x = -4.9; x <= 4.9; x += 1.25) box(x, atticTop, z, 0.18, 0.9, 0.18, 'stone');
  }
  for (const x of [-5.15, 5.15]) {
    box(x, atticTop + 0.9, 0, 0.3, 0.22, depth - 0.6, 'stone');
    for (let z = -halfZ + 0.6; z <= halfZ - 0.6; z += 1.25) box(x, atticTop, z, 0.18, 0.9, 0.18, 'stone');
  }

  // Triangular facade frontons over the arch bay, both elevations.
  for (const z of [-halfZ, halfZ]) {
    const s = Math.sign(z);
    prism(0, atticTop, z - s * 0.4, pedimentHalf * 2, 0.8, pedimentApex - atticTop, 'stone');
    sloped(-pedimentHalf, atticTop, 0, pedimentApex, z + s * 0.03, 0.55, 0.34, 'white');
    sloped(pedimentHalf, atticTop, 0, pedimentApex, z + s * 0.03, 0.55, 0.34, 'white');
    box(0, atticTop - 0.05, z + s * 0.06, pedimentHalf * 2 + 0.5, 0.34, 0.5, 'white');
    // tympanum relief: the old/new Amsterdam arms as a simple faceted shield.
    const sh = new T.Shape();
    sh.moveTo(-0.55, 0.72); sh.lineTo(0.55, 0.72); sh.lineTo(0.46, -0.08);
    sh.lineTo(0, -0.6); sh.lineTo(-0.46, -0.08); sh.closePath();
    add(new T.ExtrudeGeometry(sh, { depth: 0.14, bevelEnabled: false }), 'gold', 0, 13.72, z + s * 0.34);
  }

  // ---- Octagonal slate dome tower on the central terrace. ----
  const drumR = 2.75, drumH = 3.4;
  add(new T.CylinderGeometry(drumR, drumR, drumH, 8), 'stone', 0, atticTop + drumH / 2, 0);
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + i * Math.PI / 4;
    box(Math.cos(a) * drumR, atticTop + 0.9, Math.sin(a) * drumR, 0.9, 1.5, 0.14, 'dark', -a);
  }
  box(0, atticTop + drumH, 0, 5.7, 0.24, 5.7, 'stone'); // drum cornice

  const domeBase = atticTop + drumH;   // 16.4
  const domeR = 2.95;
  // grey lead/slate cap (not copper green); the hemisphere owns its own
  // material so the roof-normal check stays exact.
  add(new T.SphereGeometry(domeR, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), 'lead', 0, domeBase, 0);
  // eight light stone ribs over the octagon arrises
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    add(new T.SphereGeometry(domeR + 0.03, 1, 8, a - 0.055, 0.11, 0, Math.PI / 2), 'white', 0, domeBase, 0);
  }

  // Clock lantern: grey body on a stone plinth, clock on city and land faces.
  const domeTop = domeBase + domeR;    // 19.35
  add(new T.CylinderGeometry(1.05, 1.15, 0.3, 8), 'stone', 0, domeTop + 0.15, 0);
  const lantBase = domeTop + 0.3;      // 19.65
  add(new T.CylinderGeometry(0.85, 0.85, 1.7, 8), 'stone', 0, lantBase + 0.85, 0);
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + i * Math.PI / 4;
    box(Math.cos(a) * 0.86, lantBase + 0.4, Math.sin(a) * 0.86, 0.5, 0.95, 0.12, 'dark', -a);
  }
  for (const s of [-1, 1]) {
    add(new T.CylinderGeometry(0.62, 0.62, 0.08, 16).rotateX(Math.PI / 2), 'gold', 0, lantBase + 0.95, s * (0.85 + 0.02));
    add(new T.CylinderGeometry(0.5, 0.5, 0.12, 16).rotateX(Math.PI / 2), 'dark', 0, lantBase + 0.95, s * (0.85 + 0.06));
  }
  add(new T.CylinderGeometry(0.95, 0.95, 0.22, 8), 'stone', 0, lantBase + 1.81, 0);
  const capBase = lantBase + 1.92;     // 21.57
  add(new T.ConeGeometry(0.95, 0.55, 8), 'stone', 0, capBase + 0.275, 0);
  const capTop = capBase + 0.55;       // 22.12
  add(new T.ConeGeometry(0.13, 1.5, 6), 'stone', 0, capTop + 0.75, 0);   // spire
  add(new T.SphereGeometry(0.16, 8, 6), 'gold', 0, capTop + 1.35, 0);    // finial ball
}
