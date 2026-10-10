import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {wallsOf} from './worship-walls';
import {poly, put, setSink, slab} from './nearbar-kit';
import type {Frame} from './nearbar-kit';
import source from './ljg-synagoge-footprints.json';

/**
 * LJG synagogue (Liberaal Joodse Gemeente Amsterdam), Zuidelijke Wandelweg 41, BAG 0363100012241744, 2010.
 * A free-standing four-storey grey box (17 x 57 m, 16.7 m) between water on the east and the street on the west.
 * Massing is the 3DBAG LoD2.2 shell; the pale-grey skin carries the building's own signature, measured by eye from the
 * Commons photographs and municipal panoramas in the research record:
 *  - a scatter of white perforation dots that thickens into clouds under the parapet (the dot clouds are generated
 *    from a seeded density field, they imitate the character, not the exact dot positions);
 *  - the glazed hall: a star-shaped cut in the long walls (central glass spike up to the parapet, two lobes, stepped
 *    side arms and a full-height bottom band), with dark mullions and transoms;
 *  - small paired windows in two rows and a three-window ground ribbon in the south half of the long walls, the
 *    glazed entrance at the foot of the west wall and a handful of grey service doors;
 *  - the north end wall: dot cloud plus three lines of dotted Hebrew text (the pattern of word groups is
 *    approximate, the letters are not reproduced).
 * East wall: only an oblique panorama exists, the same hall/window composition is inferred from it. South end wall:
 * no photograph, dots only (inferred).
 */
type Pt = [number, number];
const rng = (seed: number) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const inside = (p: Pt, poly: Pt[]) => { let y = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], c = poly[j]; if ((a[1] > p[1]) !== (c[1] > p[1]) && p[0] < (c[0] - a[0]) * (p[1] - a[1]) / (c[1] - a[1]) + a[0]) y = !y; } return y; };

export function buildLjgSynagoge(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'concrete', roof: 'slate'});
  b.mark?.('shell');
  setSink(0.15);
  const ring = (source as never as {nativeRing: Pt[]}).nativeRing;

  const mk = (a: Pt, c: Pt): {f: Frame; len: number} => {
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]), t: Pt = [(c[0] - a[0]) / len, (c[1] - a[1]) / len];
    return {f: {origin: a, tangent: t, n: [-t[1], t[0]]}, len};
  };
  const walls = wallsOf(source as never);
  /** The 3DBAG wall sits up to ~0.25 m off the BAG ring line; slide each frame onto the long shell wall it faces. */
  const snap = (r: {f: Frame; len: number}) => {
    const cand = walls.filter(w => w.n[0] * r.f.n[0] + w.n[1] * r.f.n[1] > 0.98 && w.length > 10).sort((a, c) => c.length - a.length)[0];
    if (!cand) return r;
    const off = (cand.origin[0] - r.f.origin[0]) * r.f.n[0] + (cand.origin[1] - r.f.origin[1]) * r.f.n[1];
    return {...r, f: {...r.f, origin: [r.f.origin[0] + r.f.n[0] * off, r.f.origin[1] + r.f.n[1] * off] as [number, number]}};
  };
  const WEST = snap(mk(ring[1], ring[2]));      // t from the north end to the south end, viewer's right = south
  const EAST = snap(mk(ring[3], ring[0]));               // south corner towards the north end, viewer's right = north
  const NORTH = snap(mk(ring[0], ring[1]));              // east corner towards the west corner
  const SOUTH = snap(mk(ring[2], ring[3]));              // west corner towards the east corner (approx. end)
  const L = WEST.len;

  // ---- star-shaped hall glazing, from the straight-on photograph (px in the 220% grid crop), t from the north end ----
  const tOf = (dx: number) => (100 + dx / 2.2 - 30) / 27.35;
  const yOf = (dy: number) => (528 - (90 + dy / 2.2)) / 25.5;
  const P = (px: number[][]): Pt[] => px.map(([x, y]) => [+tOf(x).toFixed(2), +yOf(y).toFixed(2)] as Pt);
  const glazing: Pt[][] = [
    P([[195, 118], [320, 120], [590, 222], [682, 42], [758, 42], [768, 240], [1090, 125], [1205, 125], [1205, 235], [1085, 328], [1085, 765], [305, 765], [305, 555], [405, 470], [405, 420], [195, 225]]),
    P([[115, 352], [190, 352], [410, 480], [305, 545], [115, 458]]),
    P([[75, 562], [155, 562], [305, 605], [305, 765], [70, 757]]),
    P([[1040, 380], [1355, 335], [1355, 435], [1095, 545], [1090, 460]]),
    P([[1085, 612], [1280, 560], [1415, 555], [1415, 775], [1085, 765]]),
  ];
  const xOfV = (x: number) => (x - 30) / 27.35;   // photo px -> t for the small windows (v-2 coordinates)
  const winRows: {y: number; h: number; ts: number[]}[] = [
    {y: 12.7, h: 2.3, ts: [35.9, 38.2, 40.9, 43.4, 48.4, 49.7, 52.2]},
    {y: 9.3, h: 2.2, ts: [35.9, 38.2, 42.1, 43.4, 48.4, 49.7, 52.2]},
  ];
  const ribbon: [number, number][] = [[47.95, 2.3], [50.8, 2.6], [53.9, 2.7]];
  void xOfV;

  const clipV = (poly: Pt[], t: number): [number, number][] => {   // intervals of y inside the polygon along x = t
    const ys: number[] = [];
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], c = poly[j];
      if ((a[0] > t) !== (c[0] > t)) ys.push(a[1] + (c[1] - a[1]) * (t - a[0]) / (c[0] - a[0]));
    }
    ys.sort((x, y) => x - y);
    const out: [number, number][] = [];
    for (let k = 0; k + 1 < ys.length; k += 2) out.push([ys[k], ys[k + 1]]);
    return out;
  };
  const clipH = (poly: Pt[], y: number): [number, number][] => {
    const xs: number[] = [];
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], c = poly[j];
      if ((a[1] > y) !== (c[1] > y)) xs.push(a[0] + (c[0] - a[0]) * (y - a[1]) / (c[1] - a[1]));
    }
    xs.sort((x, y2) => x - y2);
    const out: [number, number][] = [];
    for (let k = 0; k + 1 < xs.length; k += 2) out.push([xs[k], xs[k + 1]]);
    return out;
  };
  /** The hall glazing laid on a frame; `flip` mirrors t (for the east wall, which is measured from the south end). */
  const hall = (f: Frame, flip: boolean) => {
    const X = (t: number) => flip ? L - t : t;
    const polys = glazing.map(g => (flip ? g.map(p => [L - p[0], p[1]] as Pt).reverse() : g));
    for (const g of polys) poly(b, f, 0, 0, g, 0.1, 'glass', 0.02);
    for (const g of polys) {
      const ts = g.map(p => p[0]), t0 = Math.min(...ts), t1 = Math.max(...ts);
      for (let t = Math.ceil(t0 / 2.7) * 2.7; t < t1; t += 2.7) for (const [y0, y1] of clipV(g, t)) if (y1 - y0 > 0.4) slab(b, f, t, y0, 0.09, y1 - y0, 0.13, 'dark', 0.02);
      for (const y of [6.2, 8.8, 11.4, 14.0]) for (const [x0, x1] of clipH(g, y)) if (x1 - x0 > 0.4) slab(b, f, (x0 + x1) / 2, y, x1 - x0, 0.08, 0.13, 'dark', 0.02);
    }
    return polys;
  };
  const smallWin = (f: Frame, t: number, y: number, w: number, h: number) => {
    slab(b, f, t, y - 0.07, w + 0.14, h + 0.14, 0.1, 'dark', 0.0);
    slab(b, f, t, y, w, h, 0.14, 'glass', 0.0);
  };
  const windowsAndDoors = (f: Frame, flip: boolean, entrance: boolean) => {
    const X = (t: number) => flip ? L - t : t;
    for (const r of winRows) for (const t of r.ts) smallWin(f, X(t), r.y, 1.0, r.h);
    for (const [t, w] of ribbon) smallWin(f, X(t), 3.5, w, 2.6);
    for (const [t, w] of [[2.3, 1.2], [5.2, 1.5], [8.8, 1.2], [12.0, 2.0], [35.2, 1.0], [40.6, 1.1]] as Pt[]) slab(b, f, X(t), 0, w, 2.2, 0.08, 'frame', 0.0);
    if (entrance) {
      slab(b, f, X(27.7), 0, 4.2, 2.4, 0.12, 'dark', 0.0);
      slab(b, f, X(27.7), 0.05, 3.9, 2.3, 0.16, 'glass', 0.0);
      for (const k of [-1, 0, 1]) slab(b, f, X(27.7) + k * 1.3, 0, 0.06, 2.4, 0.18, 'dark', 0.0);
      slab(b, f, X(27.7), 2.45, 4.8, 0.14, 0.9, 'dark', 0.0);
    }
  };

  // ---- the dots ----
  const dots = (f: Frame, polys: Pt[][], seed: number, len: number, blobs: [number, number, number, number, number][], avoid: (p: Pt) => boolean) => {
    const rand = rng(seed), pts: Pt[] = [];
    for (let t = 0.5; t < len - 0.4; t += 0.7) for (let y = 0.6; y < 16.2; y += 0.7) {
      const p: Pt = [t + (rand() - 0.5) * 0.55, y + (rand() - 0.5) * 0.55];
      let d = 0.04;
      for (const [bt, by, st, sy, amp] of blobs) d += 1.5 * amp * Math.exp(-(((p[0] - bt) / st) ** 2 + ((p[1] - by) / sy) ** 2));
      if (rand() > Math.min(0.85, d)) continue;
      if (avoid(p) || polys.some(g => inside(p, g))) continue;
      pts.push(p);
    }
    const geo: T.BufferGeometry[] = [];
    for (const p of pts) put(b, f, new T.CircleGeometry(0.17, 6), p[0], p[1], 0.012, 'white');
    return geo;
  };
  const rect = (t0: number, t1: number, y0: number, y1: number) => (p: Pt) => p[0] > t0 - 0.3 && p[0] < t1 + 0.3 && p[1] > y0 - 0.3 && p[1] < y1 + 0.3;
  const winAvoid = (flip: boolean, entrance: boolean) => {
    const X = (t: number) => flip ? L - t : t;
    const rs: ((p: Pt) => boolean)[] = [];
    for (const r of winRows) for (const t of r.ts) rs.push(rect(X(t) - 0.5, X(t) + 0.5, r.y, r.y + r.h));
    for (const [t, w] of ribbon) rs.push(rect(X(t) - w / 2, X(t) + w / 2, 3.5, 6.1));
    if (entrance) rs.push(rect(X(27.7) - 2.4, X(27.7) + 2.4, 0, 2.7));
    return (p: Pt) => rs.some(r => r(p)) || p[1] < 2.4 && p[0] > 0;
  };
  const longBlobs: [number, number, number, number, number][] = [[5, 14.5, 6, 2.2, 0.8], [17, 13.5, 6, 2.2, 0.7], [29, 13.8, 8, 2.4, 0.55], [40, 11.8, 7, 3.8, 0.65], [52, 14, 5, 2.4, 0.7], [10, 9, 6, 3, 0.4], [33, 7, 5, 3, 0.25], [24, 4.4, 4, 1.8, 0.18]];

  // west wall
  const wPolys = hall(WEST.f, false);
  windowsAndDoors(WEST.f, false, true);
  dots(WEST.f, wPolys, 11, L, longBlobs, winAvoid(false, true));
  // east wall (hall and windows inferred from one oblique panorama)
  const ePolys = hall(EAST.f, true);
  windowsAndDoors(EAST.f, true, false);
  dots(EAST.f, ePolys, 23, L, longBlobs.map(([t, y, s, sy, a]) => [L - t, y, s, sy, a] as [number, number, number, number, number]), winAvoid(true, false));
  // north end: dot cloud and three lines of dotted text
  const textLines: [number, number, number][] = [[7.5, 6.2, 16.0], [5.6, 6.2, 16.1], [3.3, 4.1, 16.1]];
  const textMask = (p: Pt) => textLines.some(([y, t0, t1]) => p[1] > y - 0.7 && p[1] < y + 0.9 && p[0] > t0 - 0.3 && p[0] < t1 + 0.3);
  dots(NORTH.f, [], 37, NORTH.len, [[3.5, 14.2, 3.2, 2.2, 0.95], [8, 12.2, 3.5, 2.6, 0.6], [12, 15, 2.5, 1.5, 0.3]], p => textMask(p) || p[1] < 2.2);
  {
    const rand = rng(91);
    for (const [y, t0, t1] of textLines) {
      let t = t0;
      while (t < t1) {
        const word = 0.9 + rand() * 1.9;
        for (let k = 0; k * 0.3 < word && t + k * 0.3 < t1; k++) for (const dy of [0, 0.34]) if (rand() > 0.15) put(b, NORTH.f, new T.CircleGeometry(0.075, 6), t + k * 0.3, y + dy + (rand() - 0.5) * 0.12, 0.012, 'white');
        t += word + 0.35 + rand() * 0.3;
      }
    }
  }
  // south end: dot cloud only (inferred)
  dots(SOUTH.f, [], 53, SOUTH.len, [[8, 13, 6, 3, 0.65]], p => p[1] < 2.2);
}
