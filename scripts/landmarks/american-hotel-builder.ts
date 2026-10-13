import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import type {Surface} from './worship-shell';
import {poly, put, ringFrame, setSink, slab, wallProbe} from './nearbar-kit';
import type {Frame} from './nearbar-kit';
import source from './american-hotel-footprints.json';
import {raisedLettering} from './ornament-kit';

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
 * Facade rhythm spec, Leidseplein front (SE), from b_20250129_0912_Track04_Sphere_00043 (49 m, leaf-off), b_20241217_0841_Track38_Sphere_00010
 * (32 m) and the 2007 Commons photo. t is metres along ring edge 58's frame.
 *  - tower (t 0.3-2.2): one narrow window per storey on the same sills as the left wing / upper rows, paired belfry openings under the clock;
 *  - Bar Americain wing (t 2.5-10.4, 3 axes): shopfront under a canopy, a row of 5 small round-headed windows, then 4 storeys on 3 axes;
 *  - entrance bay + three cafe arches (bays at t 12.4, 19.2, 25.9, 32.6): ground = entrance arch + 3 large cafe arches; loggia storey =
 *    3 equal tall windows per bay behind a balcony; eaves balustrade; 2 storeys of equal round-headed windows on 7 axes (every bay
 *    centre and midway between); crenellated parapet; 5 stepped dormer gables with 3 equal windows each and 2 small ones in the gable.
 * Every row has one window size and one sill/head level (geometry audit: window-rhythm is a FAIL for photo-spec facades).
 */
const SE_ROWS = {
  wingLow: {y: 3.9, h: 1.7}, wingMid: {y: 8.3, h: 2.0}, wingHigh: {y: 10.9, h: 1.8},
  loggia: {y: 8.5, h: 3.4}, upper1: {y: 14.1, h: 1.7}, upper2: {y: 16.9, h: 1.7},
};
const SE_BAYS = [12.4, 19.2, 25.9, 32.6];
const SE_UPPER_AXES = Array.from({length: 7}, (_, k) => 12.4 + k * (32.6 - 12.4) / 6);
const SE_WING_AXES = [4.2, 6.6, 9.0];

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
  b.mark?.('shell');   // everything added after this is detail that scripts/check-landmark-attachment.ts holds to the shell
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
    // left wing: shop glazing under the Bar Americain canopy and a row of five equal small round-headed windows over it
    for (let k = 0; k < 5; k++) {
      const t = 3.1 + 1.4 * k;
      slab(b, f, t, 0.9, 1.1, 2.4, 0.1, 'glass');
      slab(b, f, t, 0.9, 0.06, 2.4, 0.14, 'frame');
      archWindows(b, f, [t], {y: SE_ROWS.wingLow.y, w: 0.9, h: SE_ROWS.wingLow.h, bars: 1, rows: 1, sill: 'stone'});
    }
    slab(b, f, 5.9, 3.35, 6.4, 0.12, 0.4, 'white');                // canopy
    slab(b, f, 5.9, 3.1, 6.4, 0.3, 0.12, 'slate', 0.4);            // canopy valance
    // AMERICAN in standing letters on the canopy (panoramas 2019/2025; ornament inventory 2026-10-13)
    {
      const am = raisedLettering({text: 'AMERICAN', heightM: 0.55, maxWidthM: 5.6, depthM: 0.08});
      put(b, f, am.geometry.translate(0, am.heightM / 2, 0), 5.9, 3.47, 0.18, 'stone');
    }
    // big round entrance arch with door
    // the entrance doorway is drawn in the dark bronze, not the pane colour: it is a door, and the rhythm audit counts dark panes as windows
    archSlab(b, f, 12.4, 0.9, 5.4, 6.4, 0.2, 'bronze');
    archBand(b, f, 12.4, 0.9, 5.9, 6.7, 0.45, 0.28, 'stone');
    archSlab(b, f, 12.4, 1.0, 2.2, 3.4, 0.3, 'bronze');
    archBand(b, f, 12.4, 1.0, 2.7, 3.7, 0.25, 0.35, 'stone');
    for (let s = 0; s < 3; s++) slab(b, f, 12.4, 0.0 + s * 0.28, 4.0 - s * 0.5, 0.28, 0.3 + s * 0.2, 'stone');
    // three arched Cafe Americain windows
    for (const t of [19.2, 25.9, 32.6]) {
      archBand(b, f, t, 0.7, 5.9, 6.2, 0.45, 0.25, 'stone');
      archWindows(b, f, [t], {y: 1.0, w: 5.0, h: 5.2, bars: 3, rows: 4, sill: 'stone'});
    }
    // striped cafe awnings over the three arches (panorama 2019, the Leidseplein terrace; ornament inventory 2026-10-13):
    // eight cloth strips sloping 1.2 m out from the arch band below the arch head, ochre and cream alternating
    for (const t of [19.2, 25.9, 32.6]) for (let k = 0; k < 8; k++) {
      const strip = new T.BoxGeometry(5.6 / 8, 0.04, 1.2).translate(0, 0, 0.6).rotateX(0.6);
      put(b, f, strip, t - 2.8 + 5.6 * (k + 0.5) / 8, 5.5, 0.25, k % 2 ? 'stone' : 'ochre');
    }
    // Loggia storey: a balcony balustrade runs across the entrance bay and the cafe part, and every bay (the entrance and the three
    // cafe arches) carries the same three tall windows (bay centre -1.8, 0, +1.8). Until 2026-10-11 the entrance bay had a solid
    // oriel block with two windows buried inside it: a blank gap in the loggia row the panoramas show glazed (spec below).
    for (let t = 10.6; t < L - 0.5; t += 0.5) slab(b, f, t, 7.3, 0.14, 0.9, 0.18, 'stone', 0.5);
    slab(b, f, (10.4 + L) / 2, 8.2, L - 10.4, 0.12, 0.2, 'stone', 0.5);
    slab(b, f, (10.4 + L) / 2, 7.3, L - 10.4, 0.14, 0.16, 'stone', 0.5);
    for (const t of SE_BAYS) for (const dt of [-1.8, 0, 1.8]) archWindows(b, f, [t + dt], {y: SE_ROWS.loggia.y, w: 1.1, h: SE_ROWS.loggia.h, bars: 1, rows: 2, sill: 'stone'});
    // upper floors over the left wing: arched windows on two rows, one size per row
    for (const t of SE_WING_AXES) {
      archWindows(b, f, [t], {y: SE_ROWS.wingMid.y, w: 1.1, h: SE_ROWS.wingMid.h, bars: 1, rows: 2, sill: 'stone'});
      archWindows(b, f, [t], {y: SE_ROWS.wingHigh.y, w: 1.1, h: SE_ROWS.wingHigh.h, bars: 1, rows: 1, sill: 'stone'});
    }
    // The two storeys over the eaves balustrade. The 3DBAG shell here is a jumble of terraces, slopes and part-walls 0.1-2 m behind
    // the ring line (probe: artifacts/landmark-lanes/american-hotel/probe.ts), so windows snapped onto it came out on 2 of 7 axes
    // and the band read as blank brick (user report 2026-10-11, "bad windows"). The panoramas show a continuous brick wall with
    // two full rows of round-headed windows. A real wall now stands there (face 3 cm in front of the ring-line shell walls, so it
    // hides the clutter without z-fighting it), and every axis carries a window of one size per row.
    const fW = ringFrame(ring, 58, -0.03).f;
    slab(b, fW, (6.5 + L) / 2, 13.3, L - 6.5, 5.9, 1.82, 'sandstone', -1.82);
    slab(b, fW, (6.5 + L) / 2, 19.2, L - 6.5, 0.22, 0.3, 'stone', -0.05);                                   // parapet coping
    for (let t = 7.0; t < L - 0.4; t += 0.64) slab(b, fW, t, 19.42, 0.34, 0.3, 0.22, 'stone', -0.04);         // crenellations
    // eaves balustrade from the entrance bay across the cafe part
    for (let t = 10.6; t < L - 0.5; t += 0.5) slab(b, f, t, 13.45, 0.14, 0.7, 0.16, 'stone', 0.3);
    slab(b, f, (10.4 + L) / 2, 14.15, L - 10.4, 0.12, 0.2, 'stone', 0.3);
    // Seven axes on a 3.37 m pitch: over the entrance, over each cafe arch and midway between, so the upper rows stand on the
    // loggia windows' axes (photo spec: b_20250129_0912_Track04_Sphere_00043, window columns under every gable and between them).
    for (const t of SE_UPPER_AXES) for (const r of [SE_ROWS.upper1, SE_ROWS.upper2]) arched(fW, t, r.y, 0.95, r.h, {bars: 1, rows: 1});
    // left wing (t 3-10): its storeys continue upward on its own three axes, same sizes as the cafe part's upper rows
    for (const t of SE_WING_AXES) for (const r of [SE_ROWS.upper1, SE_ROWS.upper2]) archWindows(b, fW, [t], {y: r.y, w: 0.95, h: r.h, bars: 1, rows: 1, sill: 'stone'});
    for (const t of [20.8, 30.5]) poly(b, f, t, 13.4, [[-2.4, 0], [2.4, 0], [2.4, 0.5], [0, 0.5]], 0.4, 'stone', 0.2);
  }

  // Tower: one narrow window per storey on its SE face (edge 58, t 0.3-2.2) and SW face (edge 43, t 2.7-5.4), sill-for-sill with
  // the Leidseplein front's rows so the tower reads as part of the storey grid, then two round-headed belfry openings per face
  // under the clock (Commons 2007 photo and 2017 canal panorama: paired arched openings below the clock box). Until 2026-10-11 the
  // shaft carried nine identical slots at their own levels, which read as odd single windows off the facade grid.
  {
    const {f} = fr(58), g = fr(43).f;
    const levels = [SE_ROWS.wingLow, SE_ROWS.wingMid, SE_ROWS.wingHigh, SE_ROWS.upper1, SE_ROWS.upper2, {y: 20.1, h: 1.5}, {y: 23.6, h: 1.7}, {y: 26.8, h: 1.7}];
    for (const r of levels) {
      for (const [fr2, tt] of [[f, 1.25], [g, 4.05]] as [Frame, number][]) {
        slab(b, fr2, tt, r.y, 0.9, r.h, 0.1, 'glass'); slab(b, fr2, tt, r.y + r.h, 1.2, 0.2, 0.16, 'stone'); slab(b, fr2, tt, r.y, 0.05, r.h, 0.14, 'frame');
      }
    }
    for (const [fr2, tt] of [[f, 1.25], [g, 4.05]] as [Frame, number][]) for (const dt of [-0.5, 0.5]) archWindows(b, fr2, [tt + dt], {y: 30.4, w: 0.7, h: 3.0, bars: 0, rows: 1, glass: 'dark', sill: 'stone'});
    for (const y of [3.6, 13.0, 19.2, 29.9]) { slab(b, f, 1.25, y, 2.3, 0.2, 0.3, 'stone'); slab(b, g, 4.05, y, 2.5, 0.2, 0.3, 'stone'); }
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
      const fc = k === 6 ? ringFrame(ring, 19, 0.24).f : f;   // the end column stands on a step of the shell wall 6 cm proud of the others (check-landmark-attachment)
      for (const [y, h] of [[15.35, 1.35], [17.05, 1.2]] as const) {
        slab(b, fc, t, y - 0.06, 1.45, h + 0.12, 0.08, 'white'); slab(b, fc, t, y, 1.2, h, 0.1, 'glass');
        slab(b, fc, t, y, 0.05, h, 0.14, 'white'); slab(b, fc, t, y + h * 0.62, 1.2, 0.05, 0.14, 'white'); sill(fc, t, y, 1.5);
      }
    }
    for (const t of [3.1, 6.2, 9.3]) slab(b, f, t, 9.0, 0.3, 0.3, 0.18, 'dark');   // cross studs
    band(f, -0.5, L + 5.8, 8.3, 0.5, 0.35);                               // stone cornice
    band(f, -0.5, L + 5.8, 14.95, 0.35, 0.3);
    band(f, -0.5, L + 5.8, 18.6, 0.5, 0.45);                              // eaves
    // fifth bay over the recess zone and the three recessed arches on corbelled piers
    arched(f, 13.95, 10.1, 2.2, 4.8, {fan: true, bars: 1, rows: 3});
    // three narrow tall arched windows over white panels (the panorama shows glazing, not dark recesses), the door under the middle
    // The wall steps back 0.57 -> 0.79 m behind the ring here: each bay snaps onto the shell wall it stands on.
    for (const t of [14.2, 16.7, 19.2]) {
      const s = probe.snap(f, t, 5);
      archBand(b, s, t, 1.5, 2.2, 5.5, 0.3, 0.2, 'stone');
      slab(b, s, t, 1.5, 1.6, 1.6, 0.1, t === 16.7 ? 'slate' : 'white');
      archWindows(b, s, [t], {y: 3.2, w: 1.4, h: 3.6, bars: 1, rows: 2, sill: 'stone'});
    }
    for (const t of [12.9, 15.45, 17.95, 20.4]) slab(b, probe.snap(f, t, 5), t, 1.5, 0.45, 5.4, 0.25, 'stone');
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
      band(f, 0, len, 20.35, 0.3, 0.5);
    });
    // Ground floor and arcade, recounted 2026-10-11 from TMX7316010203-000199_pano_0002_000294 (2017-03-10, across the canal, square-on):
    // ten pilaster bays, each a pair of narrow arched lights over one wide segmental-headed window; the last bay towards the gable
    // front holds the canal-side door under a canopy. (Before: 12 evenly spaced lights over 8 round-headed windows, out of step.)
    const ARC_BAYS = 10, ab = total / ARC_BAYS;
    for (let k = 0; k < ARC_BAYS; k++) {
      const {f, t} = sc(ab * (k + 0.5));
      if (k === ARC_BAYS - 1) {
        slab(b, f, t, 2.2, 1.5, 2.7, 0.12, 'dark'); segBand(b, f, t, 4.9, 1.9, 0.3, 0.22, 0.2, 'stone'); slab(b, f, t, 5.0, 2.2, 0.1, 1.1, 'stone');
      } else {
        slab(b, f, t, 2.6, 1.7, 2.15, 0.1, 'glass');
        for (const dx of [-0.43, 0.43]) slab(b, f, t + dx, 2.6, 0.05, 2.2, 0.14, 'frame');
        slab(b, f, t, 3.9, 1.7, 0.05, 0.14, 'frame');
        segBand(b, f, t, 4.7, 2.1, 0.35, 0.25, 0.18, 'stone');
        slab(b, f, t, 2.45, 2.0, 0.15, 0.25, 'stone');
      }
      for (const dx of [-0.36 * ab, 0.36 * ab]) {
        const p = sc(Math.min(total - 0.05, ab * (k + 0.5) + dx));
        archWindows(b, p.f, [p.t], {y: 5.3, w: 0.8, h: 2.8, bars: 1, rows: 2, glass: 'glass', frame: 'dark'});
      }
      const m = sc(ab * (k + 0.5)); slab(b, m.f, m.t, 5.2, 0.22, 3.0, 0.16, 'greyBrick');   // slim pier between the pair
    }
    // carved pilasters at the bay edges
    for (let k = 0; k <= ARC_BAYS; k++) { const {f, t} = sc(Math.min(total - 0.05, Math.max(0.05, ab * k))); slab(b, f, t, 5.0, 0.4, 3.4, 0.22, 'stone'); slab(b, f, t, 8.2, 0.55, 0.3, 0.3, 'stone'); }
    // six canted bays, three floors
    for (let k = 0; k < bays; k++) {
      const {f, t} = sc(pitch * (k + 0.5));
      for (const y of [10.9, 13.9, 16.9]) {
        poly(b, f, t, y - 0.35, [[-1.55, 0], [1.55, 0], [1.2, 2.9], [-1.2, 2.9]], 0.55, 'greyBrick', 0.0);
        slab(b, f, t, y + 0.1, 2.3, 1.7, 0.62, 'glass');
        for (const dx of [-1.15, -0.38, 0.38, 1.15]) slab(b, f, t + dx, y + 0.05, 0.08, 1.8, 0.7, 'stone');
        slab(b, f, t, y + 1.0, 2.3, 0.05, 0.68, 'frame');
        slab(b, f, t, y + 2.1, 3.0, 0.2, 0.75, 'stone');
        slab(b, f, t, y - 0.45, 3.0, 0.18, 0.7, 'stone');
      }
      // hooded attic window
      slab(b, f, t, 19.3, 1.4, 0.75, 0.1, 'glass');
      for (const dx of [-0.23, 0.23]) slab(b, f, t + dx, 19.3, 0.05, 0.75, 0.14, 'frame');
      segBand(b, f, t, 20.05, 1.9, 0.3, 0.16, 0.2, 'stone');
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
    // Two storeys alternating round-headed and narrow square-headed windows, A r A r A, on one sill and head per storey
    // (2017 canal panorama TMX7316010203-000199_pano_0002_000294; until 2026-10-11 four equal arched windows).
    // The 3DBAG shell slopes back 1.4 m between 13.5 and 15 m here (probe), but the 2017 photo shows these two storeys as flat brick
    // flush with the facade below: a wall slab 3 cm proud of the -0.3 m shell face carries them (until 2026-10-11 the windows hung
    // in front of the slope).
    const fg = ringFrame(ring, 39, -0.27).f;
    slab(b, fg, len / 2, 12.9, len, 4.5, 1.5, 'sandstone', -1.5);
    for (const y of [13.2, 15.4]) for (let k = 0; k < 5; k++) {
      const t = len * (k + 0.5) / 5, g = fg;
      if (k % 2 === 0) arched(g, t, y, 0.9, 1.6, {bars: 1, rows: 1});
      else { slab(b, g, t, y - 0.05, 0.75, 1.7, 0.08, 'white'); slab(b, g, t, y, 0.55, 1.6, 0.1, 'glass'); slab(b, g, t, y + 1.0, 0.55, 0.05, 0.14, 'white'); sill(g, t, y, 0.8); }
    }
    band(f, 0, len, 17.4, 0.25, 0.3);
    // arcaded gallery under the gable
    // The pointed gable above the eaves stands 1.4-1.7 m behind the ring edge and 3 deg off it: fit a frame onto the shell wall at gallery height.
    const t0 = 0.6, t1 = len - 0.6, o0 = probe.offset(f, t0, 18.4), o1 = probe.offset(f, t1, 18.4);
    if (o0 !== null && o1 !== null && probe.offset(f, len / 2, 19.0) !== null) {
      const dx = (t1 - t0) * f.tangent[0] + (o1 - o0) * f.n[0], dz = (t1 - t0) * f.tangent[1] + (o1 - o0) * f.n[1], dl = Math.hypot(dx, dz);
      const tg: [number, number] = [dx / dl, dz / dl], nn: [number, number] = [-tg[1], tg[0]];
      const gf: Frame = {tangent: tg, n: nn, origin: [f.origin[0] + f.tangent[0] * t0 + f.n[0] * o0 - tg[0] * t0, f.origin[1] + f.tangent[1] * t0 + f.n[1] * o0 - tg[1] * t0]};
      const a0 = 1.0, a1 = len - 1.0;
      for (let k = 0; k < 6; k++) archWindows(b, gf, [a0 + (a1 - a0) * (k + 0.5) / 6], {y: 17.8, w: 0.45, h: 1.2, bars: 0, rows: 1, frame: 'white', sill: 'stone'});
      for (let k = 0; k <= 6; k++) slab(b, gf, a0 + (a1 - a0) * k / 6, 17.7, 0.16, 1.4, 0.18, 'stone');
    }
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
  // axes t = 8.4 (centre of the 3DBAG dormer notch t 6.3-10.5), 15.9, 21.0, 26.8 and 32.7 from the 3DBAG dormer gable walls (the leftmost is the small one by the tower).
  {
    const Fd = ringFrame(ring, 58, -2.0).f;
    const Fb = ringFrame(ring, 58, -1.55).f;           // face of the dormer-front slabs
    const Fg = ringFrame(ring, 58, -2.0 + 0.4).f;     // the stepped gables' sandstone field stands 0.39 m out of the dormer wall: their small windows sit on it
    /** Stair-stepped gable silhouette, half-width hw at the base, step height sh, n steps, apex height = n * sh. */
    const stepGable = (hw: number, sh: number, n: number): [number, number][] => {
      const right: [number, number][] = [[hw, 0]];
      let w = hw;
      for (let k = 0; k < n; k++) { right.push([w, (k + 1) * sh]); w -= hw / n; if (k < n - 1) right.push([w, (k + 1) * sh]); }
      right.push([0.0, n * sh]);
      const left = right.slice(1, -1).reverse().map(([x, y]) => [-x, y] as [number, number]);
      return [[-hw, 0], ...right, ...left];
    };
    for (const c of [8.4, 15.9, 21.0, 26.8, 32.7]) {
      // three equal round-headed windows in the dormer storey (the crenellated parapet now runs along the front wall below)
      // The 3DBAG dormer fronts are ragged (part-walls at -1.6 .. -2.4, gaps): a dormer-front slab (face 1.55 m behind the ring line)
      // gives the three windows a wall to sit on.
      slab(b, Fd, c, 19.4, c < 10 ? 3.2 : 3.6, 2.15, 0.45, 'sandstone');
      for (const dx of [-1, 0, 1].map(k => k * (c < 10 ? 0.9 : 1.05))) archWindows(b, Fb, [c + dx], {y: 20.1, w: 0.6, h: 1.45, bars: 0, rows: 1, frame: 'white', sill: 'stone'});
      // stepped gable: stone coping silhouette with a sandstone field, two small arched windows, pinnacle and flagpole
      const sil = stepGable(1.75, 0.8, 5);
      poly(b, Fd, c, 21.55, sil, 0.28, 'stone', 0.0);
      poly(b, Fd, c, 21.6, sil.map(([x, y]) => [x * 0.8, y * 0.86] as [number, number]), 0.34, 'sandstone', 0.05);   // back plane 5 cm clear of the coping's
      for (const dx of [-0.42, 0.42]) archWindows(b, Fg, [c + dx], {y: 22.3, w: 0.38, h: 1.25, bars: 0, rows: 1, frame: 'white', glass: 'dark'});
      slab(b, Fd, c, 25.5, 0.45, 1.2, 0.4, 'stone', 0.0);
      slab(b, Fd, c, 26.7, 0.62, 0.18, 0.5, 'stone', 0.0);
      slab(b, Fd, c, 26.7, 0.05, 3.4, 0.05, 'stone', 0.1);   // flagpole: a mast, kept out of the trim materials
    }
    // big pointed corner gable over the Marnixstraat corner (NE wall, frame of ring edge 12, t = -5.4 .. -1.6, base 21.2 m)
    const Fn = ringFrame(ring, 12, 0.3).f;
    const gc = -3.0, gw = 2.4, base = 21.0, apex = 29.4;
    const tri: [number, number][] = [[-gw, 0], [gw, 0], [0, apex - base]];
    poly(b, Fn, gc, base, tri, 0.45, 'stone', 0.0);
    poly(b, Fn, gc, base + 0.05, tri.map(([x, y]) => [x * 0.9, y * 0.92 + 0.0] as [number, number]), 0.52, 'sandstone', 0.05);   // back plane 5 cm clear of the coping's
    const Fq = ringFrame(ring, 12, 0.3 + 0.57).f;   // the sandstone field's face: windows and ceramics sit on it
    // blue ceramic star-and-zig-zag field with a small triangle at the top
    poly(b, Fn, gc, base + 4.3, [[-0.8, 0], [0.8, 0], [0, 1.3]], 0.08, 'blue', 0.52);
    poly(b, Fn, gc, base + 2.2, [[-1.7, 0], [1.7, 0], [1.5, 0.5], [1.1, 0.0], [0.7, 0.5], [0.3, 0.0], [-0.1, 0.5], [-0.5, 0.0], [-0.9, 0.5], [-1.3, 0.0], [-1.5, 0.5]], 0.08, 'blue', 0.52);
    // loggia opening under the apex, then rows of arched windows
    archSlab(b, Fq, gc, base + 3.6, 1.0, 1.0, 0.05, 'dark');
    for (let k = 0; k < 4; k++) archWindows(b, Fq, [gc - 1.5 + k * 1.0], {y: base + 0.9, w: 0.55, h: 1.3, bars: 0, rows: 1, frame: 'white', sill: 'stone'});
    for (const dx of [-1.1, 0, 1.1]) archWindows(b, Fn, [gc + dx], {y: base - 2.0, w: 0.6, h: 1.4, bars: 0, rows: 1, frame: 'white', sill: 'stone'});
    slab(b, Fn, gc, apex - 0.05, 0.5, 1.5, 0.5, 'stone', 0.0);        // finial pinnacle
    slab(b, Fn, gc, apex + 1.4, 0.7, 0.2, 0.6, 'stone', 0.0);
    // The corner pavilion's Marnixstraat face under the big gable (t -5.4 .. -0.6) was blank brick from the ground to the gable.
    // ref-ne.jpg and the 2007 Commons photo show a round-headed window pair on every storey either side of the central strip, over a
    // tall ground-floor pair. Two axes (t -4.3, -1.7), one size per storey row.
    for (const t of [-4.3, -1.7]) {
      const s = probe.snap(Fn, t, 8);
      arched(s, t, 2.8, 1.5, 3.6, {bars: 1, rows: 2}); arched(s, t, 7.2, 1.3, 2.2, {bars: 1, rows: 1});
      for (const y of [11.1, 14.0, 16.8]) arched(s, t, y, 0.9, 1.7, {bars: 1, rows: 1});
    }
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
        const a = (k + 0.5) * Math.PI / 4;
        b.add(new T.BoxGeometry(0.14, 1.2, 0.14).rotateY(-a).translate(x + Math.cos(a) * (r + 0.02), y0 + h - 1.2, z + Math.sin(a) * (r + 0.02)), 'dark' as never);   // each slit faces radially out of the drum
      }
    };
    turret(tcx, tcz, 1.15, 24.5, 6.4);
    const cx = Ft.origin[0] + Ft.tangent[0] * 7.6 + Ft.n[0] * -3.6, cz = Ft.origin[1] + Ft.tangent[1] * 7.6 + Ft.n[1] * -3.6;
    b.add(new T.BoxGeometry(1.0, 4.6, 1.0).translate(cx, 26.3, cz), 'sandstone' as never);
    for (const dx of [-0.25, 0.25]) b.add(new T.BoxGeometry(0.14, 0.9, 1.04).translate(cx + dx, 28.0, cz), 'dark' as never);
    b.add(new T.BoxGeometry(1.3, 0.2, 1.3).translate(cx, 28.7, cz), 'stone' as never);
  }
}
