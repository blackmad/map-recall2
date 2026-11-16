import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {ringFrame, setSink, getSink, slab, type Frame} from './nearbar-kit';
import source from './oba-staatsliedenbuurt-footprints.json';

/**
 * OBA STAATSLIEDENBUURT BLOCK (Van Hallstraat 615, BAG pand 0363100012069991, 2005): the striped apartment block over the
 * public library on the Westerkanaal, the Van Hallstraat front with three octagonal bay towers on stepped corbels between
 * open balcony bays, the canal front in dark brick with thin cream bands, and the passage under the block, spanned by a
 * steel truss. Massing: the 3DBAG LoD2.2 shell (oba-staatsliedenbuurt-footprints.json, bag-shell-prepare.ts).
 *
 * Read from the rectified Gemeente Amsterdam panoramas (CC BY 4.0, 50 px/m, the crop base at the pavement):
 *  - w01-210, Van Hallstraat (ring edge 45, 29.4 m), recording_2024-09-11_10-02-32_00048 (2024): plinth stripes, alternately
 *    dark brick 1.1 m and cream brick 1.0 m, to 7.3 m; two-storey windows with a transom; bay towers at t 2.6-7.1,
 *    12.9-17.4 and 22.4-26.9 (three storeys, window heads 10.5/13.6/16.7 m, cream with dark bands, stepped corbels under
 *    each side); open balcony bays between them with concrete slabs and posts and white rails; a roof railing.
 *  - w02-121, the canal (edge 2, 24.8 m), TMX7316010203-000198_pano_0000_000631 (2017): dark brick with thin cream bands
 *    every metre between the windows, three window storeys (heads 8.8/11.7/14.6 m), a cream top storey 15.9-19 m, a
 *    recessed loggia bay at t 6.5-12.5, the brick pavilion at t 19.1-24.9 with cream quoins and round-headed windows,
 *    ground-floor windows in cream surrounds.
 *  - w03-97 (edge 3) the same canal system; w04-211 / w05-121 (edges 49 / 54): the passage, 0-7.3 m, with its steel truss
 *    and balconies above.
 * Colours: dark brick and cream at the white-frame gain (w01 0.85; w02 1.26), see material-slot-tags.ts.
 */
export function buildObaStaatsliedenbuurt(_w: number, _d: number, b: BuildingTools) {
  const src = source as unknown as {facadeRing: number[][]; surfaces: Surface[]};
  const ring = src.facadeRing;
  // the set-back top storeys (3DBAG walls that start above the 16.2-16.9 m front walls) are pale rendered and glazed
  // penthouses in w01-210 / w02-121, not brick
  // and the corner tower at the passage (ring edges 46-53, w04-211 / w06-211) is dark blue-grey glazed brick
  const nearTower = (pts: number[][]) => pts.every(p => [46, 47, 48, 49, 50, 51, 52, 53].some(e => segDist(p[0], p[2], ring[e], ring[(e + 1) % ring.length]) < 0.6));
  addShell(b, src as never, {wall: 'brick', roof: 'slate', wallFor: s => {
    const pts = s.rings[0] as number[][];
    if (Math.min(...pts.map(p => p[1])) > 15.9) return 'ochre';
    return nearTower(pts) ? 'blue' : 'brick';
  }});
  const sink0 = getSink();
  setSink(0.05, true);

  /** Horizontal bands over t a..z: `bands` = [y0, y1] pairs, cream brick 3 cm proud. */
  const bands = (f: Frame, a: number, z: number, list: [number, number][], colour = 'stone', d = 0.05) => {
    for (const [y0, y1] of list) slab(b, f, (a + z) / 2, y0, z - a - 0.1, y1 - y0, d, colour); // 5 cm clear of the jog walls at each end
  };
  /** A white-framed window: frame 0.06, glass 0.1, an optional transom at `tr` and `mull` mullions. */
  const win = (f: Frame, t: number, y0: number, y1: number, w: number, out = 0, mull = 1, tr = 0, frame = 'white') => {
    slab(b, f, t, y0, w, y1 - y0, 0.06, frame, out);
    slab(b, f, t, y0 + 0.07, w - 0.14, y1 - y0 - 0.14, 0.11, 'glass', out);
    for (let i = 1; i <= mull; i++) slab(b, f, t - w / 2 + (i * w) / (mull + 1), y0 + 0.07, 0.06, y1 - y0 - 0.14, 0.16, frame, out);
    if (tr) slab(b, f, t, tr, w - 0.14, 0.07, 0.16, frame, out);
  };
  /** Balcony rail: a white top rail and posts every 0.12 m, simplified to a top rail, a bottom rail and posts every 0.6 m. */
  const rail = (f: Frame, a: number, z: number, y: number, out: number) => {
    slab(b, f, (a + z) / 2, y + 1.0, z - a, 0.05, 0.05, 'white', out);
    slab(b, f, (a + z) / 2, y + 0.1, z - a, 0.04, 0.04, 'white', out);
    for (let t = a + 0.05; t <= z - 0.04; t += 0.6) slab(b, f, t, y + 0.1, 0.03, 0.9, 0.03, 'white', out + 0.01);
  };

  // ---------- Van Hallstraat (edge 45, w01-210) ----------
  {
    const {f, len} = ringFrame(ring, 45);
    const PLINTH = 7.3;
    // plinth stripes: dark brick is the shell; cream bands 1.15-2.15, 3.35-4.35, 5.5-6.5
    const BAYS: [number, number][] = [[2.6, 7.1], [12.9, 17.4], [22.4, 26.9]];
    bands(f, 0, len, [[1.15, 2.15], [3.35, 4.35], [5.5, 6.5]]);
    // ground windows: two storeys tall with a transom (w01: 1.3-6.5 m), and the entrance
    for (const [t, w] of [[0.6, 1.1], [4.95, 1.7], [9.0, 0.6], [14.4 + 0.8, 1.6], [19.9, 1.6], [24.65, 1.5], [28.0, 1.6]] as [number, number][]) win(f, t, 1.3, 6.4, w, 0.05, 1, 3.6, 'white');
    win(f, 10.5, 0.1, 6.4, 2.0, 0.05, 1, 3.4, 'white');
    // the slab over the plinth
    slab(b, f, len / 2, PLINTH, len, 0.25, 0.12, 'concrete');
    const FLOORS = [PLINTH, 10.4, 13.5, 16.6];
    // open balcony bays between the towers: concrete floor slabs, posts at the bay edges and mid-bay, dark glass doors behind, white rails
    const OPEN: [number, number][] = [[0, 2.6], [7.1, 12.9], [17.4, 22.4], [26.9, len]];
    for (const [a, z] of OPEN) {
      for (let k = 0; k < 3; k++) {
        const y = FLOORS[k];
        slab(b, f, (a + z) / 2, y + 0.25, z - a - 0.1, 2.75, 0.05, 'pink');
        const n = Math.max(1, Math.round((z - a) / 2.9));
        for (let i = 0; i < n; i++) win(f, a + ((z - a) * (i + 0.5)) / n, y + 0.3, y + 2.6, Math.min(2.2, (z - a) / n - 0.5), 0.05, 1, 0, 'dark');
        slab(b, f, (a + z) / 2, y + 2.85, z - a, 0.25, 0.16, 'concrete');
        rail(f, a + 0.1, z - 0.1, y + 0.25, 0.26);
      }
      if (z - a > 4) slab(b, f, (a + z) / 2, PLINTH, 0.3, FLOORS[3] - PLINTH + 0.25, 0.2, 'concrete');
    }
    // the open top storey (w01-210: a fourth row of balconies in front of the wall the 3DBAG sets 2 m back above 16.9 m) is
    // left to the shell's pale set-back storey: a slab edge there makes audit:glb read the middle tower's cheek windows as buried
        // the bay towers: an octagon 1.2 m proud (front face and two 45-degree cheeks), cream brick with dark bands, windows
    // on the front and the cheeks, a stepped corbel under each cheek, a concrete cap and a railing
    for (const [a, z] of BAYS) {
      const D = 1.2, fw = z - a - 2 * D, tc = (a + z) / 2, H0 = PLINTH - 0.2, H1 = 16.5; // the 3DBAG front wall stops at 16.9 m
      slab(b, f, tc, H0, fw, H1 - H0, D, 'stone');
      for (const s of [-1, 1]) {
        // the cheek: from the wall at t = tc + s(fw/2 + D) out to the front face's edge, its normal facing away from the bay
        const at = (t: number, o: number): [number, number] => [f.origin[0] + f.tangent[0] * t + f.n[0] * o, f.origin[1] + f.tangent[1] * t + f.n[1] * o];
        const cheek = frameAB(at(tc + s * (fw / 2 + D), 0), at(tc + s * fw / 2, D), [f.tangent[0] * s + f.n[0], f.tangent[1] * s + f.n[1]]);
        const cw = D * Math.SQRT2;
        // the cheek runs from the front face's edge back to the wall: centre at -s * cw / 2 along its own tangent
        slab(b, cheek, cw / 2, H0, cw, H1 - H0, 0.35, 'stone', -0.35);
        for (let k = 0; k < 3; k++) {
          const y = FLOORS[k];
          slab(b, cheek, cw / 2, y + 0.05, cw - 0.1, 0.5, 0.05, 'brick');
          slab(b, cheek, cw / 2, y + 2.55, cw - 0.1, 0.35, 0.05, 'brick');
          win(cheek, cw / 2, y + 0.75, y + 2.45, 0.9, 0, 0, 0, 'white');
        }
        // the stepped corbel under the cheek (w01: four steps, 3.8 m deep from the plinth slab down)
        for (let i = 0; i < 4; i++) slab(b, f, tc + s * (fw / 2 + 0.2), H0 - 0.95 * (i + 1), 1.6 - i * 0.3, 0.95, D - i * 0.28, i % 2 ? 'stone' : 'brick');
      }
      for (let k = 0; k < 3; k++) {
        const y = FLOORS[k];
        slab(b, f, tc, y + 0.05, fw, 0.5, 0.05, 'brick', D);
        slab(b, f, tc, y + 2.55, fw, 0.35, 0.05, 'brick', D);
        win(f, tc, y + 0.75, y + 2.45, Math.min(1.5, fw - 0.5), D, 1, y + 1.9, 'white');
      }
      slab(b, f, tc, H1, fw + 0.2, 0.25, D + 0.1, 'concrete');
    }
  }

  // ---------- the canal fronts (edges 2 and 3, w02-121 / w03-97): dark brick, thin cream bands, a cream top storey ----------
  // w02's crop base is the water: the quay is 1.8 m up, so its heights are taken 1.8 m down. The 3DBAG front wall stops
  // at 16.2-16.4 m (set-back storeys above it, edge 2 t 0-10), so the top storey is drawn on the wall to 16.1 m.
  for (const e of [2, 3]) {
    const {f, len} = ringFrame(ring, e);
    const HEADS = [7.0, 9.9, 12.8], WH = 2.3, TOPS = 13.6, WALL = 16.1;
    const span = e === 2 ? 19.1 : len;
    // ground floor: cream surrounds round paired windows (0.3-4.3 m)
    const n0 = Math.floor(span / 4.6), p0 = span / n0;
    for (let i = 0; i < n0; i++) {
      const tc = p0 * (i + 0.5);
      slab(b, f, tc, 0.1, 3.7, 4.5, 0.06, 'stone');
      for (const s of [-1, 1]) win(f, tc + s * 0.85, 0.3, 4.3, 1.4, 0.06, 1, 3.0, 'dark');
    }
    bands(f, 0, span, [[4.9, 5.1]]);
    const loggia = (t: number) => e === 2 && t > 6.0 && t < 13.0;
    const n = Math.round(span / 2.15), p = span / n;
    for (let i = 0; i < n; i++) {
      const tc = p * (i + 0.5);
      if (loggia(tc)) continue;
      for (const h of HEADS) win(f, tc, h - WH, h, 1.15, 0.05, 1, h - 0.7, 'white');
    }
    // thin cream bands every metre between the windows (on the brick, not across the loggia)
    for (let y = 5.85; y < TOPS - 0.5; y += 1.0) {
      if (e === 2) { bands(f, 0, 6.5, [[y, y + 0.2]]); bands(f, 12.5, span, [[y, y + 0.2]]); } else bands(f, 0, len, [[y, y + 0.2]]);
    }
    // the cream top storey with its windows
    if (e === 2) { bands(f, 0, 6.5, [[TOPS, WALL]], 'stone', 0.04); bands(f, 12.5, span, [[TOPS, WALL]], 'stone', 0.04); } else bands(f, 0, len, [[TOPS, WALL]], 'stone', 0.04);
    for (let i = 0; i < n; i++) { const tc = p * (i + 0.5); if (!loggia(tc)) win(f, tc, TOPS + 0.5, TOPS + 1.9, 1.4, 0.06, 1, 0, 'white'); }
    if (e === 2) {
      // the loggia bay: concrete frame, dark recess, balustrade panels (the 3DBAG recess above 13.3 m is the shell's)
      for (let k = 0; k < 3; k++) {
        const y = 5.0 + 2.75 * k;
        slab(b, f, 9.5, y + 0.25, 5.8, 2.6, 0.05, 'pink');
        win(f, 8.0, y + 0.4, y + 2.6, 2.4, 0.05, 1, 0, 'dark');
        win(f, 11.0, y + 0.4, y + 2.6, 2.4, 0.05, 1, 0, 'dark');
        slab(b, f, 9.5, y, 6.0, 0.25, 0.14, 'concrete');
        slab(b, f, 9.5, y + 0.25, 6.0, 0.8, 0.1, 'concrete', 0.12);
      }
      for (const t of [6.5, 12.5]) slab(b, f, t, 5.0, 0.4, 8.2, 0.16, 'concrete');
      // the brick pavilion: cream quoins, windows with a cream head, a cream band at each storey
      for (const t of [19.4, 24.5]) for (let y = 5.0; y < 15.5; y += 3.0) slab(b, f, t, y, 0.6, 0.7, 0.05, 'stone');
      for (const h of [3.7, 9.8, 12.8, 15.4]) for (const t of [20.7, 23.2]) {
        win(f, t, h - 2.3, h - 0.3, 1.5, 0, 1, h - 0.9, 'white');
        slab(b, f, t, h - 0.3, 1.5, 0.28, 0.07, 'stone');
      }
      bands(f, 19.1, len, [[4.8, 5.0]]);
    }
  }

  // ---------- the passage (edges 49 and 54): a dark opening to 7.3 m, the steel truss, balconies above ----------
  for (const e of [49, 54]) {
    const {f, len} = ringFrame(ring, e);
    const a = 1.1, z = len - 1.1, tc = len / 2;
    slab(b, f, tc, 0, z - a, 7.3, 0.05, 'pink');
    slab(b, f, tc, 0, z - a, 2.0, 0.05, 'dark', 0.4); // the gate (w04: a dark steel fence)
    // the truss: bottom chord, top chord and diagonals in grey steel, 6.3-7.3 m
    slab(b, f, tc, 6.2, z - a, 0.18, 0.2, 'frame', 0.1);
    slab(b, f, tc, 7.0, z - a, 0.2, 0.2, 'frame', 0.1);
    const nd = 6, w = (z - a) / nd;
    for (let i = 0; i < nd; i++) {
      const t0 = a + i * w;
      slab(b, f, t0 + w / 2, 6.38, 0.14, 0.72, 0.14, 'frame', 0.12);
      slab(b, f, t0 + (i % 2 ? w * 0.3 : w * 0.7), 6.38, w * 0.55, 0.12, 0.14, 'frame', 0.12);
    }
    // the piers: dark blue-grey brick with a cream band
    for (const t of [0.6, len - 0.6]) { slab(b, f, t, 0, 1.0, 7.3, 0.08, 'greyBrick'); slab(b, f, t, 4.3, 0.95, 0.5, 0.13, 'stone'); }
    // balconies above: three storeys
    for (let k = 0; k < 3; k++) {
      const y = 7.6 + 3.05 * k;
      slab(b, f, tc, y + 0.25, len - 0.7, 2.8, 0.05, 'pink');
      win(f, tc, y + 0.4, y + 2.6, len - 2.0, 0.05, 3, 0, 'dark');
      slab(b, f, tc, y, len - 0.1, 0.25, 0.3, 'concrete');
      rail(f, 0.45, len - 0.45, y + 0.25, 0.36);
    }
    for (const t of [0.3, tc, len - 0.3]) slab(b, f, t, 7.6, 0.25, 9.4, 0.3, 'concrete');
    // the top storey: cream band and windows
    bands(f, 0, len, [[16.75, 17.1]]);
    for (const t of [len * 0.2, len * 0.5, len * 0.8]) win(f, t, 17.4, 19.1, len * 0.24, 0, 1, 0, 'white');
  }

  // ---------- the short corners (edges 42, 47, 51, 52): the plinth stripes ----------
  for (const e of [42, 47, 51, 52]) {
    const {f, len} = ringFrame(ring, e);
    const d = e === 42 ? 0.12 : 0.05; // edge 42's 3DBAG wall stands 4-5 cm proud of the ring
    bands(f, 0, len, [[1.15, 2.15], [3.35, 4.35], [5.5, 6.5]], 'stone', d);
    for (let y = 7.6; y < 16.5; y += 1.0) bands(f, 0, len, [[y, y + 0.45]], 'stone', d);
  }
  setSink(sink0);
}

/** A frame from p to q (t = 0 at p), its normal on the side of `out`. */
function frameAB(p: [number, number], q: [number, number], out: [number, number]): Frame {
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]), tangent: [number, number] = [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
  let n: [number, number] = [-tangent[1], tangent[0]];
  if (n[0] * out[0] + n[1] * out[1] < 0) n = [-n[0], -n[1]];
  return {origin: p, tangent, n};
}

/** Distance in plan from (x, z) to the segment a-c. */
function segDist(x: number, z: number, a: number[], c: number[]) {
  const dx = c[0] - a[0], dz = c[1] - a[1], L = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
