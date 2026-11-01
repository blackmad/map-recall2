import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {local, extrude, frame, onWall, tris, win, balustrade, type Kit, type V2, type Col} from './church-kit';
import {slab, put, poly, letters, ringSlab, awning, segBand, type Frame} from './nearbar-kit';
import source from './doelen-hotel-footprints.json';

/**
 * Doelen Hotel, Nieuwe Doelenstraat 24 (BAG pand 0363100012180410; Rijksmonument; built 1882-83, BAG 1883), on the
 * water where the Kloveniersburgwal meets the Binnen-Amstel. The Kloveniersburgwal front is red brick striped with
 * cream stone: a south wing standing behind a one-storey glazed pavilion (striped awnings, a terrace balustrade on its
 * roof), a corner-less tower in the middle (arched ground window, carved cartouches round an oculus, the DOELEN HOTEL
 * lettering, a balcony, a clock between two standing militiamen, a curved gable and a slate dome with an open lantern),
 * and a north wing with an arcade of round-arched ground windows, a pilastered bay carrying a balcony, a console frieze,
 * a zigzag of small gables, a mansard with dormers and a tall mansard pavilion on the rounded Nieuwe Doelenstraat
 * corner. Wrought-iron anchors (fleurs) sit between the second- and third-floor windows. The Nieuwe Doelenstraat side
 * is plainer dark brick over a grey stone ground storey with the entrance under a stone bay.
 *
 * Local frame (church-kit `local`): x along the BAG Kloveniersburgwal front from the south (Amstel) corner towards the
 * rounded north corner, y up from the quay, z out of the front towards the water; the building is z <= ~0.5. Heights and
 * openings of the north wing and the tower were read on the 2025-07-03 Gemeente Amsterdam panorama
 * recording_2025-07-03_03-29-47_03471 rectified onto the BAG front with a metre grid (cross-checked on the 2023-02-27
 * winter view TMX7316010203-002981_pano_0001_000003); the south wing (behind the pavilion) shares their storey lines,
 * read on the Commons photographs; massing behind the front from 3DBAG (doelen-hotel-footprints.json).
 * Inventory: doelen-hotel-inventory.json.
 */
export const AXIS_DEG = source.axisDeg;
export const ORIGIN: V2 = source.origin as V2;

const T0 = 20.2, T1 = 26.6, TC = (T0 + T1) / 2, TZ = 0.4; // tower span along the front and its front plane
const LZ = -4.0; // south wing face, behind the pavilion
const PAV = 5.2; // pavilion roof
const WALL = 21.6, ROOF = 24.3; // north wing parapet; the flat roofs and the south wing attic top (3DBAG)

/** Storey lines (heights above the quay), measured on the north wing. */
export const Y = {
  plinth: 1.0, g0: 2.1, g1: 4.5, cornice: 5.2,
  f1: [6.4, 9.2], band: 9.8, balc: 10.0, f2: [10.9, 13.2], fleur: 13.6, f3: [14.0, 16.4], frieze: 16.9, f4: [18.3, 20.2],
  zig: 20.45, dormer: [21.95, 23.35],
} as const;
/** Window axes: south wing (on its set-back face) and north wing. */
export const LEFT = [2.85, 5.95, 9.05, 12.15, 15.25, 18.35];
export const RIGHT = [28.1, 31.0, 33.9, 36.9, 39.85, 42.8];
/** Pilasters of the north wing's bay (between the window axes) and its span. */
const BAY = {t0: 29.2, t1: 38.75, cols: [29.55, 32.45, 35.4, 38.4], out: 0.5};

const sphere = (r: number, sx = 1, sy = 1, sz = 1, w = 8, h = 6) => new T.SphereGeometry(r, w, h).scale(sx, sy, sz);

/** Sutherland-Hodgman clip of a ring to a half-plane a*x + b*z <= c. */
function clipHalf(ring: V2[], a: number, b: number, c: number): V2[] {
  const out: V2[] = [], f = (p: V2) => a * p[0] + b * p[1] - c;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], fp = f(p), fq = f(q);
    if (fp <= 0) out.push(p);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) { const u = fp / (fp - fq); out.push([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]); }
  }
  return out;
}

export function buildDoelenHotel(_w: number, _d: number, b: BuildingTools) {
  const k: Kit = local(b, AXIS_DEG, ORIGIN);
  const bag = (source.pands['0363100012180410'].ringLocal as number[][]).slice(0, -1).map(p => [p[0], p[1]] as V2);
  // The Nieuwe Doelenstraat edge of the BAG ring jogs up to 0.11 m either side of its a-c line; trim it to that line so
  // the street-side skin (below) sits on one plane.
  const NA: V2 = [44.383, -7.881], NC: V2 = [8.881, -25.756], NL = Math.hypot(NC[0] - NA[0], NC[1] - NA[1]);
  const NN: V2 = [-(NC[1] - NA[1]) / NL, (NC[0] - NA[0]) / NL];
  const ring = clipHalf(bag, NN[0], NN[1], NN[0] * NA[0] + NN[1] * NA[1]);
  const F = frame([0, 0], [0, 1]), FL = frame([0, LZ], [0, 1]), FT = frame([0, TZ], [0, 1]);
  const S = (f: Frame, t: number, y: number, w: number, h: number, d: number, c: Col, out = 0) => onWall(k, f, t, y, w, h, d, c, out);
  const P = (f: Frame, g: T.BufferGeometry, t: number, y: number, out: number, c: Col) => put(k, f, g, t, y, out, c);
  const up = (_c: T.Vector3, n: T.Vector3) => n.y > 0;

  // ---------------------------------------------------------------- masses
  const xmax = (r: V2[], x: number) => clipHalf(r, 1, 0, x), xmin = (r: V2[], x: number) => clipHalf(r, -1, 0, -x);
  const zmax = (r: V2[], z: number) => clipHalf(r, 0, 1, z), zmin = (r: V2[], z: number) => clipHalf(r, 0, -1, -z);
  const rect = (x0: number, x1: number, z0: number, z1: number): V2[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const C0 = 41.6; // the corner mansard pavilion starts here
  // pavilion: in front of the south wing, bounded by the Amstel flank (line through (0,0) and (2.95,-8.92))
  const pavilion = clipHalf(rect(0, T0, LZ, 0), -8.92, -2.95, 0);
  extrude(k, pavilion, 0, PAV, 'brick');
  const south = zmax(xmax(ring, T0), LZ);
  extrude(k, zmin(south, -10.7), 0, ROOF, 'brick'); // the south wing carries a cream attic storey over its gablets
  extrude(k, zmax(south, -10.7), 0, ROOF, 'brick');
  extrude(k, rect(T0, T1, -7.6, TZ), 0, 22.4, 'brick'); // tower shaft
  extrude(k, zmax(xmin(xmax(ring, T1), T0), -7.6), 0, ROOF, 'brick'); // behind the tower
  extrude(k, rect(T1, C0, -2.6, 0), 0, WALL, 'brick'); // north wing front range, under the mansard slope
  extrude(k, zmax(xmax(xmin(ring, T1), C0), -2.6), 0, ROOF, 'brick'); // the attic and the wing behind
  const corner = zmax(xmin(ring, C0), 0);
  extrude(k, corner, 0, WALL, 'brick');
  for (const r of [zmax(south, -10.7), zmax(xmin(xmax(ring, T1), T0), -7.6), zmax(xmax(xmin(ring, T1), C0), -2.6)]) extrude(k, r, ROOF, ROOF + 0.12, 'slate');
  extrude(k, zmin(south, -10.7), ROOF, ROOF + 0.12, 'slate');
  extrude(k, pavilion, PAV, PAV + 0.12, 'slate');
  // mansard slope of the north wing, tower to the corner pavilion
  tris(k, [[[T1, WALL, 0], [C0, WALL, 0], [C0, ROOF, -2.6]], [[T1, WALL, 0], [C0, ROOF, -2.6], [T1, ROOF, -2.6]]], 'slate', up);

  // ---------------------------------------------------------------- polychrome courses and window surrounds
  const courses = (f: Frame, t0: number, t1: number, ys: number[], h = 0.22) => { for (const y of ys) S(f, (t0 + t1) / 2, y, t1 - t0, h, 0.08, 'stone'); };
  /** Cream stripes in the brick piers between window surrounds (speklagen), two per storey. */
  const piers = (f: Frame, axes: number[], t0: number, t1: number, w: number, rows: readonly (readonly [number, number])[]) => {
    const edges = [t0, ...axes.flatMap(a => [a - w / 2 - 0.25, a + w / 2 + 0.25]), t1];
    for (let i = 0; i + 1 < edges.length; i += 2) {
      const a = edges[i], c = edges[i + 1];
      if (c - a < 0.3) continue;
      for (const [y0, y1] of rows) for (const u of [0.33, 0.7]) S(f, (a + c) / 2, y0 + (y1 - y0) * u, c - a, 0.16, 0.06, 'stone');
    }
  };
  const ROWS = [Y.f1, Y.f2, Y.f3, Y.f4] as const;
  const window = (f: Frame, t: number, [y0, y1]: readonly [number, number], w = 1.3) => {
    win(k, f, t, {w, y0, y1, head: 'flat', bars: 1, rowM: 1.1, surround: 'white', bar: 'white', sill: 'stone'});
    S(f, t, y1 + 0.22, w + 0.7, 0.18, 0.16, 'stone'); // cornice hood
    S(f, t, y1 + 0.4, 0.34, 0.42, 0.14, 'stone'); // keystone block
  };

  // ---------------------------------------------------------------- north wing (Kloveniersburgwal)
  courses(F, T1, 43.85, [Y.cornice, Y.band, Y.f2[0] - 0.4, Y.f3[0] - 0.42, Y.f4[0] - 0.4]);
  piers(F, RIGHT, T1, 43.85, 1.3, ROWS);
  S(F, (T1 + 43.85) / 2, 0, 43.85 - T1, Y.plinth, 0.1, 'stone');
  for (const t of RIGHT) for (const r of ROWS) window(F, t, r, t === 42.8 ? 1.2 : 1.3);
  // ground floor: round-arched windows over balustered panels, one square-headed window by the corner
  for (const t of RIGHT) {
    if (t === 42.8) { win(k, F, t, {w: 1.2, y0: Y.g0, y1: Y.g1, head: 'flat', bars: 1, rowM: 1.2, surround: 'white', bar: 'white', sill: 'stone'}); continue; }
    win(k, F, t, {w: 1.4, y0: Y.g0, y1: Y.g1, head: 'round', bars: 1, rowM: 1.2, surround: 'white', bar: 'white', sill: 'stone', seg: 6});
    S(F, t, Y.plinth + 0.05, 1.6, 0.9, 0.06, 'stone');
    for (let j = -2; j <= 2; j++) S(F, t + j * 0.28, Y.plinth + 0.12, 0.12, 0.7, 0.12, 'stone');
  }
  // the pilastered bay: columns from the plinth to an entablature, balcony on top
  for (const t of BAY.cols) {
    S(F, t, 0, 0.5, Y.band, BAY.out, 'stone');
    P(F, sphere(0.2, 1.4, 1, 1), t, Y.band - 0.6, BAY.out, 'stone'); // carved capital
  }
  S(F, (BAY.t0 + BAY.t1) / 2, Y.band - 0.2, BAY.t1 - BAY.t0, 0.4, BAY.out + 0.1, 'stone');
  k.add(new T.BoxGeometry(BAY.t1 - BAY.t0, 0.2, 1.0), 'stone', (BAY.t0 + BAY.t1) / 2, Y.balc + 0.1, 0.45);
  balustrade(k, F, BAY.t0, BAY.t1, Y.balc + 0.2, {h: 0.85, out: 0.55});
  // console frieze, zigzag of small gables, parapet
  frieze(F, T1, 43.85);
  zigzag(F, T1, 43.85, RIGHT);
  // dormers in the mansard (front 0.5 m behind the parapet, standing on the slope)
  {
    const z = -0.5, Fd = frame([0, z], [0, 1]), y0 = 22.3, y1 = 23.4;
    for (const t of RIGHT.slice(0, 5)) {
      k.add(new T.BoxGeometry(1.4, 23.9 - 21.9, 1.6), 'stone', t, (21.9 + 23.9) / 2, z - 0.8);
      win(k, Fd, t, {w: 0.85, y0, y1, head: 'flat', bars: 1, rowM: 1.2, surround: 'white', bar: 'white', sill: 'stone'});
      poly(k, Fd, t, 23.9, [[-0.8, 0], [0.8, 0], [0, 0.5]], 1.6, 'stone', -1.6);
    }
  }

  // ---------------------------------------------------------------- south wing (behind the pavilion)
  courses(FL, 1.35, T0, [Y.band, Y.f2[0] - 0.4, Y.f3[0] - 0.42, Y.f4[0] - 0.4]);
  piers(FL, LEFT, 1.35, T0, 1.3, ROWS.slice(1));
  S(FL, (1.35 + T0) / 2, PAV + 0.1, T0 - 1.35, Y.band - PAV - 0.1, 0.05, 'stone'); // the first floor over the pavilion is all cream ashlar
  const FL5 = frame([0, LZ + 0.05], [0, 1]); // face of the cream ashlar skins (first floor, attic)
  for (const t of LEFT) for (const r of ROWS) window(r === Y.f1 ? FL5 : FL, t, r);
  frieze(FL, 1.35, T0);
  zigzag(FL, 1.35, T0, LEFT);
  // attic storey: cream wall over the gablets with six windows and a cornice
  S(FL, (1.35 + T0) / 2, WALL, T0 - 1.35, ROOF - WALL - 0.3, 0.05, 'stone');
  for (const t of LEFT) win(k, FL5, t, {w: 1.1, y0: 22.0, y1: 23.5, head: 'flat', bars: 1, rowM: 1.5, surround: 'white', bar: 'white', sill: 'stone'});
  S(FL, (1.35 + T0) / 2, ROOF - 0.35, T0 - 1.35, 0.35, 0.25, 'stone');
  // two balconies on carved consoles, over the outer pairs of bays
  for (const [a, c] of [[LEFT[0], LEFT[1]], [LEFT[4], LEFT[5]]]) {
    const t0 = a - 1.1, t1 = c + 1.1;
    k.add(new T.BoxGeometry(t1 - t0, 0.2, 1.0), 'stone', (t0 + t1) / 2, Y.balc + 0.1, LZ + 0.5);
    balustrade(k, FL, t0, t1, Y.balc + 0.2, {h: 0.85, out: 0.55});
    for (const t of [t0 + 0.3, (t0 + t1) / 2, t1 - 0.3]) { S(FL, t, Y.balc - 0.7, 0.3, 0.7, 0.75, 'stone'); P(FL, sphere(0.18, 1, 1.4, 1), t, Y.balc - 0.75, 0.55, 'stone'); }
  }
  // wrought-iron anchors (fleurs) between the second- and third-floor windows, both wings
  for (const [f, axes] of [[FL, LEFT], [F, RIGHT]] as const) {
    for (let i = 0; i + 1 < axes.length; i++) fleur(f, (axes[i] + axes[i + 1]) / 2, Y.fleur);
  }

  // ---------------------------------------------------------------- pavilion (glazed, striped awnings, terrace)
  {
    const t0 = 0.6, t1 = T0 - 0.3, n = 6, w = (t1 - t0) / n;
    S(F, (t0 + t1) / 2, 0, t1 - t0, 1.1, 0.1, 'stone');
    for (let i = 0; i < n; i++) {
      const t = t0 + w * (i + 0.5);
      S(F, t, 1.15, w - 0.36, 2.5, 0.06, 'glass');
      S(F, t, 2.9, w - 0.36, 0.06, 0.1, 'white');
      for (const u of [-1, 1]) S(F, t + u * w / 6, 1.15, 0.08, 2.5, 0.1, 'white');
      const m = 4, sw = (w - 0.1) / m; // awning valance: alternating red and cream stripes
      for (let j = 0; j < m; j++) awning(k, F, t - (w - 0.1) / 2 + sw * (j + 0.5), 3.85, sw, 0.55, 0.7, j % 2 ? 'ochre' : 'red');
    }
    for (let i = 0; i <= n; i++) S(F, t0 + w * i, 1.1, 0.36, 2.75, 0.14, 'white');
    S(F, (t0 + t1) / 2, 4.5, t1 - t0 + 0.4, 0.7, 0.16, 'stone');
    balustrade(k, F, t0, t1, PAV + 0.12, {h: 0.9, out: -0.35});
  }

  // ---------------------------------------------------------------- tower
  {
    const W = T1 - T0;
    for (const s of [-1, 1]) S(FT, TC + s * (W / 2 - 0.39), 0, 0.7, 22.4, 0.12, 'stone'); // pilaster strips, 4 cm in from the tower's corners
    S(FT, TC, 0, W - 1.4, 1.65, 0.1, 'stone');
    win(k, FT, TC, {w: 1.4, y0: 1.9, y1: 4.4, head: 'round', bars: 1, rowM: 1.2, surround: 'white', bar: 'white', sill: 'stone', seg: 6});
    S(FT, TC, Y.cornice, W, 0.6, 0.2, 'stone');
    // carved cartouches: the oculus in a scrolled frame and a round medallion either side
    S(FT, TC, 5.9, W - 1.4, 3.6, 0.06, 'stone');
    ringSlab(k, FT, TC, 7.6, 0.45, 0.95, 0.2, 'stone', 0.02, 18);
    P(FT, new T.CylinderGeometry(0.46, 0.46, 0.08, 16).rotateX(Math.PI / 2), TC, 7.6, 0.08, 'slate'); // the oculus: dark leaded glass read as a disc, not a window
    for (const [dx, dy, r] of [[0, 1.2, 0.3], [0, -1.15, 0.25], [-1.05, 0.5, 0.22], [1.05, 0.5, 0.22], [-1.0, -0.7, 0.2], [1.0, -0.7, 0.2]] as const) P(FT, sphere(r, 1.2, 1, 0.6), TC + dx, 7.6 + dy, 0.12, 'stone');
    for (const s of [-1, 1]) {
      ringSlab(k, FT, TC + s * 2.25, 7.4, 0.25, 0.62, 0.18, 'stone', 0.02, 16);
      P(FT, sphere(0.26, 1, 1, 0.7), TC + s * 2.25, 7.4, 0.1, 'stone');
    }
    courses(FT, T0 + 0.7, T1 - 0.7, [Y.band, Y.f2[0] - 0.4, Y.f3[0] - 0.42]);
    for (const r of [Y.f2, Y.f3]) window(FT, TC, r, 1.2);
    // frieze with the lettering, the balcony, the clock between two militiamen, the curved gable
    S(FT, TC, Y.frieze, W, 0.9, 0.2, 'stone');
    letters(k, FT, 'DOELEN HOTEL', TC, Y.frieze + 0.12, 0.19, 0.065, 0.06, 'frame', 0.09);
    k.add(new T.BoxGeometry(W - 0.6, 0.2, 0.9), 'stone', TC, 17.9, TZ + 0.4);
    balustrade(k, FT, T0 + 0.4, T1 - 0.4, 18.1, {h: 0.75, out: 0.45});
    S(FT, TC, 18.85, 2.0, 2.3, 0.1, 'stone');
    ringSlab(k, FT, TC, 19.9, 0.62, 0.82, 0.16, 'stone', 0.06, 20);
    P(FT, new T.CylinderGeometry(0.62, 0.62, 0.08, 20).rotateX(Math.PI / 2), TC, 19.9, 0.14, 'white');
    S(FT, TC, 19.86, 0.07, 0.45, 0.2, 'gold', 0.14);
    S(FT, TC - 0.12, 19.86, 0.3, 0.07, 0.21, 'gold', 0.14);
    for (const s of [-1, 1]) militiaman(FT, TC + s * 1.55, 18.85, 0.55);
    segBand(k, FT, TC, 21.1, W - 0.4, 1.3, 0.3, 0.3, 'stone', 0);
    poly(k, FT, TC, 21.1, segment(W - 0.7, 1.15), 0.12, 'stone', 0);
    P(FT, sphere(0.35, 1.4, 1, 0.6), TC, 21.6, 0.14, 'stone');
    S(FT, TC, 21.0, W + 0.1, 0.25, 0.3, 'stone');
    // drum, slate dome with zinc ribs, open lantern, cap and finial (3DBAG lantern top 31.6 m NAP)
    const dc: V2 = [TC, -3.6];
    k.add(new T.CylinderGeometry(3.1, 3.1, 0.9, 16), 'stone', dc[0], 22.85, dc[1]);
    const prof: [number, number][] = [[3.0, 0], [3.05, 0.6], [2.9, 1.6], [2.55, 2.7], [2.0, 3.7], [1.4, 4.4], [1.0, 4.8], [0.9, 5.0]];
    k.add(new T.LatheGeometry(prof.map(([r, y]) => new T.Vector2(r, y)), 16), 'slate', dc[0], 23.3, dc[1]);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      for (let j = 0; j + 1 < prof.length; j++) {
        const [r0, y0] = prof[j], [r1, y1] = prof[j + 1], L = Math.hypot(r1 - r0, y1 - y0);
        const g = new T.BoxGeometry(0.12, L, 0.12).rotateZ(Math.atan2(r1 - r0, y1 - y0) * -1).translate((r0 + r1) / 2 + 0.07, (y0 + y1) / 2, 0).rotateY(a);
        k.add(g, 'concrete', dc[0], 23.3, dc[1]);
      }
    }
    k.add(new T.CylinderGeometry(1.0, 1.0, 0.15, 12), 'concrete', dc[0], 28.35, dc[1]);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; k.add(new T.BoxGeometry(0.16, 1.7, 0.16), 'concrete', dc[0] + 0.8 * Math.cos(a), 29.25, dc[1] + 0.8 * Math.sin(a)); }
    k.add(new T.CylinderGeometry(0.55, 0.55, 1.7, 8), 'slate', dc[0], 29.25, dc[1]);
    k.add(new T.CylinderGeometry(1.0, 1.0, 0.15, 12), 'concrete', dc[0], 30.15, dc[1]);
    k.add(new T.SphereGeometry(0.9, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1), 'concrete', dc[0], 30.2, dc[1]);
    k.add(new T.ConeGeometry(0.06, 1.0, 5), 'bronze', dc[0], 31.3, dc[1]);
  }

  // ---------------------------------------------------------------- rounded north corner and its mansard pavilion
  {
    const FC = frame([47.37, -3.9], [1, 0]);
    for (const r of ROWS) window(FC, 0, r, 1.0);
    win(k, FC, 0, {w: 1.0, y0: Y.g0, y1: Y.g1, head: 'flat', bars: 1, rowM: 1.2, surround: 'white', bar: 'white', sill: 'stone'});
    S(FC, 0, 0, 2.0, Y.plinth, 0.1, 'stone');
    // steep slate frustum from the parapet over the corner plan to a flat top (3DBAG 28.45 NAP)
    const yb = WALL, yt = 27.9, sc = 0.5;
    const cx = corner.reduce((a, p) => a + p[0], 0) / corner.length, cz = corner.reduce((a, p) => a + p[1], 0) / corner.length;
    const top = corner.map(([x, z]) => [cx + (x - cx) * sc, cz + (z - cz) * sc] as V2);
    const faces: number[][][] = [], cap: number[][][] = [];
    for (let i = 0; i < corner.length; i++) {
      const j = (i + 1) % corner.length;
      faces.push([[corner[i][0], yb, corner[i][1]], [corner[j][0], yb, corner[j][1]], [top[j][0], yt, top[j][1]]], [[corner[i][0], yb, corner[i][1]], [top[j][0], yt, top[j][1]], [top[i][0], yt, top[i][1]]]);
      cap.push([[cx, yt, cz], [top[i][0], yt, top[i][1]], [top[j][0], yt, top[j][1]]]);
    }
    tris(k, faces, 'slate', (c, nn) => nn.x * (c.x - cx) + nn.z * (c.z - cz) > 0);
    tris(k, cap, 'concrete', up);
    // dormer on the water side
    k.add(new T.BoxGeometry(1.4, 2.2, 1.4), 'stone', 42.8, 23.2, -0.6);
    win(k, frame([0, 0.1], [0, 1]), 42.8, {w: 0.85, y0: 22.3, y1: 23.4, head: 'flat', bars: 1, rowM: 1.3, surround: 'white', bar: 'white', sill: 'stone'});
    poly(k, frame([0, 0.1], [0, 1]), 42.8, 24.3, [[-0.8, 0], [0.8, 0], [0, 0.7]], 0.3, 'stone', -0.6);
  }

  // ---------------------------------------------------------------- Nieuwe Doelenstraat side (dark brick over grey stone)
  {
    const a: V2 = [44.383, -7.881], c: V2 = [8.881, -25.756], L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const n: V2 = [-(c[1] - a[1]) / L, (c[0] - a[0]) / L]; // outward (away from the canal side)
    const at = (o: number) => frame([a[0] + n[0] * o, a[1] + n[1] * o], n); // tangent runs a -> c
    const FN = at(0), FN1 = at(0.1);
    // brick and stone skins 0.1 proud of the trimmed edge
    slab(k, FN, L / 2, 4.8, L - 0.6, ROOF - 0.35 - 4.8, 0.1, 'greyBrick', 0);
    slab(k, FN, L / 2, 0, L - 0.6, 4.8, 0.1, 'concrete', 0);
    const e = 19.05; // the entrance bay
    const axes = Array.from({length: 11}, (_, i) => 2.6 + i * 3.25).filter(t => Math.abs(t - e) > 2.4);
    for (const t of axes) {
      win(k, FN1, t, {w: 1.5, y0: 1.2, y1: 3.9, head: 'flat', bars: 1, rowM: 1.4, surround: 'white', bar: 'white', sill: 'concrete'});
      for (const r of ROWS) win(k, FN1, t, {w: 1.35, y0: r[0], y1: r[1], head: 'flat', bars: 1, rowM: 1.1, surround: 'white', bar: 'white', sill: 'stone'});
      win(k, FN1, t, {w: 1.1, y0: 21.7, y1: 23.4, head: 'flat', bars: 1, rowM: 1.2, surround: 'white', bar: 'white', sill: 'stone'});
    }
    for (const y of [4.8, WALL - 0.3]) S(FN1, L / 2, y, L - 0.6, 0.3, 0.16, 'stone');
    S(FN1, L / 2, ROOF - 0.35, L - 0.6, 0.35, 0.25, 'stone');
    S(FN1, e, 0, 2.2, 3.6, 0.06, 'dark');
    S(FN1, e, 0.3, 1.6, 2.7, 0.1, 'glass');
    slab(k, FN1, e, 3.8, 3.6, 0.25, 2.0, 'slate', 0); // canopy
    slab(k, FN1, e, 4.8, 3.4, Y.f2[1] + 0.5 - 4.8, 0.7, 'stone', 0);
    const FB = at(0.8);
    for (const r of [Y.f1, Y.f2]) win(k, FB, e, {w: 2.2, y0: r[0], y1: r[1], head: 'flat', bars: 2, rowM: 1.1, surround: 'white', bar: 'white', sill: 'stone'});
    balustrade(k, FN1, e - 1.7, e + 1.7, Y.f2[1] + 0.5, {h: 0.8, out: 0.0});
    for (const r of [Y.f3, Y.f4]) win(k, FN1, e, {w: 1.35, y0: r[0], y1: r[1], head: 'flat', bars: 1, rowM: 1.1, surround: 'white', bar: 'white', sill: 'stone'});
  }

  // ---------------------------------------------------------------- the Amstel end: cream-rendered flank over the café
  {
    const flank = (p: V2, q: V2, y0: number, y1: number) => {
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]), n: V2 = [(q[1] - p[1]) / L, -(q[0] - p[0]) / L]; // right of p->q: outward
      const f = frame(p, n), sgn = f.tangent[0] * (q[0] - p[0]) + f.tangent[1] * (q[1] - p[1]) > 0 ? 1 : -1;
      slab(k, f, sgn * L / 2, y0, L - 0.1, y1 - y0, 0.08, 'ochre', 0);
    };
    flank([1.32, -4.0], [2.95, -8.92], PAV + 0.12, ROOF);
    flank([2.48, -9.1], [8.881, -25.756], 0, ROOF);
  }

  // ---------------------------------------------------------------- helpers bound to this kit
  function frieze(f: Frame, t0: number, t1: number) {
    // broad carved cream frieze under the top storey: a cartouche boss over every pier, consoles between
    S(f, (t0 + t1) / 2, Y.frieze - 0.25, t1 - t0, 1.3, 0.1, 'stone');
    S(f, (t0 + t1) / 2, Y.frieze + 1.05, t1 - t0, 0.25, 0.32, 'stone');
    for (let t = t0 + 0.35; t < t1 - 0.2; t += 0.75) S(f, t, Y.frieze + 0.35, 0.2, 0.7, 0.22, 'stone');
    for (let t = t0 + 1.5; t < t1 - 0.5; t += 2.95) P(f, sphere(0.32, 1.1, 1, 0.5), t, Y.frieze + 0.4, 0.12, 'stone');
  }
  function zigzag(f: Frame, t0: number, t1: number, axes: number[]) {
    S(f, (t0 + t1) / 2, Y.zig - 0.15, t1 - t0, 0.15, 0.2, 'stone');
    for (const t of axes) {
      const s = 1.35, h = 0.85;
      poly(k, f, t, Y.zig, [[-s, 0], [s, 0], [0, h]], 0.08, 'stone', 0.04);
      poly(k, f, t, Y.zig + 0.15, [[-s + 0.45, 0], [s - 0.45, 0], [0, h - 0.33]], 0.1, 'brick', 0.1);
    }
    S(f, (t0 + t1) / 2, WALL - 0.2, t1 - t0, 0.2, 0.24, 'stone');
  }
  function fleur(f: Frame, t: number, y: number) {
    S(f, t, y - 0.35, 0.07, 0.7, 0.1, 'frame');
    S(f, t - 0.2, y + 0.18, 0.4, 0.07, 0.11, 'frame');
    for (const s of [-1, 1]) P(f, new T.BoxGeometry(0.07, 0.3, 0.06).rotateZ(s * 0.6), t + s * 0.1, y + 0.32, 0.08, 'frame');
  }
  /** A standing militiaman in stone: legs, coat, arms, head under a broad hat, musket at the side. */
  function militiaman(f: Frame, t: number, y: number, s: number) {
    const H = 2.2 * s / 0.55;
    for (const d of [-0.12, 0.12]) P(f, new T.CylinderGeometry(0.08, 0.09, H * 0.42, 6), t + d, y + H * 0.21, 0.35, 'stone');
    P(f, new T.CylinderGeometry(0.2, 0.3, H * 0.36, 8), t, y + H * 0.58, 0.35, 'stone');
    for (const d of [-0.3, 0.3]) P(f, new T.CylinderGeometry(0.07, 0.07, H * 0.3, 6).rotateZ(d > 0 ? -0.15 : 0.15), t + d, y + H * 0.6, 0.38, 'stone');
    P(f, sphere(0.14, 1, 1.1, 1), t, y + H * 0.84, 0.35, 'stone');
    P(f, new T.CylinderGeometry(0.3, 0.3, 0.04, 10), t, y + H * 0.92, 0.35, 'slate');
    P(f, new T.CylinderGeometry(0.12, 0.15, 0.2, 8), t, y + H * 0.97, 0.35, 'slate');
    P(f, new T.BoxGeometry(0.05, H * 0.85, 0.05), t + (t > TC ? 0.38 : -0.38), y + H * 0.45, 0.4, 'frame');
    S(f, t, y - 0.05, 0.8, 0.1, 0.7, 'stone'); // plinth
  }
  function segment(W: number, rise: number): [number, number][] {
    const R = (W * W / 4 + rise * rise) / (2 * rise), pts: [number, number][] = [];
    for (let i = 0; i <= 12; i++) { const x = -W / 2 + W * i / 12; pts.push([x, rise - R + Math.sqrt(R * R - x * x)]); }
    return pts;
  }
}
