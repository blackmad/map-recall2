import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {wallsOf} from './worship-walls';
import {frameOf, poly, put, setSink, slab} from './nearbar-kit';
import type {Frame} from './nearbar-kit';
import source from './trippenhuis-footprints.json';

/**
 * Trippenhuis (Kloveniersburgwal 29): Justus Vingboons, 1660-62, two houses behind one 7-axis
 * sandstone front. Massing is the 3DBAG LoD2.2 shell (native east/south metres, BAG 0363100012171636).
 * The canal front (bearing 300, collinear shell walls 17/20/72/12, 23.8 m) carries, measured by eye from
 * the 2021 municipal panorama taken from the opposite quay:
 *  - rusticated ground storey with five windows and two panelled doors on axes 2 and 6;
 *  - eight fluted Corinthian pilasters on plinth blocks, four of which carry the triangular pediment;
 *  - tall first-floor windows (pedimented over the doors), swag panels, second-floor windows, attic windows;
 *  - architrave/frieze/modillion cornice, the arms tympanum with cannon barrels and cannonball piles,
 *    and the four mortar-shaped corner chimneys (the 3DBAG chimney shafts get the bowls).
 * Side and rear walls are party walls or garden side and stay plain (inferred).
 */
const FRONT_T0 = 0, FRONT_LEN = 23.8, AXES = 7, PIL_W = 0.95;
export function buildTrippenhuis(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  setSink(0);   // module-global in the kit: do not inherit another builder's sink
  addShell(b, source as never, {wall: 'sandstone', roof: 'slate'});
  b.mark?.('shell');
  const w17 = wallsOf(source as never).find(w => w.index === 17)!;
  const f: Frame = frameOf(w17);
  const pitch = (FRONT_LEN - 1.3) / AXES;
  const pilT = (k: number) => 0.65 + pitch * k;
  const axisT = (k: number) => 0.65 + pitch * (k + 0.5);
  const centre = FRONT_LEN / 2 + FRONT_T0;
  const H = 18.6;

  // ---- ground storey: plinth course, string course, windows and the two doors ----
  slab(b, f, centre, 0, FRONT_LEN, 0.35, 0.12, 'stone');
  slab(b, f, centre, 4.45, FRONT_LEN, 0.28, 0.2, 'stone');
  slab(b, f, centre, 4.73, FRONT_LEN, 0.1, 0.26, 'stone');
  // rustication joints
  for (let y = 0.9; y < 4.4; y += 0.7) slab(b, f, centre, y, FRONT_LEN, 0.05, 0.05, 'greyBrick');
  const sash = (t: number, y: number, wd: number, h: number, cols: number, rows: number, surround = true) => {
    if (surround) {
      slab(b, f, t, y - 0.12, wd + 0.5, 0.14, 0.2, 'stone');           // sill
      slab(b, f, t, y + h, wd + 0.5, 0.2, 0.17, 'stone');               // lintel
      for (const s of [-1, 1]) slab(b, f, t + s * (wd / 2 + 0.12), y, 0.2, h, 0.12, 'stone');
    }
    slab(b, f, t, y, wd, h, 0.1, 'glass');
    for (let k = 1; k < cols; k++) slab(b, f, t - wd / 2 + wd * k / cols, y, 0.05, h, 0.14, 'frame');
    for (let r = 1; r < rows; r++) slab(b, f, t, y + h * r / rows, wd, 0.05, 0.14, 'frame');
    slab(b, f, t, y - 0.02, wd + 0.1, 0.05, 0.13, 'frame'); slab(b, f, t, y + h - 0.03, wd + 0.1, 0.05, 0.13, 'frame');
  };
  for (let k = 0; k < AXES; k++) {
    const t = axisT(k);
    if (k === 1 || k === 5) {
      // door with transom, stone surround, two steps
      slab(b, f, t, 0.0, 2.1, 4.35, 0.12, 'stone');
      slab(b, f, t, 0.15, 1.5, 3.1, 0.2, 'dark');
      slab(b, f, t, 0.15, 0.06, 3.1, 0.24, 'frame');
      slab(b, f, t, 3.3, 1.5, 0.8, 0.14, 'glass');
      slab(b, f, t, 3.3, 1.5, 0.06, 0.2, 'frame');
      slab(b, f, t, 0, 2.3, 0.15, 0.45, 'stone');
      slab(b, f, t, 4.2, 2.5, 0.25, 0.26, 'stone');
    } else sash(t, 0.95, 1.4, 2.4, 2, 3);
  }
  // basement gratings under the windows (iron bars in a stone reveal)
  for (const k of [0, 2, 3, 4, 6]) {
    const t = axisT(k);
    slab(b, f, t, 0.08, 1.5, 0.62, 0.08, 'dark');
    for (let j = -3; j <= 3; j++) slab(b, f, t + j * 0.2, 0.08, 0.04, 0.62, 0.13, 'frame');
  }

  // ---- giant fluted Corinthian pilasters ----
  const base = 5.0, capY = 16.0;
  for (let k = 0; k <= AXES; k++) {
    const t = pilT(k);
    slab(b, f, t, 4.73, PIL_W + 0.4, 0.5, 0.42, 'stone');                        // plinth block
    slab(b, f, t, 5.2, PIL_W + 0.22, 0.25, 0.38, 'stone');                       // base moulding
    slab(b, f, t, base + 0.45, PIL_W, capY - base - 0.45, 0.34, 'sandstone');   // shaft
    for (let j = -2; j <= 2; j++) slab(b, f, t + j * 0.17, base + 0.55, 0.06, capY - base - 0.65, 0.375, 'greyBrick'); // flutes
    slab(b, f, t, capY, PIL_W + 0.2, 0.55, 0.4, 'stone');                        // capital bell
    slab(b, f, t, capY + 0.55, PIL_W + 0.45, 0.2, 0.45, 'stone');                // abacus
    for (const s of [-1, 1]) slab(b, f, t + s * 0.4, capY + 0.1, 0.22, 0.5, 0.46, 'stone'); // volutes
  }

  // ---- first-floor tall windows (pedimented over the doors), swag panels ----
  const swag = (t: number, y: number, wd: number) => {
    const n = 8, pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) { const x = -wd / 2 + wd * i / n; pts.push([x, 0.55 - 0.45 * Math.cos((x / (wd / 2)) * Math.PI / 2)]); }
    for (let i = n; i >= 0; i--) { const x = -wd / 2 + wd * i / n; pts.push([x, 0.55 - 0.45 * Math.cos((x / (wd / 2)) * Math.PI / 2) - 0.14]); }
    poly(b, f, t, y, pts, 0.16, 'stone');
    slab(b, f, t, y + 0.55, wd + 0.1, 0.05, 0.12, 'stone');
  };
  for (let k = 0; k < AXES; k++) {
    const t = axisT(k);
    // carved panel between the plinth blocks, under the sill
    slab(b, f, t, 4.98, 1.7, 0.42, 0.08, 'stone'); swag(t, 4.95, 1.5);
    sash(t, 5.55, 1.5, 3.5, 2, 3);
    if (k === 1 || k === 5) poly(b, f, t, 9.35, [[-1.05, 0], [1.05, 0], [0, 0.65]], 0.2, 'stone');
    else slab(b, f, t, 9.3, 2.0, 0.14, 0.18, 'stone');
    slab(b, f, t, 9.65, 1.9, 1.0, 0.05, 'stone');
    swag(t, 9.75, 1.7);
    sash(t, 11.5, 1.4, 2.35, 2, 2);
    slab(b, f, t, 14.05, 1.9, 0.2, 0.17, 'stone');
    swag(t, 14.35, 1.6);
    sash(t, 15.6, 1.25, 0.95, 2, 1, false);
    slab(b, f, t, 15.5, 1.5, 0.1, 0.12, 'stone'); slab(b, f, t, 16.55, 1.5, 0.1, 0.12, 'stone');
  }

  // ---- entablature: architrave, frieze with garland band, modillion cornice ----
  const eY = capY + 0.75;
  slab(b, f, centre, eY, FRONT_LEN, 0.45, 0.16, 'stone');
  slab(b, f, centre, eY + 0.45, FRONT_LEN, 0.5, 0.06, 'sandstone');
  for (let k = 0; k < AXES; k++) { const t = axisT(k); slab(b, f, t, eY + 0.55, 1.6, 0.3, 0.14, 'stone'); }
  slab(b, f, centre, eY + 0.95, FRONT_LEN, 0.12, 0.3, 'stone');
  for (let t = 0.3; t < FRONT_LEN - 0.2; t += 0.42) slab(b, f, t, eY + 1.05, 0.2, 0.28, 0.36, 'stone');
  slab(b, f, centre, H - 0.1, FRONT_LEN + 0.5, 0.2, 0.55, 'stone');

  // ---- pediment with raking cornice, arms tympanum, cannon barrels and cannonball piles ----
  const halfBase = 7.0, rise = 3.3;
  poly(b, f, centre, H, [[-halfBase, 0], [halfBase, 0], [0, rise]], 0.28, 'sandstone');
  const slopeLen = Math.hypot(halfBase, rise), ang = Math.atan2(rise, halfBase);
  for (const s of [-1, 1]) {
    const g = new T.BoxGeometry(slopeLen + 0.4, 0.34, 0.5).translate(0, 0.0, 0.25);
    g.rotateZ(s * ang * -1);
    put(b, f, g, centre + s * halfBase / 2, H + rise / 2 + 0.05, 0, 'stone');
  }
  slab(b, f, centre, H, 2 * halfBase + 0.4, 0.2, 0.52, 'stone');
  // tympanum field a little proud of the pediment
  poly(b, f, centre, H + 0.35, [[-5.6, 0], [5.6, 0], [0, 2.5]], 0.34, 'sandstone');
  // arms: shield flanked by four cannon barrels, a pile of balls at each end
  poly(b, f, centre, H + 0.55, [[-0.55, 0], [0.55, 0], [0.55, 0.7], [0, 1.1], [-0.55, 0.7]], 0.4, 'stone');
  slab(b, f, centre, H + 0.7, 0.14, 0.4, 0.44, 'sandstone');
  for (const s of [-1, 1]) for (const j of [0, 1]) {
    const g = new T.CylinderGeometry(0.13, 0.17, 2.1, 8).rotateZ(Math.PI / 2 + s * (0.18 + 0.14 * j)).translate(0, 0, 0.1);
    put(b, f, g, centre + s * (2.1 + 0.15 * j), H + 0.55 + 0.4 * j + 0.15, 0.36, 'greyBrick');
    for (let i = 0; i < 3; i++) {
      const ball = new T.SphereGeometry(0.19, 8, 6);
      put(b, f, ball, centre + s * (4.1 + 0.4 * (i % 2) - 0.2 * Math.floor(i / 2) + 0.2), H + 0.55 + 0.17 + 0.28 * Math.floor(i / 2), 0.36, 'greyBrick');
    }
  }

  // ---- garden (east) front, after Vingboons' 1660s elevation print: ten axes, basement + four storeys,
  // two double stairs to the doors on axes 3 and 8, a four-axis pediment carrying the arms ----
  {
    const w87 = wallsOf(source as never).find(w => w.index === 87)!;
    const g: Frame = frameOf(w87), len = 23.55, sc = len / 24.1, c0 = len / 2;
    const xs = [1.4, 3.6, 5.8, 8.2, 10.6, 13.4, 15.9, 18.3, 20.5, 22.8].map(v => v * sc);
    const rows: [number, number][] = [[1.65, 2.95], [6.25, 2.95], [10.85, 2.85], [15.3, 2.7]];
    const sashR = (t: number, y: number, wd: number, h: number) => {
      slab(b, g, t, y - 0.1, wd + 0.4, 0.12, 0.18, 'stone');
      slab(b, g, t, y + h, wd + 0.4, 0.14, 0.14, 'stone');
      slab(b, g, t, y + h + 0.14, wd + 0.2, 0.16, 0.2, 'stone');
      slab(b, g, t, y, wd, h, 0.09, 'glass');
      slab(b, g, t, y, 0.05, h, 0.12, 'frame');
      slab(b, g, t, y + h / 2, wd, 0.05, 0.12, 'frame');
    };
    xs.forEach((t, k) => {
      const door = k === 2 || k === 7;
      rows.forEach(([y, h], r) => {
        if (r === 0 && door) {
          slab(b, g, t, y - 0.15, 1.8, h + 0.55, 0.1, 'stone');
          slab(b, g, t, y, 1.3, h - 0.2, 0.18, 'dark');
          slab(b, g, t, y + h - 0.2, 1.3, 0.35, 0.12, 'glass');
        } else sashR(t, y, 1.25, h);
      });
      slab(b, g, t, 0.15, 1.2, 0.85, 0.08, 'dark');   // basement window
      slab(b, g, t, 0.05, 1.45, 0.1, 0.14, 'stone'); slab(b, g, t, 1.0, 1.45, 0.1, 0.14, 'stone');
    });
    for (const y of [4.55, 9.55, 14.4]) slab(b, g, c0, y, len, 0.2, 0.12, 'stone');   // storey bands
    slab(b, g, c0, 19.0, len + 0.5, 0.25, 0.5, 'stone');                              // eaves cornice
    const hb = 5.75, rs = 2.6;
    poly(b, g, c0, 19.2, [[-hb, 0], [hb, 0], [0, rs]], 0.26, 'sandstone');
    const sl = Math.hypot(hb, rs), an = Math.atan2(rs, hb);
    for (const s of [-1, 1]) {
      const bx = new T.BoxGeometry(sl + 0.3, 0.3, 0.46).translate(0, 0, 0.23);
      bx.rotateZ(-s * an);
      put(b, g, bx, c0 + s * hb / 2, 19.2 + rs / 2 + 0.05, 0, 'stone');
    }
    slab(b, g, c0, 19.2, 2 * hb + 0.3, 0.18, 0.48, 'stone');
    poly(b, g, c0, 19.65, [[-0.5, 0], [0.5, 0], [0.5, 0.7], [0, 1.1], [-0.5, 0.7]], 0.36, 'stone');   // arms cartouche
    // double stairs: solid landing, two stepped flights running along the wall, rail and newel balls
    for (const k of [2, 7]) {
      const t = xs[k], top = 1.65, n = 8, run = 2.6, dx = run / n;
      slab(b, g, t, 0, 2.2, top - 0.05, 1.3, 'stone');
      slab(b, g, t, top - 0.05, 2.5, 0.2, 1.45, 'stone');
      for (const s of [-1, 1]) {
        const prof: [number, number][] = [[0, 0], [0, top]];
        for (let i = 0; i < n; i++) prof.push([i * dx, top * (1 - i / n)], [(i + 1) * dx, top * (1 - i / n)]);
        prof.push([n * dx, 0]);
        const pts = prof.map(([x, y]) => [s * x, y] as [number, number]);
        if (s < 0) pts.reverse();
        poly(b, g, t + s * 1.25, 0, pts, 1.0, 'stone');
        const rail = new T.BoxGeometry(Math.hypot(run, top), 0.07, 0.07).rotateZ(-s * Math.atan2(top, run));
        put(b, g, rail, t + s * (1.25 + run / 2), top / 2 + 0.95, 1.0, 'dark');
        // newel posts under both rail ends, the lower one topped by a stone ball
        slab(b, g, t + s * (1.25 + run), 0, 0.16, 0.95, 0.16, 'stone', 0.9);
        put(b, g, new T.SphereGeometry(0.14, 8, 6), t + s * (1.25 + run), 1.0, 0.98, 'stone');
        slab(b, g, t + s * 1.25, top, 0.16, 0.97, 0.16, 'stone', 0.9);
      }
    }
  }

  // ---- mortar chimneys: bowl-shaped caps on the four corner chimney shafts ----
  const mortar = (x: number, z: number, top: number) => {
    const bowl = new T.CylinderGeometry(0.95, 0.55, 0.95, 14, 1, false).translate(x, top - 0.25, z);
    const rim = new T.CylinderGeometry(1.0, 1.0, 0.14, 14).translate(x, top + 0.28, z);
    const foot = new T.CylinderGeometry(0.6, 0.6, 0.4, 12).translate(x, top - 0.8, z);
    b.add(foot, 'sandstone'); b.add(bowl, 'stone'); b.add(rim, 'stone');
  };
  mortar(-9.3, 8.5, 25.9);
  mortar(-1.5, -5.4, 25.9);
  mortar(9.4, 3.05, 23.9);
  mortar(3.8, 12.5, 23.8);
}
