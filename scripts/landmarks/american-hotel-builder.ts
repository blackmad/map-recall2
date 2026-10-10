import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import type {Surface} from './worship-shell';
import {archBand, archSlab, archWindows, poly, put, ringFrame, segBand, setSink, slab} from './nearbar-kit';
import type {Frame} from './nearbar-kit';
import source from './american-hotel-footprints.json';

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
 *    windows and three recessed arches on corbelled piers;
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
  addShell(b, source as never, {wall: 'sandstone', roof: 'slate', roofFor: towerCap, skip: (s) => s.type === 'WallSurface' && brown(s)});
  addShell(b, source as never, {wall: 'greyBrick', roof: 'slate', skip: (s) => s.type !== 'WallSurface' || !brown(s)});
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
    // counted from the 2020/2022 winter panoramas: two storeys of round-headed windows over the eaves balustrade,
    // four axes (two under each stepped gable)
    for (const t of [19.2, 22.4, 28.9, 32.0]) {
      for (const y of [14.0, 16.6]) arched(fUp, t, y, 0.9, 1.5);
    }
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
      // top-storey window
      slab(b, f, t, 15.7, 1.7, 2.2, 0.1, 'glass'); slab(b, f, t, 15.7, 0.06, 2.2, 0.14, 'frame'); slab(b, f, t, 16.8, 1.7, 0.06, 0.14, 'frame');
      slab(b, f, t, 15.55, 2.1, 0.12, 0.25, 'stone');
    }
    for (const t of [3.1, 6.2, 9.3, 12.0]) slab(b, f, t, 9.0, 0.3, 0.3, 0.18, 'dark');   // cross studs
    band(f, -0.5, L + 5.8, 8.3, 0.5, 0.35);                               // stone cornice
    band(f, -0.5, L + 5.8, 14.95, 0.35, 0.3);
    band(f, -0.5, L + 5.8, 18.6, 0.5, 0.45);                              // eaves
    // fifth bay over the recess zone and the three recessed arches on corbelled piers
    arched(f, 13.95, 10.1, 2.2, 4.8, {fan: true, bars: 1, rows: 3});
    for (const t of [14.2, 16.7, 19.2]) {
      archSlab(b, f, t, 1.5, 1.8, 5.2, 0.1, 'dark');
      archBand(b, f, t, 1.5, 2.2, 5.5, 0.3, 0.2, 'stone');
      archWindows(b, f, [t], {y: 3.5, w: 1.2, h: 2.4, bars: 1, rows: 1, sill: 'stone'});
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
}
