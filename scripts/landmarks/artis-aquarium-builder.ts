import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {wallsOf} from './worship-walls';
import type {Wall} from './worship-walls';
import {archBand, archSlab, frameOf, poly, put, setSink, slab} from './nearbar-kit';
import type {Frame} from './nearbar-kit';
import source from './artis-aquarium-footprints.json';

/**
 * Artis Aquariumgebouw (Plantage Middenlaan 53; G.B. and A. Salm, 1881-82), neoclassical, symmetrical about the central portico.
 * Massing is the 3DBAG LoD2.2 shell of BAG pand 0363100012170226 (native east/south metres from its centroid). Street front
 * (bearing 209.5 degrees, towards Plantage Middenlaan) from the 2016 municipal panorama taken from the opposite pavement:
 *  - a tetrastyle Corinthian portico (coupled columns at each corner, a wide central bay with two arched portals) on a rusticated
 *    pink sandstone base with two arched basement openings, double flights of stairs with balustrades, an entablature lettered
 *    NATURA ARTIS MAGISTRA and a pediment with a painted tympanum (the 3DBAG shell only carries the gable behind the portico);
 *  - two five-bay wings: blind arch, three arched windows, blind arch, over small basement windows and panelled sills, under a frieze and cornice;
 *  - two end pavilions with paired arched windows and small pediments.
 * Axes: u runs along the front to the viewer's right, symmetry axis at u = -5.3 m. The rounded east (dome) and west ends and the garden
 * side have no street photograph and stay plain shell (inferred).
 */
const GL: Record<string, string[]> = {
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
};

export function buildArtisAquarium(_w: number, _d: number, bld: BuildingTools & {mark?: (n: string) => void}) {
  const b = bld;
  setSink(0.1);
  addShell(b, source as never, {wall: 'stone', roof: 'slate'});
  b.mark?.('shell');
  const walls = new Map(wallsOf(source as never).map(w => [w.index, w]));
  const W = (i: number): Wall => walls.get(i)!;

  /** Round-headed window in a cream surround with glazing bars. */
  const archWin = (f: Frame, t: number, y: number, w: number, h: number) => {
    archSlab(b, f, t, y - 0.12, w + 0.5, h + 0.12 + 0.25, 0.1, 'white');
    archSlab(b, f, t, y, w, h, 0.14, 'glass');
    for (const s of [-1, 0, 1]) slab(b, f, t + s * w / 4, y, 0.05, h - w / 2, 0.18, 'frame');
    for (const r of [0.28, 0.55]) slab(b, f, t, y + (h - w / 2) * r, w, 0.05, 0.18, 'frame');
    slab(b, f, t, y + h - w / 2 - 0.02, w, 0.05, 0.18, 'frame');
    archBand(b, f, t, y - 0.12, w + 1.0, h + 0.7, 0.18, 0.1, 'white');
    slab(b, f, t, y - 0.3, w + 0.75, 0.16, 0.24, 'white');                       // sill
  };
  const blindArch = (f: Frame, t: number, y: number, w: number, h: number) => {
    archSlab(b, f, t, y, w, h, 0.06, 'sandstone');
    archBand(b, f, t, y - 0.05, w + 0.3, h + 0.35, 0.16, 0.1, 'white');
  };
  const pilaster = (f: Frame, t: number, y0: number, y1: number, pw = 0.5) => {
    slab(b, f, t, y0, pw, y1 - y0, 0.14, 'white');
    slab(b, f, t, y0, pw + 0.18, 0.22, 0.2, 'white');
    slab(b, f, t, y1 - 0.3, pw + 0.18, 0.3, 0.2, 'white');
  };

  /** One wing of five bays (blind, three windows, blind) on a wall frame; windows only where the wing is long enough. */
  const wing = (w: Wall) => {
    const f = frameOf(w), L = w.length, P = L / 5, ax = (k: number) => P * (k + 0.5);
    // plinth with joints, small basement windows, string course, panelled sills
    slab(b, f, L / 2, 0, L, 3.7, 0.04, 'stone');
    for (let y = 0.6; y < 3.6; y += 0.6) slab(b, f, L / 2, y, L, 0.04, 0.1, 'sandstone');
    slab(b, f, L / 2, 0, L, 0.3, 0.14, 'sandstone');
    slab(b, f, L / 2, 3.65, L, 0.35, 0.28, 'white');
    for (const k of [1, 2, 3]) {
      slab(b, f, ax(k), 1.7, 1.15, 1.0, 0.1, 'dark');
      for (let j = -2; j <= 2; j++) slab(b, f, ax(k) + j * 0.22, 1.7, 0.04, 1.0, 0.14, 'frame');
      slab(b, f, ax(k), 1.58, 1.5, 0.12, 0.2, 'white');
      slab(b, f, ax(k), 1.4, 0.0 + 0.01, 0.01, 0.01, 'dark');
    }
    for (let k = 0; k < 5; k++) {
      slab(b, f, ax(k), 4.0, P - 0.9, 0.7, 0.1, 'white');                    // panel under the sill
      slab(b, f, ax(k), 4.1, P - 1.3, 0.5, 0.14, 'sandstone');
      if (k === 0 || k === 4) blindArch(f, ax(k), 4.8, 1.6, 3.5);
      else archWin(f, ax(k), 4.85, 1.5, 3.45);
    }
    for (let k = 0; k <= 5; k++) pilaster(f, k * P, 4.0, 8.3, k === 0 || k === 5 ? 0.35 : 0.5);
    // frieze with rosettes over the pilasters and the cornice
    slab(b, f, L / 2, 8.3, L, 0.5, 0.14, 'stone');
    for (let k = 0; k < 5; k++) put(b, f, new T.CylinderGeometry(0.17, 0.17, 0.1, 10).rotateX(Math.PI / 2).translate(0, 0, 0.1), ax(k), 8.55, 0.14, 'white');
    slab(b, f, L / 2, 8.8, L + 0.3, 0.3, 0.42, 'white');
  };
  wing(W(133));
  wing(W(135));

  /** End pavilion: 6 m, two arched windows between pilasters, entablature and a small pediment. frame from the first wall. */
  const pavilion = (w: Wall, L: number) => {
    const f = frameOf(w), c = L / 2;
    slab(b, f, c, 0, L, 3.9, 0.04, 'stone');
    for (let y = 0.6; y < 3.8; y += 0.6) slab(b, f, c, y, L, 0.04, 0.1, 'sandstone');
    slab(b, f, c, 3.85, L, 0.35, 0.28, 'white');
    for (const t of [1.6, 4.4]) {
      archWin(f, t, 4.9, 1.5, 4.2);
      slab(b, f, t, 1.7, 1.1, 1.1, 0.1, 'dark');
      slab(b, f, t, 1.55, 1.45, 0.12, 0.2, 'white');
    }
    for (const t of [0.15, c, L - 0.15]) pilaster(f, t, 4.2, 10.4, t === c ? 0.4 : 0.5);
    slab(b, f, c, 10.4, L + 0.2, 0.5, 0.2, 'stone');
    slab(b, f, c, 10.9, L + 0.5, 0.35, 0.44, 'white');
    poly(b, f, c, 11.25, [[-(L / 2 + 0.2), 0], [L / 2 + 0.2, 0], [0, 1.55]], 0.3, 'white');
    poly(b, f, c, 11.35, [[-(L / 2 - 0.5), 0], [L / 2 - 0.5, 0], [0, 1.0]], 0.38, 'stone');
  };
  pavilion(W(222), 6.0);
  pavilion(W(3), 6.1);

  // ---------------- portico ----------------
  {
    const w = W(130), f = frameOf(w);
    // wall 130 starts at u = -11.9; the symmetry axis u = -5.3 is 6.6 m along it
    const cc = 6.6, DEP = 5.4;
    const ts = [cc - 6.55, cc - 5.25, cc + 5.25, cc + 6.55];
    // rusticated base of the platform, 3.3 m high, with two arched basement openings and the stair cheeks
    slab(b, f, cc, 0, 16.2, 3.3, DEP + 0.25, 'red');
    for (let y = 0.55; y < 3.2; y += 0.55) slab(b, f, cc, y, 16.2, 0.05, DEP + 0.31, 'sandstone');
    slab(b, f, cc, 3.3, 16.8, 0.3, DEP + 0.55, 'stone');
    for (const t of [cc - 3.6, cc + 3.6]) {
      archSlab(b, f, t, 0.0, 1.9, 2.5, 0.12, 'sandstone', DEP + 0.25);
      archSlab(b, f, t, 0.0, 1.5, 2.3, 0.16, 'dark', DEP + 0.25);
      for (let j = -3; j <= 3; j++) slab(b, f, t + j * 0.2, 0.0, 0.04, 1.7, 0.2, 'frame', DEP + 0.25);
    }
    // double stairs: two flights along the front rising towards the platform, each with a balustrade
    for (const s of [-1, 1]) {
      const run = 5.2, top = 3.3, n = 16, dx = run / n, x0 = cc + s * 8.1;
      const prof: [number, number][] = [[0, 0], [0, top]];
      for (let i = 0; i < n; i++) prof.push([i * dx, top * (1 - i / n)], [(i + 1) * dx, top * (1 - i / n)]);
      prof.push([n * dx, 0]);
      const pts = prof.map(([x, y]) => [s * x, y] as [number, number]);
      if (s < 0) pts.reverse();
      poly(b, f, x0, 0, pts, 2.4, 'red', 0.0);
      const rail = new T.BoxGeometry(Math.hypot(run, top), 0.14, 0.2).rotateZ(-s * Math.atan2(top, run));
      put(b, f, rail, x0 + s * run / 2, top / 2 + 0.95, 2.3, 'stone');
      for (let i = 0; i <= 12; i++) {
        const x = i * run / 12, y = top * (1 - x / run);
        slab(b, f, x0 + s * x, y, 0.13, 0.9, 0.13, 'stone', 2.25);
      }
      slab(b, f, x0 + s * (run + 0.1), 0, 0.4, 1.0, 0.4, 'stone', 2.1);
    }
    // balustrade along the front of the platform between the column plinths
    slab(b, f, cc, 3.6, 13.8, 0.14, 0.3, 'stone', DEP - 0.75);
    for (let t = cc - 6.4; t <= cc + 6.45; t += 0.38) slab(b, f, t, 3.74, 0.14, 0.75, 0.14, 'stone', DEP - 0.75);
    slab(b, f, cc, 4.5, 13.8, 0.16, 0.3, 'stone', DEP - 0.75);
    // columns: coupled front pairs at the corners plus one return column each side
    const colH = 7.3, colBase = 3.9;
    const column = (t: number, depth: number) => {
      slab(b, f, t, colBase - 0.3, 1.25, 0.6, 1.25, 'stone', depth - 0.62);
      put(b, f, new T.CylinderGeometry(0.36, 0.42, colH - 1.0, 12).translate(0, (colH - 1.0) / 2 + 0.4, 0), t, colBase + 0.4, depth, 'sandstone');
      put(b, f, new T.CylinderGeometry(0.55, 0.4, 0.75, 12).translate(0, 0.375, 0), t, colBase + colH - 0.6, depth, 'stone');
      slab(b, f, t, colBase + colH + 0.1, 1.3, 0.22, 1.3, 'stone', depth - 0.65);
    };
    for (const t of ts) column(t, DEP - 0.7);
    for (const t of [cc - 6.55, cc + 6.55]) column(t, DEP - 3.2);
    // entablature (architrave, lettered frieze, cornice) over the whole portico
    const eY = colBase + colH + 0.32;
    slab(b, f, cc, eY, 16.2, 1.1, DEP + 0.3, 'stone');                     // architrave + frieze block
    slab(b, f, cc, eY + 1.1, 16.8, 0.5, DEP + 1.05, 'white');               // cornice, 0.8 m beyond the platform front (DEP + 0.25) as in the photos
    slab(b, f, cc, eY + 1.6, 17.0, 0.18, DEP + 1.15, 'stone');
    // gilded lettering on the frieze
    const text = 'NATURA ARTIS MAGISTRA', px = 0.055, pitch = 6 * px;
    let u = cc - (text.length * pitch) / 2;
    for (const ch of text) {
      const rows = GL[ch];
      if (rows) for (let j = 0; j < 7; j++) {
        let k = 0; const row = rows[j];
        while (k < 5) {
          if (row[k] !== '1') { k++; continue; }
          let e = k; while (e < 5 && row[e] === '1') e++;
          slab(b, f, u + (k + e) / 2 * px, eY + 0.4 + (6 - j) * px, (e - k) * px, px, 0.05, 'gold', DEP + 0.28);
          k = e;
        }
      }
      u += pitch;
    }
    // pediment: roof prism with the three-quarter tympanum, raking cornices
    const PY = eY + 1.78, rise = 16.8 - PY - 0.1, hb = 8.1;
    poly(b, f, cc, PY, [[-hb, 0], [hb, 0], [0, rise]], DEP + 0.4, 'slate');
    poly(b, f, cc, PY + 0.15, [[-hb + 1.0, 0], [hb - 1.0, 0], [0, rise - 0.7]], DEP + 0.5, 'blue');
    const slope = Math.hypot(hb, rise), ang = Math.atan2(rise, hb);
    for (const s of [-1, 1]) {
      const g = new T.BoxGeometry(slope + 0.5, 0.36, 0.5).translate(0, 0, 0.25);
      g.rotateZ(s * ang * -1);
      put(b, f, g, cc + s * hb / 2, PY + rise / 2 + 0.05, DEP + 0.2, 'white');
    }
    // two tall arched portals and small windows in the recessed back wall
    for (const t of [cc - 3.6, cc + 3.6]) {
      archSlab(b, f, t, 3.6, 2.4, 4.1, 0.1, 'white');
      archSlab(b, f, t, 3.7, 1.9, 3.8, 0.16, 'dark');
      slab(b, f, t, 3.7, 0.06, 2.4, 0.2, 'frame'); slab(b, f, t, 6.1, 1.9, 0.06, 0.2, 'frame');
      slab(b, f, t, 8.4, 0.9, 1.0, 0.1, 'dark'); slab(b, f, t, 8.3, 1.2, 0.12, 0.16, 'white');
    }
    for (const t of [cc - 0.0]) slab(b, f, t, 3.7, 0.5, 7.4, 0.1, 'white');
  }
}
