import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './kraanspoor-footprints.json';

type Colour = Parameters<BuildingTools['add']>[1];

/**
 * Kraanspoor, NDSM-werf (BAG pand 0363100012115127, bouwjaar 2008): the 2007 three-storey glass office by Trude Hooykaas
 * (OTH) on the 1952 concrete crane track by Architectenbureau Postma (nl.wikipedia "Kraanspoor", CC BY-SA 4.0).
 * Footprint: the BAG ring (CC0) in the native frame of scripts/landmarks/kraanspoor-footprints.json (x east, z south, y up,
 * metres; citroen-zuid-prepare.ts --id=kraanspoor). The box fills the 261.9 x 12.9 m ring; the concrete track below it is
 * authored, because the 3DBAG LoD2.2 shell is one solid prism down to the ground and the real thing is open underneath.
 *
 * Local frame: s along the building from the SW end (0) to the NE end (261.9), v across from the SE (quay) face (0) to the
 * NW (water) face (12.9), y up from the street (the 3DBAG flat roof is 24.97 m NAP, the rectified panorama puts it 25.0 m
 * over the street, so the street is about 0 m NAP).
 *
 * Measured on the rectified SE panoramas (16.1 px/m: recording_2024-10-23_07-33-22_00814 and TMX7316010203-002193_pano_0000_004912,
 * Gemeente Amsterdam CC BY 4.0), corrected for the track standing ~2 m behind the box plane (camera 34 m out):
 *  - concrete beam 7.4-11.3 m on legs; openings 11-19 m wide with chamfered haunches;
 *  - steel posts and braces 11.3-13.7 m, light grey box soffit 13.7-14.3 m, glass box to 25.0 m, storey lines 17.4 / 21.1 m;
 *  - four glazed stair/lift cores in wide piers with round-arched heads cut up into the beam and white numerals 5.1-8.9 m.
 *    Their stations (51.8 / 105.2 / 157.5 / 209.9 m) are the 3DBAG lift overruns on the roof (26.1-26.3 m NAP), which match the
 *    panorama's cores 1-3 and Wikipedia's four portals.
 * End blocks from Commons photos (CC BY 2.0 / CC BY-SA 3.0, listed in kraanspoor-inventory.json), scaled to the 8.7 m track:
 * four legs with two tie levels, the head 7.7-11.3 m with two blank panels and a window, the cap on curved brackets.
 */
type Src = {nativeRing: number[][]};
const ring = (source as unknown as Src).nativeRing;
// Ring corners: [0] NE-SE, [1] NE-NW, [2] SW-NW, [3] SW-SE.
const P3 = ring[3], P0 = ring[0], P2 = ring[2];
const L = Math.hypot(P0[0] - P3[0], P0[1] - P3[1]), Wd = Math.hypot(P2[0] - P3[0], P2[1] - P3[1]);
const ts = [(P0[0] - P3[0]) / L, (P0[1] - P3[1]) / L], tv = [(P2[0] - P3[0]) / Wd, (P2[1] - P3[1]) / Wd];
/** Local (s, y, w = -v) to native; columns ts, up, -tv keep the handedness (det +1), so normals survive. */
const M = new T.Matrix4().set(
  ts[0], 0, -tv[0], P3[0],
  0, 1, 0, 0,
  ts[1], 0, -tv[1], P3[1],
  0, 0, 0, 1,
);
const TEXT_ANGLE = Math.atan2(-ts[1], ts[0]);

let b: BuildingTools;
function put(g: T.BufferGeometry, c: Colour) { g.applyMatrix4(M); b.add(g, c); }
/** Axis box in local s/v/y extents. `drop` removes faces: 'top', 'bottom' (hidden contact faces, not coplanar twins). */
function B(s0: number, s1: number, v0: number, v1: number, y0: number, y1: number, c: Colour, drop: ('top' | 'bottom')[] = []) {
  let g: T.BufferGeometry = new T.BoxGeometry(s1 - s0, y1 - y0, v1 - v0);
  if (drop.length) {
    // BoxGeometry groups: +x, -x, +y, -y, +z, -z (6 indices each)
    const idx = g.getIndex()!.array as ArrayLike<number>, keep: number[] = [];
    for (let f = 0; f < 6; f++) if (!(f === 2 && drop.includes('top')) && !(f === 3 && drop.includes('bottom'))) for (let i = 0; i < 6; i++) keep.push(idx[f * 6 + i]);
    g.setIndex(keep); g.clearGroups();
  }
  g = g.translate((s0 + s1) / 2, (y0 + y1) / 2, -(v0 + v1) / 2);
  put(g, c);
}
/** Prism from a profile in the (s, y) plane, extruded across v0..v1. */
function profileSY(pts: [number, number][], v0: number, v1: number, c: Colour, segments = 1) {
  const sh = new T.Shape(pts.map(p => new T.Vector2(p[0], p[1])));
  const g = new T.ExtrudeGeometry(sh, {depth: v1 - v0, bevelEnabled: false, curveSegments: segments});
  g.translate(0, 0, -v1); // extrude runs +z (= -v) from 0: shift so it spans w = -v1 .. -v0
  put(g, c);
}
/** Prism from a profile in the (v, y) plane, extruded along s0..s1. */
function profileVY(pts: [number, number][], s0: number, s1: number, c: Colour) {
  const sh = new T.Shape(pts.map(p => new T.Vector2(-p[0], p[1]))); // shape x = w = -v
  const g = new T.ExtrudeGeometry(sh, {depth: s1 - s0, bevelEnabled: false});
  g.rotateY(-Math.PI / 2); // (x, y, z) -> (-z, y, x): shape x stays w on z, the extrusion runs -s
  g.translate(s1, 0, 0);
  put(g, c);
}

// ---- dimensions -------------------------------------------------------------------------------------------------
const TRACK0 = 4.0, TRACK1 = L - 4.0;             // the box cantilevers about 4 m past both concrete heads
const VA = 2.1, VB = 10.8;                         // track faces (8.7 m wide, centred on the 12.9 m box)
const BEAM_T = 1.0;                                // longitudinal beam thickness
const BEAM_Y0 = 7.4, DECK = 11.3;
const LEG_D = 1.6;
const POST_Y1 = 13.7, SOFFIT_Y1 = 14.3, ROOF = 25.0;
const CORES = [51.8, 105.2, 157.5, 209.9];
const CORE_HALF = 2.6, PIER_LEG = 2.4;          // core glass 5.2 m between 2.4 m legs (w02 2021 crop px 1600-1760)
const MID_LEGS = [22, 34, 78.5, 131.35, 183.7, L - 34, L - 22];
const END_LEN = 6.0, END_LEG = 1.8;

/** Every leg as [s0, s1, width along v]. */
function legList(): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const [a, dir] of [[TRACK0, 1], [TRACK1, -1]] as [number, number][]) {
    const near = [a, a + dir * END_LEG].sort((p, q) => p - q) as [number, number];
    const far = [a + dir * (END_LEN - END_LEG), a + dir * END_LEN].sort((p, q) => p - q) as [number, number];
    out.push([near[0], near[1], END_LEG], [far[0], far[1], END_LEG]);
  }
  for (const m of MID_LEGS) out.push([m - LEG_D / 2, m + LEG_D / 2, BEAM_T]);
  for (const c of CORES) out.push([c - CORE_HALF - PIER_LEG, c - CORE_HALF, BEAM_T], [c + CORE_HALF, c + CORE_HALF + PIER_LEG, BEAM_T]);
  return out.sort((p, q) => p[0] - q[0]);
}

function legs() {
  const FOOT = -1.0;
  for (const [s0, s1, d] of legList()) {
    const isEnd = s0 < TRACK0 + END_LEN || s1 > TRACK1 - END_LEN;
    const top = isEnd ? 7.7 : BEAM_Y0, out = isEnd ? 0.05 : 0;
    B(s0, s1, VA - out, VA - out + d, FOOT, top, 'concrete', ['top', 'bottom']);
    B(s0, s1, VB + out - d, VB + out, FOOT, top, 'concrete', ['top', 'bottom']);
    if (isEnd) continue;
    // transverse tie low between the pair (Kraanspoor.JPG), recessed 0.3 m
    B(s0 + 0.3, s1 - 0.3, VA + d - 0.1, VB - d + 0.1, 1.0, 1.8, 'concrete');
    // chamfered haunches under the beam on both sides of the leg, 2 cm inside the beam faces
    for (const [v0, v1] of [[VA + 0.02, VA + BEAM_T - 0.02], [VB - BEAM_T + 0.02, VB - 0.02]] as [number, number][]) {
      profileSY([[s0 + 0.3, BEAM_Y0 + 0.05], [s0 - 1.3, BEAM_Y0 + 0.05], [s0 + 0.3, BEAM_Y0 - 1.6]], v0, v1, 'concrete');
      profileSY([[s1 - 0.3, BEAM_Y0 + 0.05], [s1 - 0.3, BEAM_Y0 - 1.6], [s1 + 1.3, BEAM_Y0 + 0.05]], v0, v1, 'concrete');
    }
  }
}

function trackBeams() {
  const s0 = TRACK0 + END_LEN - 0.1, s1 = TRACK1 - END_LEN + 0.1;
  B(s0, s1, VA, VA + BEAM_T, BEAM_Y0, DECK, 'concrete');
  B(s0, s1, VB - BEAM_T, VB, BEAM_Y0, DECK, 'concrete');
  // deck slab between the beams (5 cm below the beam tops, ends inside the beams) and transverse ribs under it
  B(s0, s1, VA + BEAM_T - 0.1, VB - BEAM_T + 0.1, 10.6, DECK - 0.2, 'concrete');
  for (let s = s0 + 1.5; s < s1 - 1; s += 3.0) B(s - 0.15, s + 0.15, VA + BEAM_T - 0.05, VB - BEAM_T + 0.05, 10.0, 10.65, 'concrete');
}

function endBlock(a: number, dir: 1 | -1) {
  const sNear = a, sFar = a + dir * END_LEN, lo = Math.min(sNear, sFar), hi = Math.max(sNear, sFar);
  const vA = VA - 0.05, vB = VB + 0.05;
  // head 7.7-10.5 m over the whole block, cap 10.5-11.35 m projecting 0.8 m past the end face and 1.2 m past the sides
  B(lo, hi, vA, vB, 7.7, 10.55, 'concrete');
  const capOut = dir > 0 ? [sNear - 0.8, hi] : [lo, sNear + 0.8];
  B(capOut[0], capOut[1], vA - 1.2, vB + 1.2, 10.5, DECK + 0.05, 'concrete');
  // curved brackets under the side overhangs (w03 crop, Commons 29670093954): quarter curves from the leg face to the cap edge
  const bracket = (vFace: number, sign: 1 | -1) => {
    // concave fillet: vertical at the leg face (8.4 m), horizontal under the cap edge (10.5 m, 1.2 m out)
    const pts: [number, number][] = [[vFace - sign * 0.3, 8.4]];
    for (let k = 0; k <= 6; k++) { const t = k / 6 * Math.PI / 2; pts.push([vFace + sign * 1.2 * (1 - Math.cos(t)), 8.4 + 2.1 * Math.sin(t)]); }
    pts.push([vFace + sign * 1.2, 10.55], [vFace - sign * 0.3, 10.55]);
    profileVY(pts, lo + 0.4, hi - 0.4, 'concrete');
  };
  bracket(vB, 1); bracket(vA, -1);
  // end face (s = sNear): two blank inset panels and a rounded window between them, 8.0-10.1 m
  const face = sNear, outN = -dir; // outward along s
  const mid = (VA + VB) / 2;
  for (const dv of [-2.4, 0, 2.4]) {
    const c: Colour = dv === 0 ? 'glass' : 'stone';
    const s0 = face + outN * 0.0, s1 = face + outN * 0.07;
    B(Math.min(s0, s1), Math.max(s0, s1), mid + dv - 0.7, mid + dv + 0.7, 8.0, 10.1, c);
    if (dv === 0) { const f0 = face + outN * 0.07, f1 = face + outN * 0.12; B(Math.min(f0, f1), Math.max(f0, f1), mid - 0.75, mid + 0.75, 7.95, 8.05, 'frame'); B(Math.min(f0, f1), Math.max(f0, f1), mid - 0.75, mid + 0.75, 10.05, 10.15, 'frame'); }
  }
  // ledge under the panels and two tie levels on all four faces (recessed 5 cm from the leg faces)
  { const f0 = face, f1 = face + outN * 0.25; B(Math.min(f0, f1), Math.max(f0, f1), vA, vB, 7.7, 7.95, 'concrete'); }
  for (const [y0, y1] of [[1.0, 1.8], [4.2, 5.0]]) {
    for (const [sF, dIn] of [[sNear, dir], [sFar, -dir]]) { const s0 = sF + dIn * 0.05, s1 = sF + dIn * 0.7; B(Math.min(s0, s1), Math.max(s0, s1), vA + END_LEG - 0.1, vB - END_LEG + 0.1, y0, y1, 'concrete'); }
    B(lo + END_LEG - 0.1, hi - END_LEG + 0.1, vA + 0.05, vA + 0.7, y0, y1, 'concrete');
    B(lo + END_LEG - 0.1, hi - END_LEG + 0.1, vB - 0.7, vB - 0.05, y0, y1, 'concrete');
  }
}

function cores() {
  for (let k = 0; k < CORES.length; k++) {
    const c = CORES[k];
    // the glazed core between the pier legs, inset 0.25 m from both track faces
    B(c - CORE_HALF + 0.1, c + CORE_HALF - 0.1, VA + 0.25, VB - 0.25, 0, BEAM_Y0 + 0.4, 'glass');
    for (const [face, sgn] of [[VA, -1], [VB, 1]] as [number, number][]) {
      // round-arched glass head on the beam face, 6 cm proud, 9.0 m to the crown
      const w = 2 * CORE_HALF - 0.1, h = 9.0, r = w / 2;
      const sh = new T.Shape(); sh.moveTo(-r, 0); sh.lineTo(r, 0); sh.lineTo(r, h - r); sh.absarc(0, h - r, r, 0, Math.PI, false); sh.lineTo(-r, 0);
      const g = new T.ExtrudeGeometry(sh, {depth: 0.36, bevelEnabled: false, curveSegments: 10});
      // extrude +z = -v; the SE panel spans v face-0.06 .. face+0.30, the NW one v face-0.30 .. face+0.06
      if (sgn < 0) g.translate(c, 0, -(face + 0.30)); else g.translate(c, 0, -(face + 0.06));
      put(g, 'glass');
      // mullions and transoms on the glass (5 cm proud of it)
      const fo = sgn < 0 ? [face - 0.11, face - 0.06] : [face + 0.06, face + 0.11];
      for (const ds of [-r / 3, r / 3]) B(c + ds - 0.05, c + ds + 0.05, fo[0], fo[1], 0, h - r + Math.sqrt(r * r - ds * ds) - 0.15, 'frame');
      for (const y of [2.8, 5.0, 9.0]) B(c - r + 0.15, c + r - 0.15, fo[0], fo[1], y, y + 0.1, 'frame');
      // white numeral 1-4, 3.8 m tall, centred on the glass
      const digit = String(k + 1), pixel = 0.46;
      if (sgn < 0) {
        const p = new T.Vector3(c, 4.7, -(face - 0.09)).applyMatrix4(M);
        b.sign(digit, p.x, p.y, p.z, pixel, 'white', undefined, TEXT_ANGLE);
      } else {
        const p = new T.Vector3(c, 4.7, -(face + 0.09)).applyMatrix4(M);
        b.sign(digit, p.x, p.y, p.z, pixel, 'white', undefined, TEXT_ANGLE + Math.PI);
      }
    }
    // glazed lobbies about 10 m long either side of core 1 only (w02 2021 crop px 950-1100 = 59-68 m, Commons 29670102564);
    // the bays beside cores 2-4 are open to the water in the same crop
    if (k !== 0) continue;
    for (const [s0, s1] of [[c - CORE_HALF - PIER_LEG - 10, c - CORE_HALF - PIER_LEG - 0.05], [c + CORE_HALF + PIER_LEG + 0.05, c + CORE_HALF + PIER_LEG + 10]]) {
      const g0 = VA + BEAM_T + 0.05;
      B(s0, s1, g0, VB - BEAM_T - 0.05, 0, BEAM_Y0 - 0.25, 'glass');
      for (let s = s0 + 1.8; s < s1 - 0.5; s += 1.8) B(s - 0.05, s + 0.05, g0 - 0.07, g0 + 0.03, 0, BEAM_Y0 - 0.3, 'frame');
      B(s0, s1, g0 - 0.09, g0 + 0.02, 3.0, 3.12, 'frame');
      B(s0 - 0.1, s1 + 0.1, g0 - 0.05, VB - BEAM_T, BEAM_Y0 - 0.3, BEAM_Y0 - 0.15, 'dark');
      const g1 = VB - BEAM_T - 0.05;
      for (let s = s0 + 1.8; s < s1 - 0.5; s += 1.8) B(s - 0.05, s + 0.05, g1 - 0.03, g1 + 0.07, 0, BEAM_Y0 - 0.3, 'frame');
      B(s0, s1, g1 - 0.02, g1 + 0.09, 3.0, 3.12, 'frame');
    }
  }
}

function posts() {
  // steel columns on both beams, every ~10.8 m, and V braces at each core (w02 crops)
  for (let s = TRACK0 + 2.0; s < TRACK1 - 1.5; s += 10.8) for (const v of [VA + 0.5, VB - 0.5]) B(s - 0.15, s + 0.15, v - 0.15, v + 0.15, DECK - 0.05, POST_Y1 + 0.05, 'bronze');
  for (const c of CORES) for (const v of [VA + 0.5, VB - 0.5]) for (const sg of [-1, 1]) {
    const a = new T.Vector3(c + sg * 0.3, DECK, -v), q = new T.Vector3(c + sg * 4.2, POST_Y1, -v), d = q.clone().sub(a);
    const g = new T.BoxGeometry(0.16, d.length(), 0.16);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize()));
    g.translate((a.x + q.x) / 2, (a.y + q.y) / 2, (a.z + q.z) / 2);
    put(g, 'bronze');
  }
}

function glassBox() {
  const IN = 0.5; // curtain wall inset from the BAG ring; the louvre skin stands on the ring line
  B(0.3, L - 0.3, 0.3, Wd - 0.3, POST_Y1, SOFFIT_Y1, 'stone');
  B(IN, L - IN, IN, Wd - IN, SOFFIT_Y1 - 0.05, ROOF - 0.4, 'glass');
  B(IN - 0.06, L - IN + 0.06, IN - 0.06, Wd - IN + 0.06, ROOF - 0.45, ROOF, 'slate');
  // mullions every 1.8 m and dark floor bands on the curtain wall, all four faces
  for (let s = IN + 1.8; s < L - IN - 0.5; s += 1.8) for (const [v0, v1] of [[IN - 0.1, IN + 0.02], [Wd - IN - 0.02, Wd - IN + 0.1]]) B(s - 0.05, s + 0.05, v0, v1, SOFFIT_Y1 + 0.05, ROOF - 0.5, 'frame');
  for (let v = IN + 1.8; v < Wd - IN - 0.5; v += 1.8) for (const [s0, s1] of [[IN - 0.1, IN + 0.02], [L - IN - 0.02, L - IN + 0.1]]) B(s0, s1, v - 0.05, v + 0.05, SOFFIT_Y1 + 0.05, ROOF - 0.5, 'frame');
  for (const y of [17.4, 21.1]) {
    B(IN - 0.13, L - IN + 0.13, IN - 0.13, IN + 0.03, y - 0.3, y + 0.25, 'dark');
    B(IN - 0.13, L - IN + 0.13, Wd - IN - 0.03, Wd - IN + 0.13, y - 0.3, y + 0.25, 'dark');
    B(IN - 0.13, IN + 0.03, IN + 0.04, Wd - IN - 0.04, y - 0.3, y + 0.25, 'dark');
    B(L - IN - 0.03, L - IN + 0.13, IN + 0.04, Wd - IN - 0.04, y - 0.3, y + 0.25, 'dark');
  }
}

/** Glass louvre skin: steel posts every 1.8 m on the ring line, pale glass blades every 0.9 m, a crown rail over the roof edge. */
function louvreSkin() {
  const Y0 = SOFFIT_Y1 - 0.2, Y1 = ROOF + 0.4;
  const longFace = (vPost: number, vBlade0: number, vBlade1: number) => {
    for (let s = 0.1; s <= L - 0.05; s += (L - 0.2) / Math.round((L - 0.2) / 1.8)) B(s - 0.05, s + 0.05, vPost - 0.06, vPost + 0.06, Y0, Y1, 'bronze');
    for (let y = Y0 + 0.75; y + 0.32 < ROOF - 0.5; y += 0.9) B(0.05, L - 0.05, vBlade0, vBlade1, y, y + 0.32, 'canopyGlass');
    B(0.05, L - 0.05, Math.min(vBlade0, vBlade1), Math.max(vBlade0, vBlade1), Y1 - 0.08, Y1, 'bronze');
  };
  longFace(0.06, 0.08, 0.52);
  longFace(Wd - 0.06, Wd - 0.52, Wd - 0.08);
  // end faces: louvres over the NW 55 %, the SE part is clear glass panels (Commons 29670110014, 29670102564)
  for (const [s, s0, s1] of [[0.06, 0.08, 0.52], [L - 0.06, L - 0.52, L - 0.08]]) {
    const vStart = Wd * 0.45;
    for (let v = vStart; v <= Wd - 0.1; v += 1.8) B(s - 0.06, s + 0.06, v - 0.05, v + 0.05, Y0, Y1, 'bronze');
    for (let y = Y0 + 0.75; y + 0.32 < ROOF - 0.5; y += 0.9) B(s0, s1, vStart, Wd - 0.55, y, y + 0.32, 'canopyGlass');
    B(s0, s1, 0.55, Wd - 0.55, Y1 - 0.08, Y1, 'bronze');
  }
}

function roofParts() {
  // 3DBAG LoD2.2 roof parts (u from the NE end in the prepare frame -> s = L - u); tops in m over the street (= m NAP)
  const parts: [number, number, number, number, number][] = [
    [49.5, 54.6, 5.2, 10.7, 26.2], [101.6, 107.2, 5.2, 10.6, 26.2], [153.8, 159.7, 5.3, 10.7, 26.2], [206.8, 213.4, 5.3, 10.5, 26.2],
    [42.1, 49.6, 7.4, 9.3, 27.1], [57.4, 62.0, 7.1, 9.1, 26.8], [95.0, 101.5, 7.4, 9.1, 26.8], [108.3, 115.5, 7.7, 8.7, 26.8],
    [146.4, 154.1, 7.6, 9.1, 26.8], [161.4, 167.2, 7.6, 9.1, 26.8], [199.1, 207.3, 6.8, 8.9, 26.8], [213.1, 220.8, 7.3, 9.3, 27.1],
    [10.6, 15.3, 7.0, 10.2, 26.0], [246.8, 251.2, 7.2, 10.0, 26.0],
  ];
  for (const [u0, u1, v0, v1, top] of parts) B(L - u1, L - u0, v0, v1, ROOF - 0.1, top, top > 26.5 ? 'slate' : 'concrete', ['bottom']);
}

/** Escape walkway hung from the legs on the water side, about 4 m up (Wikipedia; seen through every SE opening). */
function walkway() {
  const v0 = VB - 0.05, v1 = VB + 1.45, y = 4.0, s0 = TRACK0 + END_LEN + 0.05, s1 = TRACK1 - END_LEN - 0.05;
  B(s0, s1, v0, v1, y, y + 0.15, 'bronze');
  B(s0, s1, v1 - 0.06, v1, y + 1.05, y + 1.12, 'bronze');
  B(s0, s1, v1 - 0.06, v1, y + 0.55, y + 0.6, 'bronze');
  for (let s = s0 + 1.5; s < s1; s += 3.0) B(s - 0.04, s + 0.04, v1 - 0.06, v1 - 0.01, y + 0.15, y + 1.05, 'bronze');
  // escape stair landings at both end blocks (Commons 30214778541, w04 crop)
  for (const [a, dir] of [[TRACK0, 1], [TRACK1, -1]] as [number, number][]) {
    const lo = Math.min(a + dir * 0.6, a + dir * END_LEN), hi = Math.max(a + dir * 0.6, a + dir * END_LEN);
    for (const yy of [y, 7.4]) {
      B(lo, hi, VB, VB + 1.6, yy, yy + 0.15, 'bronze');
      B(lo, hi, VB + 1.54, VB + 1.6, yy + 1.0, yy + 1.07, 'bronze');
      for (const s of [lo + 0.1, hi - 0.1]) B(s - 0.04, s + 0.04, VB + 1.54, VB + 1.6, yy + 0.15, yy + 1.0, 'bronze');
    }
    const sp = dir > 0 ? lo + 0.2 : hi - 0.2;
    B(sp - 0.08, sp + 0.08, VB + 1.4, VB + 1.56, -0.5, 8.5, 'bronze', ['bottom']);
    // the flight between the landings
    const d = new T.Vector3((hi - lo) * 0.7 * dir, 3.4, 0), st = new T.Vector3(dir > 0 ? lo + 0.5 : hi - 0.5, y + 0.1, -(VB + 0.85));
    const g = new T.BoxGeometry(0.9, d.length(), 0.12); g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize()));
    g.rotateY(0); g.translate(st.x + d.x / 2, st.y + d.y / 2, st.z); put(g, 'bronze');
  }
}

/** Concrete mooring block with two bollards in the water off the SW head, NW side (Commons 30214778541, 29670110014). */
function bollards() {
  B(0.6, 3.4, VB - 1.0, VB + 1.8, -1.0, 1.2, 'concrete', ['bottom']);
  for (const v of [VB - 0.2, VB + 1.0]) {
    const g = new T.CylinderGeometry(0.28, 0.3, 0.6, 10); g.translate(2.0, 1.5, -v); put(g, 'copper');
    const cap = new T.CylinderGeometry(0.38, 0.38, 0.12, 10); cap.translate(2.0, 1.86, -v); put(cap, 'copper');
  }
}

export function buildKraanspoor(_w: number, _d: number, tools: BuildingTools) {
  b = tools;
  legs();
  trackBeams();
  endBlock(TRACK0, 1);
  endBlock(TRACK1, -1);
  cores();
  posts();
  glassBox();
  louvreSkin();
  roofParts();
  walkway();
  bollards();
}
