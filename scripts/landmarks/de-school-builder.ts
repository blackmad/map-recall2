import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {wallsOf} from './worship-walls';
import type {Wall} from './worship-walls';
import {faceOut, frameOf, put, slab} from './nearbar-kit';
import source from './de-school-footprints.json';

/**
 * De School / Tilla Tec (Dr. Jan van Breemenstraat 1, BAG 0363100012121682, 1966): the former technical school.
 * The massing is the 3DBAG LoD2.2 shell in native east/south metres: an 83 m four-level slab (13 m, flat roof with
 * a concrete flue stack) lying east-west, with a 5-8 m saw-tooth workshop wing on its north side.
 * Detail follows the 2017 and 2025 municipal panoramas:
 *  - slab long faces: bare precast-concrete plinth, then three continuous ribbons of glazing in dark red-brown
 *    frames (panes about 2 m wide with a transom), concrete spandrels between them and a deep concrete fascia;
 *  - south (canal) face: same ribbons plus a floor-to-ceiling glazed stair core;
 *  - east end of the wing: the green-framed two-row ribbon of the "pavilion" under a deep fascia, and the
 *    entrance porch with its flat canopy, steps and yellow/pink door leaves;
 *  - slab gable ends are blank concrete (as photographed).
 * The slab's north and south faces are gently curved in reality; the BAG outline is straight, so they are straight here.
 */
export function buildDeSchool(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'concrete', roof: 'slate'});
  b.mark?.('shell');
  const walls = new Map(wallsOf(source as never).map(w => [w.index, w]));
  const wall = (i: number) => walls.get(i)!;
  const open = (i: number) => faceOut(wall(i), source.surfaces as never);

  /** One continuous ribbon of separate panes divided by mullions with a transom, between t0 and t1. */
  const ribbon = (w: Wall, t0: number, t1: number, y: number, h: number, pitch: number, o: {frame?: string; skip?: [number, number][]; transom?: number} = {}) => {
    const f = frameOf(w), frame = o.frame ?? 'red';
    const n = Math.max(1, Math.round((t1 - t0) / pitch)), p = (t1 - t0) / n;
    for (let k = 0; k < n; k++) {
      const tc = t0 + p * (k + 0.5);
      if (o.skip?.some(([a, c]) => tc + p / 2 > a && tc - p / 2 < c)) continue;
      slab(b, f, tc, y, p - 0.08, h, 0.08, 'glass');
      slab(b, f, tc, y, 0.04, h, 0.12, frame);
      slab(b, f, tc, y + h * (o.transom ?? 0.72), p, 0.04, 0.12, frame);
      slab(b, f, tc, y - 0.04, p, 0.06, 0.13, frame);
      slab(b, f, tc, y + h - 0.02, p, 0.06, 0.13, frame);
    }
    for (let k = 0; k <= n; k++) slab(b, f, t0 + p * k, y - 0.04, 0.07, h + 0.08, 0.14, frame);
  };
  /** Projecting concrete ledge under a ribbon and the deep fascia at the top of a slab face. */
  const ledge = (w: Wall, t0: number, t1: number, y: number) => slab(b, frameOf(w), (t0 + t1) / 2, y, t1 - t0, 0.14, 0.14, 'greyBrick');
  const fascia = (w: Wall, y: number) => {
    slab(b, frameOf(w), w.length / 2, y, w.length, 0.3, 0.3, 'greyBrick');
    slab(b, frameOf(w), w.length / 2, y + 0.3, w.length, 0.55, 0.18, 'concrete');
  };
  // The fascia returns round the blank gable ends.
  fascia(wall(1), 11.95);
  fascia(wall(3), 11.95);
  const tiers: [number, number][] = [[1.7, 2.3], [5.5, 2.5], [9.3, 2.5]];

  // ---- North face of the slab (towards the entrance court): west part, the stretch above the wing, east part ----
  for (const [w, lowest] of [[wall(4), 0], [open(83), 1], [wall(30), 0]] as [Wall, number][]) {
    const skip: [number, number][] = [];
    tiers.slice(lowest).forEach(([y, h]) => { ribbon(w, 0.6, w.length - 0.6, y, h, 3.2, {skip}); ledge(w, 0.2, w.length - 0.2, y - 0.17); });
    fascia(w, 11.95);
  }

  // ---- South (canal) face: three ribbons, glazed stair core, fascia ----
  {
    const w = wall(5), core = 66.3, cw = 3.8;
    tiers.forEach(([y, h]) => { ribbon(w, 0.6, w.length - 0.6, y, h, 3.2, {skip: [[core - cw / 2 - 0.1, core + cw / 2 + 0.1]]}); ledge(w, 0.2, w.length - 0.2, y - 0.17); });
    fascia(w, 11.95);
    const f = frameOf(w);
    slab(b, f, core, 1.4, cw + 0.3, 10.7, 0.12, 'red');
    slab(b, f, core, 1.5, cw, 10.5, 0.2, 'glass');
    for (let k = 0; k <= 4; k++) slab(b, f, core - cw / 2 + cw * k / 4, 1.4, 0.08, 10.7, 0.26, 'red');
    for (let r = 0; r <= 8; r++) slab(b, f, core, 1.5 + r * 10.5 / 8 - 0.04, cw + 0.3, 0.08, 0.26, 'red');
  }

  // ---- East face of the wing: green-framed pavilion ribbon and the entrance porch ----
  {
    const w = wall(49), f = frameOf(w);
    // rounded concrete drum pavilion: solid core on a segmented arc, concrete plinth, two rows of green-framed glazing,
    // blank curved upper band overhanging the glass
    {
      const t0 = 12.2, t1 = 18.3, c = (t0 + t1) / 2, half = (t1 - t0) / 2, sag = 2.2, R = (half * half + sag * sag) / (2 * sag), N = 8, A = Math.asin(half / R);
      const pt = (i: number): [number, number] => { const a = -A + 2 * A * i / N; return [c + R * Math.sin(a), R * Math.cos(a) - (R - sag)]; };
      const sh = new T.Shape([[t0, 0], ...Array.from({length: N + 1}, (_, i) => pt(i)).map(q => [q[0], -q[1]] as [number, number]), [t1, 0]].map(q => new T.Vector2(q[0], q[1])));
      const g = new T.ExtrudeGeometry(sh, {depth: 5.2, bevelEnabled: false}).rotateX(-Math.PI / 2);
      put(b, f, g, 0, 0, 0, 'concrete');
      const world = (t: number, o: number): [number, number] => [f.origin[0] + f.tangent[0] * t + f.n[0] * o, f.origin[1] + f.tangent[1] * t + f.n[1] * o];
      for (let i = 0; i < N; i++) {
        const [ta, oa] = pt(i), [tb, ob] = pt(i + 1);
        const P0 = world(ta, oa), P1 = world(tb, ob), L = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]);
        let tan: [number, number] = [(P1[0] - P0[0]) / L, (P1[1] - P0[1]) / L], o0 = P0;
        let nn: [number, number] = [-tan[1], tan[0]];
        if (nn[0] * f.n[0] + nn[1] * f.n[1] < 0) { tan = [-tan[0], -tan[1]]; nn = [-nn[0], -nn[1]]; o0 = P1; }
        const fs: Frame = {origin: o0, tangent: tan, n: nn};
        slab(b, fs, L / 2, 0, L + 0.02, 1.3, 0.05, 'stone');
        slab(b, fs, L / 2, 1.35, L - 0.04, 2.45, 0.07, 'glass');
        for (const y of [1.3, 2.5, 3.72]) slab(b, fs, L / 2, y, L, 0.09, 0.12, 'green');
        for (const e of [0.05, L - 0.05, L / 2]) slab(b, fs, e, 1.3, 0.09, 2.5, 0.12, 'green');
        slab(b, fs, L / 2, 3.8, L + 0.03, 1.4, 0.2, 'concrete');
      }
    }
    // porch: platform, steps, glazed front with door leaves, flat canopy on two posts
    const pc = 6.5, pw = 7.4;
    slab(b, f, pc, 0, pw, 0.45, 2.9, 'stone');
    for (const [k, d] of [[1, 0.4], [2, 0.8], [3, 1.2]] as [number, number][]) slab(b, f, pc, 0, pw - 0.6, 0.45 - 0.15 * k, 2.9 + d, 'stone');
    slab(b, f, pc, 0.5, pw - 0.4, 2.7, 0.1, 'glass');
    for (let k = 0; k <= 6; k++) slab(b, f, pc - (pw - 0.4) / 2 + (pw - 0.4) * k / 6, 0.5, 0.07, 2.8, 0.16, 'dark');
    slab(b, f, pc, 3.15, pw - 0.4, 0.07, 0.16, 'dark');
    for (const [k, c] of [[1, 'ochre'], [2, 'ochre'], [4, 'pink'], [5, 'pink']] as [number, string][])
      slab(b, f, pc - (pw - 0.4) / 2 + (pw - 0.4) * (k + 0.5) / 6, 0.5, (pw - 0.4) / 6 - 0.12, 2.2, 0.14, c);
    slab(b, f, pc, 3.3, pw + 0.4, 0.4, 3.2, 'greyBrick');
    for (const s of [-1, 1]) slab(b, f, pc + s * (pw / 2 - 0.1), 0.45, 0.14, 2.85, 0.14, 'dark', 3.0);
  }
}
