import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {setSink, slab} from './nearbar-kit';
import {rawWall, topOf} from './big-kit';
import source from './grasweg-116-footprints.json';

/**
 * Grasweg 116-124 (BAG 0363100012252853, 2022; Buiksloterham, 129 flats): two 48-50 m towers on a stepped dark-brick base of 10-18 m terraces around a
 * courtyard. Every tower face is a regular punched-window grid (1.9 x 1.5 m windows, 2.9-3.0 m column pitch, 3.05 m floor pitch, first row centred
 * at 6.4 m above ground) in brick that steps from dark brown through grey-brown to light tan with height. Rhythm and brick steps are read from
 * rectified municipal panoramas (artifacts/landmark-lanes/grasweg-116, 16 px/m, rectifier cap 32 m so rows above are extrapolated by the grid):
 *  - SW (walls 22/14/80, 16 m, three planes stepping 1.15 m back): 6 columns at t = -0.25 + 2.875 k (rect-sw.jpg).
 *  - SE (wall 36, 20.4 m): 7 columns at t = 0.25 + 2.96 k (rect-se.jpg).
 *  - NW (walls 38, 231): 4 + 2 columns, pitch 2.98 (rect-nw.jpg).
 *  - NE (wall 134, 20.5 m) has no panorama: INFERRED from the SE grid. Terrace walls 67/150/17 INFERRED (first-floor row only).
 * Not modelled: the corner balconies with glass balustrades, the roof plant, ground-floor shop interiors, the brick relief.
 */
const ROW0 = 6.4, PITCH = 3.05, WH = 1.5, WW = 1.9;

type Tone = 'D' | 'M' | 'L';
export function buildGrasweg116(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'greyBrick', roof: 'slate'});
  b.mark?.('shell');
  if (process.env.BIG_SHELL_ONLY) return;
  setSink(0.3);
  const wall = (i: number) => rawWall(source as never, i);

  type Face = {ref: number; walls: number[]; ground: [number, number][]};
  /** Brick tone steps: each zone is [tRef, yMid, yLight]; dark brick (the shell colour) below yMid, grey-brown to yLight, tan above. */
  const tones = (face: Face, zones: [number, number, number][], endT: number) => {
    const ref = wall(face.ref);
    for (const i of face.walls) {
      const w = wall(i);
      const shift = (w.f.origin[0] - ref.f.origin[0]) * ref.f.tangent[0] + (w.f.origin[1] - ref.f.origin[1]) * ref.f.tangent[1];
      zones.forEach(([t0, yM, yL], k) => {
        const t1 = k + 1 < zones.length ? zones[k + 1][0] : endT;
        const a = Math.max(t0 - shift, 0), c = Math.min(t1 - shift, w.len);
        if (c - a < 0.2) return;
        const top = topOf(w, (a + c) / 2);
        if (Math.min(yL, top) - yM > 0.3) slab(b, w.f, (a + c) / 2, yM, c - a, Math.min(yL, top) - yM, 0.03, 'brick');
        if (top - yL > 0.3) slab(b, w.f, (a + c) / 2, yL, c - a, top - yL, 0.03, 'ochre');
      });
    }
  };
  let sillOn = true;
  const win = (f: Parameters<typeof slab>[1], t: number, y: number) => {
    slab(b, f, t, y - WH / 2, WW + 0.14, WH + 0.14, 0.1, 'frame');
    slab(b, f, t, y - WH / 2 + 0.07, WW - 0.06, WH - 0.0, 0.13, 'glass');
    if (sillOn) slab(b, f, t, y - WH / 2 - 0.07, WW + 0.3, 0.1, 0.16, 'concrete');
  };
  /** Columns are spread evenly over the 3DBAG wall (the measured pitch is 2.9 m; the stepped SW planes show two columns per plane, 5.0-5.6 m long). */
  const grid = (i: number, rows: number[]) => {
    const w = wall(i), n = Math.max(1, Math.round(w.len / 2.85));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) * w.len / n;
      for (const y of rows) if (y - WH / 2 >= w.base + 0.3 && Math.min(topOf(w, t - WW / 2), topOf(w, t + WW / 2)) >= y + WH / 2 + 0.3) win(w.f, t, y);
    }
  };
  const glass = (i: number, shift: number, spans: [number, number][]) => {
    const w = wall(i);
    for (const [a0, c0] of spans) {
      const a = Math.max(a0 - shift, 0.15), c = Math.min(c0 - shift, w.len - 0.15);
      if (c - a < 0.4) continue;
      slab(b, w.f, (a + c) / 2, 0.4, c - a, 3.9, 0.1, 'glass');
      slab(b, w.f, (a + c) / 2, 4.25, c - a + 0.1, 0.1, 0.16, 'frame'); slab(b, w.f, (a + c) / 2, 0.35, c - a + 0.1, 0.1, 0.16, 'frame');
      for (let t = a; t <= c + 0.01; t += Math.max(1.2, (c - a) / Math.round((c - a) / 1.5))) slab(b, w.f, t, 0.4, 0.07, 3.9, 0.16, 'frame');
    }
  };
  const rows = Array.from({length: 14}, (_, k) => ROW0 + PITCH * k);
  const shiftOf = (refI: number, i: number) => { const r = wall(refI), w = wall(i); return (w.f.origin[0] - r.f.origin[0]) * r.f.tangent[0] + (w.f.origin[1] - r.f.origin[1]) * r.f.tangent[1]; };

  // ---------- SW: walls 22, 14, 80 (reference frame of wall 22; t as in rect-sw.jpg with t = -2 + px / 16) ----------
  {
    const face: Face = {ref: 22, walls: [22, 14, 80], ground: [[1.9, 3.3], [4.9, 9.9], [10.5, 14.9]]};
    tones(face, [[-3, 12.5, 23], [2.5, 14, 23], [8.4, 17, 23], [11.3, 20, 23]], 17);
    for (const i of face.walls) { grid(i, rows); glass(i, shiftOf(22, i), face.ground); }
  }
  // ---------- SE: wall 36 (t = -1 + px / 16 in rect-se.jpg) ----------
  {
    const face: Face = {ref: 36, walls: [36], ground: [[-1, 7.1], [8.7, 10.25], [11.5, 13.1], [14.3, 15.9], [17.1, 18.7]]};
    tones(face, [[-3, 14, 20.5], [1.8, 14, 17.5], [7.8, 14, 14], [13.8, 11, 11]], 22);
    grid(36, rows); glass(36, 0, face.ground);
  }
  // ---------- NW: walls 38 (frame t = -1 + px / 16) and 231 ----------
  {
    const face: Face = {ref: 38, walls: [38, 231], ground: [[-1, 4.3], [5.25, 10.9]]};
    tones(face, [[-3, 14, 99]], 13);
    grid(38, rows); glass(38, 0, face.ground);
    grid(231, rows);
  }
  // ---------- NE (wall 134, no panorama) and the terrace walls: INFERRED ----------
  {
    const ne: Face = {ref: 134, walls: [134], ground: []};
    tones(ne, [[-3, 14, 99]], 22);
    grid(134, rows);
    for (const i of [18, 163, 189]) grid(i, rows);   // the west tower's SW/NW flanks: no panorama sees them, rhythm of the other faces
    for (const i of [67, 150, 17]) grid(i, [ROW0, ROW0 - PITCH]);
  }
  // ---------- every other tall wall (courtyard and inner flanks): tone steps and the same grid, no sills; INFERRED, no photograph ----------
  {
    const done = new Set([22, 14, 80, 36, 38, 231, 134, 18, 163, 189, 67, 150, 17]);
    sillOn = false;
    source.surfaces.forEach((s, i) => {
      if (s.type !== 'WallSurface' || done.has(i)) return;
      const w = wall(i);
      if (w.len < 2.9 || w.top < 20) return;
      tones({ref: i, walls: [i], ground: []}, [[-3, 14, 23]], w.len + 3);
      grid(i, rows);
    });
    sillOn = true;
  }
  setSink(0);
}
