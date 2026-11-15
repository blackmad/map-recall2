import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, disc, facePanel, letters, ledgeStrip, poly, ringFrame, segBand, setSink, getSink, slab, type Frame} from './nearbar-kit';
import source from './diamant-museum-footprints.json';

/**
 * DIAMANT MUSEUM AMSTERDAM, Paulus Potterstraat 8 (BAG pand 0363100012076129, bouwjaar 1899, gemeentelijk monument 505735):
 * a brick villa of 1899 next to Coster Diamonds, the Diamond Museum since 2007 (en.wikipedia Diamond_Museum_Amsterdam).
 * Massing: the BAG ring (diamant-museum-footprints.json, native east/south metres, written by bag-shell-prepare.ts) with the
 * 3DBAG LoD2.2 shell for the rear and the flanks; the street front, its roof and the corner turret are drawn from the photo
 * (the 3DBAG front roof is a noisy slope that hides the gable). Every detail is read from the Gemeente Amsterdam panoramas
 * (CC BY 4.0), diamant-museum-inventory.json:
 *  - Paulus Potterstraat front (ring edge 3, 8.97 m, faces 157; recording_2025-07-30_09-59-09_01439 rectified at 50 px/m,
 *    b_20241211_0838_Track09_Sphere_00069): left bay under a steep front gable with the round-headed attic light, two stone
 *    roundels and the white DIAMOND MUSEUM letters under it; a three-light French window on a stone balcony with a wrought-iron
 *    railing on corbels; right bay with the stone entrance surround lettered DIAMANT MUSEUM, segmental-headed windows in stone
 *    springers, a diapered brick band, the white cornice on a corbel table and a wall dormer with a flat lid; chimney.
 *  - the diagonal corner turret (ring edges 0-2, 2.99 x 1.86 m): three storeys of windows, the DIAMOND / MUSEUM letters
 *    under its eaves and the steep slate spire with a finial (b_20241211_0838_Track09_Sphere_00069, TMX7316010203-000785_pano_0000_000060).
 *  - east flank (ring edge 4, 19.6 m, b_20241211_0838_Track08_Sphere_00101, oblique 36 deg): white stone blocks in the window
 *    jambs and a dark round awning over the Royal Coster side door; window rhythm only roughly readable (simplified).
 *  - west flank: hedges and trees in every panorama; 3DBAG shell only (inferred).
 */
export function buildDiamantMuseum(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as {facadeRing: number[][]; surfaces: Surface[]; nativeRing: number[][]};
  const ring = src.facadeRing;
  const {f: F} = ringFrame(ring, 3); // street front, t from the turret corner (2.71, 10.48)
  const FRONT_DEPTH = 2.4; // front zone drawn here; the 3DBAG flat top (15.8 m) starts behind it
  const EAVES = 11.7, RIDGE = 15.8;
  /** Depth of a native point behind the street-front plane (negative in front of it). */
  const behind = (x: number, z: number) => -((x - F.origin[0]) * F.n[0] + (z - F.origin[1]) * F.n[1]);
  const turretRing = [ring[0], ring[1], ring[2], ring[3]];
  const inTurret = (x: number, z: number) => {
    let inside = false;
    for (let i = 0, j = turretRing.length - 1; i < turretRing.length; j = i++) {
      const [xi, zi] = turretRing[i], [xj, zj] = turretRing[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  };
  // ---- 3DBAG shell: everything except the front zone and the turret ----
  addShell(b, src as never, {
    wall: 'brick', roof: 'slate',
    skip: s => {
      const r = s.rings[0];
      if (r.every(p => behind(p[0], p[2]) < FRONT_DEPTH + 0.05 && p[0] > -2.2) || r.every(p => inTurret(p[0], p[2]) || behind(p[0], p[2]) < 0.3)) return true;
      if (s.type !== 'RoofSurface') return false;
      // roof planes centred over the front zone or the turret are the noisy 3DBAG slope over the gable and the spire
      const cx = r.reduce((a, p) => a + p[0], 0) / r.length, cz = r.reduce((a, p) => a + p[2], 0) / r.length;
      return (behind(cx, cz) < FRONT_DEPTH + 0.6 && cx > -2.2) || r.some(p => inTurret(p[0], p[2]));
    },
  });

  const sink0 = getSink();
  setSink(0.05);
  // ---- front block: the main body ring (turret cut off by its chord) clipped to FRONT_DEPTH, brick to the eaves ----
  const body = [ring[0], ...ring.slice(3)];
  const clip: number[][] = [];
  for (let i = 0; i < body.length; i++) {
    const a = body[i], c = body[(i + 1) % body.length], da = behind(a[0], a[1]) - FRONT_DEPTH - 0.6, dc = behind(c[0], c[1]) - FRONT_DEPTH - 0.6;
    if (da <= 0) clip.push(a);
    if ((da < 0) !== (dc < 0)) { const u = da / (da - dc); clip.push([a[0] + (c[0] - a[0]) * u, a[1] + (c[1] - a[1]) * u]); }
  }
  prism(b, clip, 0, EAVES, 'brick');
  // the turret runs 0.3 m into the body so no face of it is coplanar with the body's chord face
  const into = (a: number[], c: number[]) => { const L = Math.hypot(a[0] - c[0], a[1] - c[1]); return [a[0] + ((a[0] - c[0]) / L) * 0.3, a[1] + ((a[1] - c[1]) / L) * 0.3]; };
  prism(b, [into(ring[0], ring[1]), ring[1], ring[2], into(ring[3], ring[2])], 0, 13.0, 'brick');

  // ---- roofs over the front zone ----
  const len3 = 8.97, GABLE_T0 = -0.25, GABLE_T1 = 3.8, APEX_T = (GABLE_T0 + GABLE_T1) / 2;
  // right bay: steep slate slope from the cornice to the flat top, run past the east flank
  {
    const s = new T.Shape();
    s.moveTo(0, EAVES); s.lineTo(FRONT_DEPTH + 0.8, RIDGE); s.lineTo(FRONT_DEPTH + 0.8, EAVES - 0.06); s.lineTo(0.03, EAVES - 0.06);
    roofProfile(b, F, s, GABLE_T1 - 0.2, len3 + 0.05, 0, 'slate');
  }
  // left bay: the front gable, brick triangle on the front plane and a slate ridge roof running back to the flat top
  {
    // brick gable wall, 0.4 m deep and 0.2 m under the slates so no face of it is coplanar with the roof planes
    const tri: [number, number][] = [[GABLE_T0 - APEX_T, 0], [GABLE_T1 - APEX_T, 0], [0, RIDGE - EAVES]];
    poly(b, F, APEX_T, EAVES - 0.2, tri, 0.4, 'brick', -0.4);
    const half = (GABLE_T1 - GABLE_T0) / 2, over = 0.18, rise = RIDGE - EAVES;
    for (const side of [-1, 1]) {
      const g = new T.BufferGeometry();
      const P = (t: number, y: number, back: number) => [F.origin[0] + F.tangent[0] * t - F.n[0] * back, y, F.origin[1] + F.tangent[1] * t - F.n[1] * back];
      const tA = APEX_T, tE = APEX_T + side * (half + over), yE = EAVES - over * rise / half;
      const v = [...P(tA, RIDGE + 0.05, -0.12), ...P(tE, yE, -0.12), ...P(tE, yE, FRONT_DEPTH + 0.8), ...P(tA, RIDGE + 0.05, FRONT_DEPTH + 0.8)];
      g.setAttribute('position', new T.Float32BufferAttribute(v, 3));
      g.setIndex(side > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
      g.computeVertexNormals();
      const up = g.getAttribute('normal').getY(0);
      if (up < 0) g.setIndex(side > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
      g.computeVertexNormals();
      g.userData.role = 'roof';
      b.add(g, 'slate' as never);
      // stone coping on the gable edge
      const L = Math.hypot(half, rise), ang = Math.atan2(rise, half) * side;
      const cop = new T.BoxGeometry(L + 0.1, 0.18, 0.32).translate(0, 0.09, 0.16).rotateZ(-ang);
      putAt(b, F, cop, APEX_T + side * half / 2, EAVES + rise / 2, -0.02, 'stone');
    }
    // finial at the apex
    slab(b, F, APEX_T, RIDGE, 0.16, 0.7, 0.16, 'stone');
    disc(b, F, APEX_T, RIDGE + 0.75, 0.13, 0.12, 'stone', 0.02);
  }

  // ---- street front details (frame F; y up from the 3DBAG ground) ----
  const frameW = 0.07;
  /** White-framed window: glass, outer frame, `cols` lights and a transom at `transom` (y), stone sill. */
  const win = (f: Frame, t: number, y0: number, y1: number, w: number, cols: number, transom?: number, sill = true, out = 0) => {
    facePanel(b, f, t, y0, w, y1 - y0, 'glass', out + 0.04);
    for (const s of [-1, 1]) slab(b, f, t + s * (w / 2 - frameW / 2), y0, frameW, y1 - y0, 0.08, 'frame', out);
    slab(b, f, t, y1 - frameW, w, frameW, 0.08, 'frame', out);
    slab(b, f, t, y0, w, frameW, 0.08, 'frame', out);
    for (let k = 1; k < cols; k++) slab(b, f, t - w / 2 + (w * k) / cols, y0, 0.06, (transom ?? y1) - y0, 0.08, 'frame', out);
    if (transom) slab(b, f, t, transom, w, 0.07, 0.08, 'frame', out);
    if (sill) ledgeStrip(b, f, t, y0 - 0.12, w + 0.2, 0.12, 0.16, 'stone', out);
  };
  /** Segmental brick head with stone springers and keystone over an opening of width w with its top at y. */
  const segHead = (f: Frame, t: number, y: number, w: number) => {
    segBand(b, f, t, y, w + 0.3, 0.32, 0.3, 0.07, 'red');
    for (const s of [-1, 1]) slab(b, f, t + s * (w / 2 + 0.05), y - 0.12, 0.26, 0.26, 0.1, 'stone');
    slab(b, f, t, y + 0.18, 0.2, 0.3, 0.1, 'stone');
  };
  /** Low wrought-iron guard in front of a window. */
  const guard = (f: Frame, t: number, y: number, w: number, h: number, out = 0.08) => {
    slab(b, f, t, y + h - 0.04, w, 0.04, 0.04, 'dark', out);
    slab(b, f, t, y, w, 0.04, 0.04, 'dark', out);
    for (let u = -w / 2 + 0.05; u <= w / 2 - 0.04; u += 0.12) slab(b, f, t + u, y, 0.025, h, 0.025, 'dark', out);
  };

  // plinth and sill courses
  slab(b, F, len3 / 2, 0, len3, 0.38, 0.06, 'stone');
  ledgeStrip(b, F, len3 / 2, 7.82, len3, 0.12, 0.1, 'stone');
  // -- left (gable) bay --
  win(F, 1.72, 0.5, 2.8, 2.45, 3, 2.45);
  // balcony on corbels with a wrought-iron railing
  for (const t of [0.15, 3.25]) {
    const c: [number, number][] = [[-0.12, 0], [0.12, 0], [0.12, 0.7], [-0.12, 0.7]];
    poly(b, F, t, 2.85, c, 0.45, 'stone');
  }
  slab(b, F, 1.85, 3.52, 3.85, 0.18, 0.65, 'stone');
  {
    const out = 0.58; // railing on the balcony edge
    slab(b, F, 1.85, 4.55, 3.8, 0.05, 0.05, 'dark', out);
    slab(b, F, 1.85, 3.72, 3.8, 0.04, 0.04, 'dark', out);
    for (let u = 0.0; u <= 3.75; u += 0.11) slab(b, F, u, 3.7, 0.022, 0.86, 0.022, 'dark', out);
    for (const u of [0.0, 3.75]) for (let o = 0.1; o < out; o += 0.11) slab(b, F, u, 3.7, 0.022, 0.86, 0.022, 'dark', o);
  }
  win(F, 1.72, 3.72, 6.9, 2.5, 3, 6.45, false);
  segHead(F, 1.72, 6.92, 2.6);
  // second floor: two windows with segmental heads and low guards
  for (const t of [0.98, 2.47]) { win(F, t, 7.95, 10.6, 1.05, 2, 10.05); segHead(F, t, 10.62, 1.05); guard(F, t, 7.95, 1.0, 0.6); }
  // DIAMOND MUSEUM in white capitals on the gable bay (letters 0.35 m); lettering uses the accent palette name `gold`, tinted white
  letters(b, F, 'DIAMOND MUSEUM', 1.62, 11.17, 0.03, 0.035, 0.04, 'gold', 0.05);
  // gable: round-headed attic light, relieving arch, two stone roundels
  archSlab(b, F, APEX_T, 11.85, 1.05, 2.25, 0.05, 'glass');
  archBand(b, F, APEX_T, 11.85, 1.05, 2.25, 0.07, 0.08, 'frame');
  slab(b, F, APEX_T, 11.85, 1.0, 0.07, 0.08, 'frame');
  slab(b, F, APEX_T, 11.85, 0.06, 1.7, 0.08, 'frame');
  slab(b, F, APEX_T, 13.15, 1.0, 0.06, 0.08, 'frame');
  archBand(b, F, APEX_T, 11.85, 1.45, 2.5, 0.22, 0.06, 'red');
  ledgeStrip(b, F, APEX_T, 11.73, 1.3, 0.12, 0.14, 'stone');
  for (const t of [APEX_T - 1.15, APEX_T + 1.15]) { disc(b, F, t, 13.2, 0.17, 0.06, 'stone'); disc(b, F, t, 13.2, 0.09, 0.08, 'red'); }
  // -- right bay --
  // stone entrance surround with DIAMANT MUSEUM, dark green door, lamps
  slab(b, F, 4.75, 0, 2.5, 3.3, 0.1, 'stone');
  facePanel(b, F, 4.75, 0.1, 1.6, 2.4, 'green', 0.17);
  slab(b, F, 4.75, 2.5, 1.7, 0.1, 0.14, 'stone');
  letters(b, F, 'DIAMANT MUSEUM', 4.75, 2.82, 0.1, 0.025, 0.03, 'dark', 0.03);
  for (const t of [3.68, 5.82]) slab(b, F, t, 1.75, 0.16, 0.3, 0.18, 'dark', 0.1);
  // ground-floor window right
  win(F, 7.15, 0.55, 2.75, 1.3, 1, 2.2);
  segHead(F, 7.15, 2.78, 1.3);
  // diapered band between ground and first floor
  slab(b, F, 6.4, 3.55, 5.15, 0.45, 0.04, 'red');
  for (let t = 4.1; t < 8.8; t += 0.42) poly(b, F, t, 3.78, [[-0.14, 0], [0, 0.14], [0.14, 0], [0, -0.14]], 0.06, 'stone');
  // first and second floor windows of the right bay
  win(F, 5.95, 4.1, 6.85, 1.6, 2, 6.45); segHead(F, 5.95, 6.88, 1.6); guard(F, 5.95, 4.1, 1.5, 0.3);
  win(F, 5.95, 8.0, 10.65, 1.6, 2, 10.1); segHead(F, 5.95, 10.68, 1.6); guard(F, 5.95, 8.0, 1.5, 0.55);
  // cornice: corbel table and a white cornice over the right bay
  for (let t = GABLE_T1 + 0.15; t < len3 - 0.2; t += 0.32) slab(b, F, t, 10.95, 0.14, 0.22, 0.14, 'stone');
  slab(b, F, (GABLE_T1 + len3 - 0.05) / 2, 11.17, len3 - 0.05 - GABLE_T1, 0.45, 0.3, 'stone');
  // wall dormer: brick cheeks, window, flat projecting lid
  slab(b, F, 6.0, EAVES - 0.1, 1.95, 1.75, 0.35, 'brick');
  win(F, 6.0, 11.9, 13.05, 1.1, 2, undefined, false, 0.35);
  slab(b, F, 6.0, 13.3, 2.25, 0.12, 0.75, 'white');
  slab(b, F, 6.0, 13.42, 2.1, 0.08, 0.6, 'slate');
  // chimney behind the cornice, right
  slab(b, F, 8.2, 11.0, 0.55, 2.0, 0.55, 'brick', -1.0);
  slab(b, F, 8.2, 12.95, 0.65, 0.1, 0.65, 'stone', -1.05);
  // downpipe at the east corner
  slab(b, F, 8.55, 0.3, 0.1, 10.3, 0.1, 'dark');

  // ---- corner turret (ring edges 0-2) ----
  const turretFace = (i: number) => ringFrame(ring, i);
  for (const i of [0, 1, 2]) {
    const {f, len} = turretFace(i), mid = len / 2, w = i === 1 ? 0.95 : 0.8;
    slab(b, f, mid, 0, len, 0.38, 0.06, 'stone');
    ledgeStrip(b, f, mid, 7.82, len, 0.12, 0.1, 'stone');
    ledgeStrip(b, f, mid, 3.55, len, 0.14, 0.1, 'stone');
    if (i !== 0) { // the west face (edge 0) looks into the garden: hedges in every panorama, no windows claimed
      win(f, mid, 0.5, 2.8, w, 1, 2.25);
      segHead(f, mid, 2.82, w);
      win(f, mid, 4.0, 6.85, w, 1, 6.3);
      archBand(b, f, mid, 4.0, w + 0.3, 3.2, 0.18, 0.07, 'red');
      win(f, mid, 8.0, 10.6, w, 1, 10.0);
      segHead(f, mid, 10.62, w);
    }
    // eaves cornice of the turret
    slab(b, f, mid, 12.7, len, 0.3, 0.22, 'stone');
    for (let t = 0.15; t < len - 0.05; t += 0.32) slab(b, f, t, 12.45, 0.12, 0.25, 0.12, 'stone');
  }
  {
    const {f, len} = turretFace(1);
    letters(b, f, 'DIAMOND', len / 2, 11.75, 0.04, 0.05, 0.04, 'gold', 0.05);
    letters(b, f, 'MUSEUM', len / 2, 11.2, 0.04, 0.05, 0.04, 'gold', 0.05);
  }
  // spire: steep slate pyramid over the turret, overhanging 0.15 m, with a finial
  {
    const cx = turretRing.reduce((s, p) => s + p[0], 0) / 4, cz = turretRing.reduce((s, p) => s + p[1], 0) / 4;
    const base = turretRing.map(p => { const dx = p[0] - cx, dz = p[1] - cz, L = Math.hypot(dx, dz); return [p[0] + (dx / L) * 0.2, p[1] + (dz / L) * 0.2]; });
    const y0 = 13.0, apex = 18.0, v: number[] = [], idx: number[] = [];
    for (let k = 0; k < 4; k++) {
      const a = base[k], c = base[(k + 1) % 4], n0 = v.length / 3;
      v.push(a[0], y0, a[1], c[0], y0, c[1], cx, apex, cz);
      idx.push(n0, n0 + 1, n0 + 2);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(v, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    // outward normals: flip when the first face points to the centre
    const nx = g.getAttribute('normal').getX(0), nz = g.getAttribute('normal').getZ(0), mx = (base[0][0] + base[1][0]) / 2 - cx, mz = (base[0][1] + base[1][1]) / 2 - cz;
    if (nx * mx + nz * mz < 0) { for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]]; g.setIndex(idx); g.computeVertexNormals(); }
    g.userData.role = 'roof';
    b.add(g, 'slate' as never);
    b.add(new T.CylinderGeometry(0.03, 0.03, 1.0, 6).translate(cx, apex + 0.45, cz), 'dark' as never);
    b.add(new T.SphereGeometry(0.12, 8, 6).translate(cx, apex + 0.35, cz), 'dark' as never);
  }

  // ---- east flank (ring edge 4, 19.6 m, oblique photo): window rows with white stone jamb blocks, the Coster side door ----
  setSink(0.2, true);
  {
    const {f, len} = ringFrame(ring, 4);
    slab(b, f, len / 2, 0, len, 0.38, 0.06, 'stone');
    const ts = [16.0, 13.2, 11.0, 8.1, 5.4, 2.6];
    for (const t of ts) for (const [y0, y1] of [[0.6, 2.8], [4.0, 6.6], [8.0, 10.4]]) {
      win(f, t, y0, y1, 1.0, 2, y1 - 0.55);
      for (let y = y0 + 0.2; y < y1; y += 0.55) for (const s of [-1, 1]) slab(b, f, t + s * 0.62, y, 0.22, 0.14, 0.05, 'white');
    }
    // side door with its round dark awning
    slab(b, f, 9.55, 0.42, 1.0, 2.0, 0.06, 'dark'); // a slab, sunk like the windows: the 3DBAG flank stands up to 0.2 m behind the merged ring here
    const s = new T.Shape(); s.moveTo(0, 0.9); s.quadraticCurveTo(0.85, 0.9, 0.9, 0); s.lineTo(0, 0); s.lineTo(0, 0.9);
    const g = new T.ExtrudeGeometry(s, {depth: 1.5, bevelEnabled: false, curveSegments: 6});
    g.rotateY(-Math.PI / 2).translate(0.75, 0, 0);
    putAt(b, f, g, 9.55, 2.45, 0, 'dark');
  }
  setSink(sink0);
}

/** Extrude a native (x, z) polygon from y0 to y1. */
function prism(b: BuildingTools, pts: number[][], y0: number, y1: number, colour: string) {
  const s = new T.Shape(pts.map(p => new T.Vector2(p[0], p[1])));
  const g = new T.ExtrudeGeometry(s, {depth: y1 - y0, bevelEnabled: false});
  g.rotateX(Math.PI / 2).translate(0, y1, 0);
  b.add(g, colour as never);
}
/** Place a geometry authored in frame space (x along the wall, y up, z out) at (t, y, out). */
function putAt(b: BuildingTools, f: Frame, g: T.BufferGeometry, t: number, y: number, out: number, colour: string) {
  g.rotateY(Math.atan2(f.n[0], f.n[1]));
  g.translate(f.origin[0] + f.tangent[0] * t + f.n[0] * out, y, f.origin[1] + f.tangent[1] * t + f.n[1] * out);
  b.add(g, colour as never);
}
/** Extrude a roof profile drawn in (depth behind the front, y) along the front from t0 to t1; the eave runs `over` in front of the wall. */
function roofProfile(b: BuildingTools, f: Frame, s: T.Shape, t0: number, t1: number, over: number, colour: string) {
  const g = new T.ExtrudeGeometry(s, {depth: t1 - t0, bevelEnabled: false});
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const depth = pos.getX(i), y = pos.getY(i), t = t0 + pos.getZ(i), back = depth < 0.01 ? -over : depth;
    pos.setXYZ(i, f.origin[0] + f.tangent[0] * t - f.n[0] * back, y, f.origin[1] + f.tangent[1] * t - f.n[1] * back);
  }
  // the map (depth, y, along) -> world can mirror the solid; keep the faces outward
  const A = new T.Vector3(), B = new T.Vector3(), C = new T.Vector3(), cen = new T.Vector3();
  g.computeBoundingBox(); g.boundingBox!.getCenter(cen);
  const idx = g.getIndex();
  const tri = (k: number) => idx ? [idx.getX(k), idx.getX(k + 1), idx.getX(k + 2)] : [k, k + 1, k + 2];
  const [i0, i1, i2] = tri(0);
  A.fromBufferAttribute(pos, i0); B.fromBufferAttribute(pos, i1); C.fromBufferAttribute(pos, i2);
  const n = B.clone().sub(A).cross(C.clone().sub(A)), m = A.clone().add(B).add(C).divideScalar(3).sub(cen);
  if (n.dot(m) < 0) {
    if (idx) { const a = idx.array as Uint16Array | Uint32Array; for (let k = 0; k < a.length; k += 3) [a[k + 1], a[k + 2]] = [a[k + 2], a[k + 1]]; idx.needsUpdate = true; }
    else { const a = pos.array as Float32Array; for (let k = 0; k < a.length; k += 9) for (let j = 0; j < 3; j++) [a[k + 3 + j], a[k + 6 + j]] = [a[k + 6 + j], a[k + 3 + j]]; }
  }
  g.computeVertexNormals();
  g.userData.role = 'roof';
  b.add(g, colour as never);
}
