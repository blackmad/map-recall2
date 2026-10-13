import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {wallsOf} from './worship-walls';
import {archBand, archSlab, archWindows, awning, disc, letters, poly, put, ringFrame, sashWindows, setSink, slab} from './nearbar-kit';
import type {Frame} from './nearbar-kit';
import source from './hotel-de-l-europe-footprints.json';

/**
 * Hotel de l'Europe (De L'Europe Amsterdam, Nieuwe Doelenstraat 2-14; Willem Hamer Jr., 1895-96, neo-Renaissance;
 * BAG 0363100012168170). Massing is the 3DBAG LoD2.2 shell in native east/south metres; every opening is placed from
 * the facade rhythm spec below (FACADE_SPEC), measured on rectified panoramas (photo projected onto each facade line,
 * 1 m grid, same scale as an orthographic model elevation):
 *  - SE Amstel side: b_20241211_0954_Track19_Sphere_00235 (46 m, square-on, leaf-off) and the 2017 canal-boat panorama
 *    TMX7316010203-000354_pano_0001_001522 (22 m, for counts and balcony shapes);
 *  - SW Amstel front: TMX7316010203-002925_pano_0000_000128 (2023, 41 m) and boat pano TMX7316010203-000354_pano_0001_000236;
 *  - NW Nieuwe Doelenstraat: TMX7316010203-001609_pano_0000_000090 (annex, 17 m) and _000094 (ornate end, 6 m).
 * Heights are in model metres above the 3DBAG ground (NAP +0.1, the waterside). The square-on Amstel panorama agrees with
 * the 3DBAG flat roof of section C (cornice 22.0 m) and gives the 1895 block's storeys (OLD); the Nieuwe Doelenstraat
 * panoramas read the same storeys ~0.6 m lower against their street, which stands higher than the quay, so the annex
 * rows (measured only there) are kept relative to that street. On the mansard sides the 3DBAG wall stops at the BAG
 * eave line (SW right 14.3-15.4 m) below the real cornice, so the facade is extended up to the cornice there. One sill/head level per storey row per section, one window width per section, and
 * every window of a section on its axis list, so the columns stack.
 */

type Row = [number, number];   // sill, head (m above local ground)
/** The 1895-96 block (Amstel front, round south end, SE section A, ornate Nieuwe Doelenstraat end). */
const OLD: Row[] = [[8.1, 10.2], [12.2, 14.2], [15.9, 17.8]];
const OLD_ATTIC: Row = [19.6, 20.9];
/** Over the ground storey: stone balcony band and balustrade base; the main cornice. */
const BAND = 6.6, BAL = 7.1, CORN = 18.6;
const SE_A = OLD, SE_A_ATTIC = OLD_ATTIC;
/** Nieuwe Doelenstraat attic: under the lower 3DBAG eave there (21.1 m), the photo's attic sill/head + 0.6 m. */
const NW_ATTIC: Row = [19.4, 20.6];

/**
 * Facade rhythm spec. u is metres along the facade's reference line (left end as seen from outside), the same u as
 * the rectified elevations. Sections are listed left to right.
 */
export const FACADE_SPEC = {
  se: {
    line: [[16.33, 18.05], [42.08, 4.41]], edges: [118, 119, 120, 122],
    sections: {
      A: {u: [0, 9.2], axes: [4.1], oriel: 8.4, w: 2.0, rows: SE_A, attic: SE_A_ATTIC, ground: 'brick: one window under the balconies; white stacked oriel (canted, glazed tiers) from the plinth to a balcony under storey 3',
        balconies: 'axis 4.1 at storeys 1 and 2'},
      B: {u: [10.0, 18.4], axes: [11.3, 13.7, 16.1], w: 1.45, rows: [[8.6, 10.7], [12.7, 14.6], [16.2, 18.0], [19.2, 21.1]] as Row[],
        ground: 'glazed restaurant conservatory 0-7.2 m (main glazing, transom band, clerestory, fascia)',
        balconies: 'storey 1: conservatory-roof balustrade (B+C); storey 2: full width; storey 3: two short ones on the outer axes',
        roof: '"DE L\'EUROPE" letters on the parapet (u 10.5-16)'},
      C: {u: [18.4, 25.1], axes: [19.25, 20.95, 22.65, 24.35], w: 1.15, rows: [[8.4, 10.6], [11.9, 14.1], [15.4, 17.6], [18.8, 20.9]] as Row[],
        ground: 'conservatory continues', brick: 'darker brown, stone friezes between storeys, cornice 21.5-22 (= 3DBAG flat roof 22.0)'},
      W: {u: [25.75, 29.14], axes: [26.6, 28.3], w: 1.15, rows: [[7.6, 10.2], [11.4, 13.8], [15.0, 17.2]] as Row[], groundRow: [1.0, 6.0] as Row,
        note: 'white stucco frame with brick panels (ring edge 122, inside this BAG pand; the rest of the white wing is pand 0363100012168239)'},
    },
  },
  sw: {
    line: [[-8.7, -2.93], [5.45, 17.5]], edges: [83, 85, 87, 88, 90, 91, 93],
    sections: {
      L: {u: [0, 13.84], axes: [2.45, 6.9, 11.4], w: 1.4, rows: OLD, attic: OLD_ATTIC, ground: 'round-headed windows on the axes; BORD\'EAU glass pavilion projects in front from u 4.0 to 14.6',
        balconies: 'storey 2 on every axis (centre wider); storey 3 on the centre axis', roof: 'mansard from the cornice (18.4 m); stone gable on the centre axis, dormer gables on the outer axes, small dormers between; "DE L\'EUROPE" letters above u 5.3-12.5'},
      M: {u: [13.84, 18.1], axes: [16.0], w: 1.4, rows: OLD, attic: OLD_ATTIC, oriel: 16.0, ground: 'rectangular window', note: 'canted oriel at storey 1 standing on the balustrade band, balcony on its top; balcony at storey 3'},
      R: {u: [18.1, 24.85], axes: [19.9, 23.1], w: 1.4, rows: OLD, ground: 'round-headed windows behind a glazed conservatory', balconies: 'storey 2 on both axes', roof: 'round-topped brick gable centred u 21.5 with one window'},
    },
  },
  nw: {
    line: [[25.09, -27.22], [-7.56, -6.99]], edges: [0, 1, 2, 4, 5, 6, 8, 10, 12],
    sections: {
      annex: {u: [0, 15.79], axes: [0, 1, 2, 3, 4, 5].map(k => 7.895 + 2.28 * (k - 2.5)), w: 1.35, ground: [2.2, 4.3] as Row, door: 2,
        rows: [[5.3, 6.8], [8.0, 10.0], [11.5, 13.5], [15.0, 16.8]] as Row[], note: 'Nieuwe Doelenstraat 8-6: dark brick, stone ground storey, brick piers between the six axes, cornice 19.3'},
      N1: {u: [15.79, 24.67], axes: [17.14, 19.99, 23.09], w: 1.3, rows: OLD, attic: NW_ATTIC, ground: 'main entrance under a white canopy'},
      N2: {u: [24.67, 32.78], axes: [27.59, 31.39], w: 1.3, rows: OLD, attic: NW_ATTIC, oriel: 27.59, ground: 'round-headed windows'},
      N4: {u: [32.8, 38.4], axes: [34.39, 36.99], w: 1.3, rows: OLD, ground: 'two round-headed openings', balconies: 'deep stone balcony over the ground storey; one at storey 2', roof: 'stepped gable with rosette'},
    },
  },
} as const;

export function buildHotelDeLEurope(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'brick', roof: 'slate'});
  b.mark?.('shell');
  setSink(0.5, true);   // staggered back planes: the layered stone bands and window trims no longer share one hidden plane
  const ring = (source.nativeRing as number[][]).slice(0, -1);
  const pieces = wallsOf(source as never);
  /** Frame of ring edge i, moved onto the shell wall's real plane (3DBAG walls stand up to ~0.3 m off the footprint line). */
  const fr = (i: number) => {
    const base = ringFrame(ring, i);
    const offs: number[] = [];
    for (let t = 0.3; t < base.len - 0.2; t += 0.4) { const w = wallAt(base.f, t); if (w.top > 3 && Math.abs(w.off) < 0.45) offs.push(w.off); }
    offs.sort((a, c) => a - c);
    return ringFrame(ring, i, offs.length ? offs[Math.floor(offs.length / 2)] : 0);
  };
  /** Highest shell wall at tangent position t of a frame (top 0 when no wall is within 1.2 m), with its offset from the frame. */
  const wallAt = (f: Frame, t: number) => {
    let best = 0, bestOff = 0;
    for (const w of pieces) {
      if (w.n[0] * f.n[0] + w.n[1] * f.n[1] < 0.97) continue;
      const off = (w.origin[0] - f.origin[0]) * f.n[0] + (w.origin[1] - f.origin[1]) * f.n[1];
      if (Math.abs(off) > 1.2) continue;
      const t0 = (w.origin[0] - f.origin[0]) * f.tangent[0] + (w.origin[1] - f.origin[1]) * f.tangent[1];
      const t1 = t0 + w.length * (w.tangent[0] * f.tangent[0] + w.tangent[1] * f.tangent[1]);
      if (t < Math.min(t0, t1) + 0.05 || t > Math.max(t0, t1) - 0.05) continue;
      const lt = Math.abs(t - t0);
      for (let i = 0; i < w.poly.length; i++) {
        const a = w.poly[i], c = w.poly[(i + 1) % w.poly.length];
        if ((a[0] - lt) * (c[0] - lt) > 0) continue;
        const y = Math.abs(a[0] - c[0]) < 1e-6 ? Math.max(a[1], c[1]) : a[1] + (c[1] - a[1]) * (lt - a[0]) / (c[0] - a[0]);
        if (y > best) { best = y; bestOff = off; }
      }
    }
    return {top: best, off: bestOff};
  };
  const topAt = (f: Frame, t: number) => wallAt(f, t).top;
  const shift = (f: Frame, d: number): Frame => d === 0 ? f : {origin: [f.origin[0] + f.n[0] * d, f.origin[1] + f.n[1] * d], tangent: f.tangent, n: f.n};

  /**
   * A facade measured along a straight reference line: `at(u)` finds the ring edge under line position u and returns its
   * frame and tangent position, so spec u values (read off the rectified photos) land on the right edge even where the
   * footprint jogs. `ext` records where the facade has been extended above the 3DBAG wall (mansard sides).
   */
  const facade = (line: readonly (readonly number[])[], edges: readonly number[]) => {
    const [a, c] = line, L = Math.hypot(c[0] - a[0], c[1] - a[1]), dir = [(c[0] - a[0]) / L, (c[1] - a[1]) / L];
    const proj = (p: readonly number[]) => (p[0] - a[0]) * dir[0] + (p[1] - a[1]) * dir[1];
    const segs = edges.map(i => {
      const e = fr(i), s = Math.sign(e.f.tangent[0] * dir[0] + e.f.tangent[1] * dir[1]) || 1;
      const ua = proj(ring[i]), ub = proj(ring[(i + 1) % ring.length]);
      return {f: e.f, len: e.len, lo: Math.min(ua, ub), hi: Math.max(ua, ub), uo: proj(e.f.origin), s, i};
    });
    const ext: {u0: number; u1: number; top: number}[] = [];
    const at = (u: number) => {
      let g = segs.find(q => u >= q.lo - 1e-6 && u <= q.hi + 1e-6);
      if (!g) g = segs.reduce((m, q) => (Math.min(Math.abs(u - q.lo), Math.abs(u - q.hi)) < Math.min(Math.abs(u - m.lo), Math.abs(u - m.hi)) ? q : m));
      return {f: g.f, t: (u - g.uo) * g.s, seg: g};
    };
    const extTop = (u: number) => ext.reduce((m, e) => (u >= e.u0 && u <= e.u1 ? Math.max(m, e.top) : m), 0);
    /** Chunks of [u0,u1] that stay on one edge and are at most `max` long. */
    const chunks = (u0: number, u1: number, max = 3) => {
      const out: [number, number][] = [];
      for (const q of segs) {
        const s0 = Math.max(u0, q.lo), s1 = Math.min(u1, q.hi);
        if (s1 - s0 < 0.05) continue;
        const n = Math.ceil((s1 - s0) / max - 1e-9);
        for (let k = 0; k < n; k++) out.push([s0 + (s1 - s0) * k / n, s0 + (s1 - s0) * (k + 1) / n]);
      }
      return out;
    };
    return {at, chunks, ext, extTop, total: L};
  };
  type Facade = ReturnType<typeof facade>;

  /** Surface frame at u: the wall's real plane (or the extension skin), with the usable wall top there. */
  const surf = (F: Facade, u: number) => {
    const {f, t} = F.at(u);
    const w = wallAt(f, t), e = F.extTop(u);
    const off = w.top > 3 ? w.off : 0;
    return {f, t, top: Math.max(w.top, e), wallTop: w.top, off, g: shift(f, off)};
  };
  const EXT = 0.05, SKIN = 0.05;
  /** Window on axis u of a facade; on an extension skin the window is lifted onto it. Returns false when no wall carries it. */
  const win = (F: Facade, u: number, r: Row, w: number, o: {cols?: number; rows?: number; lift?: number} = {}) => {
    const s = surf(F, u);
    if (s.top < r[1] + 0.15) return false;
    const lift = (s.wallTop < r[1] + 0.15 ? EXT : 0) + (o.lift ?? 0);
    sashWindows(b, shift(s.g, lift), [s.t], {y: r[0], w, h: r[1] - r[0], cols: o.cols ?? 2, rows: o.rows ?? 3, sill: 'stone'});
    return true;
  };
  /** Horizontal band across [u0,u1] wherever a wall (or extension) stands above it. */
  const band = (F: Facade, u0: number, u1: number, y: number, h: number, d: number, mat: string, out = 0) => {
    for (const [a, c] of F.chunks(u0, u1, 1.5)) {
      const m = (a + c) / 2, s = surf(F, m);
      if (s.top < y + h) continue;
      slab(b, shift(s.g, s.wallTop < y + h ? EXT : 0), s.t, y, c - a, h, d, mat, out);
    }
  };
  /** Skin from y0 up to the wall top over [u0,u1] (cladding/overlay colour), d proud of the wall. */
  const skin = (F: Facade, u0: number, u1: number, y0: number, d: number, mat: string, yMax = 99) => {
    for (const [a, c] of F.chunks(u0, u1, 1.0)) {
      const m = (a + c) / 2, s = surf(F, m);
      const top = Math.min(s.wallTop, yMax);
      if (top < y0 + 0.2) continue;
      slab(b, s.g, s.t, y0, c - a, top - y0, d, mat);
    }
  };
  /** Raise the facade face to `top` where the 3DBAG wall stops lower (mansard eaves on the BAG line). */
  const extend = (F: Facade, u0: number, u1: number, top: number, mat: string) => {
    for (const [a, c] of F.chunks(u0, u1, 1.0)) {
      const s = surf(F, (a + c) / 2);
      if (s.wallTop >= top - 0.05 || s.wallTop < 3) continue;
      slab(b, s.g, s.t, s.wallTop - 0.3, c - a, top - 0.1 - s.wallTop + 0.3, EXT, mat);   // 10 cm under `top`: the cornice band caps it
    }
    F.ext.push({u0, u1, top});
  };
  /** Speklagen: white stone courses through the brick between the storey rows (pitch ~0.6 m). */
  const courses = (F: Facade, u0: number, u1: number, y0: number, y1: number, pitch = 0.6) => {
    for (let y = y0; y < y1 - 0.2; y += pitch) band(F, u0, u1, y, 0.18, 0.035, 'stone');
  };
  /** Sill and lintel bands for each row of a section. */
  const rowBands = (F: Facade, u0: number, u1: number, rows: readonly Row[]) => {
    for (const [y0, y1] of rows) { band(F, u0, u1, y0 - 0.32, 0.16, 0.1, 'stone'); band(F, u0, u1, y1 + 0.07, 0.22, 0.12, 'stone'); }
  };
  /** Balcony: stone floor slab on corbels, balusters and a rail; floor top at y. */
  const balcony = (F: Facade, uc: number, w: number, y: number, depth: number, mat = 'stone') => {
    const s = surf(F, uc);
    if (s.top < y + 1.2) return;
    slab(b, s.g, s.t, y - 0.25, w, 0.25, depth, mat);
    slab(b, s.g, s.t, y + 0.9, w, 0.1, 0.12, mat, depth - 0.14);
    for (const side of [-1, 1]) slab(b, s.g, s.t + side * (w / 2 - 0.06), y, 0.12, 0.9, depth - 0.02, mat);
    for (let x = -w / 2 + 0.3; x < w / 2 - 0.15; x += 0.3) slab(b, s.g, s.t + x, y, 0.08, 0.9, 0.08, mat, depth - 0.12);
    const nC = Math.max(2, Math.round(w / 1.4) + 1);
    for (let k = 0; k < nC; k++) slab(b, s.g, s.t - w / 2 + 0.25 + (w - 0.5) * k / (nC - 1), y - 0.75, 0.16, 0.5, depth * 0.6, mat);
  };
  /**
   * Canted oriel (three-sided bay) on axis uc: `tiers` alternate solid white bands and glazed bands, bottom to top.
   * Glazed tiers sit 4 cm inside the bands so the bands read as the stone frame; white mullions at the front corners.
   */
  const oriel = (F: Facade, uc: number, wb: number, depth: number, tiers: [number, number, 'white' | 'glass'][]) => {
    const s = surf(F, uc);
    const prism = (y0: number, y1: number, grow: number) => {
      const d = depth + grow, hw = wb / 2 + grow, fw = Math.max(0.3, hw - d);
      const sh = new T.Shape([new T.Vector2(-hw, -0.45), new T.Vector2(hw, -0.45), new T.Vector2(hw, 0), new T.Vector2(fw, d), new T.Vector2(-fw, d), new T.Vector2(-hw, 0)]);
      return new T.ExtrudeGeometry(sh, {depth: y1 - y0, bevelEnabled: false}).rotateX(Math.PI / 2).translate(0, y1 - y0, 0);
    };
    for (const [y0, y1, kind] of tiers) {
      if (s.top < y1 - 0.5) continue;
      put(b, s.g, prism(y0, y1, kind === 'white' ? 0.04 : 0), s.t, y0, 0, kind === 'white' ? 'white' : 'glass');
      if (kind === 'glass') {
        const fw = wb / 2 - depth;
        for (const x of [-fw, 0, fw]) slab(b, s.g, s.t + x, y0, 0.09, y1 - y0, 0.06, 'white', depth - 0.02);
        for (const side of [-1, 1]) put(b, s.g, new T.BoxGeometry(0.09, y1 - y0, 0.09).translate(0, (y1 - y0) / 2, 0), s.t + side * (wb / 2 - 0.02), y0, 0.04, 'white');
      }
    }
  };
  /** Glazed conservatory along [u0,u1]: plinth, main glazing, transom, clerestory, fascia; mullions every ~1 m. */
  const conservatory = (F: Facade, u0: number, u1: number, proj: number, levels: {plinth: number; transom: Row; fascia: Row}) => {
    for (const [a, c] of F.chunks(u0, u1, 3)) {
      const s = surf(F, (a + c) / 2), w = c - a;
      if (s.top < levels.fascia[1]) continue;
      slab(b, s.g, s.t, 0, w, levels.plinth, proj + 0.05, 'white');
      slab(b, s.g, s.t, levels.plinth, w, levels.transom[0] - levels.plinth, proj - 0.05, 'glass');
      slab(b, s.g, s.t, levels.transom[0], w, levels.transom[1] - levels.transom[0], proj + 0.03, 'white');
      slab(b, s.g, s.t, levels.transom[1], w, levels.fascia[0] - levels.transom[1], proj - 0.05, 'glass');
      slab(b, s.g, s.t, levels.fascia[0], w, levels.fascia[1] - levels.fascia[0], proj + 0.08, 'white');
      const n = Math.max(1, Math.round(w / 1.0));
      for (let k = 0; k <= n; k++) slab(b, s.g, s.t - w / 2 + w * k / n, levels.plinth, 0.1, levels.fascia[0] - levels.plinth, proj + 0.02, 'white');
    }
  };
  /** Balustrade (top rail + balusters) standing at height y, `out` in front of the wall, along [u0,u1]. */
  const balustrade = (F: Facade, u0: number, u1: number, y: number, out: number, mat = 'white') => {
    for (const [a, c] of F.chunks(u0, u1, 3)) {
      const s = surf(F, (a + c) / 2), w = c - a;
      if (s.top < y + 1.0) continue;
      slab(b, s.g, s.t, y, w, 0.12, 0.25, mat, out - 0.2);
      slab(b, s.g, s.t, y + 0.85, w, 0.12, 0.22, mat, out - 0.2);
      for (let x = -w / 2 + 0.15; x < w / 2; x += 0.3) slab(b, s.g, s.t + x, y + 0.12, 0.08, 0.73, 0.08, mat, out - 0.12);
    }
  };
  /** Gable or dormer face standing on the cornice at y: brick/stone triangle or round top, with one window. */
  const gable = (F: Facade, uc: number, y: number, w: number, h: number, shape: 'tri' | 'round', win1: Row | null, mat = 'brick') => {
    const s = surf(F, uc);
    if (shape === 'round') { archSlab(b, s.g, s.t, y, w + 0.3, h + 0.15, 0.32, 'stone'); archSlab(b, s.g, s.t, y, w, h, 0.4, mat); }
    else { poly(b, s.g, s.t, y, [[-w / 2 - 0.2, 0], [w / 2 + 0.2, 0], [0, h + 0.25]], 0.32, 'stone'); poly(b, s.g, s.t, y, [[-w / 2, 0], [w / 2, 0], [0, h]], 0.4, mat); }
    if (win1) sashWindows(b, shift(s.g, 0.4), [s.t], {y: win1[0], w: Math.min(1.1, w - 0.6), h: win1[1] - win1[0], cols: 2, rows: 2, sill: 'stone'});
    put(b, s.g, new T.SphereGeometry(0.18, 8, 6), s.t, y + h + 0.3, 0.2, 'stone');
  };
  /** Roof lettering on a dark bar standing on the wall top (posts down to it). */
  const roofSign = (F: Facade, u0: number, u1: number, text: string, hLetter: number, back = 0, lift = 0) => {
    const s = surf(F, (u0 + u1) / 2);
    let top = 0, low = 99;
    for (let u = u0; u <= u1; u += 0.5) { const q = surf(F, u); if (q.wallTop < 3) continue; top = Math.max(top, q.wallTop); low = Math.min(low, q.wallTop); }
    if (low < 10) return;
    const glyphs = [...text].length * 6 - 1, px = (u1 - u0) / glyphs, py = hLetter / 7;
    const g = shift(s.g, -back), y = top + lift;
    slab(b, g, s.t, y - 0.05, u1 - u0 + 0.3, 0.2, 0.14, 'slate');
    for (const u of [u0 + 0.2, (u0 + u1) / 2, u1 - 0.2]) { const q = surf(F, u); if (q.wallTop < 3) continue; slab(b, shift(q.g, -back), q.t, q.wallTop - 0.3, 0.12, y - q.wallTop + 0.35, 0.14, 'slate'); }
    letters(b, g, text, s.t, y + 0.15, 0.02, px, 0.1, 'stone', py);
    // the apostrophe floats above the baseline: a thin rod of the sign frame carries it
    const k = [...text].indexOf("'");
    if (k >= 0) slab(b, g, s.t - glyphs * px / 2 + (k * 6 + 1.5) * px, y + 0.15, px * 0.5, 4 * py, 0.06, 'slate', 0.04);
  };

  // ======================================== SE: Amstel side ========================================
  {
    const S = FACADE_SPEC.se.sections, F = facade(FACADE_SPEC.se.line, FACADE_SPEC.se.edges);
    // A: ornate brick, axis 4.1 with balconies and the white stacked oriel at 7.5
    band(F, S.A.u[0], S.A.u[1], 0, 0.4, 0.2, 'stone');
    band(F, S.A.u[0], S.A.u[1], 6.8, 0.5, 0.25, 'stone');
    rowBands(F, S.A.u[0], S.A.u[1], [...S.A.rows, S.A.attic]);
    courses(F, S.A.u[0], S.A.u[1], 7.5, 18.6);
    for (const u of S.A.axes) {
      win(F, u, [2.4, 4.8], S.A.w, {cols: 3});
      for (const r of [...S.A.rows, S.A.attic]) win(F, u, r, S.A.w, {cols: 3});
      balcony(F, u, 3.0, S.A.rows[0][0] - 0.25, 0.8);
      balcony(F, u, 2.6, S.A.rows[1][0] - 0.25, 0.7);
    }
    oriel(F, S.A.oriel, 2.4, 0.8, [[0.4, 2.4, 'white'], [2.4, 4.8, 'glass'], [4.8, 5.4, 'white'], [5.4, 6.6, 'glass'], [6.6, 8.1, 'white'],
      [8.1, 11.2, 'glass'], [11.2, 12.4, 'white'], [12.4, 14.7, 'glass'], [14.7, 15.2, 'white']]);
    balustrade(F, S.A.oriel - 0.8, S.A.oriel + 0.8, 15.2, 0.75);
    for (const r of [S.A.rows[2], S.A.attic]) win(F, S.A.oriel, r, 1.3);

    // B: three axes; balconies full width (storey 2) and short (storey 3); parapet with the roof lettering
    const B = S.B, C = S.C;
    rowBands(F, B.u[0], B.u[1], B.rows);
    courses(F, B.u[0], B.u[1], 8.3, 21.3);
    band(F, B.u[0], B.u[1], 18.35, 0.45, 0.16, 'stone');        // dentil frieze between storeys 3 and 4
    band(F, B.u[0], B.u[1], 21.5, 0.5, 0.3, 'stone');           // cornice
    for (const u of B.axes) for (const r of B.rows) win(F, u, r, B.w);
    balcony(F, (B.u[0] + B.u[1]) / 2, B.u[1] - B.u[0] - 0.3, B.rows[1][0] - 0.1, 0.9);
    for (const u of [B.axes[0], B.axes[2]]) balcony(F, u, 2.7, B.rows[2][0] - 0.1, 0.75);
    roofSign(F, 10.5, 16.1, "DE L'EUROPE", 1.0);

    // C: plain darker brick, four narrow axes, stone friezes, cornice at the flat roof
    skin(F, C.u[0], C.u[1], 7.2, SKIN, 'red');
    rowBands(F, C.u[0], C.u[1], C.rows);
    for (const y of [11.1, 14.65, 18.15]) band(F, C.u[0], C.u[1], y, 0.32, 0.1, 'stone');
    band(F, C.u[0], C.u[1], 21.4, 0.55, 0.32, 'stone');
    for (const u of C.axes) for (const r of C.rows) win(F, u, r, C.w, {rows: 2, lift: SKIN});

    // B + C: the glazed restaurant conservatory and the balustrade on its roof
    conservatory(F, B.u[0], C.u[1], 0.35, {plinth: 1.3, transom: [4.6, 5.1], fascia: [6.8, 7.25]});
    balustrade(F, B.u[0], C.u[1], 7.25, 0.4);
    // pier between A and B
    band(F, S.A.u[1], B.u[0], 0, 7.25, 0.06, 'stone');

    // W: the white stucco wing's first bay (edge 122): white frame, brick panels, two tall axes
    const W = S.W;
    skin(F, W.u[0], W.u[1], 0, 0.03, 'white');
    for (const u of W.axes) {
      const s = surf(F, u);
      if (s.wallTop > 17.5) slab(b, s.g, s.t, 7.0, 1.45, 10.6, 0.07, 'brick');
      win(F, u, W.groundRow, W.w, {rows: 4, lift: 0.03});
      for (const r of W.rows) win(F, u, r, W.w, {lift: 0.07});
    }
    band(F, W.u[0], W.u[1], 17.8, 0.5, 0.3, 'white');
    band(F, W.u[0], W.u[1], 6.4, 0.35, 0.2, 'white');
  }

  // ======================================== SW: Amstel front ========================================
  {
    const S = FACADE_SPEC.sw.sections, F = facade(FACADE_SPEC.sw.line, FACADE_SPEC.sw.edges);
    const CORNICE = CORN + 0.65;
    // the 3DBAG wall stops at the mansard eave on the BAG line (14.3-15.4 m) right of u 12.3: raise the brick face to the cornice
    extend(F, 12.3, 24.85, CORNICE, 'brick');
    // stone ground storey with rusticated courses, balustrade band over it
    band(F, 0, 24.85, 0, BAND, 0.05, 'stone');
    for (let y = 1.2; y < BAND - 0.1; y += 0.8) band(F, 0, 24.85, y, 0.04, 0.24, 'greyBrick');
    band(F, 0, 24.85, BAND, BAL - BAND, 0.55, 'stone');
    balustrade(F, 0.3, 24.6, BAL, 0.55, 'stone');
    // white stone pilasters between the bays (2023 panorama: section edges and between the L axes)
    for (const u of [0.6, 4.6, 9.2, 13.9, 18.2, 24.5]) { const s = surf(F, u); if (s.top > CORN) slab(b, s.g, s.t, BAL, 0.55, CORN - BAL, 0.14, 'stone'); }
    rowBands(F, 0, 24.85, OLD);
    courses(F, 0, 24.85, BAL + 0.4, CORN - 0.2);
    band(F, 0, 24.85, CORN, 0.65, 0.38, 'stone');               // cornice
    // windows: one width, one sill/head per storey, on the axes
    for (const sec of [S.L, S.M, S.R]) for (const u of sec.axes) {
      for (const r of OLD) if (!('oriel' in sec && sec.oriel === u && r[0] < 10)) win(F, u, r, sec.w);
    }
    // ground storey: round-headed windows on the L and R axes, a plain window in M
    for (const u of [...S.L.axes, ...S.R.axes]) { const s = surf(F, u); archBand(b, s.g, s.t, 1.2, 3.0, 4.6, 0.3, 0.2, 'stone'); archWindows(b, s.g, [s.t], {y: 1.3, w: 2.5, h: 4.3, bars: 2, rows: 3, frame: 'white', sill: 'stone'}); }
    win(F, S.M.axes[0], [1.4, 5.0], 1.5);
    // BORD'EAU glass pavilion (L) and the conservatory (R) project in front of the ground storey
    const pavilion = (u0: number, u1: number, proj: number) => {
      for (const [a, c] of F.chunks(u0, u1, 3)) {
        const s = surf(F, (a + c) / 2), w = c - a;
        slab(b, s.g, s.t, 0, w, 0.6, proj, 'white');
        slab(b, s.g, s.t, 0.6, w, 3.0, proj - 0.1, 'glass');
        slab(b, s.g, s.t, 2.9, w, 0.08, proj - 0.02, 'white');
        slab(b, s.g, s.t, 3.6, w, 0.55, proj + 0.15, 'white');
        const n = Math.max(1, Math.round(w / 1.0));
        for (let k = 0; k <= n; k++) slab(b, s.g, s.t - w / 2 + w * k / n, 0.6, 0.1, 3.0, proj, 'white');
      }
    };
    pavilion(4.0, 14.6, 1.6);
    pavilion(18.4, 24.0, 1.0);
    // balconies: storey 2 on every axis (centre wider), storey 3 on the centre axis; storey 2 on both R axes
    for (const u of S.L.axes) balcony(F, u, u === 6.9 ? 3.0 : 2.0, OLD[1][0] - 0.3, 0.6);
    balcony(F, 6.9, 1.8, OLD[2][0] - 0.3, 0.55);
    for (const u of S.R.axes) balcony(F, u, 2.6, OLD[1][0] - 0.3, 0.7);
    // M: canted oriel through storeys 1-2, its top the storey-3 balcony
    oriel(F, S.M.oriel, 2.4, 0.75, [[BAND, 8.0, 'white'], [8.0, 10.4, 'glass'], [10.4, 11.2, 'white']]);
    balustrade(F, S.M.oriel - 0.75, S.M.oriel + 0.75, 11.2, 0.7, 'stone');
    balcony(F, S.M.oriel, 1.8, OLD[2][0] - 0.3, 0.55);
    // roof: slate mansard skin over the brick shell above the cornice (L), gables and dormers, roof lettering
    skin(F, 0.2, 12.3, CORNICE, 0.04, 'slate');
    gable(F, 6.9, CORNICE, 3.0, 4.2, 'tri', OLD_ATTIC);
    for (const u of [2.45, 11.4]) gable(F, u, CORNICE, 2.0, 3.5, 'tri', OLD_ATTIC, 'stone');
    gable(F, S.M.axes[0], CORNICE, 1.9, 3.3, 'tri', OLD_ATTIC, 'stone');
    gable(F, 21.5, CORNICE, 3.0, 3.8, 'round', OLD_ATTIC);
    for (const u of [4.7, 9.15]) { const s = surf(F, u); if (s.wallTop > 21.2) { slab(b, s.g, s.t, 20.0, 1.2, 1.2, 0.45, 'stone'); sashWindows(b, shift(s.g, 0.45), [s.t], {y: 20.15, w: 0.8, h: 0.85, cols: 2, rows: 2}); } }
    roofSign(F, 5.3, 12.5, "DE L'EUROPE", 1.1, 0.3, 1.5);   // just behind the facade, its foot hidden by the centre gable as in the photos
  }

  // =============================== rounded south end: the semicircular bay on the Munt corner ===============================
  // Circle fitted to ring vertices 94-118: centre (11.30, 13.34) east/south, radius 5.9 m. Angle 0 = due south.
  {
    const cx = 11.298, cz = 13.339, R = 5.9 - 0.08, deg = Math.PI / 180;
    /** Radius of the 3DBAG shell wall on the arc (its facets stand inside the BAG ring: 5.33 m at -44 deg, 5.63 m due
     *  south, 5.70 m from +20 deg), so flat window frames sit on the wall instead of hanging in front of it. */
    const wallR = (th: number) => (th < 0 ? 5.63 + 0.0068 * th : Math.min(5.71, 5.63 + 0.004 * th)) - 0.02;
    const cf = (th: number): Frame => { const a = th * deg, nx = Math.sin(a), nz = Math.cos(a), r = wallR(th); return {origin: [cx + r * nx, cz + r * nz], tangent: [nz, -nx], n: [nx, nz]}; };
    /** Wall top over the bay at angle th, read from the nearest ring edge of the shell. */
    const topNear = (th: number) => {
      let best = 0;
      for (let i = 95; i <= 116; i++) {
        const m = [(ring[i][0] + ring[i + 1][0]) / 2 - cx, (ring[i][1] + ring[i + 1][1]) / 2 - cz];
        if (Math.abs(Math.atan2(m[0], m[1]) / deg - th) > 7) continue;
        const e = fr(i);
        for (const k of [0.25, 0.5, 0.75]) best = Math.max(best, topAt(e.f, e.len * k));
      }
      return best || 18;   // small 3DBAG facets the wall matcher misses: the arc's typical eave
    };
    const rows = [...OLD, OLD_ATTIC];
    const step = 8.5, w = 2 * R * Math.tan(step / 2 * deg) + 0.12;   // R: the widest radius, so the facets overlap
    // the arc runs from ring vertex 94 (-54.6 deg) to 117 (48.4 deg)
    for (let th = -54 + step / 2; th < 48; th += step) {
      const f = cf(th), top = topNear(th);
      slab(b, f, 0, 0, w, 0.35, 0.2, 'stone');                               // plinth
      // glazed white terrace pavilion on the ground storey
      // two glazed tiers (main glazing, clerestory) in white frames, as on the Amstel-side conservatory
      slab(b, f, 0, 1.0, w, 5.4, 0.1, 'glass');
      slab(b, f, 0, 1.0, w, 0.12, 0.16, 'white'); slab(b, f, 0, 4.2, w, 0.35, 0.18, 'white'); slab(b, f, 0, 6.2, w, 0.4, 0.22, 'white');
      slab(b, f, -w / 2 + 0.05, 1.0, 0.1, 5.4, 0.16, 'white');
      slab(b, f, 0, BAND, w, BAL - BAND, 0.55, 'stone');                    // balcony band (Amstel front level)
      slab(b, f, 0, BAL, w, 0.12, 0.25, 'stone', 0.3); slab(b, f, 0, BAL + 0.85, w, 0.12, 0.22, 'stone', 0.3);
      for (const [y0, y1] of rows) if (top > y1 + 0.3) { slab(b, f, 0, y0 - 0.32, w, 0.16, 0.1, 'stone'); slab(b, f, 0, y1 + 0.07, w, 0.22, 0.12, 'stone'); }
      for (let y = BAL + 0.4; y < Math.min(top - 0.7, CORN - 0.2); y += 0.6) slab(b, f, 0, y, w, 0.18, 0.035, 'stone');
      if (top > 12) slab(b, f, 0, Math.min(top - 0.65, CORN), w, 0.65, 0.38, 'stone');   // cornice
    }
    // three window axes, paired sashes in stone surrounds
    // shallow sink here: on the curve the 0.5 m back-sink makes neighbouring windows' boxes overlap, and the geometry
    // audit then judges two windows as one flat assembly hanging off the arc
    setSink(0.08, true);
    // (each axis gets a flat brick pier face the width of its windows: the arc's 3DBAG facets are only 0.5 m wide)
    for (const th of [-40, -20, 0, 20, 40]) {
      const f = cf(th), top = topNear(th), live = rows.filter(r => top > r[1] + 0.3);
      if (!live.length) continue;
      slab(b, f, 0, BAL + 0.2, 1.75, live[live.length - 1][1] + 0.3 - BAL - 0.2, 0.02, 'brick');
      for (const r of live) sashWindows(b, shift(f, 0.02), [0], {y: r[0], w: 1.2, h: r[1] - r[0], cols: 2, rows: 3, sill: 'stone'});
    }
    setSink(0.5, true);
    // three brick gables with stone coping, finial and a window (the central one a small stone-framed dormer)
    for (const [th, h] of [[-30, 3.2], [0, 2.3], [30, 3.2]] as [number, number][]) {
      const f = cf(th), base = topNear(th) - 0.5;
      if (base < 12) continue;
      poly(b, f, 0, base, [[-1.7, 0], [1.7, 0], [0, h + 0.35]], 0.42, 'stone');
      poly(b, f, 0, base, [[-1.4, 0], [1.4, 0], [0, h]], 0.5, th === 0 ? 'stone' : 'brick');
      archWindows(b, f, [0], {y: base + 0.5, w: 0.8, h: 1.2, bars: 1, rows: 2, sill: 'stone'});
      put(b, f, new T.SphereGeometry(0.2, 8, 6), 0, base + h + 0.45, 0.2, 'stone');
    }
  }

  // ======================================== NW: Nieuwe Doelenstraat ========================================
  {
    const S = FACADE_SPEC.nw.sections, F = facade(FACADE_SPEC.nw.line, FACADE_SPEC.nw.edges);
    // annex (Nieuwe Doelenstraat 8-6): dark brick, stone ground storey, six axes between brick piers
    const A = S.annex;
    skin(F, A.u[0], A.u[1], 5.0, SKIN, 'red');
    band(F, A.u[0], A.u[1], 0, 5.0, SKIN, 'stone');
    band(F, A.u[0], A.u[1], 0.9, 0.05, 0.08, 'greyBrick');
    band(F, A.u[0], A.u[1], 4.8, 0.35, 0.18, 'stone');
    band(F, A.u[0], A.u[1], 18.9, 0.45, 0.3, 'stone');           // cornice (3DBAG wall top 19.3-19.7)
    const pitch = A.axes[1] - A.axes[0];
    for (let k = 0; k <= A.axes.length; k++) {
      const u = A.axes[0] + (k - 0.5) * pitch, s = surf(F, u);
      if (s.wallTop < 18.5 || u < A.u[0] + 0.2 || u > A.u[1] - 0.2) continue;
      slab(b, s.g, s.t, 5.15, 0.5, 13.4, 0.16, 'red');
      poly(b, s.g, s.t, 18.55, [[-0.25, 0], [0.25, 0], [0, 0.6]], 0.16, 'stone');
    }
    A.axes.forEach((u, k) => {
      if (k === A.door) { const s = surf(F, u); slab(b, s.g, s.t, 0, 1.9, 3.6, 0.12, 'stone'); slab(b, s.g, s.t, 0, 1.4, 3.2, 0.16, 'dark'); }
      else win(F, u, A.ground, A.w, {rows: 2, lift: SKIN});
      for (const r of A.rows) win(F, u, r, A.w, {rows: 2, lift: SKIN});
    });

    // ornate end: stone ground storey, striped brick, OLD storey rows
    const u0 = S.N1.u[0], u1 = S.N4.u[1];
    band(F, u0, u1, 0, BAND, 0.05, 'stone');
    for (let y = 1.2; y < BAND - 0.1; y += 0.8) band(F, u0, u1, y, 0.04, 0.2, 'greyBrick');
    band(F, u0, u1, BAND, BAL - BAND, 0.3, 'stone');
    rowBands(F, u0, u1, [...OLD, NW_ATTIC]);
    courses(F, u0, u1, BAL + 0.4, CORN - 0.2);
    band(F, u0, u1, CORN, 0.6, 0.35, 'stone');
    for (const sec of [S.N1, S.N2, S.N4]) for (const u of sec.axes) {
      for (const r of OLD) if (!('oriel' in sec && sec.oriel === u && r[0] < 10)) win(F, u, r, u === 17.14 ? 0.8 : sec.w);
      if ('attic' in sec) win(F, u, sec.attic, u === 17.14 ? 0.8 : sec.w);
    }
    // N1: main entrance under the white canopy
    { const s = surf(F, 21.6); slab(b, s.g, s.t, 0, 3.8, 3.7, 0.08, 'stone'); sashWindows(b, shift(s.g, 0.08), [s.t], {y: 0.05, w: 3.0, h: 3.3, cols: 3, rows: 2}); awning(b, s.g, s.t, 3.75, 5.6, 1.1, 2.6, 'sandstone'); }
    win(F, 17.14, [1.6, 4.4], 0.8, {rows: 2});
    // N2: canted oriel through storeys 1-2 on corbels, balcony on top; round-headed ground windows; N3 axis 31.39
    oriel(F, S.N2.oriel, 3.0, 0.9, [[5.8, 8.0, 'white'], [8.0, 10.4, 'glass'], [10.4, 11.4, 'white']]);
    balustrade(F, S.N2.oriel - 1.0, S.N2.oriel + 1.0, 11.4, 0.85, 'stone');
    for (const u of [26.39, 28.94, 31.39]) { const s = surf(F, u); archWindows(b, s.g, [s.t], {y: 1.6, w: 1.5, h: 3.8, bars: 1, rows: 3, frame: 'white', sill: 'stone'}); }
    // N4: round-headed openings, deep stone balcony over the ground storey, one at storey 2, stepped gable with rosette
    for (const u of S.N4.axes) { const s = surf(F, u); archBand(b, s.g, s.t, 1.0, 2.1, 4.4, 0.25, 0.2, 'stone'); archWindows(b, s.g, [s.t], {y: 1.1, w: 1.7, h: 4.1, bars: 1, rows: 3, frame: 'white', sill: 'stone'}); }
    balcony(F, 35.6, 5.2, BAL + 0.4, 1.0);
    balcony(F, 35.8, 4.0, OLD[1][0] - 0.3, 0.7);
    { const s = surf(F, 35.7); if (s.wallTop > 20) { const y = Math.min(s.wallTop, 22.7) - 0.3; poly(b, s.g, s.t, y, [[-2.4, 0], [2.4, 0], [2.4, 0.8], [1.6, 0.8], [1.6, 1.6], [0.8, 1.6], [0.8, 2.3], [-0.8, 2.3], [-0.8, 1.6], [-1.6, 1.6], [-1.6, 0.8], [-2.4, 0.8]], 0.35, 'brick'); disc(b, s.g, s.t, y + 1.2, 0.5, 0.42, 'stone'); } }
  }

  // =============================== west corner turret: copper conical cap ===============================
  {
    const cx = -7.0, cz = -5.2, r = 1.55, top = 25.2;
    const g = new T.ConeGeometry(r + 0.2, 4.2, 14).translate(cx, top + 2.1, cz);
    b.add(g, 'copper');
    b.add(new T.CylinderGeometry(r + 0.2, r + 0.2, 0.35, 14).translate(cx, top + 0.05, cz), 'stone');
    b.add(new T.SphereGeometry(0.28, 8, 6).translate(cx, top + 4.4, cz), 'copper');
  }
}
