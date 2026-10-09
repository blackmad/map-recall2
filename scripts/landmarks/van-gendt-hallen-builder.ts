import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {wallBetween} from './worship-kit';
import {wallsOf, wallTop, type Wall} from './worship-walls';
import {archBand, archWindows, frameOf, setSink, slab} from './nearbar-kit';
import source from './van-gendt-hallen-footprints.json';

/**
 * Van Gendt Hallen (Hallen van Stork), Oostenburg: five parallel factory halls by A.L. van Gendt (1898-1910), 157 m long.
 * Massing is the 3DBAG LoD2.2 shell (native east/south metres). Detail read from the 2018-2024 municipal panoramas:
 *  - end gables (NE and SW), one per hall: stepped corbel friezes following the shallow rake, three bays divided by pilasters,
 *    tall round-arched factory windows, a big window over a loading door in the middle bay;
 *  - NW water front (hall 1): a regular run of tall boarded openings under small arched upper windows between plinth,
 *    string course and cornice;
 *  - SE front (hall 5): 26 bays of tall round-arched windows in two storeys between brick pilasters.
 */
type P2 = [number, number];
const ne = wallBetween([2.69, -52.17], [59.79, 7.36], 20, [0.72, -0.69]);          // t = 0 at the east end
const sw = wallBetween([-110.43, 56.77], [-53.18, 116.23], 20, [-0.72, 0.694]);    // t = 0 at the north-west end
const nw = wallBetween([2.69, -52.17], [-110.43, 56.77], 9.5, [-0.693, -0.72]);   // t = 0 at the north-east end
const se = wallBetween([59.79, 7.36], [-53.18, 116.23], 10, [0.693, 0.72]);       // t = 0 at the south-west end
const NEHALLS: [number, number][] = [[0, 19], [19, 35.6], [35.6, 51.2], [51.2, 66.9], [66.9, 82.5]];
const SWHALLS: [number, number][] = [[0, 15.6], [15.6, 31.2], [31.2, 46.8], [46.8, 63.4], [63.4, 82.4]];

const pt = (w: Wall, t: number, out = 0): P2 => [w.origin[0] + w.tangent[0] * t + w.n[0] * out, w.origin[1] + w.tangent[1] * t + w.n[1] * out];

export function buildVanGendtHallen(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'brick', roof: 'slate'});
  b.mark?.('shell');
  setSink(0.5);
  const all = wallsOf(source as never);

  /** Highest shell wall at tangent position t of an end frame (the gable profile), or null. */
  const profile = (f: Wall, t: number, out = 0): number | null => {
    const p = pt(f, t, out);
    let best: number | null = null;
    for (const w of all) {
      if (w.n[0] * f.n[0] + w.n[1] * f.n[1] < 0.9) continue;
      const d = (p[0] - w.origin[0]) * w.n[0] + (p[1] - w.origin[1]) * w.n[1];
      if (Math.abs(d) > 1.0) continue;
      const tw = (p[0] - w.origin[0]) * w.tangent[0] + (p[1] - w.origin[1]) * w.tangent[1];
      if (tw < -0.05 || tw > w.length + 0.05) continue;
      const h = wallTop(w, Math.min(w.length, Math.max(0, tw)));
      if (Number.isFinite(h) && (best === null || h > best)) best = h;
    }
    return best;
  };

  const endGables = (f: Wall, halls: [number, number][], doors: number[]) => {
    halls.forEach(([a, c], i) => {
      const mid = (a + c) / 2, W = c - a - 0.8;
      // this hall's own gable plane: 3DBAG staggers the ends by up to a metre or two
      const ds: number[] = [];
      for (const w of all) {
        if (w.n[0] * f.n[0] + w.n[1] * f.n[1] < 0.95 || w.base > 0.5 || w.length < 3) continue;
        const m = pt(w, w.length / 2), tm = (m[0] - f.origin[0]) * f.tangent[0] + (m[1] - f.origin[1]) * f.tangent[1];
        if (tm > a + 1 && tm < c - 1) ds.push((m[0] - f.origin[0]) * f.n[0] + (m[1] - f.origin[1]) * f.n[1]);
      }
      ds.sort((x, y) => x - y);
      const dh = ds.length ? ds[Math.floor(ds.length / 2)] : 0;
      const fr = {...frameOf(f), origin: [f.origin[0] + f.n[0] * dh, f.origin[1] + f.n[1] * dh] as [number, number]};
      const profile2 = (t: number) => profile(f, t, dh - 0.0);
      const ridge = profile2(mid) ?? 13, eave = Math.min(profile2(a + 0.6) ?? ridge, profile2(c - 0.6) ?? ridge);
      // stepped corbel frieze following the rake, two courses
      const half = W / 2;
      for (const sgn of [-1, 1]) {
        for (let s = 0.6; s < half - 2.0; s += 0.9) {
          const t = mid + sgn * s, h = Math.min(profile2(t) ?? 99, profile2(t - 0.3) ?? 99, profile2(t + 0.3) ?? 99);
          if (h > 90) continue;
          const up = (Math.floor(s / 0.9) % 2) * 0.28;
          slab(b, fr, t, h - 1.4 + up, 0.5, 0.26, 0.12, 'greyBrick', -0.12);
        }
      }
      // pilasters framing the three bays
      for (const t of [a + 0.5, c - 0.5, mid - W * 0.2, mid + W * 0.2]) {
        const top = Math.min(profile2(t) ?? eave, profile2(t - 0.5) ?? eave, profile2(t + 0.5) ?? eave, ridge) - 1.9;
        slab(b, fr, t, 0, 0.55, top, 0.14, 'brick');
        slab(b, fr, t, top - 0.15, 0.8, 0.2, 0.2, 'stone');
      }
      slab(b, fr, mid, 5.6, W, 0.12, 0.1, 'stone');
      // side bays: tall arched window over a small low window
      const sideW = Math.min(2.2, W * 0.13);
      for (const t of [mid - W * 0.36, mid + W * 0.36]) {
        archWindows(b, fr, [t], {y: 3.2, w: sideW, h: Math.min(6.2, eave - 3.9), frame: 'frame', bars: 1, rows: 3, sill: 'stone'});
        archWindows(b, fr, [t], {y: 0.9, w: sideW * 0.75, h: 2.4, frame: 'frame', bars: 1, rows: 2, sill: 'stone'});
      }
      // middle bay: big window over the loading door (or a small green door)
      const wy = Math.max(5.0, ridge - 8.6);
      archWindows(b, fr, [mid], {y: wy, w: 2.5, h: Math.min(4.6, ridge - wy - 1.9), frame: 'frame', bars: 1, rows: 3, sill: 'stone'});
      if (doors.includes(i)) {
        slab(b, fr, mid, 0, 4.6, 6.3, 0.1, 'dark', 0.02);
        slab(b, fr, mid, 6.3, 5.2, 0.2, 0.2, 'stone');
      } else {
        slab(b, fr, mid, 0, 1.9, 3.1, 0.1, 'green', 0.02);
        archBand(b, fr, mid, 3.0, 2.4, 0.9, 0.2, 0.1, 'greyBrick', 0);
      }
    });
  };
  endGables(ne, NEHALLS, [1, 3]);
  endGables(sw, SWHALLS, [0, 2, 4]);

  // ---- NW water front: tall boarded openings, small arched upper windows ----
  {
    const f = frameOf(nw), L = nw.length;
    slab(b, f, L / 2, 0, L, 0.7, 0.12, 'stone');
    slab(b, f, L / 2, 5.3, L, 0.14, 0.1, 'stone');
    slab(b, f, L / 2, 9.0, L, 0.4, 0.2, 'greyBrick');
    const ts: number[] = [];
    for (let t = 2.0; t < L - 1.5; t += 3.6) if (t < 41.5 || t > 48.5) ts.push(t);
    for (const t of ts) {
      slab(b, f, t, 1.2, 1.9, 3.7, 0.1, 'dark', 0.02);
    }
    archWindows(b, f, ts.map(t => t + 1.8), {y: 6.7, w: 0.9, h: 1.4, frame: 'frame', bars: 0, rows: 0});
    for (let t = 3.8; t < L - 1; t += 3.6) if (t < 41 || t > 49) slab(b, f, t, 0, 0.5, 9.0, 0.1, 'greyBrick');
  }
  // ---- SE front: two storeys of round-arched windows between pilasters ----
  {
    const f = frameOf(se), L = se.length, pitch = L / 26;
    slab(b, f, L / 2, 0, L, 0.6, 0.12, 'stone');
    slab(b, f, L / 2, 5.9, L, 0.14, 0.1, 'stone');
    slab(b, f, L / 2, 9.6, L, 0.4, 0.2, 'greyBrick');
    const ts: number[] = [];
    for (let k = 0; k < 26; k++) ts.push((k + 0.5) * pitch);
    archWindows(b, f, ts, {y: 1.4, w: 3.0, h: 4.4, frame: 'frame', bars: 1, rows: 2, sill: 'stone'});
    archWindows(b, f, ts, {y: 6.9, w: 2.6, h: 2.5, frame: 'frame', bars: 1, rows: 0});
    for (let k = 0; k <= 26; k++) {
      const t = k * pitch;
      slab(b, f, Math.min(L - 0.3, Math.max(0.3, t)), 0, 0.6, 9.4, 0.14, 'greyBrick');
    }
  }
}
