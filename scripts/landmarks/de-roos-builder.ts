import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {local, extrude, frame, hipRoof, onWall, tris, type Kit, type V2, type Col} from './church-kit';
import {slab, archBand, archSlab, segBand, type Frame} from './nearbar-kit';
import {mansardRoof} from './pavilion-kit';

/**
 * De Roos, Pieter Cornelisz. Hooftstraat 183 / Van Eeghenlaan 21 (BAG pand 0363100012236970, gemeentelijk monument
 * 222055). The 1880 villa for A.F. Insinger on the P.C. Hooftstraat corner of the Vondelpark entrance (plastered,
 * pilasters, baluster panels, console cornice, chamfered park corner, risalit with pediment and two bay windows),
 * extended in 1897 by G. van Arkel into a double villa with the picturesque Van Eeghenlaan wing (red-tile hips with
 * broad eaves, five-sided serre with a tile skirt and balcony, thermal window, glass serres at the west head), and
 * the one-storey 1943 garage by I. Blomhert. Features from the register text and Gemeente Amsterdam panoramas; see
 * de-roos-inventory.json.
 *
 * Authored in a local frame (u, v): u along the Van Eeghenlaan building line (bearing 66.9, ENE), v across it towards
 * the Van Eeghenlaan (SSE); `local(b, AXIS_DEG)` maps it onto native east/south metres. Plan rectangles follow the BAG
 * ring (in de-roos-footprints.json) read in that frame; heights from the 3DBAG LoD2.2 roof planes above the -1.28 m
 * NAP ground; the villa's storey heights read from the 2025 P.C. Hooftstraat panoramas scaled to that cornice.
 */
export const AXIS_DEG = 23.07;
const S = 0.04;

type Face = {f: Frame; len: number};
/** Wall from a to b (plan u, v); the outward normal is to the right of a->b walking with the wall on the left. */
const edge = (a: V2, b: V2): Face => {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), t: V2 = [dx / L, dz / L];
  return {f: frame(a, [-t[1], t[0]]), len: L};
};

// ---------- plan (u, v) ----------
/** 1880 villa main block with the chamfered park corner; the risalit strip is separate. */
export const VILLA: V2[] = [[19.15, -16.28], [10.63, -16.18], [9.03, -14.49], [9.05, -1.3], [18.9, -1.3]];
export const RISALIT: V2[] = [[9.05, -7.4], [7.6, -7.4], [7.6, -1.3], [9.05, -1.3]];
/** Five-sided bel-etage bay in front of the villa's west wall and risalit (BAG ring 7-10, 3DBAG roof 198/189). */
export const ERKER: V2[] = [[9.05, -10.3], [7.2, -10.3], [5.45, -9.0], [5.45, -7.6], [7.6, -6.0], [7.6, -7.4], [9.05, -7.4]];
export const ERKER_SMALL: V2[] = [[7.6, -5.95], [6.2, -5.95], [5.5, -5.25], [5.5, -2.45], [7.6, -2.45]];
const rect = (u0: number, u1: number, v0: number, v1: number): V2[] => [[u1, v0], [u0, v0], [u0, v1], [u1, v1]];
export const PARTS = {
  W1: rect(-0.3, 7.6, -2.45, 3.4), // flat 11.5 (3DBAG 190), garden front with the coupled window
  H1: rect(-5.55, -0.3, -3.08, 7.04), // red-tile hip, eaves 10.4, ridge 13.1 (193/194/215/188)
  W0: rect(-8.9, -5.55, -3.9, 2.4), // flat 10.5 (213)
  TW: rect(-8.9, -5.55, 2.4, 7.04), // pyramid, eaves 10.3 (202/214/216)
  V192: rect(-0.3, 6.6, 3.4, 7.04), // flat 10.5
  E12: [[16.1, -1.3], [7.6, -1.3], [7.6, 3.4], [6.6, 3.4], [6.6, 7.04], [16.1, 7.04]] as V2[], // flat 12.0 (203)
  LOW: rect(-14.7, -8.9, -3.9, 7.04), // one storey under the serres, 3.4 (200)
  ING: rect(-14.7, -11.3, -8.7, -3.9), // one-storey block toward the garden, 3.5 (212)
  GAR: rect(-22.9, -14.7, -12.1, 7.04), // 1943 garage, 4.1 (201)
};
/** East block: one storey on a souterrain, rounded on the Van Eeghenlaan corner (radius 2.5 m). */
export function eastRing(): V2[] {
  const r = 2.5, cu = 19.05 - r, cv = 7.06 - r, arc: V2[] = [];
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; arc.push([cu + r * Math.sin(a), cv + r * Math.cos(a)]); }
  return [[19.05, -1.3], [16.1, -1.3], [16.1, 7.06], ...arc];
}

export const H = {
  plinth: 1.8, villaTop: 13.0, villaFlat: 15.3, w1: 11.5, h1: 10.4, h1Ridge: 13.1, w0: 10.5, tw: 10.3, twApex: 12.5, v192: 10.5, e12: 12.0,
  east: 6.5, low: 3.4, ing: 3.5, gar: 4.1, erker: 5.5, erkerTop: 6.5, erkerSmall: 5.6,
};

export function buildDeRoos(_w: number, _d: number, b: BuildingTools) {
  const k: Kit = local(b, AXIS_DEG);
  const W = (f: Frame, t: number, y: number, w: number, h: number, d: number, c: Col, out = 0) => onWall(k, f, t, y, w, h, d, c, out);

  // ---------- masses: plinth below, plaster above ----------
  /** Plinth, plaster, and for a flat roof a 10 cm roofing layer whose top is the roof (cornices cover its edge). */
  const mass = (ring: V2[], top: number, plinth: Col = 'concrete', ph = H.plinth, flat = false, wall: Col = 'stone') => {
    extrude(k, ring, 0, Math.min(ph, top), plinth);
    const wt = flat ? top - 0.1 : top;
    if (wt > ph) extrude(k, ring, ph, wt, wall);
    if (flat) extrude(k, ring, wt, top, 'slate');
  };
  mass(VILLA, H.villaTop); mass(RISALIT, H.villaTop); mass(ERKER, H.erker); mass(ERKER_SMALL, H.erkerSmall, 'concrete', H.plinth, true);
  mass(PARTS.W1, H.w1, 'greyBrick', H.plinth, true); mass(PARTS.H1, H.h1, 'greyBrick'); mass(PARTS.W0, H.w0, 'greyBrick', 1.2, true); mass(PARTS.TW, H.tw, 'greyBrick', 1.5);
  mass(PARTS.V192, H.v192, 'greyBrick', 1.5, true); mass(PARTS.E12, H.e12, 'greyBrick', 1.5, true); mass(eastRing(), H.east, 'greyBrick', 2.2, true);
  mass(PARTS.LOW, H.low, 'greyBrick', 0.9, true); mass(PARTS.ING, H.ing, 'greyBrick', 0.5, true); mass(PARTS.GAR, H.gar, 'greyBrick', 0.3, true, 'blue');

  // ---------- window vocabulary ----------
  /** T-sash (register "T-schuiframen"): one glass pane, white surround, a mullion over the lower sash and a transom. */
  const tsash = (f: Frame, t: number, y: number, w: number, h: number, head = true) => {
    W(f, t, y, w, h, 0.06, 'glass');
    for (const s of [-1, 1]) W(f, t + s * (w / 2 + 0.08), y - 0.04, 0.16, h + 0.08, 0.12, 'white');
    W(f, t, y + h, w + 0.32, 0.14, 0.12, 'white');
    W(f, t, y, 0.06, h * 0.6, 0.1, 'white'); W(f, t, y + h * 0.6, w, 0.07, 0.1, 'white');
    W(f, t, y - 0.14, w + 0.4, 0.12, 0.2, 'white');
    if (head) W(f, t, y + h + 0.14, w + 0.6, 0.18, 0.22, 'white');
  };
  /** Coupled window with a high transom: `cols` lights below, small panes above (register "hooggeplaatste middendorpel"). */
  const coupled = (f: Frame, t: number, y: number, w: number, h: number, cols: number, o: {up?: number; rows?: number; glass?: Col} = {}) => {
    W(f, t, y, w, h, 0.06, o.glass ?? 'glass');
    for (const s of [-1, 1]) W(f, t + s * (w / 2 + 0.07), y - 0.04, 0.14, h + 0.08, 0.12, 'white');
    W(f, t, y + h, w + 0.28, 0.13, 0.12, 'white'); W(f, t, y - 0.13, w + 0.36, 0.12, 0.18, 'white');
    for (let i = 1; i < cols; i++) W(f, t - w / 2 + (w * i) / cols, y, 0.08, h, 0.1, 'white');
    const ty = y + h * 0.76; W(f, t, ty, w, 0.07, 0.1, 'white');
    const up = o.up ?? cols * 2; for (let i = 1; i < up; i++) if (i % (up / cols)) W(f, t - w / 2 + (w * i) / up, ty, 0.04, h * 0.24, 0.1, 'white');
    for (let r = 1; r < (o.rows ?? 1); r++) W(f, t, y + (h * 0.76 * r) / (o.rows ?? 1), w, 0.04, 0.09, 'white');
  };
  /** Barred souterrain window (register "traliewerk"). */
  const barred = (f: Frame, t: number, y: number, w: number, h: number) => {
    W(f, t, y, w, h, 0.06, 'glass'); W(f, t, y - 0.1, w + 0.2, 0.1, 0.14, 'white');
    for (let i = 0; i <= 5; i++) W(f, t - w / 2 + 0.06 + ((w - 0.12) * i) / 5, y, 0.04, h, 0.12, 'dark');
    W(f, t, y + h * 0.5, w, 0.04, 0.12, 'dark');
  };
  const band = (fc: Face, y: number, h: number, d: number, c: Col = 'white', inset = 0.05) => W(fc.f, fc.len / 2, y, fc.len - 2 * inset, h, d, c);
  /** Plaster consoles (stone slot: modelled as part of the wall, not window trim). */
  const consoles = (f: Frame, t0: number, t1: number, y: number, pitch = 0.9, h = 0.55, d = 0.36) => {
    const n = Math.max(1, Math.round((t1 - t0) / pitch));
    for (let i = 0; i <= n; i++) W(f, t0 + ((t1 - t0) * i) / n, y, 0.16, h, d, 'stone');
  };

  // ---------- 1880 villa facades ----------
  const villaFace = (fc: Face, bays: number[], o: {door?: number; noBel?: number[]; arch?: number; low?: number} = {}) => {
    const {f, len} = fc, lo = {f, len: o.low ?? len};
    // pilasters with sunk panels at the ends and between the bays
    const piers = [0.3, len - 0.3, ...bays.slice(1).map((t, i) => (t + bays[i]) / 2)];
    for (const t of piers) if (len > 3 && t > 0.25 && t < len - 0.25 && t <= lo.len - 0.3) { W(f, t, H.plinth, 0.5, 8.8, 0.06, 'white'); W(f, t, 2.4, 0.3, 2.6, 0.1, 'stone'); W(f, t, 6.9, 0.3, 2.4, 0.1, 'stone'); }
    band(lo, H.plinth - 0.12, 0.2, 0.14); // plinth cap
    band(lo, 5.45, 0.18, 0.26); band(lo, 6.25, 0.14, 0.2); // cordon pair
    for (const t of bays) {
      if (t === o.door) {
        W(f, t, 0.35, 1.3, 3.05, 0.06, 'dark'); // carved double door
        for (const s of [-1, 1]) { W(f, t + s * 0.33, 1.1, 0.4, 0.9, 0.11, 'frame'); W(f, t + s * 0.33, 2.3, 0.4, 0.8, 0.11, 'frame'); }
        W(f, t, 3.55, 1.3, 0.8, 0.06, 'glass'); W(f, t, 3.4, 1.3, 0.15, 0.1, 'white');
        for (const s of [-1, 1]) W(f, t + s * 0.8, 0.35, 0.3, 4.15, 0.14, 'white');
        W(f, t, 4.5, 2.0, 0.22, 0.24, 'white');
        W(f, t, 0.0, 1.9, 0.35, 0.45, 'concrete'); // stoep step
      } else if (!o.noBel?.includes(t)) {
        tsash(f, t, 2.1, 1.25, 2.75);
        barred(f, t, 0.45, 1.0, 0.75);
      }
      // baluster panel under the upper window, upper T-sash under an entablature on consoles
      if (!o.noBel?.includes(t)) W(f, t, 5.65, 1.55, 0.6, 0.08, 'stone');
      if (!o.noBel?.includes(t)) for (let i = 0; i < 5; i++) W(f, t - 0.6 + i * 0.3, 5.7, 0.12, 0.5, 0.16, 'white');
      tsash(f, t, 6.75, 1.2, 2.6, false);
      W(f, t, 9.5, 1.75, 0.22, 0.26, 'white'); W(f, t, 9.72, 1.95, 0.12, 0.34, 'white');
      for (const s of [-1, 1]) W(f, t + s * 0.82, 8.95, 0.16, 0.55, 0.3, 'stone'); // plaster scroll consoles
    }
    // frieze, consoles and the projecting cornice; an attic arch breaks it at `arch`
    const brk = o.arch !== undefined ? [o.arch - 1.05, o.arch + 1.05] : null;
    const a0 = o.arch !== undefined ? 0.85 : 0.05; // the front's cornice dies into the taller party-wall neighbour
    const runs: [number, number][] = brk ? [[a0, brk[0]], [brk[1], len - 0.05]] : [[a0, len - 0.05]];
    for (const [a, c] of runs) if (c - a > 0.2) {
      W(f, (a + c) / 2, 10.55, c - a, 0.2, 0.18, 'white');
      consoles(f, a + 0.3, c - 0.3, 11.3);
      W(f, (a + c) / 2, 11.85, c - a, 0.18, 0.46, 'white'); W(f, (a + c) / 2, 12.03, c - a, 0.3, 0.56, 'white');
    }
    if (brk) { // rondboog round the attic window, rising through the cornice into a dormer front
      const t = o.arch!;
      archSlab(k, f, t, 11.15, 1.0, 1.5, 0.06 + S, 'glass', -S);
      archBand(k, f, t, 11.0, 1.6, 1.85, 0.3, 0.2 + S, 'white', -S);
      archBand(k, f, t, 10.85, 2.1, 2.1, 0.12, 0.3 + S, 'white', -S);
    }
  };
  const vf = edge(VILLA[0], VILLA[1]); // P.C. Hooftstraat front, 8.5 m
  villaFace(vf, [2.35, 6.2], {door: 2.35, arch: 2.35});
  const ch = edge(VILLA[1], VILLA[2]); // chamfer to the park
  villaFace(ch, [ch.len / 2]);
  const vw = edge(VILLA[2], VILLA[3]); // west wall: free part north of the bay window, upper storey over it
  villaFace({f: vw.f, len: 6.9}, [2.1, 5.3], {noBel: [5.3], low: 3.3});
  const vs = edge(VILLA[3], VILLA[4]); // south wall above the 12.0 m block: cornice only
  W(vs.f, vs.len / 2, 12.03, vs.len - 0.1, 0.3, 0.5, 'white', 0);
  // the dormer behind the attic arch
  {
    const c = vf.f, t = 2.35, p: V2 = [c.origin[0] + c.tangent[0] * t, c.origin[1] + c.tangent[1] * t];
    slab(k, c, t, H.villaTop, 1.9, 0.75, 2.2, 'stone', -2.2); // front in the wall plane, above the wall top
    hipRoof(k, p[0] - 1.05, p[0] + 1.05, p[1] - 0.12, p[1] + 2.3, H.villaTop + 0.75, 0.5, 'slate', {ends: false, gableCol: 'stone'});
  }
  // risalit: cornice carried round, pediment (timpaan) on the garden side
  const rf = edge([7.6, -7.4], [7.6, -2.45]); // faces west, 4.95 m (W1 owns the rest)
  W(rf.f, rf.len / 2, 10.55, rf.len - 0.1, 0.2, 0.18, 'white'); consoles(rf.f, 1.0, rf.len - 1.0, 11.3);
  W(rf.f, rf.len / 2, 11.85, rf.len, 0.18, 0.46, 'white'); W(rf.f, rf.len / 2, 12.03, rf.len + 0.1, 0.3, 0.56, 'white');
  tsash(rf.f, 1.4, 6.75, 1.15, 2.6, false); W(rf.f, 1.4, 9.5, 1.7, 0.22, 0.26, 'white');
  W(rf.f, 3.75, 5.75, 1.0, 2.9, 0.06, 'glass'); W(rf.f, 3.75, 8.65, 1.3, 0.16, 0.14, 'white'); // balcony door
  for (const s of [-1, 1]) W(rf.f, 3.75 + s * 0.58, 5.75, 0.16, 2.9, 0.12, 'white');
  {
    const yb = H.villaTop, rise = 1.35, half = 2.48, vc = (-7.4 - 2.45) / 2;
    const tri = new T.Shape([new T.Vector2(-half - 0.1, 0), new T.Vector2(half + 0.1, 0), new T.Vector2(0, rise)]);
    const g = new T.ExtrudeGeometry(tri, {depth: 3.2, bevelEnabled: false}); // tympanum, running back into the mansard
    g.rotateY(Math.PI / 2); k.add(g, 'stone', 7.6, yb, vc);
    // raked cornices
    const Lr = Math.hypot(half, rise), sl = Math.atan2(rise, half);
    for (const s of [-1, 1]) {
      const bx = new T.BoxGeometry(0.5, 0.22, Lr + 0.2); bx.rotateX(s * sl); bx.translate(0, 0, 0);
      k.add(bx, 'white', 7.6 - 0.1, yb + rise / 2 - 0.07, vc + s * half / 2);
    }
    const P = (u: number, y: number, v: number) => [u, y, v];
    tris(k, [[P(7.45, yb + 0.12, vc - half - 0.2), P(10.6, yb + 0.12, vc - half - 0.2), P(10.6, yb + rise + 0.18, vc)], [P(7.45, yb + 0.12, vc - half - 0.2), P(10.6, yb + rise + 0.18, vc), P(7.45, yb + rise + 0.18, vc)],
      [P(7.45, yb + 0.12, vc + half + 0.2), P(7.45, yb + rise + 0.18, vc), P(10.6, yb + rise + 0.18, vc)], [P(7.45, yb + 0.12, vc + half + 0.2), P(10.6, yb + rise + 0.18, vc), P(10.6, yb + 0.12, vc + half + 0.2)]], 'slate');
  }
  // villa roof: flat top with all-round steep hips (register "plat dak met omlopende schilden")
  mansardRoof(k, VILLA, [1.35, 1.35, 1.35, 1.35, 1.35], H.villaTop, H.villaFlat, 'slate', 'slate', 0);
  // timber dormer with a segmental pediment on the slope above the chamfer
  {
    const c = ch.f, t = ch.len / 2, inw = 0.55, p: V2 = [c.origin[0] + c.tangent[0] * t - c.n[0] * inw, c.origin[1] + c.tangent[1] * t - c.n[1] * inw];
    const df: Frame = frame(p, c.n);
    slab(k, df, 0, H.villaTop + 0.05, 1.4, 1.95, 1.4, 'ochre', -1.3);
    W(df, 0, H.villaTop + 0.3, 0.9, 1.0, 0.06, 'glass'); W(df, 0, H.villaTop + 0.75, 0.9, 0.06, 0.1, 'white');
    segBand(k, df, 0, H.villaTop + 1.4, 1.2, 0.4, 0.22, 0.2, 'white', 0);
    slab(k, df, 0, H.villaTop + 2.0, 1.55, 0.15, 1.5, 'slate', -1.35);
  }

  // ---------- bay windows on the garden side ----------
  const erkerFaces = (ring: V2[], skip: number, top: number, lightH: number) => {
    for (let i = 0; i < ring.length; i++) {
      const fc = edge(ring[i], ring[(i + 1) % ring.length]);
      if (i >= skip || fc.len < 0.6) continue;
      band(fc, H.plinth - 0.12, 0.2, 0.14);
      if (fc.len > 1.0) { tsash(fc.f, fc.len / 2, 2.0, Math.min(fc.len - 0.5, 1.6), lightH, false); barred(fc.f, fc.len / 2, 0.45, Math.min(fc.len - 0.6, 1.0), 0.7); }
      // decoratief houtbeschot: boarded white fascia with battens
      W(fc.f, fc.len / 2, top - 0.95, fc.len - 0.04, 0.68, 0.08, 'white');
      for (let x = 0.2; x < fc.len - 0.1; x += 0.3) W(fc.f, x, top - 0.92, 0.05, 0.62, 0.12, 'stone');
      W(fc.f, fc.len / 2, top - 0.25, fc.len - 0.04, 0.15, 0.25, 'white');
    }
  };
  erkerFaces(ERKER, 4, H.erker, 2.5);
  mansardRoof(k, ERKER, [0.9, 0.9, 0.9, 0.9, 0, 0, 0], H.erker + 0.07, H.erkerTop, 'copper', 'copper', 0.25);
  erkerFaces(ERKER_SMALL, 3, H.erkerSmall, 2.4);
  { // balcony on the small bay: white balustrade along its free edges
    for (let i = 0; i < 3; i++) {
      const fc = edge(ERKER_SMALL[i], ERKER_SMALL[i + 1]);
      if (fc.len < 0.5) continue;
      slab(k, fc.f, fc.len / 2, H.erkerSmall + 0.02, fc.len, 0.15, 0.25, 'ochre', -0.25);
      slab(k, fc.f, fc.len / 2, H.erkerSmall + 0.95, fc.len, 0.12, 0.22, 'ochre', -0.24);
      for (let x = 0.15; x < fc.len - 0.05; x += 0.22) slab(k, fc.f, x, H.erkerSmall + 0.17, 0.08, 0.78, 0.1, 'ochre', -0.18);
    }
  }

  // ---------- younger wing, garden side ----------
  const rf4 = (r: V2[]) => ({n: edge(r[0], r[1]), w: edge(r[1], r[2]), s: edge(r[2], r[3]), e: edge(r[3], r[0])});
  const w1 = rf4(PARTS.W1), h1 = rf4(PARTS.H1), w0 = rf4(PARTS.W0), tw = rf4(PARTS.TW), v192 = rf4(PARTS.V192), low = rf4(PARTS.LOW), ing = rf4(PARTS.ING), gar = rf4(PARTS.GAR);
  const plinthCap = (fc: Face, y = H.plinth) => band(fc, y - 0.1, 0.16, 0.12);
  // W1 garden front (5.8 m exposed east of H1): bel-etage pair, the wide coupled window above, plain cornice
  {
    const f = w1.n.f; // viewer's left = east end (u 7.6)
    plinthCap(w1.n);
    coupled(f, 4.6, 2.1, 1.7, 2.6, 2); coupled(f, 2.4, 2.1, 1.7, 2.6, 2);
    barred(f, 4.6, 0.45, 1.0, 0.75); barred(f, 2.4, 0.45, 1.0, 0.75);
    coupled(f, 3.5, 6.2, 4.4, 2.4, 4, {up: 8});
    W(f, w1.n.len / 2, H.w1 - 0.55, w1.n.len - 0.1, 0.25, 0.3, 'white'); W(f, w1.n.len / 2, H.w1 - 0.3, w1.n.len - 0.1, 0.2, 0.42, 'white');
    // W1 south face is hidden by V192 and E12; its east face meets the risalit
  }
  // H1: five-sided serre with a red-tile skirt, balcony with timber balustrade, the hip with broad eaves
  {
    const SERRE: V2[] = [[-1.25, -3.08], [-1.25, -3.65], [-1.99, -4.19], [-3.92, -4.18], [-4.67, -3.6], [-4.66, -3.08]];
    extrude(k, SERRE, 0, 1.4, 'greyBrick'); extrude(k, SERRE, 1.4, 5.5, 'stone');
    for (let i = 0; i < SERRE.length - 1; i++) {
      const fc = edge(SERRE[i], SERRE[i + 1]);
      if (fc.len > 0.7) band(fc, 1.32, 0.14, 0.12);
      if (fc.len > 1.5) coupled(fc.f, fc.len / 2, 1.65, fc.len - 0.3, 3.5, 3, {up: 9});
      else if (fc.len > 0.7) { W(fc.f, fc.len / 2, 1.65, fc.len - 0.2, 3.5, 0.06, 'green'); W(fc.f, fc.len / 2, 1.65 + 3.5 * 0.76, fc.len - 0.2, 0.07, 0.1, 'ochre'); } // canted lights
    }
    // tile skirt (breed overstekende schilden) from 5.5 with 0.6 m overhang up to the wall at 6.2
    const skirt: V2[] = [[-0.65, -3.08], [-0.65, -3.95], [-1.75, -4.8], [-4.15, -4.8], [-5.25, -3.95], [-5.25, -3.08]];
    mansardRoof(k, [...skirt], [0.55, 0.55, 0.55, 0.55, 0.55, 0], 5.5, 6.25, 'red', 'slate', 0);
    // balcony on the skirt: slab and white timber balustrade (sober)
    const bal: V2[] = [[-1.4, -3.08], [-1.4, -3.75], [-2.1, -4.3], [-3.8, -4.3], [-4.5, -3.75], [-4.5, -3.08]];
    for (let i = 0; i < bal.length - 1; i++) {
      const fc = edge(bal[i], bal[i + 1]);
      slab(k, fc.f, fc.len / 2, 6.25, fc.len, 0.12, 0.2, 'ochre', -0.2);
      slab(k, fc.f, fc.len / 2, 7.15, fc.len, 0.1, 0.16, 'ochre', -0.18);
      for (let x = 0.12; x < fc.len - 0.05; x += 0.2) slab(k, fc.f, x, 6.37, 0.07, 0.78, 0.08, 'ochre', -0.16);
    }
    const f = h1.n.f; // H1 north wall over the serre: balcony door, top window
    W(f, h1.n.len / 2, 6.35, 1.4, 2.5, 0.06, 'glass'); for (const s of [-1, 1]) W(f, h1.n.len / 2 + s * 0.78, 6.3, 0.16, 2.6, 0.12, 'white');
    W(f, h1.n.len / 2, 8.85, 1.7, 0.14, 0.12, 'white');
    for (const t of [0.45, h1.n.len - 0.45]) W(f, t, 1.4, 0.4, 8.8, 0.06, 'white');
    hipRoof(k, -6.3, -0.3, -3.85, 7.75, H.h1, H.h1Ridge - H.h1, 'red');
    // soffit boards under the broad eaves
    for (const [u0, u1, v0, v1] of [[-5.55, -0.3, -3.85, -3.08], [-5.55, -0.3, 7.04, 7.75]] as [number, number, number, number][])
      k.add(new T.BoxGeometry(u1 - u0, 0.06, v1 - v0), 'white', (u0 + u1) / 2, H.h1 - 0.1, (v0 + v1) / 2);
    piron(k, -3.3, H.h1Ridge, -0.85); piron(k, -3.3, H.h1Ridge, 4.75);
  }
  // W0: garden side of the west part (2016 "COFFEE" corner), top-storey balcony
  {
    const f = w0.n.f, L = w0.n.len; plinthCap(w0.n, 1.2);
    coupled(f, L / 2, 4.1, 2.2, 2.3, 2, {up: 6}); coupled(f, L / 2, 7.3, 2.2, 2.2, 2, {up: 6});
    for (const [y, h] of [[7.25, 0.12], [8.15, 0.1]] as [number, number][]) slab(k, f, L / 2, y, 2.9, h, 0.75, 'ochre', 0);
    for (let x = L / 2 - 1.35; x <= L / 2 + 1.36; x += 0.2) slab(k, f, x, 7.37, 0.07, 0.78, 0.08, 'ochre', 0.62);
    W(f, L / 2, H.w0 - 0.45, L - 0.1, 0.35, 0.4, 'white');
    // west face above the low storey: balcony door over the serres, window above
    const fw = w0.w.f, Lw = w0.w.len;
    W(fw, Lw / 2, 7.75, 1.0, 2.2, 0.06, 'glass'); for (const s of [-1, 1]) W(fw, Lw / 2 + s * 0.58, 7.7, 0.16, 2.3, 0.12, 'white');
    W(fw, Lw / 2, H.w0 - 0.45, Lw - 0.1, 0.35, 0.4, 'white');
  }
  // Van Eeghenlaan block with the pyramid roof: windows, cornice line of the low storey continued
  {
    const f = tw.s.f, L = tw.s.len; // viewer's left = west
    W(f, L / 2, 3.25, L - 0.1, 0.25, 0.3, 'white');
    barred(f, L / 2, 0.5, 1.2, 0.9); tsash(f, L / 2, 4.4, 1.15, 2.2); coupled(f, L / 2, 8.0, 1.0, 1.3, 2, {up: 4});
    const fw = tw.w.f; coupled(fw, tw.w.len / 2, 7.9, 1.0, 1.4, 2, {up: 4});
    hipRoof(k, -9.75, -4.7, 1.55, 7.9, H.tw, H.twApex - H.tw, 'red');
    k.add(new T.BoxGeometry(5.05, 0.06, 6.35), 'white', -7.225, H.tw - 0.1, 4.725);
    piron(k, -7.225, H.twApex, 4.725);
  }
  // H1 on the Van Eeghenlaan: shallow balustraded bay on consoles (left), thermal window (right)
  {
    const f = h1.s.f, L = h1.s.len; // t from u -5.55
    plinthCap(h1.s, 1.5);
    barred(f, 1.25, 0.45, 1.0, 0.75); barred(f, 3.9, 0.45, 1.0, 0.75);
    tsash(f, 1.25, 2.3, 1.1, 2.5);
    { // balcony on consoles with a stone balustrade, window behind
      slab(k, f, 1.25, 7.45, 2.5, 0.3, 0.62, 'stone', 0);
      for (const s of [-1, 1]) slab(k, f, 1.25 + s * 1.0, 6.95, 0.2, 0.5, 0.5, 'stone', 0);
      coupled(f, 1.25, 7.9, 1.1, 1.9, 2, {up: 4});
      slab(k, f, 1.25, 8.55, 2.5, 0.12, 0.3, 'stone', 0.3);
      for (let x = 0.15; x <= 2.36; x += 0.17) slab(k, f, x, 7.75, 0.09, 0.8, 0.09, 'stone', 0.45);
      for (const x of [0.08, 2.42]) slab(k, f, x, 7.75, 0.16, 0.8, 0.5, 'stone', 0.08);
    }
    // thermenvenster: semicircular arch, three lights, broad moulded band
    const t = 3.85, w = 2.3, y = 2.4;
    archSlab(k, f, t, y, w, w / 2 + 1.0, 0.06 + S, 'glass', -S);
    archBand(k, f, t, y - 0.05, w + 0.5, w / 2 + 1.25, 0.25, 0.16 + S, 'white', -S);
    archBand(k, f, t, y - 0.1, w + 0.95, w / 2 + 1.5, 0.2, 0.08 + S, 'white', -S);
    for (const s of [-1, 1]) W(f, t + s * w / 6, y, 0.08, 1.0 + w / 2 * Math.sqrt(1 - (1 / 3) ** 2) - 0.05, 0.12, 'white');
    W(f, t, y + 1.0, w, 0.07, 0.1, 'white'); W(f, t, y - 0.15, w + 0.6, 0.14, 0.2, 'white');
  }
  // V192 on the Van Eeghenlaan: stair window, entrance in a round-arch surround (no. 21), upper windows, cornice
  {
    const f = v192.s.f, L = v192.s.len; // t from u -0.3
    plinthCap(v192.s, 1.5);
    W(f, 1.0, 2.6, 0.8, 4.4, 0.06, 'blue'); for (const s of [-1, 1]) W(f, 1.0 + s * 0.47, 2.55, 0.14, 4.5, 0.12, 'white'); W(f, 1.0, 7.05, 1.0, 0.14, 0.12, 'white');
    for (let r = 1; r < 6; r++) W(f, 1.0, 2.6 + r * 0.73, 0.8, 0.04, 0.1, 'white');
    barred(f, 3.0, 0.45, 1.0, 0.75); coupled(f, 3.0, 2.3, 1.2, 2.5, 2, {up: 4}); coupled(f, 3.0, 6.3, 1.2, 2.3, 2, {up: 4});
    const td = 5.3; W(f, td, 0.25, 1.15, 2.75, 0.05, 'dark');
    archSlab(k, f, td, 3.0, 1.15, 0.575, 0.06 + S, 'glass', -S);
    archBand(k, f, td, 0.25, 1.75, 3.35 + 0.3, 0.3, 0.16 + S, 'white', -S);
    coupled(f, td, 6.3, 1.2, 2.3, 2, {up: 4});
    W(f, L / 2, H.v192 - 0.55, L - 0.1, 0.25, 0.3, 'white'); W(f, L / 2, H.v192 - 0.3, L - 0.1, 0.2, 0.42, 'white');
  }
  // E12 on the Van Eeghenlaan: three axes of coupled windows, barred souterrain, plain cornice
  {
    const r = PARTS.E12, fs = edge(r[4], r[5]), f = fs.f, L = fs.len; // u 6.6 -> 16.1
    plinthCap(fs, 1.5);
    for (const t of [1.6, 4.75, 7.9]) { barred(f, t, 0.45, 1.1, 0.75); coupled(f, t, 2.3, 1.7, 2.7, 2, {up: 6}); coupled(f, t, 6.6, 1.7, 2.6, 2, {up: 6}); }
    W(f, L / 2, H.e12 - 0.6, L - 0.1, 0.25, 0.3, 'white'); W(f, L / 2, H.e12 - 0.35, L - 0.1, 0.25, 0.45, 'white');
  }
  // east block: rounded corner, window on the east side, cornice
  {
    const ring = eastRing();
    for (let i = 0; i < ring.length; i++) {
      const fc = edge(ring[i], ring[(i + 1) % ring.length]);
      if (fc.len < 1 || fc.f.n[1] < -0.9 || fc.f.n[0] < -0.9) continue; // north and west sides are against the villa and E12
      W(fc.f, fc.len / 2, H.east - 0.45, fc.len - 0.04, 0.35, 0.35, 'white');
      W(fc.f, fc.len / 2, 2.1, fc.len - 0.04, 0.14, 0.12, 'white');
      if (fc.len > 2.5) { tsash(fc.f, fc.len / 2, 2.9, 1.5, 2.6); barred(fc.f, fc.len / 2, 0.5, 1.1, 0.8); }
    }
  }

  // ---------- low storey, glass serres, the 1943 garage ----------
  {
    // LOW: Van Eeghenlaan face (window with grille, double door), garden face under the serres (glazed doors)
    const f = low.s.f, L = low.s.len; // t from u -14.7
    W(f, L / 2, H.low - 0.35, L - 0.1, 0.25, 0.3, 'white');
    garageWindow(k, f, 1.9, 0.75, 2.6, 2.0); W(f, 4.6, 0.1, 1.5, 2.5, 0.05, 'dark'); W(f, 4.6, 2.6, 1.8, 0.16, 0.12, 'white');
    const fn = low.n.f; // u -8.9 -> -14.7, exposed u -11.3 .. -8.9
    W(fn, 1.2, 0.35, 1.6, 2.4, 0.06, 'glass'); for (const s of [-1, 1]) W(fn, 1.2 + s * 0.88, 0.3, 0.16, 2.5, 0.12, 'white'); W(fn, 1.2, 2.75, 1.9, 0.14, 0.12, 'white');
    W(fn, 1.2, H.low - 0.35, 2.3, 0.25, 0.3, 'white');
    // ING: one-storey block toward the garden, entrance and six-pane windows
    const fi = ing.n.f, Li = ing.n.len;
    W(fi, Li / 2, 0.05, 1.4, 2.4, 0.05, 'dark'); W(fi, Li / 2, 2.45, 1.7, 0.14, 0.12, 'white');
    for (const t of [0.6, Li - 0.6]) coupled(fi, t, 1.0, 0.7, 1.4, 2, {up: 2, rows: 2});
    for (const fc of [ing.n, ing.e]) W(fc.f, fc.len / 2, H.ing - 0.35, fc.len - 0.04, 0.25, 0.32, 'white');
    for (const t of [1.2, 3.6]) coupled(ing.e.f, t, 1.0, 1.4, 1.4, 3, {up: 3, rows: 2});
    // glass casing round the half-round dome serre (flat top), timber serre with a glass hip, balcony above
    glassBox(k, -14.3, -11.9, -2.4, 2.4, H.low + 0.01, 6.3, true);
    glassBox(k, -11.9, -8.9, -2.9, 3.3, H.low + 0.01, 6.0, false);
    hipRoof(k, -11.95, -8.9, -2.95, 3.35, 6.0, 0.9, 'green', {ends: true});
    k.add(new T.BoxGeometry(2.6, 0.18, 4.4), 'ochre', -10.2, 7.6, 0.2);
    for (const [u, v] of [[-11.45, -1.95], [-11.45, 2.35]] as V2[]) k.add(new T.BoxGeometry(0.1, 0.9, 0.1), 'ochre', u, 7.78 + 0.45, v);
    k.add(new T.BoxGeometry(0.1, 0.1, 4.4), 'ochre', -11.45, 8.75, 0.2);
    for (const v of [-1.95, 2.35]) k.add(new T.BoxGeometry(2.55, 0.1, 0.1), 'ochre', -10.2, 8.75, v);
    for (let v = -1.75; v < 2.3; v += 0.25) k.add(new T.BoxGeometry(0.05, 0.8, 0.05), 'ochre', -11.45, 8.2, v);
    for (let u = -11.25; u < -9.0; u += 0.25) for (const v of [-1.95, 2.35]) k.add(new T.BoxGeometry(0.05, 0.8, 0.05), 'ochre', u, 8.2, v);
    // garage: pale blue, white cornice band, wide windows with grilles, skylights
    const fg = gar.s.f, Lg = gar.s.len;
    for (const fc of [gar.s, gar.w, gar.n]) W(fc.f, fc.len / 2, H.gar - 0.5, fc.len - 0.04, 0.4, 0.3, 'white');
    for (const t of [2.1, 6.0]) garageWindow(k, fg, t, 0.75, 3.0, 2.1);
    for (const t of [2.8, 7.4, 11.8, 16.4]) garageWindow(k, gar.w.f, t, 0.9, 2.6, 1.8);
    for (const t of [1.6, 4.1, 6.6]) coupled(gar.n.f, t, 1.0, 1.6, 1.6, 3, {up: 3, rows: 2});
    for (const [u, v] of [[-18.6, 0.4], [-18.6, -6.0]] as V2[]) { k.add(new T.BoxGeometry(3.2, 0.5, 1.6), 'stone', u, H.gar + 0.25, v); k.add(new T.BoxGeometry(2.9, 0.3, 1.3), 'green', u, H.gar + 0.65, v); }
  }
}

/** Red ceramic piron on a ridge end or apex. */
function piron(k: Kit, u: number, y: number, v: number) {
  const g = new T.CylinderGeometry(0.05, 0.13, 0.45, 8); k.add(g, 'red', u, y + 0.2, v);
  k.add(new T.SphereGeometry(0.11, 8, 6), 'red', u, y + 0.5, v);
}
/** Wide garage window: glass, white frame grid, dark iron grille with a scroll band. */
function garageWindow(k: Kit, f: Frame, t: number, y: number, w: number, h: number) {
  const W = (tt: number, yy: number, ww: number, hh: number, d: number, c: Col) => onWall(k, f, tt, yy, ww, hh, d, c);
  W(t, y, w, h, 0.06, 'glass');
  for (const s of [-1, 1]) W(t + s * (w / 2 + 0.07), y - 0.04, 0.14, h + 0.08, 0.12, 'white');
  W(t, y + h, w + 0.28, 0.13, 0.12, 'white'); W(t, y - 0.13, w + 0.36, 0.12, 0.18, 'white');
  const cols = Math.round(w / 0.5); for (let i = 1; i < cols; i++) W(t - w / 2 + (w * i) / cols, y, 0.05, h, 0.1, 'white');
  for (const r of [0.33, 0.66]) W(t, y + h * r, w, 0.05, 0.1, 'white');
  const bars = Math.round(w / 0.5); for (let i = 1; i < bars; i++) W(t - w / 2 + (w * i) / bars + 0.25, y, 0.025, h, 0.16, 'frame');
  W(t, y + h * 0.82, w, 0.08, 0.16, 'frame');
}
/** Glazed box with a white frame grid; `cap` closes the top with a flat glass roof and a white edge. */
function glassBox(k: Kit, u0: number, u1: number, v0: number, v1: number, y0: number, y1: number, cap: boolean) {
  const h = y1 - y0, uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
  k.add(new T.BoxGeometry(u1 - u0, h, v1 - v0), 'green', uc, y0 + h / 2, vc);
  for (let u = u0; u <= u1 + 1e-6; u += (u1 - u0) / Math.max(1, Math.round((u1 - u0) / 0.6)))
    for (const v of [v0, v1]) k.add(new T.BoxGeometry(0.08, h, 0.08), 'ochre', u, y0 + h / 2, v);
  for (let v = v0; v <= v1 + 1e-6; v += (v1 - v0) / Math.max(1, Math.round((v1 - v0) / 0.6)))
    for (const u of [u0, u1]) k.add(new T.BoxGeometry(0.08, h, 0.08), 'ochre', u, y0 + h / 2, v);
  for (const y of [y0 + 0.5, y0 + h * 0.7, y1 - 0.05]) {
    k.add(new T.BoxGeometry(u1 - u0 + 0.1, 0.07, 0.1), 'ochre', uc, y, v0); k.add(new T.BoxGeometry(u1 - u0 + 0.1, 0.07, 0.1), 'ochre', uc, y, v1);
    k.add(new T.BoxGeometry(0.1, 0.07, v1 - v0 + 0.1), 'ochre', u0, y, vc); k.add(new T.BoxGeometry(0.1, 0.07, v1 - v0 + 0.1), 'ochre', u1, y, vc);
  }
  if (cap) k.add(new T.BoxGeometry(u1 - u0 + 0.2, 0.12, v1 - v0 + 0.2), 'ochre', uc, y1 + 0.06, vc);
}
