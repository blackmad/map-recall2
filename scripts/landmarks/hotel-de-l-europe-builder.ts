import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {wallsOf} from './worship-walls';
import {archBand, archSlab, archWindows, poly, put, ringFrame, sashWindows, setSink, slab} from './nearbar-kit';
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

  // storey rows: sill, head
  const rows: [number, number][] = [[8.7, 11.3], [13.0, 15.4], [16.6, 18.6], [19.8, 22.1]];
  const stripes = (f: Frame, len: number, o: {balcony?: boolean} = {}) => {
    for (const [t0, t1] of runs(f, len)) {
      const c = (t0 + t1) / 2, w = t1 - t0;
      slab(b, f, c, 0, w, 0.35, 0.2, 'stone');                          // plinth
      slab(b, f, c, 5.95, w, 0.45, 0.22, 'stone');                      // string course over the ground storey
      for (const [y0, y1] of rows) {
        if (topAt(f, c) < y1 + 0.4) continue;
        slab(b, f, c, y0 - 0.14, w, 0.14, 0.12, 'stone');               // sill band
        slab(b, f, c, y1, w, 0.2, 0.14, 'stone');                       // lintel band
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
    // ground storey: round-headed windows
    for (const u of [1.0, 6.4, 11.3, 15.8, 20.6]) {
      const {f, t} = p.at(u);
      if (topAt(f, t) < 6 || !flush(f, t)) continue;
      archBand(b, f, t, 1.0, 3.0, 4.6, 0.3, 0.2, 'stone');
      archWindows(b, f, [t], {y: 1.1, w: 2.4, h: 4.4, bars: 1, rows: 3, frame: 'white', sill: 'stone'});
    }
    // upper floors at the bay rhythm
    for (const u of [1.1, 6.6, 12.1, 17.4, 22.5]) {
      const {f, t} = p.at(u);
      for (const r of rows) row(f, [t], r, 1.7);
    }
  }

  // =============================== rounded south end ===============================
  {
    const edges: number[] = [];
    for (let i = 94; i <= 118; i++) edges.push(i);
    const p = path(edges);
    for (const e of p.fs) {
      if (e.len < 0.4) continue;
      for (const [t0, t1] of runs(e.f, e.len)) {
        slab(b, e.f, (t0 + t1) / 2, 0, t1 - t0, 0.35, 0.2, 'stone');
        slab(b, e.f, (t0 + t1) / 2, 5.95, t1 - t0, 0.45, 0.22, 'stone');
        slab(b, e.f, (t0 + t1) / 2, 7.1, t1 - t0, 0.3, 0.55, 'stone');
      }
    }
    const n = 7;
    for (let k = 0; k < n; k++) {
      const {f, t} = p.at(p.total * (k + 0.5) / n);
      if (flush(f, t)) {
        archBand(b, f, t, 1.0, 2.6, 4.6, 0.28, 0.2, 'stone');
        archWindows(b, f, [t], {y: 1.1, w: 2.0, h: 4.4, bars: 1, rows: 3, frame: 'white', sill: 'stone'});
      }
      for (const r of rows) row(f, [t], r, 1.5);
    }
  }

  // =============================== Nieuwe Doelenstraat side (SE) ===============================
  {
    const p = path([119, 120, 122]);
    for (const e of p.fs) stripes(e.f, e.len, {balcony: true});
    for (let u = 1.4; u < p.total - 0.8; u += 2.8) {
      const {f, t} = p.at(u);
      if (topAt(f, t) > 6 && flush(f, t)) { archBand(b, f, t, 1.0, 2.2, 4.6, 0.25, 0.2, 'stone'); archWindows(b, f, [t], {y: 1.1, w: 1.7, h: 4.4, bars: 1, rows: 3, frame: 'white', sill: 'stone'}); }
      for (const r of rows) row(f, [t], r, 1.5);
    }
  }

  // =============================== NW side (Oude Turfmarkt end) ===============================
  {
    const p = path([1, 8, 12]);
    for (const e of p.fs) stripes(e.f, e.len);
    for (let u = 1.5; u < p.total - 1; u += 3.2) {
      const {f, t} = p.at(u);
      for (const r of rows.slice(0, 3)) row(f, [t], r, 1.6);
      if (topAt(f, t) > 6 && flush(f, t)) sashWindows(b, f, [t], {y: 1.3, w: 1.8, h: 3.4, cols: 2, rows: 3, sill: 'stone'});
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
