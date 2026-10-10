import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import type {Surface} from './worship-shell';
import {poly, put, ringFrame, setSink, slab, wallProbe} from './nearbar-kit';
import type {Frame} from './nearbar-kit';
import source from './american-hotel-footprints.json';

// Local round-head primitives with 4 curve segments per half circle (the shared kit uses 8). The Hotel carries several hundred
// round-headed openings and the lane budget is < 30000 triangles; at window scale (0.5-1.3 m wide) the polygonal head is invisible.
const SINK = 0.5, CS = 4;
const archSlab = (b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, d: number, colour: string, out = 0) => {
  const s = new T.Shape(), r = w / 2;
  s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, h - r); s.absarc(0, h - r, r, 0, Math.PI, false); s.lineTo(-r, 0);
  put(b, f, new T.ExtrudeGeometry(s, {depth: d + SINK, bevelEnabled: false, curveSegments: CS}), t, y, out - SINK, colour);
};
const archBand = (b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, th: number, d: number, colour: string, out = 0) => {
  const r = w / 2, ri = r - th, s = new T.Shape();
  s.moveTo(-r, 0); s.lineTo(-r, h - r); s.absarc(0, h - r, r, Math.PI, 0, true); s.lineTo(r, 0);
  s.lineTo(ri, 0); s.lineTo(ri, h - r); s.absarc(0, h - r, ri, 0, Math.PI, false); s.lineTo(-ri, 0); s.lineTo(-r, 0);
  put(b, f, new T.ExtrudeGeometry(s, {depth: d + SINK, bevelEnabled: false, curveSegments: CS}), t, y, out - SINK, colour);
};
const segBand = (b: BuildingTools, f: Frame, t: number, y: number, W: number, rise: number, th: number, d: number, colour: string, out = 0) => {
  const R = (W * W / 4 + rise * rise) / (2 * rise), n = 6, pts: [number, number][] = [];
  const yo = (x: number) => rise - R + Math.sqrt(R * R - x * x);
  for (let i = 0; i <= n; i++) { const x = -W / 2 + W * i / n; pts.push([x, yo(x)]); }
  for (let i = n; i >= 0; i--) { const x = -W / 2 + W * i / n; pts.push([x, yo(x) - th]); }
  poly(b, f, t, y, pts, d, colour, out);
};
const archWindows = (b: BuildingTools, f: Frame, ts: number[], o: {y: number; w: number; h: number; frame?: string; glass?: string; sill?: string; bars?: number; rows?: number}) => {
  const frame = o.frame ?? 'white', glass = o.glass ?? 'glass';
  for (const t of ts) {
    archSlab(b, f, t, o.y - 0.04, o.w + 0.2, o.h + 0.12, 0.08, frame);
    archSlab(b, f, t, o.y, o.w, o.h, 0.11, glass);
    const bars = o.bars ?? 1;
    for (let k = 1; k <= bars; k++) slab(b, f, t - o.w / 2 + o.w * k / (bars + 1), o.y, 0.05, o.h - o.w / 2, 0.14, frame);
    const rows = o.rows ?? 2;
    for (let r = 1; r <= rows; r++) slab(b, f, t, o.y + (o.h - o.w / 2) * r / (rows + 1), o.w, 0.05, 0.14, frame);
    if (o.sill) slab(b, f, t, o.y - 0.14, o.w + 0.45, 0.1, 0.2, o.sill);
  }
};

/**
 * American Hotel (Leidseplein 28, Willem Kromhout and H.G. Jansen, 1900-02, extended 1927-28 by G.J. Rutgers):
 * the 3DBAG LoD2.2 shell of BAG 0363100012168734 in native east/south metres. Brick colours: the buff
 * Jugendstil hotel (Leidseplein and the street side) against the dark-brown 1920s block along the
 * Leidsekade canal. Detail follows the 2021-2025 municipal panoramas:
 *  - Leidseplein front (SE, ring edges 58-68, 36 m): ground-floor shop glazing under the Bar Americain canopy,
 *    small round-headed windows, the big round entrance arch, the three arched Cafe Americain windows,
 *    the first-floor balcony with balustrade and striped awnings, upper arched windows, the eaves balustrade
 *    and the two stepped roof gables; the slender corner tower with its arched window columns;
 *  - street side (NE, ring edges 12-25): the staircase tower, the canted oriel, four tall double-height
 *    windows under stone arches, five fan-tracery windows, the stone cornice with cross studs, the top-storey
 *    windows (two storeys on seven axes) and three narrow tall arched windows on corbelled piers;
 *  - canal side (SW, ring edges 31-38, curved): rusticated stone plinth, eight round-headed ground windows,
 *    the arcade of twelve narrow arched windows between carved pilasters, a brick band, six canted bays of
 *    three-window oriels on three floors and the hooded attic windows.
 * Window positions are scaled off the panoramas to about 0.3 m; the NW sides are party walls.
 */
export function buildAmericanHotel(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  // The 1920s canal block is dark brown brick; the shell gets two wall colours.
  const brown = (s: Surface) => {
    const r = s.rings[0];
    return r.reduce((a, p) => a + p[0], 0) / r.length < -17.7;
  };
  // The tower's peaked cap (roof planes 488, 496, 511) is pale stone like its shaft, not tile (2016 summer panorama).
  const towerCap = (_s: Surface, i: number) => (i === 488 || i === 496 || i === 511 ? 'stone' : 'slate');
  const shellGeoms: T.BufferGeometry[] = [];
  const bs = {...b, add: (g: T.BufferGeometry, c: never, x?: number, y?: number, z?: number, a?: number) => { b.add(g, c, x, y, z, a); shellGeoms.push(g.clone()); }} as BuildingTools;
  addShell(bs, source as never, {wall: 'sandstone', roof: 'slate', roofFor: towerCap, skip: (s) => s.type === 'WallSurface' && brown(s)});
  addShell(bs, source as never, {wall: 'greyBrick', roof: 'slate', skip: (s) => s.type !== 'WallSurface' || !brown(s)});
  const probe = wallProbe(shellGeoms);
  b.mark?.('shell');
  setSink(0.5);
  const ring = (source.nativeRing as number[][]).slice(0, -1);
  const fr = (i: number) => ringFrame(ring, i);

  /** Fan-tracery head: radial spokes and a ring inside a round-headed window of width w, springing at yTop - w/2. */
  const fan = (f: Frame, t: number, ySpring: number, w: number) => {
    const r = w / 2 - 0.08;
    for (let k = 1; k <= 4; k++) {
      const a = Math.PI * k / 5;
      const g = new T.BoxGeometry(r, 0.05, 0.1).translate(r / 2, 0, 0.05).rotateZ(a);
      put(b, f, g, t, ySpring, 0.1, 'frame');
    }
    put(b, f, new T.CylinderGeometry(r * 0.45, r * 0.45, 0.08, 14).rotateX(Math.PI / 2).translate(0, r * 0.1, 0.04), t, ySpring, 0.08, 'frame');
  };
  /** Round-headed window with stone arch band, sill and optional fan. */
  const arched = (f: Frame, t: number, y: number, w: number, h: number, o: {fan?: boolean; bars?: number; rows?: number; band?: 'stone' | 'greyBrick'} = {}) => {
    archBand(b, f, t, y - 0.02, w + 0.7, h + 0.35, 0.28, 0.12, o.band ?? 'stone');
    archWindows(b, f, [t], {y, w, h, bars: o.bars ?? 1, rows: o.rows ?? 2, sill: 'stone'});
    if (o.fan) fan(f, t, y + h - w / 2, w);
  };
  const band = (f: Frame, t0: number, t1: number, y: number, h: number, d: number, c: 'stone' | 'greyBrick' | 'sandstone' = 'stone') => slab(b, f, (t0 + t1) / 2, y, t1 - t0, h, d, c);
  const sill = (f: Frame, t: number, y: number, w: number) => slab(b, f, t, y - 0.12, w, 0.12, 0.25, 'stone');

  // =============================== Leidseplein front (SE), frame from ring edge 58 ===============================
  {
    const {f} = fr(58);
    const L = 36.2;
    band(f, 0.2, L, 0, 1.0, 0.18);                                 // stone plinth
    band(f, 0.2, L, 6.95, 0.35, 0.45);                             // first-floor string and balcony floor
    band(f, 0.2, L, 13.0, 0.45, 0.4);                              // eaves cornice
    // left wing: shop glazing under the Bar Americain canopy and small round-headed windows
    for (let k = 0; k < 5; k++) {
      const t = 3.6 + 1.7 * k;
      slab(b, f, t, 0.9, 1.3, 2.4, 0.1, 'glass');
      slab(b, f, t, 0.9, 0.06, 2.4, 0.14, 'frame');
      arched(f, t, 3.9, 1.0, 1.7, {bars: 1, rows: 1});
    }
    slab(b, f, 6.6, 3.35, 7.4, 0.12, 0.4, 'white');                // canopy
    slab(b, f, 6.6, 3.1, 7.4, 0.3, 0.12, 'dark', 0.4);            // canopy valance
    // big round entrance arch with door
    archSlab(b, f, 12.4, 0.9, 5.4, 6.4, 0.2, 'dark');
    archBand(b, f, 12.4, 0.9, 5.9, 6.7, 0.45, 0.28, 'stone');
    archSlab(b, f, 12.4, 1.0, 2.2, 3.4, 0.3, 'dark');
    archBand(b, f, 12.4, 1.0, 2.7, 3.7, 0.25, 0.35, 'stone');
    for (let s = 0; s < 3; s++) slab(b, f, 12.4, 0.0 + s * 0.28, 4.0 - s * 0.5, 0.28, 0.3 + s * 0.2, 'stone');
    // three arched Cafe Americain windows
    for (const t of [19.2, 25.9, 32.6]) {
      archBand(b, f, t, 0.7, 5.9, 6.2, 0.45, 0.25, 'stone');
      archWindows(b, f, [t], {y: 1.0, w: 5.0, h: 5.2, bars: 3, rows: 4, sill: 'stone'});
    }
    // balcony balustrade with posts across the cafe part, striped awnings, upper arched windows
    for (let t = 15.4; t < L - 0.5; t += 0.5) slab(b, f, t, 7.3, 0.14, 0.9, 0.18, 'stone', 0.5);
    slab(b, f, 25.9, 8.2, 22.0, 0.12, 0.2, 'stone', 0.5);
    slab(b, f, 25.9, 7.3, 22.0, 0.14, 0.16, 'stone', 0.5);
    for (const t of [19.2, 25.9, 32.6]) {
      for (const dt of [-1.8, 0, 1.8]) archWindows(b, f, [t + dt], {y: 8.5, w: 1.1, h: 3.4, bars: 1, rows: 2, sill: 'stone'});
    }
    // upper floors over the left wing: arched windows on two rows
    for (const t of [4.2, 6.6, 9.0]) {
      archWindows(b, f, [t], {y: 8.3, w: 1.2, h: 2.4, bars: 1, rows: 2, sill: 'stone'});
      archWindows(b, f, [t], {y: 10.9, w: 1.1, h: 1.8, bars: 1, rows: 1, sill: 'stone'});
    }
    // oriel bay over the entrance and its pair of tall windows
    poly(b, f, 12.4, 7.0, [[-2.2, 0], [2.2, 0], [1.9, 5.8], [-1.9, 5.8]], 0.9, 'sandstone', 0.15);
    for (const dt of [-1.0, 1.0]) archWindows(b, f, [12.4 + dt], {y: 7.6, w: 1.0, h: 3.4, bars: 1, rows: 2, frame: 'white', sill: 'stone'});
    slab(b, f, 12.4, 10.9, 4.6, 0.25, 1.05, 'stone');
    slab(b, f, 12.4, 11.15, 3.4, 1.7, 0.6, 'sandstone', 0.3);
    for (const dt of [-0.9, 0.9]) archWindows(b, f, [12.4 + dt], {y: 11.5, w: 0.9, h: 1.3, bars: 1, rows: 1, sill: 'stone'});
    // eaves balustrade over the cafe part
    for (let t = 15.4; t < L - 0.5; t += 0.5) slab(b, f, t, 13.45, 0.14, 0.7, 0.16, 'stone', 0.3);
    slab(b, f, 25.9, 14.15, 22.0, 0.12, 0.2, 'stone', 0.3);
    // gable windows
    const fUp = ringFrame(ring, 58, -1.2).f;   // the 3DBAG upper storeys of this front stand 1.2 m behind the ring line
    // Two storeys of round-headed windows over the eaves balustrade on an even 3.35 m pitch: two per cafe bay
    // (bay centre +- 1.675) plus one over the entrance oriel. Recounted on 2026-10-10 from the leaf-off panorama
    // b_20241217_0841_Track38_Sphere_00011 (33 m out); the earlier four-axis count left a blank band between the
    // gables and broke the rhythm of the storeys below.
    // Each window snaps onto the 3DBAG wall where it really stands (the upper storeys step back 0.5-2 m behind the ring).
    for (const t of [14.2, 17.5, 20.9, 24.2, 27.6, 30.9, 34.3]) {
      for (const y of [14.0, 16.6]) { const off = probe.offset(fUp, t, y + 0.8); if (off !== null) arched(probe.snap(fUp, t, y + 0.8), t, y, 0.9, 1.5); }
    }
    // left wing (t 3-10): its two lower storeys continue upward on the same three axes
    for (const t of [4.2, 6.6, 9.0]) for (const y of [13.6, 16.2]) { const off = probe.offset(f, t, y + 0.9); if (off !== null) archWindows(b, probe.snap(f, t, y + 0.9), [t], {y, w: 1.1, h: 1.8, bars: 1, rows: 1, sill: 'stone'}); }
    for (const t of [20.8, 30.5]) poly(b, f, t, 13.4, [[-2.4, 0], [2.4, 0], [2.4, 0.5], [0, 0.5]], 0.4, 'stone', 0.2);
  }

  // tower: window columns on its SE face (edge 58, t 0.3-2.2) and SW face (edge 43, t 2.7-5.4)
  {
    const {f} = fr(58), g = fr(43).f;
    for (const y of [1.6, 5.0, 8.4, 12.0, 15.6, 19.2, 23.0, 26.6, 30.2]) {
      for (const [fr2, tt] of [[f, 1.25], [g, 4.05]] as [Frame, number][]) {
        slab(b, fr2, tt, y, 0.85, 2.1, 0.1, 'glass'); slab(b, fr2, tt, y + 2.1, 1.15, 0.2, 0.16, 'stone'); slab(b, fr2, tt, y, 0.05, 2.1, 0.14, 'frame');
      }
    }
    for (const y of [3.7, 10.8, 17.9, 25.2, 32.4]) { slab(b, f, 1.25, y, 2.3, 0.2, 0.3, 'stone'); slab(b, g, 4.05, y, 2.5, 0.2, 0.3, 'stone'); }
    slab(b, f, 1.25, 36.2, 2.6, 0.5, 0.45, 'stone'); slab(b, g, 4.05, 36.2, 2.9, 0.5, 0.45, 'stone');
    // clock faces under the cap, as in the summer panorama
    for (const [fr2, tt, dz] of [[f, 1.25, -0.02], [g, 4.05, -0.25]] as [Frame, number, number][]) {
      put(b, fr2, new T.CylinderGeometry(0.7, 0.7, 0.12, 20).rotateX(Math.PI / 2), tt, 34.6, dz, 'white');
      put(b, fr2, new T.TorusGeometry(0.72, 0.06, 6, 20), tt, 34.6, dz + 0.02, 'stone');
    }
  }

  // =============================== Street side (NE) ===============================
  {
    const frN = (i: number) => ringFrame(ring, i, 0.3);   // the shell wall stands 0.3 m outside the BAG ring here
    const {f} = frN(19), L = 12.1;
    band(f, -0.5, L + 5.8, 0, 1.5, 0.3);                               // rusticated stone plinth
    for (let y = 0.5; y < 1.5; y += 0.5) slab(b, f, (L + 5.3) / 2, y, L + 6.3, 0.04, 0.34, 'greyBrick');
    for (const t of [1.55, 4.65, 7.75, 10.85]) {
      // double-height ground window: segmental stone head, transom
      segBand(b, f, t, 7.2, 3.1, 0.7, 0.3, 0.14, 'stone');
      slab(b, f, t, 1.75, 2.3, 5.9, 0.12, 'glass');
      for (const dx of [-0.38, 0.38]) slab(b, f, t + dx, 1.75, 0.06, 5.9, 0.16, 'frame');
      for (const y of [4.6, 3.2, 6.0]) slab(b, f, t, y, 2.3, 0.06, 0.16, 'frame');
      slab(b, f, t, 1.6, 2.7, 0.15, 0.3, 'stone');
      // basement window in the plinth
      slab(b, f, t, 0.45, 0.9, 0.55, 0.1, 'dark');
      // storey-2 fan window
      arched(f, t, 10.1, 2.2, 4.8, {fan: true, bars: 1, rows: 3});
    }
    // Two storeys over the stone cornice on seven even axes (t 0.8-13.9). Recounted on 2026-10-10 from panorama
    // TMX7316010203-002985_pano_0003_000472 (2023-02-27, 13 m out): the earlier single row of four top windows left a blank
    // storey over the fan windows and broke the rhythm of the street side.
    for (let k = 0; k < 7; k++) {
      const t = 0.8 + 13.1 * k / 6;
      for (const [y, h] of [[15.35, 1.35], [17.05, 1.2]] as const) {
        slab(b, f, t, y - 0.06, 1.45, h + 0.12, 0.08, 'white'); slab(b, f, t, y, 1.2, h, 0.1, 'glass');
        slab(b, f, t, y, 0.05, h, 0.14, 'white'); slab(b, f, t, y + h * 0.62, 1.2, 0.05, 0.14, 'white'); sill(f, t, y, 1.5);
      }
    }
    for (const t of [3.1, 6.2, 9.3, 12.0]) slab(b, f, t, 9.0, 0.3, 0.3, 0.18, 'dark');   // cross studs
    band(f, -0.5, L + 5.8, 8.3, 0.5, 0.35);                               // stone cornice
    band(f, -0.5, L + 5.8, 14.95, 0.35, 0.3);
    band(f, -0.5, L + 5.8, 18.6, 0.5, 0.45);                              // eaves
    // fifth bay over the recess zone and the three recessed arches on corbelled piers
    arched(f, 13.95, 10.1, 2.2, 4.8, {fan: true, bars: 1, rows: 3});
    // three narrow tall arched windows over white panels (the panorama shows glazing, not dark recesses), the door under the middle
    for (const t of [14.2, 16.7, 19.2]) {
      archBand(b, f, t, 1.5, 2.2, 5.5, 0.3, 0.2, 'stone');
      slab(b, f, t, 1.5, 1.6, 1.6, 0.1, t === 16.7 ? 'dark' : 'white');
      archWindows(b, f, [t], {y: 3.2, w: 1.4, h: 3.6, bars: 1, rows: 2, sill: 'stone'});
    }
    for (const t of [12.9, 15.45, 17.95, 20.4]) slab(b, f, t, 1.5, 0.45, 5.4, 0.25, 'stone');
    // staircase tower (edge 16) with arched windows and the canted oriel
    const g = frN(16).f;
    for (const y of [3.0, 6.6, 10.2, 13.8, 17.4]) archWindows(b, g, [0.0], {y, w: 0.9, h: 2.0, bars: 1, rows: 1, sill: 'stone'});
    slab(b, g, 0.0, 19.6, 3.2, 0.5, 0.45, 'stone');
    // oriel: three arched windows on two rows
    poly(b, g, 2.5, 0, [[-1.4, 0], [1.4, 0], [1.4, 8.0], [-1.4, 8.0]], 0.5, 'sandstone', 0.15);
    for (const dx of [-0.8, 0, 0.8]) { archWindows(b, g, [2.5 + dx], {y: 1.9, w: 0.5, h: 1.8, bars: 0, rows: 1, glass: 'copper'}); archWindows(b, g, [2.5 + dx], {y: 5.4, w: 0.5, h: 1.8, bars: 0, rows: 1, glass: 'copper'}); }
    slab(b, g, 2.5, 8.0, 3.2, 0.3, 0.8, 'stone');
    // low east wing (edge 12): three arched openings and the string course
    const h = frN(12).f;
    band(h, -1.0, 9.0, 0, 1.0, 0.3);
    band(h, -1.0, 9.0, 13.0, 0.4, 0.35);
    for (const t of [1.2, 3.7, 6.2]) { arched(h, t, 2.8, 1.5, 3.6, {bars: 1, rows: 2}); slab(b, h, t, 7.2, 1.6, 2.2, 0.08, 'glass'); slab(b, h, t, 7.2, 0.06, 2.2, 0.12, 'frame'); slab(b, h, t, 8.4, 1.6, 0.06, 0.12, 'frame'); }
  }

  // =============================== Canal side (SW), curved: polyline of ring edges 31-38 ===============================
  {
    const edges = [31, 32, 33, 34, 35, 36, 37, 38];
    const fs = edges.map(i => fr(i));
    const total = fs.reduce((a, e) => a + e.len, 0);
    /** Frame and local t for arc-length position s along the curve. */
    const at = (s: number) => {
      let acc = 0;
      for (const e of fs) { if (s <= acc + e.len || e === fs[fs.length - 1]) return {f: e.f, t: s - acc}; acc += e.len; }
      return {f: fs[0].f, t: 0};
    };
    const bays = 6, pitch = total / bays;
    const sc = (s: number) => at(s);
    // plinth, band and cornice courses edge by edge
    fs.forEach(({f, len}) => {
      band(f, 0, len, 0, 2.1, 0.25);
      for (const y of [0.7, 1.4]) slab(b, f, len / 2, y, len, 0.04, 0.28, 'greyBrick');
      band(f, 0, len, 2.1, 0.22, 0.3);
      band(f, 0, len, 8.4, 0.3, 0.32);
      band(f, 0, len, 10.4, 0.35, 0.34);
      band(f, 0, len, 20.1, 0.55, 0.5);
    });
    // eight round-headed ground windows
    for (let k = 0; k < 8; k++) { const {f, t} = sc(total * (k + 0.5) / 8); archWindows(b, f, [t], {y: 2.6, w: 1.3, h: 2.3, bars: 1, rows: 2, sill: 'stone'}); }
    // arcade of twelve narrow arched windows between carved pilasters
    for (let k = 0; k < 12; k++) {
      const {f, t} = sc(total * (k + 0.5) / 12);
      archWindows(b, f, [t], {y: 5.2, w: 0.85, h: 3.0, bars: 1, rows: 2, glass: 'glass', frame: 'dark'});
    }
    for (let k = 0; k <= 12; k++) { const {f, t} = sc(Math.min(total - 0.05, Math.max(0.05, total * k / 12))); slab(b, f, t, 5.0, 0.4, 3.4, 0.22, 'stone'); slab(b, f, t, 8.2, 0.55, 0.3, 0.3, 'stone'); }
    // six canted bays, three floors
    for (let k = 0; k < bays; k++) {
      const {f, t} = sc(pitch * (k + 0.5));
      for (const y of [11.2, 14.5, 17.6]) {
        poly(b, f, t, y - 0.35, [[-1.55, 0], [1.55, 0], [1.2, 2.9], [-1.2, 2.9]], 0.55, 'greyBrick', 0.0);
        slab(b, f, t, y + 0.1, 2.3, 1.7, 0.62, 'glass');
        for (const dx of [-1.15, -0.38, 0.38, 1.15]) slab(b, f, t + dx, y + 0.05, 0.08, 1.8, 0.7, 'stone');
        slab(b, f, t, y + 1.0, 2.3, 0.05, 0.68, 'frame');
        slab(b, f, t, y + 2.1, 3.0, 0.2, 0.75, 'stone');
        slab(b, f, t, y - 0.45, 3.0, 0.18, 0.7, 'stone');
      }
      // hooded attic window
      slab(b, f, t, 19.45, 1.4, 0.85, 0.1, 'glass');
      for (const dx of [-0.23, 0.23]) slab(b, f, t + dx, 19.45, 0.05, 0.85, 0.14, 'frame');
      segBand(b, f, t, 20.2, 1.9, 0.45, 0.18, 0.2, 'stone');
    }
  }

  // =============================== Leidsekade gable front (SW, ring edge 39, 6.7 m) ===============================
  // Until 2026-10-10 this buff Jugendstil gable front between the brown 1920s canal block and the tower had no detail at all:
  // a blank sandstone wall in the middle of the canal elevation. Spec from panorama TMX7316010203-001968_pano_0000_000120
  // (2021-01-18, 28 m out, square-on): four window axes, mirror-free; from the ground: the arched entrance with its canopy on the
  // left axis and three stone-framed windows; a storey of four rectangular windows; a balustrade; the four-arch tracery arcade
  // with ring tracery (~8.9-12.5 m); two storeys of four round-headed windows; a five-light arcaded gallery under the pointed gable.
  {
    const {f, len} = fr(39);
    const ax = [0, 1, 2, 3].map(k => len * (k + 0.5) / 4);
    band(f, 0, len, 0, 1.0, 0.2);                                     // plinth
    // ground storey
    archBand(b, f, ax[0], 0.9, 2.1, 3.6, 0.3, 0.2, 'stone');
    archSlab(b, f, ax[0], 0.9, 1.6, 3.4, 0.12, 'dark');
    slab(b, f, ax[0], 3.6, 2.3, 0.15, 1.3, 'dark');                   // canopy
    for (const t of ax.slice(1)) { slab(b, f, t, 1.15, 1.6, 2.1, 0.14, 'stone'); slab(b, f, t, 1.3, 1.25, 1.8, 0.1, 'glass', 0.14); slab(b, f, t, 1.3, 0.05, 1.8, 0.14, 'frame', 0.2); }
    band(f, 0, len, 4.25, 0.25, 0.3);
    // storey 2: rectangular windows
    for (const t of ax) { slab(b, f, t, 4.7, 1.2, 1.8, 0.1, 'glass'); slab(b, f, t, 4.7, 0.05, 1.8, 0.14, 'frame'); slab(b, f, t, 5.6, 1.2, 0.05, 0.14, 'frame'); sill(f, t, 4.7, 1.4); }
    // balustrade
    band(f, 0, len, 8.0, 0.25, 0.45);
    for (let t = 0.3; t < len - 0.2; t += 0.4) slab(b, f, t, 8.25, 0.12, 0.55, 0.16, 'stone', 0.25);
    band(f, 0, len, 8.8, 0.12, 0.42);
    // tracery arcade: four arches with a ring in each head
    for (const t of ax) {
      archBand(b, f, t, 9.0, 1.6, 3.5, 0.18, 0.18, 'stone');
      archSlab(b, f, t, 9.0, 1.4, 3.4, 0.1, 'glass');
      for (const dx of [-0.35, 0.35]) slab(b, f, t + dx, 9.0, 0.06, 2.6, 0.14, 'frame');
      put(b, f, new T.TorusGeometry(0.45, 0.06, 4, 12), t, 11.6, 0.14, 'stone');
    }
    band(f, 0, len, 12.6, 0.3, 0.3);
    // two storeys of round-headed windows
    for (const y of [13.2, 15.4]) for (const t of ax) arched(f, t, y, 0.9, 1.6, {bars: 1, rows: 1});
    band(f, 0, len, 17.4, 0.25, 0.3);
    // arcaded gallery under the gable
    for (let k = 0; k < 5; k++) archWindows(b, f, [len * (k + 0.5) / 5], {y: 17.8, w: 0.6, h: 1.2, bars: 0, rows: 1, frame: 'white', sill: 'stone'});
    for (let k = 0; k <= 5; k++) slab(b, f, Math.min(len - 0.1, Math.max(0.1, len * k / 5)), 17.7, 0.2, 1.4, 0.18, 'stone');
    // the narrow bay between the gable front and the tower (edge 43, t ~1.3): a door, then one window per storey
    const g = fr(43).f, tb = 1.3;
    archSlab(b, g, tb, 0.9, 1.2, 2.8, 0.12, 'dark'); archBand(b, g, tb, 0.9, 1.6, 3.0, 0.2, 0.18, 'stone');
    slab(b, g, tb, 4.7, 1.0, 1.8, 0.1, 'glass'); slab(b, g, tb, 4.7, 0.05, 1.8, 0.14, 'frame'); sill(g, tb, 4.7, 1.2);
    arched(g, tb, 9.0, 1.0, 3.4, {bars: 1, rows: 2});
    for (const y of [13.2, 15.4]) arched(g, tb, y, 0.9, 1.6, {bars: 1, rows: 1});
  }

  // =============================== Roofline (Kromhout's ornate skyline) ===============================
  // Counted from the 2007 Commons photo (ref-commons-americain.jpg: 5 stepped dormer gables along the Leidseplein roof, the big
  // pointed corner gable over Marnixstraat with its blue ceramic star and zig-zag, the round stone turret beside the clock tower)
  // and the 2022 leaf-off panorama crops. Dormer gable walls stand 2.0 m behind the ring line (3DBAG wall planes n = -2.0);
  // axes t = 9.0, 15.9, 21.0, 26.8 and 32.7 from the 3DBAG dormer gable walls (the leftmost is the small one by the tower).
  {
    const Fd = ringFrame(ring, 58, -2.0).f;
    /** Stair-stepped gable silhouette, half-width hw at the base, step height sh, n steps, apex height = n * sh. */
    const stepGable = (hw: number, sh: number, n: number): [number, number][] => {
      const right: [number, number][] = [[hw, 0]];
      let w = hw;
      for (let k = 0; k < n; k++) { right.push([w, (k + 1) * sh]); w -= hw / n; if (k < n - 1) right.push([w, (k + 1) * sh]); }
      right.push([0.0, n * sh]);
      const left = right.slice(1, -1).reverse().map(([x, y]) => [-x, y] as [number, number]);
      return [[-hw, 0], ...right, ...left];
    };
    for (const c of [9.0, 15.9, 21.0, 26.8, 32.7]) {
      // crenellated corbel ledge with merlons, three tall windows over it
      slab(b, Fd, c, 18.9, 3.9, 0.45, 0.55, 'stone');
      for (let k = 0; k < 6; k++) slab(b, Fd, c - 1.6 + k * 0.64, 19.35, 0.34, 0.32, 0.22, 'stone', 0.33);
      for (const dx of [-1.2, 1.2]) archWindows(b, Fd, [c + dx], {y: 19.8, w: 0.55, h: 1.7, bars: 0, rows: 2, frame: 'white', sill: 'stone'});
      slab(b, Fd, c, 19.8, 1.0, 1.5, 0.1, 'glass');
      slab(b, Fd, c, 19.8, 1.15, 0.12, 0.18, 'stone'); slab(b, Fd, c, 21.3, 1.3, 0.14, 0.22, 'stone');
      slab(b, Fd, c, 19.8, 0.05, 1.5, 0.14, 'frame');
      // stepped gable: stone coping silhouette with a sandstone field, two small arched windows, pinnacle and flagpole
      const sil = stepGable(1.75, 0.8, 5);
      poly(b, Fd, c, 21.55, sil, 0.28, 'stone', 0.0);
      poly(b, Fd, c, 21.6, sil.map(([x, y]) => [x * 0.8, y * 0.86] as [number, number]), 0.34, 'sandstone', 0.0);
      for (const dx of [-0.42, 0.42]) archWindows(b, Fd, [c + dx], {y: 22.3, w: 0.38, h: 1.25, bars: 0, rows: 1, frame: 'white', glass: 'dark'});
      slab(b, Fd, c, 25.5, 0.45, 1.2, 0.4, 'stone', 0.0);
      slab(b, Fd, c, 26.7, 0.62, 0.18, 0.5, 'stone', 0.0);
      slab(b, Fd, c, 26.7, 0.05, 3.4, 0.05, 'frame', 0.1);
    }
    // big pointed corner gable over the Marnixstraat corner (NE wall, frame of ring edge 12, t = -5.4 .. -1.6, base 21.2 m)
    const Fn = ringFrame(ring, 12, 0.3).f;
    const gc = -3.0, gw = 2.4, base = 21.0, apex = 29.4;
    const tri: [number, number][] = [[-gw, 0], [gw, 0], [0, apex - base]];
    poly(b, Fn, gc, base, tri, 0.45, 'stone', 0.0);
    poly(b, Fn, gc, base + 0.05, tri.map(([x, y]) => [x * 0.9, y * 0.92 + 0.0] as [number, number]), 0.52, 'sandstone', 0.0);
    // blue ceramic star-and-zig-zag field with a small triangle at the top
    poly(b, Fn, gc, base + 4.3, [[-0.8, 0], [0.8, 0], [0, 1.3]], 0.58, 'blue', 0.0);
    poly(b, Fn, gc, base + 2.2, [[-1.7, 0], [1.7, 0], [1.5, 0.5], [1.1, 0.0], [0.7, 0.5], [0.3, 0.0], [-0.1, 0.5], [-0.5, 0.0], [-0.9, 0.5], [-1.3, 0.0], [-1.5, 0.5]], 0.56, 'blue', 0.0);
    // loggia opening under the apex, then rows of arched windows
    archSlab(b, Fn, gc, base + 3.6, 1.0, 1.0, 0.5, 'dark');
    for (let k = 0; k < 4; k++) archWindows(b, Fn, [gc - 1.5 + k * 1.0], {y: base + 0.9, w: 0.55, h: 1.3, bars: 0, rows: 1, frame: 'white', sill: 'stone'});
    for (const dx of [-1.5, 0, 1.5]) archWindows(b, Fn, [gc + dx], {y: base - 2.0, w: 0.6, h: 1.4, bars: 0, rows: 1, frame: 'white', sill: 'stone'});
    slab(b, Fn, gc, apex - 0.05, 0.5, 1.5, 0.5, 'stone', 0.0);        // finial pinnacle
    slab(b, Fn, gc, apex + 1.4, 0.7, 0.2, 0.6, 'stone', 0.0);
    // the little pointed gablet on the bay beside it
    poly(b, Fn, -0.7, 21.9, [[-1.0, 0], [1.0, 0], [0, 1.9]], 0.4, 'stone', 0.0);
    poly(b, Fn, -0.7, 21.95, [[-0.8, 0], [0.8, 0], [0, 1.5]], 0.45, 'blue', 0.0);

    // round stone turret beside the clock tower (slits and a dome cap) and a slit chimney
    const Ft = ringFrame(ring, 58, 0).f;
    const tcx = Ft.origin[0] + Ft.tangent[0] * 4.7 + Ft.n[0] * -3.4, tcz = Ft.origin[1] + Ft.tangent[1] * 4.7 + Ft.n[1] * -3.4;
    const turret = (x: number, z: number, r: number, y0: number, h: number) => {
      const g = new T.CylinderGeometry(r, r, h, 18).translate(x, y0 + h / 2, z);
      b.add(g, 'stone' as never);
      const dome = new T.SphereGeometry(r * 1.05, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1).translate(x, y0 + h, z);
      b.add(dome, 'slate' as never);
      b.add(new T.SphereGeometry(0.16, 8, 6).translate(x, y0 + h + r * 0.74 + 0.1, z), 'stone' as never);
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4;
        b.add(new T.BoxGeometry(0.14, 1.2, 0.14).translate(x + Math.cos(a) * (r + 0.02), y0 + h - 1.2, z + Math.sin(a) * (r + 0.02)), 'dark' as never);
      }
    };
    turret(tcx, tcz, 1.15, 24.5, 6.4);
    const cx = Ft.origin[0] + Ft.tangent[0] * 7.6 + Ft.n[0] * -3.6, cz = Ft.origin[1] + Ft.tangent[1] * 7.6 + Ft.n[1] * -3.6;
    b.add(new T.BoxGeometry(1.0, 4.6, 1.0).translate(cx, 26.3, cz), 'sandstone' as never);
    for (const dx of [-0.25, 0.25]) b.add(new T.BoxGeometry(0.14, 0.9, 1.04).translate(cx + dx, 28.0, cz), 'dark' as never);
    b.add(new T.BoxGeometry(1.3, 0.2, 1.3).translate(cx, 28.7, cz), 'stone' as never);
  }
}
