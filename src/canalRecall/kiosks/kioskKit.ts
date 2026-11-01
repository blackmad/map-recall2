/**
 * Kiosk kit (#180): the small freestanding food and flower kiosks a rider passes at bridges, squares and quays (Dr Falafel,
 * the herring stands, Bloemenmarkt stalls), built from one typed set of parts with per-kiosk measurements and branding.
 *
 * Why: a kiosk is 5-20 m2 and rarely more than 3.5 m tall, but it is recognised by things the building kits never draw:
 * a white-framed glazed wall, a fold-up serving hatch whose flap becomes the awning, a striped valance, a sign board with
 * the stand's name, a trailer's wheels and drawbar, a flower stall's glass-house on a barge. Each variant is a recipe of
 * these parts; a kiosk spec gives measured sizes, panel order per face, roof and branding.
 *
 * Frame: kiosk-local metres, y up, plan centre at the origin, FRONT FACE TOWARDS +Z (the three.js facade convention), so
 * the front viewer's right is +X. `place()` turns that into the landmark GLB frame (x east, z south) given the plan centre
 * and the front's outward compass bearing. Every part is a closed box/prism/cylinder or a flat quad set; trim stands at
 * least 5 cm off the surface it decorates or is recessed into the frame (no coplanar overlaps).
 *
 * Variants (`KioskVariant`):
 *   glass         modern glass-and-steel kiosk: plinth, corner posts, mullions, glazed/solid/door infill, flat slab roof.
 *   herring       wooden herring/fish kiosk: boarded walls, serving hatch with fold-up flap (or fixed awning), hip/gable roof.
 *   trailer       food trailer or cart: body on a chassis with wheels and an A-frame drawbar, hatch and flap, barrel roof.
 *   flower-stall  Bloemenmarkt stall: pontoon hull at the quay, glass-house with a pitched glass roof, open front with
 *                 tiered flower displays, a front fascia board.
 */
import {BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Matrix4, Vector3} from 'three';

export type Pt = [number, number];
export type KioskVariant = 'glass' | 'herring' | 'trailer' | 'flower-stall';
export type FaceName = 'front' | 'back' | 'left' | 'right';
export const FACES: readonly FaceName[] = ['front', 'right', 'back', 'left'];

/** Every part carries a role; a kiosk builder maps roles to palette colours (each with a measured tint). */
export type KioskRole =
  | 'plinth' | 'frame' | 'glass' | 'solid' | 'door' | 'board' | 'void' | 'counter' | 'flap' | 'strut'
  | 'awning' | 'awningStripe' | 'roof' | 'fascia' | 'sign' | 'lettering' | 'chassis' | 'wheel' | 'hull' | 'deck'
  | 'display' | 'bloomA' | 'bloomB' | 'bloomC' | 'bloomD' | 'foliage' | 'pole';
export interface KioskPart { role: KioskRole; geometry: BufferGeometry }

/**
 * One infill panel of a face, left to right as seen from outside. `width` is relative: the panels of a face share the
 * clear length between the corner posts (less the mullions) in proportion to it.
 *   glass  glazed panel recessed in the frame         solid  closed panel (painted/clad), recessed
 *   door   glazed door (a mid rail and a handle bar)  board  vertical-boarded timber panel (herring kiosks)
 *   hatch  serving hatch: board below the counter, open (dark) above it, board above the hatch head; see `KioskHatch`
 *   grille steel bar gate: vertical bars (role strut) every ~0.11 m in the frame plane, dark recess behind
 *   louvre solid panel whose part above `louvreFrom` (metres above ground) carries horizontal vent slats (role frame)
 *          every ~0.09 m, standing 5 cm proud of the panel
 */
export interface KioskPanel {
  kind: 'glass' | 'solid' | 'door' | 'board' | 'hatch' | 'grille' | 'louvre'; width: number;
  lettering?: KioskLettering | KioskLettering[];
  louvreFrom?: number;
}
export interface KioskFace { panels: KioskPanel[] }
export interface KioskHatch {
  /** height of the counter / bottom of the opening and of its top (metres above ground) */
  sill: number; head: number;
  /** counter shelf depth out from the wall */
  counterDepth: number;
  /** 'flap': the hatch door hinged at the head, swung up and out by `flapAngleDeg` from hanging (90 = horizontal);
   *  'awning': a fixed sloped canvas awning `awningDepth` deep above the head with a `valance` drop; 'none' */
  cover: 'flap' | 'awning' | 'none';
  flapAngleDeg?: number; awningDepth?: number; awningDrop?: number; valance?: number;
  /** canvas stripes across the awning (alternating awning/awningStripe); 0 or undefined = plain */
  stripes?: number;
  /** a glass display case standing on the counter, `height` tall and `depth` deep (centred on the wall plane) */
  vitrine?: {height: number; depth: number};
  /** role of the panel part above the hatch head (default 'board'; menu chalkboards are 'void') */
  aboveRole?: KioskRole;
}
export type KioskRoof =
  | {kind: 'flat'; thickness: number; overhang: number; /** a second, inset slab on top (upstand/roof light) */ upstand?: {inset: number; height: number}}
  | {kind: 'gable' | 'hip'; rise: number; overhang: number; eaveThickness: number; ridge: 'width' | 'depth'}
  | {kind: 'barrel'; rise: number; overhang: number; segments?: number};
/** Text in the 5x7 pixel face, uppercase A-Z, 0-9, space and . ' & -; centred on (along, bottom) of its face/panel. */
export interface KioskLettering { text: string; height: number; maxWidth?: number; bottom: number; along?: number; role?: KioskRole }
export interface KioskSign {
  face: FaceName; along: number; bottom: number; width: number; height: number;
  /** how far the board's front stands proud of the wall plane (>= 0.05) */
  proud: number;
  lettering?: KioskLettering | KioskLettering[];
  /** 'wall' fixed to the face; 'roof' standing on the roof edge above the face (a top board) */
  mount?: 'wall' | 'roof';
}
export interface KioskSpec {
  variant: KioskVariant;
  /** along the front, and front-to-back (metres) */
  width: number; depth: number;
  /** top of the walls / underside of the roof (metres above ground) */
  wallHeight: number;
  plinth: number;
  /** corner post and mullion section; frame depth into the wall */
  post: number; mullion: number; frameDepth: number;
  /** height of the bottom and head rails of the frame */
  baseRail: number; headRail: number;
  faces: Record<FaceName, KioskFace>;
  roof: KioskRoof;
  hatch?: KioskHatch & {face: FaceName};
  signs?: KioskSign[];
  /** trailer: chassis height (body floor), wheel radius, wheel positions along the width, drawbar length (towards -X) */
  trailer?: {floor: number; wheelRadius: number; wheelsAt: number[]; drawbar: number};
  /** flower stall: hull below the deck, and tiered displays across the open front */
  stall?: {hullDepth: number; hullOverhang: number; tiers: number; tierDepth: number; tierRise: number; openFace: FaceName};
}

// ---------------------------------------------------------------------------------------------------------------------
// plan helpers

/** Minimum-area rectangle of a small plan ring (native x east, z south). `frontNear` picks which side is the front: the
 *  side whose outward normal bearing is nearest it; otherwise the first long side. Width runs along the front. */
export function minimumRectangle(ring: Pt[], frontNear?: number): {centre: Pt; width: number; depth: number; frontBearing: number} {
  let best: {area: number; e: Pt; n: Pt; e0: number; e1: number; n0: number; n1: number} | null = null;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < 1e-6) continue;
    const e: Pt = [(b[0] - a[0]) / l, (b[1] - a[1]) / l], n: Pt = [-e[1], e[0]];
    const pe = ring.map(p => p[0] * e[0] + p[1] * e[1]), pn = ring.map(p => p[0] * n[0] + p[1] * n[1]);
    const r = {e, n, e0: Math.min(...pe), e1: Math.max(...pe), n0: Math.min(...pn), n1: Math.max(...pn), area: 0};
    r.area = (r.e1 - r.e0) * (r.n1 - r.n0);
    if (!best || r.area < best.area - 1e-9) best = r;
  }
  if (!best) throw Error('degenerate ring');
  const {e, n, e0, e1, n0, n1} = best;
  const mid = [(e0 + e1) / 2, (n0 + n1) / 2];
  const centre: Pt = [e[0] * mid[0] + n[0] * mid[1], e[1] * mid[0] + n[1] * mid[1]];
  const le = e1 - e0, ln = n1 - n0;
  // four outward normals with the extent of the side they belong to and the depth behind them
  const sides = [
    {dir: n, width: le, depth: ln}, {dir: [-n[0], -n[1]] as Pt, width: le, depth: ln},
    {dir: e, width: ln, depth: le}, {dir: [-e[0], -e[1]] as Pt, width: ln, depth: le},
  ].map(s => ({...s, bearing: bearingOf(s.dir)}));
  const angDiff = (a: number, b: number) => Math.abs(((a - b) % 360 + 540) % 360 - 180);
  const pick = frontNear === undefined ? sides.slice().sort((a, b) => b.width - a.width)[0]
    : sides.slice().sort((a, b) => angDiff(a.bearing, frontNear) - angDiff(b.bearing, frontNear))[0];
  return {centre, width: pick.width, depth: pick.depth, frontBearing: pick.bearing};
}

/** Compass bearing of a native (east, south) direction. */
export const bearingOf = (d: Pt) => ((Math.atan2(d[0], -d[1]) * 180 / Math.PI) + 360) % 360;

/** Matrix taking kiosk-local (front +Z) to native (x east, z south) for a plan centre and front bearing. */
export function placement(centre: Pt, frontBearingDeg: number): Matrix4 {
  const b = frontBearingDeg * Math.PI / 180;
  return new Matrix4().makeTranslation(centre[0], 0, centre[1]).multiply(new Matrix4().makeRotationY(Math.PI - b));
}

// ---------------------------------------------------------------------------------------------------------------------
// face frames: each face has an outward normal, an along axis (left to right seen from outside) and its plane offset

const FACE_ANGLE: Record<FaceName, number> = {front: 0, right: Math.PI / 2, back: Math.PI, left: -Math.PI / 2};
export function faceLength(s: KioskSpec, f: FaceName) { return f === 'front' || f === 'back' ? s.width : s.depth; }
function faceOffset(s: KioskSpec, f: FaceName) { return f === 'front' || f === 'back' ? s.depth / 2 : s.width / 2; }

/** Box on a face: centred `along` (from the face centre, viewer's right +), from `y0` to `y1`, its depth band from `out0`
 *  to `out1` metres along the outward normal measured from the wall plane (negative = inside the wall). */
function faceBox(s: KioskSpec, f: FaceName, along: number, width: number, y0: number, y1: number, out0: number, out1: number): BufferGeometry {
  const g = new BoxGeometry(width, y1 - y0, out1 - out0);
  g.translate(along, (y0 + y1) / 2, faceOffset(s, f) + (out0 + out1) / 2);
  g.rotateY(FACE_ANGLE[f]);
  return g;
}

/** A quad strip / closed solid from face-local points (along, y, out) per triangle: used for the sloped flap and awning. */
function faceSolid(s: KioskSpec, f: FaceName, tris: [number, number, number][]): BufferGeometry {
  const g = new BufferGeometry();
  const pos: number[] = [];
  for (const [a, y, o] of tris) pos.push(a, y, faceOffset(s, f) + o);
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.rotateY(FACE_ANGLE[f]);
  g.computeVertexNormals();
  return g;
}

/** A thin slab between four face-local corners (a sloped board), closed: top, bottom and four edges. */
function slab(s: KioskSpec, f: FaceName, c: [number, number, number][], thick: number, up: [number, number, number]): BufferGeometry {
  const t = c.map(([a, y, o]) => [a + up[0] * thick, y + up[1] * thick, o + up[2] * thick] as [number, number, number]);
  const q = (p: [number, number, number][], i: number[]) => [p[i[0]], p[i[1]], p[i[2]], p[i[0]], p[i[2]], p[i[3]]];
  const tris: [number, number, number][] = [
    ...q(t, [0, 1, 2, 3]), ...q(c, [3, 2, 1, 0]),
    ...[0, 1, 2, 3].flatMap(i => {const j = (i + 1) % 4; return [c[i], c[j], t[j], c[i], t[j], t[i]];}),
  ];
  return fixWinding(faceSolid(s, f, tris));
}

/** Re-wind every triangle of a closed convex-ish solid so its normal points away from the solid's centroid. */
function fixWinding(g: BufferGeometry): BufferGeometry {
  const p = g.getAttribute('position').array as Float32Array;
  let cx = 0, cy = 0, cz = 0;
  const n = p.length / 3;
  for (let i = 0; i < p.length; i += 3) {cx += p[i]; cy += p[i + 1]; cz += p[i + 2];}
  cx /= n; cy /= n; cz /= n;
  for (let i = 0; i < p.length; i += 9) {
    const ax = p[i], ay = p[i + 1], az = p[i + 2];
    const ux = p[i + 3] - ax, uy = p[i + 4] - ay, uz = p[i + 5] - az, vx = p[i + 6] - ax, vy = p[i + 7] - ay, vz = p[i + 8] - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = (ax + p[i + 3] + p[i + 6]) / 3 - cx, my = (ay + p[i + 4] + p[i + 7]) / 3 - cy, mz = (az + p[i + 5] + p[i + 8]) / 3 - cz;
    if (nx * mx + ny * my + nz * mz < 0) for (let k = 0; k < 3; k++) {const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t;}
  }
  g.getAttribute('position').needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------------------------------------------------
// lettering: 5x7 pixel glyphs, each covered by a few rectangles (greedy), each rectangle a raised block (5 faces)

const GLYPHS: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'], D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'], F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'], H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['111', '010', '010', '010', '010', '010', '111'], J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'], L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'], N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'], R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'], T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'], V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'], X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'], Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'], '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'], '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  '.': ['0', '0', '0', '0', '0', '0', '1'], "'": ['1', '1', '0', '0', '0', '0', '0'], '-': ['000', '000', '000', '111', '000', '000', '000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'], ' ': ['00', '00', '00', '00', '00', '00', '00'],
};

/** Greedy rectangle cover of a glyph bitmap: [col, row(from top), w, h] per rectangle. Covers every '1' exactly once. */
export function glyphRects(rows: string[]): [number, number, number, number][] {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const used = rows.map(r => [...r.padEnd(w, '0')].map(c => c !== '1'));
  const out: [number, number, number, number][] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (used[y][x]) continue;
    let rw = 0;
    while (x + rw < w && !used[y][x + rw]) rw++;
    let rh = 1;
    while (y + rh < h && used[y + rh].slice(x, x + rw).every(u => !u)) rh++;
    for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) used[yy][xx] = true;
    out.push([x, y, rw, rh]);
  }
  return out;
}

/** Width in pixels of a text in the 5x7 face (one pixel gap between glyphs). */
export function textPixels(text: string) {
  return [...text.toUpperCase()].reduce((s, ch) => s + (GLYPHS[ch]?.[0].length ?? 3) + 1, 0) - 1;
}

/** Raised letter blocks for `text` on a face plane at `surfaceOut` (metres along the normal from the wall plane),
 *  standing `relief` proud of it; centred at `along`, bottom at `bottom`, glyph height `height` (scaled to maxWidth). */
function letteringParts(s: KioskSpec, f: FaceName, l: KioskLettering, surfaceOut: number, relief = 0.05): BufferGeometry[] {
  const text = l.text.toUpperCase();
  for (const ch of text) if (!GLYPHS[ch]) throw Error(`kiosk lettering: no glyph for "${ch}" in "${l.text}"`);
  let px = l.height / 7;
  const wPx = textPixels(text);
  if (l.maxWidth && wPx * px > l.maxWidth) px = l.maxWidth / wPx;
  const out: BufferGeometry[] = [];
  let u = (l.along ?? 0) - wPx * px / 2;
  for (const ch of text) {
    const rows = GLYPHS[ch];
    for (const [cx, cy, cw, chh] of glyphRects(rows)) {
      const a0 = u + cx * px, y1 = l.bottom + (7 - cy) * px;
      // the block starts 1 cm inside the surface so its back never shows a gap; front stands `relief` proud
      out.push(faceBox(s, f, a0 + cw * px / 2, cw * px * 0.94, y1 - chh * px + px * 0.03, y1 - px * 0.03, surfaceOut - 0.01, surfaceOut + relief));
    }
    u += (rows[0].length + 1) * px;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// the kiosk

/** Clear spans of a face's panels between the corner posts: [centre along, width] per panel, and mullion centres. */
export function panelLayout(s: KioskSpec, f: FaceName): {panels: [number, number][]; mullions: number[]} {
  const L = faceLength(s, f), clear = L - 2 * s.post, ps = s.faces[f].panels;
  if (!ps.length) return {panels: [], mullions: []};
  const free = clear - (ps.length - 1) * s.mullion, tot = ps.reduce((a, p) => a + p.width, 0);
  if (free <= 0) throw Error(`face ${f}: mullions fill the face`);
  let u = -clear / 2;
  const panels: [number, number][] = [], mullions: number[] = [];
  ps.forEach((p, i) => {
    const w = free * p.width / tot;
    panels.push([u + w / 2, w]);
    u += w;
    if (i < ps.length - 1) {mullions.push(u + s.mullion / 2); u += s.mullion;}
  });
  return {panels, mullions};
}

export function buildKiosk(s: KioskSpec): KioskPart[] {
  const parts: KioskPart[] = [];
  const add = (role: KioskRole, g: BufferGeometry) => parts.push({role, geometry: g});
  const floor = s.trailer?.floor ?? 0;
  const W = s.width, D = s.depth, H = s.wallHeight;
  if (H <= floor + s.baseRail + s.headRail + 0.3) throw Error('wallHeight too low');
  const recess = 0.06, infill = 0.03;

  // base: plinth (glass/herring), deck + hull (flower stall), chassis + wheels + drawbar (trailer)
  if (s.plinth > 0) add('plinth', new BoxGeometry(W, s.plinth, D).translate(0, s.plinth / 2, 0));
  const base = Math.max(s.plinth, floor);
  if (s.trailer) {
    const t = s.trailer;
    add('chassis', new BoxGeometry(W * 0.9, 0.12, D * 0.8).translate(0, floor - 0.06, 0));
    for (const x of t.wheelsAt) for (const z of [-1, 1]) {
      const wheel = new CylinderGeometry(t.wheelRadius, t.wheelRadius, 0.18, 12).rotateX(Math.PI / 2);
      add('wheel', wheel.translate(x, t.wheelRadius, z * (D / 2 - 0.12)));
    }
    // A-frame drawbar towards -X, its two arms meeting at the hitch on a jockey wheel stand
    const hitch: [number, number, number] = [-W / 2 - t.drawbar, floor - 0.25, 0];
    for (const z of [-1, 1]) add('chassis', beam([-W / 2 + 0.05, floor - 0.08, z * D * 0.32], hitch, 0.07));
    add('chassis', new BoxGeometry(0.06, floor - 0.25, 0.06).translate(hitch[0] + 0.15, (floor - 0.25) / 2, 0));
  }
  if (s.stall) {
    const st = s.stall, o = st.hullOverhang;
    add('hull', new BoxGeometry(W + 2 * o, st.hullDepth, D + 2 * o).translate(0, -st.hullDepth / 2 - 0.02, 0));
    add('deck', new BoxGeometry(W + 2 * o, 0.06, D + 2 * o).translate(0, 0.01, 0));
  }

  // corner posts
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    add('frame', new BoxGeometry(s.post, H - base, s.post).translate(sx * (W / 2 - s.post / 2), (base + H) / 2, sz * (D / 2 - s.post / 2)));

  for (const f of FACES) {
    const face = s.faces[f];
    const L = faceLength(s, f), clear = L - 2 * s.post;
    const open = s.stall?.openFace === f;
    // rails across the clear length (the open stall front keeps only its head beam)
    if (!open) add('frame', faceBox(s, f, 0, clear, base, base + s.baseRail, -s.frameDepth, 0));
    add('frame', faceBox(s, f, 0, clear, H - s.headRail, H, -s.frameDepth, 0));
    if (open) continue;
    const {panels, mullions} = panelLayout(s, f);
    for (const m of mullions) add('frame', faceBox(s, f, m, s.mullion, base + s.baseRail, H - s.headRail, -s.frameDepth, 0));
    const y0 = base + s.baseRail, y1 = H - s.headRail;
    face.panels.forEach((p, i) => {
      const [c, w] = panels[i];
      const back = -recess - infill, front = -recess;
      if (p.kind === 'glass' || p.kind === 'solid') add(p.kind, faceBox(s, f, c, w, y0, y1, back, front));
      else if (p.kind === 'door') {
        add('glass', faceBox(s, f, c, w, y0, y1, back, front));
        // door stiles stand 5 cm proud of the glass, inside the frame depth
        add('door', faceBox(s, f, c, w, y0 + (y1 - y0) * 0.42, y0 + (y1 - y0) * 0.42 + 0.08, front, front + 0.05));
        add('door', faceBox(s, f, c + w * 0.36, 0.04, y0 + 0.9, y0 + 1.25, front + 0.05, front + 0.1));
      } else if (p.kind === 'board') {
        add('board', faceBox(s, f, c, w, y0, y1, back, front));
        // vertical battens every ~0.3 m, 5 cm proud of the boards
        const n = Math.max(1, Math.round(w / 0.3));
        for (let k = 1; k < n; k++) add('frame', faceBox(s, f, c - w / 2 + w * k / n, 0.035, y0, y1, front, front + 0.05));
      } else if (p.kind === 'louvre') {
        add('solid', faceBox(s, f, c, w, y0, y1, back, front));
        const from = Math.max(y0, Math.min(y1, p.louvreFrom ?? y0));
        const n = Math.floor((y1 - from) / 0.09);
        for (let k = 0; k < n; k++) add('frame', faceBox(s, f, c, w - 0.04, from + k * 0.09 + 0.02, from + k * 0.09 + 0.055, front, front + 0.05));
      } else if (p.kind === 'grille') {
        add('void', faceBox(s, f, c, w, y0, y1, -0.4, -0.37));
        const n = Math.max(2, Math.round(w / 0.11));
        for (let k = 0; k < n; k++) add('strut', faceBox(s, f, c - w / 2 + (k + 0.5) * w / n, 0.025, y0, y1, -0.05, -0.02));
      } else if (p.kind === 'hatch') {
        const h = s.hatch;
        if (!h || h.face !== f) throw Error(`hatch panel on ${f} without a matching hatch spec`);
        add('board', faceBox(s, f, c, w, y0, h.sill, back, front));
        add(h.aboveRole ?? 'board', faceBox(s, f, c, w, h.head, y1, back, front));
        // the opening: a dark interior set 0.25 m back, with reveals
        add('void', faceBox(s, f, c, w, h.sill, h.head, -0.35, -0.25));
        for (const side of [-1, 1]) add('frame', faceBox(s, f, c + side * (w / 2 - 0.02), 0.04, h.sill, h.head, -0.25, 0));
        add('counter', faceBox(s, f, c, w + 0.1, h.sill - 0.05, h.sill, -0.25, h.counterDepth));
        if (h.vitrine) add('glass', faceBox(s, f, c, w - 0.1, h.sill, h.sill + h.vitrine.height, -Math.min(0.2, h.vitrine.depth / 2), h.vitrine.depth / 2));
        hatchCover(s, f, c, w, h, add);
      }
      for (const l of lines(p.lettering)) for (const g of letteringParts(s, f, {...l, along: c + (l.along ?? 0)}, front)) add(l.role ?? 'lettering', g);
    });
  }

  if (s.stall) stallFront(s, add);
  roof(s, add);
  for (const sign of s.signs ?? []) {
    const f = sign.face;
    if (sign.proud < 0.05) throw Error('sign boards stand at least 5 cm proud');
    const top = sign.bottom + sign.height;
    const front = sign.mount === 'roof' ? overhangOf(s) : sign.proud;
    add('sign', faceBox(s, f, sign.along, sign.width, sign.bottom, top, front - 0.04, front));
    for (const l of lines(sign.lettering)) for (const g of letteringParts(s, f, {...l, along: sign.along + (l.along ?? 0)}, front)) add(l.role ?? 'lettering', g);
  }
  return parts;
}

const lines = (l?: KioskLettering | KioskLettering[]) => l === undefined ? [] : Array.isArray(l) ? l : [l];

function overhangOf(s: KioskSpec) { return s.roof.overhang + 0.05; }

function hatchCover(s: KioskSpec, f: FaceName, c: number, w: number, h: KioskHatch, add: (r: KioskRole, g: BufferGeometry) => void) {
  if (h.cover === 'flap') {
    // the hatch door, hinged at the head, swung up and out; two struts from the wall to its outer edge
    const a = (h.flapAngleDeg ?? 75) * Math.PI / 180, len = h.head - h.sill;
    const tipY = h.head - Math.cos(a) * len, tipO = 0.06 + Math.sin(a) * len;
    const corners: [number, number, number][] = [[c - w / 2, h.head, 0.06], [c + w / 2, h.head, 0.06], [c + w / 2, tipY, tipO], [c - w / 2, tipY, tipO]];
    add('flap', slab(s, f, corners, 0.04, [0, Math.sin(a), -Math.cos(a)]));
    for (const side of [-1, 1]) {
      const g = faceStrut(s, f, [c + side * (w / 2 - 0.08), h.head - 0.45, 0.02], [c + side * (w / 2 - 0.08), tipY - 0.01, tipO - 0.06], 0.03);
      add('strut', g);
    }
  } else if (h.cover === 'awning') {
    const d = h.awningDepth ?? 0.8, drop = h.awningDrop ?? 0.35, val = h.valance ?? 0.18, n = Math.max(1, h.stripes ?? 1);
    const top = h.head + 0.15;
    for (let k = 0; k < n; k++) {
      const a0 = c - w / 2 - 0.05 + (w + 0.1) * k / n, a1 = c - w / 2 - 0.05 + (w + 0.1) * (k + 1) / n;
      const role: KioskRole = k % 2 ? 'awningStripe' : 'awning';
      add(role, slab(s, f, [[a0, top, 0.06], [a1, top, 0.06], [a1, top - drop, 0.06 + d], [a0, top - drop, 0.06 + d]], 0.02, [0, 1, 0]));
      add(role, faceBox(s, f, (a0 + a1) / 2, a1 - a0, top - drop - val, top - drop + 0.01, d + 0.04, d + 0.08));
    }
  }
}

function stallFront(s: KioskSpec, add: (r: KioskRole, g: BufferGeometry) => void) {
  const st = s.stall!, f = st.openFace, L = faceLength(s, f), clear = L - 2 * s.post;
  // tiered display benches rising away from the open front, each carrying blooms in four colours
  const blooms: KioskRole[] = ['bloomA', 'bloomB', 'bloomC', 'bloomD'];
  for (let t = 0; t < st.tiers; t++) {
    const o1 = -0.15 - t * st.tierDepth, o0 = o1 - st.tierDepth, y = 0.45 + t * st.tierRise;
    add('display', faceBox(s, f, 0, clear - 0.1, 0.04, y, o0, o1));
    const n = Math.max(2, Math.round(clear / 0.55));
    for (let k = 0; k < n; k++) {
      const a = -clear / 2 + (k + 0.5) * clear / n;
      add(blooms[(k + t) % 4], faceBox(s, f, a, clear / n * 0.8, y, y + 0.22, o0 + 0.06, o1 - 0.06));
    }
  }
  // buckets on the deck in front of the stall, under the fascia
  const n = Math.max(2, Math.round(clear / 0.7));
  for (let k = 0; k < n; k++) {
    const a = -clear / 2 + (k + 0.5) * clear / n;
    add('display', faceBox(s, f, a, 0.32, 0.04, 0.34, 0.05, 0.37));
    add(blooms[(k + 2) % 4], faceBox(s, f, a, 0.4, 0.34, 0.62, 0.01, 0.41));
  }
}

function faceStrut(s: KioskSpec, f: FaceName, a: [number, number, number], b: [number, number, number], r: number) {
  const g = beam(a, b, r);
  g.translate(0, 0, faceOffset(s, f));
  g.rotateY(FACE_ANGLE[f]);
  return g;
}

/** A square bar between two points (kiosk-local, or face-local before the face transform). */
function beam(a: [number, number, number], b: [number, number, number], r: number): BufferGeometry {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l = Math.hypot(dx, dy, dz);
  const g = new BoxGeometry(r, l, r);
  const m = new Matrix4();
  const dir = [dx / l, dy / l, dz / l];
  // rotate +Y onto dir
  const ax = [dir[2], 0, -dir[0]], al = Math.hypot(ax[0], ax[2]), ang = Math.acos(Math.max(-1, Math.min(1, dir[1])));
  if (al > 1e-9) m.makeRotationAxis(new Vector3(ax[0] / al, 0, ax[2] / al), ang);
  else if (dir[1] < 0) m.makeRotationX(Math.PI);
  g.applyMatrix4(m);
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
}

function roof(s: KioskSpec, add: (r: KioskRole, g: BufferGeometry) => void) {
  const r = s.roof, W = s.width, D = s.depth, H = s.wallHeight;
  if (r.kind === 'flat') {
    add('fascia', new BoxGeometry(W + 2 * r.overhang, r.thickness, D + 2 * r.overhang).translate(0, H + r.thickness / 2, 0));
    if (r.upstand) add('roof', new BoxGeometry(W + 2 * r.overhang - 2 * r.upstand.inset, r.upstand.height, D + 2 * r.overhang - 2 * r.upstand.inset).translate(0, H + r.thickness + r.upstand.height / 2, 0));
    return;
  }
  if (r.kind === 'barrel') {
    const n = r.segments ?? 6, w2 = W / 2 + r.overhang, d2 = D / 2 + r.overhang, t = 0.05;
    // a low arch across the depth (trailer roofs curve side to side), extruded along the width
    const prof = (k: number): [number, number] => {const a = Math.PI * k / n; return [-Math.cos(a) * d2, H + Math.sin(a) * r.rise];};
    const tris: number[] = [];
    const quad = (p: number[][]) => {for (const i of [0, 1, 2, 0, 2, 3]) tris.push(...p[i]);};
    for (let k = 0; k < n; k++) {
      const [z0, y0] = prof(k), [z1, y1] = prof(k + 1);
      quad([[-w2, y0 + t, z0], [-w2, y1 + t, z1], [w2, y1 + t, z1], [w2, y0 + t, z0]]); // top (re-wound below)
      for (const x of [-w2, w2]) {
        // end caps: the arch segment and the wedge down to the eave line
        quad([[x, y0, z0], [x, y1, z1], [x, y1 + t, z1], [x, y0 + t, z0]]);
        for (const i of [0, 1, 2]) tris.push(...[[x, H, 0], [x, y0, z0], [x, y1, z1]][i]);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(tris, 3));
    add('roof', windOutward(g, [0, H - 0.5, 0]));
    // the ceiling the arch springs from
    add('fascia', new BoxGeometry(W + 2 * r.overhang, 0.06, D + 2 * r.overhang).translate(0, H - 0.03 + 0.001, 0));
    return;
  }
  // gable / hip with eaves; ridge along the width (gable ends left/right) or the depth (gable ends front/back)
  const along = r.ridge === 'width', a = (along ? W : D) / 2 + r.overhang, b = (along ? D : W) / 2 + r.overhang;
  const y0 = H + r.eaveThickness, y1 = y0 + r.rise;
  const ridgeHalf = r.kind === 'hip' ? Math.max(0, a - b) : a;
  const P = (x: number, y: number, z: number) => along ? [x, y, z] : [z, y, x];
  const v = {
    e00: P(-a, y0, -b), e10: P(a, y0, -b), e11: P(a, y0, b), e01: P(-a, y0, b),
    r0: P(-ridgeHalf, y1, 0), r1: P(ridgeHalf, y1, 0),
  };
  const tri: number[][] = [
    v.e01, v.e11, v.r1, v.e01, v.r1, v.r0, // slope towards +b
    v.e10, v.e00, v.r0, v.e10, v.r0, v.r1, // slope towards -b
    v.e00, v.e01, v.r0, v.e11, v.e10, v.r1, // ends (hip triangles or gable triangles)
    v.e00, v.e10, v.e11, v.e00, v.e11, v.e01, // soffit (faces down)
  ];
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(tri.flat(), 3));
  add('roof', windOutward(g, [0, (y0 + y1) / 2 - 0.01, 0]));
  // eave board: a thin closed slab under the roof edge all round
  add('fascia', new BoxGeometry(along ? 2 * a : 2 * b, r.eaveThickness, along ? 2 * b : 2 * a).translate(0, H + r.eaveThickness / 2, 0));
}

function windOutward(g: BufferGeometry, c: [number, number, number]) {
  const p = g.getAttribute('position').array as Float32Array;
  for (let i = 0; i < p.length; i += 9) {
    const ux = p[i + 3] - p[i], uy = p[i + 4] - p[i + 1], uz = p[i + 5] - p[i + 2], vx = p[i + 6] - p[i], vy = p[i + 7] - p[i + 1], vz = p[i + 8] - p[i + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = (p[i] + p[i + 3] + p[i + 6]) / 3 - c[0], my = (p[i + 1] + p[i + 4] + p[i + 7]) / 3 - c[1], mz = (p[i + 2] + p[i + 5] + p[i + 8]) / 3 - c[2];
    if (nx * mx + ny * my + nz * mz < 0) for (let k = 0; k < 3; k++) {const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t;}
  }
  g.computeVertexNormals();
  return g;
}

/** Triangles of a part list. */
export function triangleCount(parts: KioskPart[]) {
  return parts.reduce((n, p) => n + (p.geometry.index ? p.geometry.index.count : p.geometry.getAttribute('position').count) / 3, 0);
}

/** Build and place: parts in native (x east, z south) metres for a plan centre and front bearing. */
export function placedKiosk(s: KioskSpec, centre: Pt, frontBearingDeg: number): KioskPart[] {
  const m = placement(centre, frontBearingDeg);
  return buildKiosk(s).map(p => ({role: p.role, geometry: p.geometry.applyMatrix4(m)}));
}
