import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {wallsOf} from './worship-walls';
import {archBand, archSlab, archWindows, poly, put, ringFrame, roofHeightAt, sashWindows, setSink, slab} from './nearbar-kit';
import type {Frame} from './nearbar-kit';
import source from './hotel-de-l-europe-footprints.json';

/**
 * Hotel de l'Europe (De L'Europe Amsterdam, Nieuwe Doelenstraat 2-14; Willem Hamer Jr., 1895-96, neo-Renaissance;
 * BAG 0363100012168170). Massing is the 3DBAG LoD2.2 shell in native east/south metres. Detail follows the 2025
 * municipal panoramas of the Amstel (SW) front, the rounded south end and the Nieuwe Doelenstraat side:
 *  - red brick walls striped with white-stone courses at every sill and lintel;
 *  - a rusticated stone ground storey with large round-headed windows under the glazed terrace;
 *  - a continuous stone balcony with balustrade over the ground storey;
 *  - four floors of white-framed sash windows in the bay rhythm of the Amstel front;
 *  - the round west corner turret with its copper conical cap, and the rounded south end.
 * Mansard roofs and dormers are the 3DBAG roof planes only; the NW and SE sides are inferred from oblique views.
 */
export function buildHotelDeLEurope(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'brick', roof: 'slate'});
  b.mark?.('shell');
  setSink(0.5);
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

  /** Highest shell wall at tangent position t of a ring-edge frame (0 when no wall is within 1.2 m). */
  const wallAt = (f: Frame, t: number) => {
    let best = 0, bestOff = 9;
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
  /** True where the shell wall stands within 0.45 m of the ring line (details sit on the ring, so recesses are skipped). */
  const flush = (f: Frame, t: number) => { const w = wallAt(f, t); return w.top > 3 && Math.abs(w.off) < 0.45; };
  /** Runs [t0,t1] of the edge where the wall is flush, sampled every 0.3 m. */
  const runs = (f: Frame, len: number) => {
    const out: [number, number][] = [];
    let s: number | null = null;
    for (let t = 0.15; t <= len; t += 0.3) {
      const ok = flush(f, Math.min(t, len - 0.06));
      if (ok && s === null) s = t - 0.15;
      if (!ok && s !== null) { out.push([s, t - 0.15]); s = null; }
    }
    if (s !== null) out.push([s, len]);
    return out.filter(r => r[1] - r[0] > 0.5);
  };
  /** Polyline of consecutive ring edges: frame and local t for arc-length position u. */
  const path = (edges: number[]) => {
    const fs = edges.map(i => ({...fr(i), i}));
    const total = fs.reduce((a, e) => a + e.len, 0);
    const at = (u: number) => {
      let acc = 0;
      for (const e of fs) { if (u <= acc + e.len || e === fs[fs.length - 1]) return {f: e.f, t: u - acc, i: e.i, len: e.len}; acc += e.len; }
      return {f: fs[0].f, t: 0, i: fs[0].i, len: fs[0].len};
    };
    return {fs, total, at};
  };

  /** Vertical white-stone strip (quoin / pilaster) between window axes, from the string course to just under the eaves. */
  const pier = (a: {f: Frame; t: number}) => {
    const top = topAt(a.f, a.t);
    if (top < 12 || !flush(a.f, a.t)) return;
    slab(b, a.f, a.t, 6.4, 0.45, Math.min(top - 0.6, 21.5) - 6.4, 0.1, 'stone');
  };
  /** Stone-framed dormer on the mansard behind frame f at t: sits on the 3DBAG roof plane 0.9 m back from the eave, front flush with the wall. */
  const dormer = (f: Frame, t: number) => {
    const T0 = topAt(f, t);
    if (T0 < 14 || !flush(f, t)) return;
    const x = f.origin[0] + f.tangent[0] * t - f.n[0] * 0.9, z = f.origin[1] + f.tangent[1] * t - f.n[1] * 0.9;
    const rh = roofHeightAt((source as {surfaces: never[]}).surfaces, x, z);
    if (rh === null || rh < T0 - 0.1 || rh > T0 + 3) return;
    const y0 = T0 - 0.3, wy = Math.max(rh - 0.1, T0 + 0.1), wh = 1.3, h = wy + wh + 0.3 - y0;   // box rooted in the eave, window clear of the roof plane
    slab(b, f, t, y0, 1.5, h, 0.5, 'stone');                                // frame box
    slab(b, f, t, wy, 0.9, wh, 0.58, 'glass');                              // window
    slab(b, f, t, wy, 0.06, wh, 0.62, 'frame');
    poly(b, f, t, y0 + h, [[-0.95, 0], [0.95, 0], [0, 0.8]], 0.5, 'stone');  // gablet
  };

  // storey rows: sill, head
  const rows: [number, number][] = [[7.2, 9.9], [11.0, 13.7], [14.8, 17.3], [18.4, 20.6]];
  const stripes = (f: Frame, len: number, o: {balcony?: boolean; ground?: boolean} = {}) => {
    for (const [t0, t1] of runs(f, len)) {
      const c = (t0 + t1) / 2, w = t1 - t0;
      if (o.ground !== false) {
        slab(b, f, c, 0, w, 5.95, 0.08, 'stone');                       // pale stone-clad ground storey (panoramas: grey-white ashlar under the brick)
        slab(b, f, c, 0, w, 0.35, 0.2, 'stone');                        // plinth
      }
      slab(b, f, c, 5.95, w, 0.45, 0.22, 'stone');                      // string course over the ground storey
      for (const [y0, y1] of rows) {
        if (topAt(f, c) < y1 + 0.4) continue;
        slab(b, f, c, y0 - 0.14, w, 0.14, 0.12, 'stone');               // sill band
        slab(b, f, c, y1, w, 0.2, 0.14, 'stone');                       // lintel band
      }
      // the 'striped' brick: a white stone course every ~1.1 m between the window bands (alternating brick and stone)
      for (let ts = t0; ts < t1 - 0.3; ts += 2.2) {
        const te = Math.min(ts + 2.2, t1), cm = (ts + te) / 2, top = topAt(f, cm);
        for (let y = 6.9; y < top - 0.7; y += 1.1) slab(b, f, cm, y, te - ts, 0.16, 0.07, 'stone');
      }
      if (o.balcony) {
        slab(b, f, c, 7.1, w, 0.3, 0.55, 'stone');                       // balcony slab
        slab(b, f, c, 8.4, w, 0.1, 0.2, 'stone', 0.55);
        for (let t = t0 + 0.2; t < t1 - 0.1; t += 0.45) slab(b, f, t, 7.4, 0.12, 1.0, 0.14, 'stone', 0.6);
      }
    }
  };
  const row = (f: Frame, ts: number[], r: [number, number], w = 1.6) => {
    const ok = ts.filter(t => topAt(f, t) >= r[1] + 0.5 && flush(f, t));
    sashWindows(b, f, ok, {y: r[0], w, h: r[1] - r[0] - 0.1, cols: 2, rows: 3, sill: 'stone'});
  };

  // =============================== Amstel front (SW) ===============================
  {
    const p = path([83, 88, 90, 93]);
    for (const e of p.fs) {
      stripes(e.f, e.len, {balcony: true});
      // rusticated ground storey: courses
      for (const [t0, t1] of runs(e.f, e.len)) for (let y = 0.9; y < 5.9; y += 0.8) slab(b, e.f, (t0 + t1) / 2, y, t1 - t0, 0.04, 0.24, 'greyBrick');
    }
    // ground storey: round-headed windows on the first two bays; from u 5.5 the glazed terrace pavilion projects 1.6 m
    // (review tiles wall 237 9.1 m and 6.8 m, 2017 panoramas: the BODEGA/terrace glass pavilion, not arched windows)
    const PAV = 5.5;
    for (let u = PAV + 0.5; u < p.total; u += 1.0) {
      const {f, t} = p.at(u);
      if (topAt(f, t) < 6 || !flush(f, t)) continue;
      slab(b, f, t, 0, 1.02, 0.5, 1.6, 'white');
      slab(b, f, t, 0.5, 1.02, 4.0, 1.5, 'glass');
      slab(b, f, t - 0.45, 0.5, 0.1, 4.0, 1.6, 'white');
      slab(b, f, t, 3.3, 1.02, 0.08, 1.58, 'white');
      slab(b, f, t, 4.5, 1.02, 0.6, 1.75, 'white');
    }
    for (let u = 1.5; u < PAV; u += 3.0) {
      const {f, t} = p.at(u);
      if (topAt(f, t) < 6 || !flush(f, t)) continue;
      archBand(b, f, t, 1.0, 2.5, 4.6, 0.3, 0.2, 'stone');
      archWindows(b, f, [t], {y: 1.1, w: 1.9, h: 4.4, bars: 1, rows: 3, frame: 'white', sill: 'stone'});
    }
    // upper floors at the bay rhythm
    for (let u = 1.5; u < p.total - 1.2; u += 3.0) {
      const {f, t} = p.at(u);
      for (const r of rows) row(f, [t], r, 1.4);
      dormer(f, t);
      pier(p.at(u + 1.5));
    }
  }

  // =============================== rounded south end: the semicircular bay on the Munt corner ===============================
  // Circle fitted to ring vertices 94-118: centre (11.30, 13.34) east/south, radius 5.9 m. Angle 0 = due south.
  {
    const cx = 11.298, cz = 13.339, R = 5.9 - 0.08, deg = Math.PI / 180;
    const cf = (th: number): Frame => { const a = th * deg, nx = Math.sin(a), nz = Math.cos(a); return {origin: [cx + R * nx, cz + R * nz], tangent: [nz, -nx], n: [nx, nz]}; };
    /** Wall top over the bay at angle th, read from the nearest ring edge of the shell. */
    const topNear = (th: number) => {
      let best = 0, bd = 1e9;
      for (let i = 94; i <= 118; i++) {
        const m = [(ring[i][0] + ring[i + 1][0]) / 2 - cx, (ring[i][1] + ring[i + 1][1]) / 2 - cz];
        const d = Math.abs(Math.atan2(m[0], m[1]) / deg - th);
        if (d < bd) { bd = d; best = i; }
      }
      const e = fr(best);
      return topAt(e.f, e.len / 2);
    };
    const step = 8.5, w = 2 * R * Math.tan(step / 2 * deg) + 0.12;
    for (let th = -34 + step / 2; th < 34; th += step) {
      const f = cf(th), top = topNear(th);
      slab(b, f, 0, 0, w, 0.35, 0.2, 'stone');                               // plinth
      // glazed white terrace pavilion on the ground storey (2025 panoramas)
      slab(b, f, 0, 1.0, w, 4.3, 0.1, 'glass');
      slab(b, f, 0, 1.0, w, 0.12, 0.16, 'white'); slab(b, f, 0, 3.2, w, 0.1, 0.14, 'white'); slab(b, f, 0, 5.2, w, 0.3, 0.2, 'white');
      slab(b, f, -w / 2 + 0.05, 1.0, 0.1, 4.3, 0.16, 'white');
      slab(b, f, 0, 5.95, w, 0.45, 0.22, 'stone');                           // string course
      slab(b, f, 0, 7.1, w, 0.3, 0.55, 'stone');                             // balcony slab
      slab(b, f, 0, 8.4, w, 0.1, 0.2, 'stone', 0.55);
      slab(b, f, 0, 7.4, 0.12, 1.0, 0.14, 'stone', 0.6);
      for (const [y0, y1] of rows) { slab(b, f, 0, y0 - 0.14, w, 0.14, 0.12, 'stone'); slab(b, f, 0, y1, w, 0.2, 0.14, 'stone'); }
      for (let y = 6.9; y < top - 0.7; y += 1.1) slab(b, f, 0, y, w, 0.16, 0.07, 'stone');
      if (top > 12) slab(b, f, 0, top - 0.55, w, 0.45, 0.3, 'stone');        // stone cornice / parapet base
    }
    // three window axes, four floors; paired sashes in stone surrounds
    for (const th of [-22, 0, 22]) { const f = cf(th); for (const r of rows) sashWindows(b, f, [0], {y: r[0], w: 1.35, h: r[1] - r[0] - 0.1, cols: 2, rows: 3, sill: 'stone'}); }
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

  // =============================== Amstel side (SE): edges 118-122 ===============================
  // Rewritten 2026-10-10 from the leaf-off panorama b_20241211_0954_Track19_Sphere_00235 (47 m out across the Amstel, square-on).
  // The earlier model treated this as a street side with a stone ground storey of round-headed windows on a 3.0 m pitch and
  // dormers, and left edge 118 blank. The photo shows three sections along the 28.6 m run (u from the round corner):
  //  A u 0-9.9   ornate brick: two window axes (u 2.2, 4.8) with balconies, then a white stacked oriel (u 8.0) from the ground storey
  //              to the top storey; brick ground storey with windows;
  //  B u 9.9-17.2 three axes (u 11.3, 13.2, 15.4), a full-width balcony over storey 1 and two short balconies over storey 2,
  //              the roof lettering behind (not modelled: no glyph set for it);
  //  C u 17.2-28.6 plain brick annex, narrow windows on a 2.2 m pitch, five rows on a 3.3 m storey pitch, flat top;
  //  B and C stand on the glazed white-framed restaurant conservatory (0-5.2 m) with its fascia band.
  {
    const p = path([118, 119, 120, 122]);
    for (const e of p.fs) stripes(e.f, e.len, {ground: false});
    const along = (u0: number, u1: number, fn: (f: Frame, t: number) => void, step = 1.0) => { for (let u = u0 + step / 2; u < u1; u += step) { const {f, t} = p.at(u); if (flush(f, t)) fn(f, t); } };
    // string course over the ground storey on the whole run
    along(0, p.total, (f, t) => slab(b, f, t, 5.95, 1.02, 0.45, 0.22, 'stone'));
    // A: brick ground storey with two windows, balconies
    for (const u of [2.2, 4.8]) {
      const {f, t} = p.at(u);
      row(f, [t], [1.6, 4.6], 1.4);
      for (const r of rows) row(f, [t], r, 1.4);
    }
    { const {f, t} = p.at(4.8); for (const y of [7.1, 10.6]) { slab(b, f, t, y, 2.4, 0.25, 0.6, 'stone'); slab(b, f, t, y + 0.9, 2.4, 0.08, 0.15, 'frame', 0.5); } }
    // A: white stacked oriel
    {
      const {f, t} = p.at(8.0);
      if (topAt(f, t) > 18) {
        poly(b, f, t, 1.0, [[-1.5, 0], [1.5, 0], [1.2, 17.0], [-1.2, 17.0]], 0.9, 'white', 0);
        for (const [y0, y1] of ([[1.6, 4.6], ...rows] as [number, number][]).filter(r => r[1] < 17.9)) { slab(b, f, t, y0, 2.0, y1 - y0 - 0.1, 0.1, 'glass', 0.9); for (const dx of [-0.5, 0.5]) slab(b, f, t + dx, y0, 0.07, y1 - y0 - 0.1, 0.06, 'white', 1.0); }
      }
    }
    // B: three axes and balconies
    for (const u of [11.3, 13.2, 15.4]) { const {f, t} = p.at(u); for (const r of rows) row(f, [t], r, 1.35); }
    along(9.9, 17.2, (f, t) => { slab(b, f, t, 10.6, 1.02, 0.25, 0.65, 'stone'); slab(b, f, t, 11.55, 1.02, 0.08, 0.15, 'frame', 0.55); });
    for (const [u0, u1] of [[10.2, 12.4], [14.2, 16.6]]) along(u0, u1, (f, t) => { slab(b, f, t, 14.35, 0.62, 0.22, 0.55, 'stone'); slab(b, f, t, 15.25, 0.62, 0.08, 0.15, 'frame', 0.5); }, 0.6);
    // C: plain annex, narrow windows, five rows
    for (let u = 18.3; u < p.total - 0.6; u += 2.2) {
      const {f, t} = p.at(u);
      for (const y of [7.4, 10.7, 14.0, 17.3, 20.3]) if (topAt(f, t) > y + 2.1 && flush(f, t)) sashWindows(b, f, [t], {y, w: 1.15, h: 1.75, cols: 2, rows: 2, sill: 'stone'});
    }
    // B + C: glazed restaurant conservatory with white mullions and a fascia band
    along(9.9, p.total, (f, t) => {
      slab(b, f, t, 0.0, 1.02, 0.5, 0.3, 'white');
      slab(b, f, t, 0.5, 1.02, 4.3, 0.24, 'glass');
      slab(b, f, t - 0.45, 0.5, 0.1, 4.3, 0.32, 'white');
      slab(b, f, t, 3.4, 1.02, 0.08, 0.3, 'white');
      slab(b, f, t, 4.8, 1.02, 0.55, 0.36, 'white');
    });
  }

  // =============================== Nieuwe Doelenstraat side (NW) ===============================
  // Rewritten 2026-10-10. Ring edges 0-7 (24.7 m) are the plain dark-brick annex, Nieuwe Doelenstraat 8-6: granite ground storey
  // with the entrance and tall windows, then five storeys of white sash windows on eight even axes, no stone stripes
  // (panoramas TMX7316010203-001609_pano_0000_000090, 2020-01-30, and the review tile wall 329). It was blank brick: the old
  // path skipped edge 0 and ran edge 1 straight into the ornate end. Edges 8 and 12 are the ornate end by the turret: four rows
  // like the Amstel front and round-headed ground windows (review tile wall 327).
  {
    const p = path([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const e of p.fs) for (const [t0, t1] of runs(e.f, e.len)) {
      const c = (t0 + t1) / 2, w = t1 - t0;
      slab(b, e.f, c, 0, w, 5.6, 0.03, 'stone');                        // granite ground storey (thin: its windows sit proud of it)
      for (let y = 0.9; y < 1.3; y += 0.9) slab(b, e.f, c, y, w, 0.04, 0.05, 'greyBrick');
      slab(b, e.f, c, 5.6, w, 0.35, 0.22, 'stone');                     // string course
      if (topAt(e.f, c) > 20) slab(b, e.f, c, Math.min(topAt(e.f, c), 21.6) - 0.5, w, 0.4, 0.2, 'stone');   // cornice
    }
    const axes = Array.from({length: 8}, (_, k) => p.total * (k + 0.5) / 8);
    axes.forEach((u, k) => {
      const {f, t} = p.at(u);
      if (k === 2) { if (flush(f, t) && topAt(f, t) > 6) { slab(b, f, t, 0, 1.6, 3.4, 0.16, 'dark'); slab(b, f, t, 3.4, 1.9, 0.25, 0.25, 'stone'); } }
      else row(f, [t], [1.3, 4.6], 1.6);
      for (const y of [6.5, 9.6, 12.7, 15.8, 18.7]) row(f, [t], [y, y + 2.0], 1.3);
    });
  }
  {
    const p = path([8, 12]);
    for (const e of p.fs) stripes(e.f, e.len);
    for (let u = 1.5; u < p.total - 1; u += 3.2) {
      const {f, t} = p.at(u);
      for (const r of rows) row(f, [t], r, 1.5);
      if (topAt(f, t) > 6 && flush(f, t)) archWindows(b, f, [t], {y: 1.2, w: 1.7, h: 4.0, bars: 1, rows: 3, frame: 'white', sill: 'stone'});
    }
  }

  // =============================== west corner turret: copper conical cap, windows, bands ===============================
  {
    const cx = -7.0, cz = -5.2, r = 1.55, top = 25.2;
    const g = new T.ConeGeometry(r + 0.2, 4.2, 14).translate(cx, top + 2.1, cz);
    b.add(g, 'copper');
    b.add(new T.CylinderGeometry(r + 0.2, r + 0.2, 0.35, 14).translate(cx, top + 0.05, cz), 'stone');
    b.add(new T.SphereGeometry(0.28, 8, 6).translate(cx, top + 4.4, cz), 'copper');
  }
}
