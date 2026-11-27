import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, disc, getSink, poly, put, ringFrame, ringSlab, setSink, slab, type Frame} from './nearbar-kit';
import {speklagen, type BandOpening} from '../../src/canalRecall/landmarks/speklagen';
import {balustrade} from '../../src/canalRecall/landmarks/balustrade';
import {steppedGable} from '../../src/canalRecall/landmarks/steppedGable';
import {layoutRelief} from '../../src/canalRecall/landmarks/pedimentRelief';
import {voussoirFan} from '../../src/canalRecall/landmarks/voussoirFan';
import source from './kweekschool-zeevaart-footprints.json';

/**
 * KWEEKSCHOOL VOOR DE ZEEVAART, Prins Hendrikkade (BAG pand 0363100012181563, rijksmonument 518430, bouwjaar 1859 per
 * BAG): a symmetric three-storey neo-renaissance school front of red-brown brick with pale stone bands, block quoins,
 * sunburst voussoirs and a niche frieze, end pavilions and a centre risalit under stepped gables, six pointed dormers,
 * and a rounded east corner turning into the SE side.
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts). The front is ring edges 30-38 (t from the SE
 * end): SE pavilion (edge 30, 6.3 m), wing (32, 9.8 m, 0.3 m back), centre risalit (34, 8.6 m), wing (36), NW pavilion
 * (38). The 3DBAG walls of the pavilions and the centre rise as plain triangles to 21.5 and 22.3 m; the stepped gables
 * are sized so every step corner stands above that triangle. The rounded corner is ring edges 22-28 (1.17 m facets),
 * the SE side ring edge 21 (16.3 m, t from its SW end).
 *
 * Read from the rectified Gemeente Amsterdam panoramas (CC BY 4.0): the front on TMX7316010203-002370_pano_0000_000191
 * (2021, 45.1 px/m) and b_20250108_1041_Track08_Sphere_00263 (2024, roof and gables against the sky), the SE side on
 * b_20241210_1246_Track15_Sphere_00023 (2024, 50 px/m). The two crops disagree on the vertical scale by ~7 %; both are
 * fitted to the 3DBAG eaves (17.0-17.4 m) with the cornice crown at 16.9 m, so the storey lines run level round the
 * corner as in the aimed views.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const R = src.facadeRing;

/** Storey lines shared by every front (m above the pavement). */
const Y = {
  g: [1.45, 4.3] as [number, number], // ground-floor glass
  balcony: 5.15, // first-floor string course and balcony slabs
  f1: [6.05, 9.4] as [number, number],
  fan: 9.55, // sunburst voussoirs over the first-floor windows
  string2: 10.85,
  f2: [11.3, 14.1] as [number, number],
  niche: [14.55, 15.5] as [number, number],
  cornice: [15.85, 16.9] as [number, number],
};
const W = 1.42; // window glass width (crop: 64 px / 45.1)

export function buildKweekschoolZeevaart(_w: number, _d: number, b: BuildingTools) {
  addShell(b, src as never, {wall: 'brick', roof: 'slate'});
  const sink0 = getSink();
  setSink(0.04, true);
  pavilion(b, 30, false);
  pavilion(b, 38, true);
  wing(b, 32);
  wing(b, 36);
  centre(b);
  for (let e = 22; e <= 28; e++) cornerFacet(b, e);
  seSide(b);
  {
    // ring edge 11 (w04-119): the pair of doors under fanlights
    const {f: F, len: L} = ringFrame(R, 11);
    bands(b, F, 0.05, L - 0.05, [{t0: 0.3, t1: 2.9, y0: 0, y1: 4.4}]);
    doublePortal(b, F, 1.6);
  }
  setSink(sink0);
}

/** Pale stone bands through the brick of the ground storey (kz-banding), stopped at the openings; a plinth. */
function bands(b: BuildingTools, F: Frame, t0: number, t1: number, openings: BandOpening[], y1 = Y.balcony, out = 0) {
  const rows = [] as {y: number; h: number}[];
  for (let y = 0.55; y < y1 - 0.15; y += 0.46) rows.push({y, h: 0.22});
  for (const r of speklagen({t0, t1, bands: rows, openings, gap: 0.03})) slab(b, F, (r.t0 + r.t1) / 2, r.y, r.t1 - r.t0, r.h, 0.05, 'stone', out);
  slab(b, F, (t0 + t1) / 2, 0, t1 - t0, 0.5, 0.12, 'sandstone', out);
}

/** Storey string courses over a run of wall. */
function strings(b: BuildingTools, F: Frame, t0: number, t1: number, out = 0) {
  const tc = (t0 + t1) / 2, w = t1 - t0;
  slab(b, F, tc, Y.balcony - 0.1, w, 0.3, 0.16, 'stone', out);
  slab(b, F, tc, Y.string2, w, 0.16, 0.12, 'stone', out);
  slab(b, F, tc, Y.f2[1] + 0.25, w, 0.12, 0.1, 'stone', out);
}

/** Cross window (kruisvenster): white frame, mullion and transom, small-pane bars, stone sill; block quoins beside it. */
function crossWindow(b: BuildingTools, F: Frame, t: number, [y0, y1]: [number, number], w = W, quoins = true, out = 0, sillD = 0.2) {
  slab(b, F, t, y0 - 0.07, w + 0.14, y1 - y0 + 0.14, 0.07, 'frame', out);
  slab(b, F, t, y0, w, y1 - y0, 0.12, 'glass', out);
  const tr = y1 - (y1 - y0) * 0.3;
  slab(b, F, t, y0, 0.08, y1 - y0, 0.18, 'frame', out);
  slab(b, F, t, tr, w, 0.08, 0.18, 'frame', out);
  for (const s of [-1, 1]) slab(b, F, t + s * w / 4, y0, 0.03, tr - y0, 0.15, 'frame', out);
  slab(b, F, t, y0 + (tr - y0) / 2, w, 0.03, 0.15, 'frame', out);
  slab(b, F, t, y0 - 0.2, w + 0.35, 0.13, sillD, 'stone', out);
  if (quoins) for (let y = y0, k = 0; y < y1 - 0.15; y += 0.62, k++) for (const s of [-1, 1]) slab(b, F, t + s * (w / 2 + 0.07 + (k % 2 ? 0.14 : 0.22)), y, k % 2 ? 0.28 : 0.44, 0.3, 0.06, 'stone', out);
}

/** Sunburst over a first-floor window (kz-sunbursts): radiating stone voussoirs laid by the voussoirFan kit. */
function sunburst(b: BuildingTools, F: Frame, t: number, out = 0) {
  for (const r of voussoirFan({cy: Y.fan - 0.9, r0: 1.0, r1: 2.15, count: 9, halfAngle: 0.62, width: 0.13, shortRatio: 0.55})) {
    const g = new T.BoxGeometry(r.width, r.length, 0.06).translate(0, 0, 0.03).rotateZ(-r.angle);
    put(b, F, g, t + r.t, r.y, out, 'stone');
  }
}
/** The iron wall anchors between the sunbursts, drawn as dark crosses. */
function anchor(b: BuildingTools, F: Frame, t: number, y: number, out = 0) {
  slab(b, F, t, y, 0.1, 0.55, 0.05, 'bronze', out);
  slab(b, F, t, y + 0.22, 0.3, 0.08, 0.05, 'bronze', out);
}

/** Niche frieze under the cornice (kz-niche-frieze): a shallow round-headed niche with a shell panel. */
function niche(b: BuildingTools, F: Frame, t: number, w = 1.2, out = 0) {
  archBand(b, F, t, Y.niche[0], w, Y.niche[1] - Y.niche[0], 0.12, 0.08, 'stone', out, 8);
  archSlab(b, F, t, Y.niche[0], w - 0.24, Y.niche[1] - Y.niche[0] - 0.12, 0.05, 'sandstone', out);
}

/** Cornice: bed, a frieze band and the corona. */
function cornice(b: BuildingTools, F: Frame, t0: number, t1: number, out = 0) {
  const tc = (t0 + t1) / 2, w = t1 - t0;
  slab(b, F, tc, Y.cornice[0], w, 0.3, 0.14, 'stone', out);
  slab(b, F, tc, Y.cornice[0] + 0.3, w, 0.4, 0.3, 'stone', out);
  slab(b, F, tc, Y.cornice[1] - 0.35, w + 0.1, 0.35, 0.55, 'stone', out);
}

/** Stone balcony with a balustrade (balustrade kit) on console blocks (kz-centre-balcony, kz-pavilion-balconies). */
function balcony(b: BuildingTools, F: Frame, t: number, w: number, consoles: number, out = 0) {
  const y = Y.balcony, depth = 0.85;
  slab(b, F, t, y, w, 0.24, depth, 'stone', out);
  for (let k = 0; k < consoles; k++) {
    const tk = t - w / 2 + 0.35 + (k * (w - 0.7)) / (consoles - 1);
    slab(b, F, tk, y - 0.75, 0.28, 0.75, depth - 0.15, 'sandstone', out);
    slab(b, F, tk, y - 0.95, 0.2, 0.2, 0.35, 'sandstone', out);
  }
  const lay = balustrade({width: w - 0.1, height: 0.95, post: 0.26, plinth: 0.14, rail: 0.14, baluster: 0.12, pitch: 0.24, bays: consoles - 1});
  const o = out + depth - 0.24;
  for (const p of [lay.plinth, lay.rail]) slab(b, F, t + (p.x0 + p.x1) / 2, y + 0.24 + p.y, p.x1 - p.x0, p.h, 0.22, 'stone', o);
  for (const p of lay.posts) slab(b, F, t + p.x, y + 0.24 + p.y, p.w, p.h, 0.24, 'stone', o - 0.01);
  for (const p of lay.balusters) put(b, F, new T.CylinderGeometry(p.w * 0.32, p.w / 2, p.h, 6).translate(0, p.h / 2, 0), t + p.x, y + 0.24 + p.y, o + 0.11, 'stone');
  for (const s of [-1, 1]) slab(b, F, t + s * (w / 2 - 0.13), y + 0.24, 0.26, 0.85, depth - 0.05, 'stone', out); // below the rail's top
}

/** A stepped gable (steppedGable kit) at t: brick tiers, stone copings and quoins, pinnacles on the treads, a finial. */
function gable(b: BuildingTools, F: Frame, t: number, o: {width: number; steps: number; rise: number; run: number; out?: number; finial?: number}) {
  const out = o.out ?? 0, fin = o.finial ?? 0.8;
  const lay = steppedGable({width: o.width, y0: Y.cornice[1], stepsPerSide: o.steps, rise: o.rise, run: o.run, coping: 0.14, overhang: 0.08});
  // unsunk: the gable stands in front of the 3DBAG triangle; trims sit 5 cm off the tiers' back plane so no hidden faces pair up
  const sink = getSink();
  setSink(0);
  for (const tr of lay.tiers) slab(b, F, t + (tr.t0 + tr.t1) / 2, tr.y0, tr.t1 - tr.t0, tr.y1 - tr.y0, 0.3, 'brick', out);
  for (const c of lay.copings) slab(b, F, t + (c.t0 + c.t1) / 2, c.y, c.t1 - c.t0, c.h, 0.37, 'stone', out + 0.05);
  for (const tr of lay.tiers) for (const s of [tr.t0 + 0.18, tr.t1 - 0.18]) for (let y = tr.y0 + 0.13; y < tr.y1 - 0.25; y += 0.5) slab(b, F, t + s, y, 0.26, 0.24, 0.33, 'stone', out + 0.05);
  for (const c of lay.copings.slice(0, -1)) put(b, F, new T.ConeGeometry(0.11, 0.55, 4).rotateY(Math.PI / 4).translate(0, 0.27, 0), t + (c.t0 + c.t1) / 2, c.y + c.h, out + 0.2, 'stone');
  slab(b, F, t, lay.top, 0.5, 0.35, 0.35, 'stone', out + 0.05);
  put(b, F, new T.ConeGeometry(0.13, fin, 6).translate(0, fin / 2, 0), t, lay.top + 0.35, out + 0.2, 'bronze');
  setSink(sink, true);
  return lay;
}

/** Pointed dormer with a finial on the slate roof (kz-dormers). */
function dormer(b: BuildingTools, F: Frame, t: number) {
  const y0 = 17.3, y1 = 18.55, w = 0.95, out = -0.05; // front on the wall line: the 3DBAG roof rises from 17.0-17.4 m there
  // no sink: a sunk pane would reach back through the roof slope
  const sink = getSink();
  setSink(0);
  slab(b, F, t, y0, w, y1 - y0, 0.6, 'stone', out - 0.6);
  slab(b, F, t, y0 + 0.12, w - 0.3, y1 - y0 - 0.24, 0.05, 'glass', out);
  slab(b, F, t, y0 + 0.12 + (y1 - y0 - 0.24) / 2, w - 0.3, 0.04, 0.08, 'frame', out);
  const s = new T.Shape([new T.Vector2(-w / 2 - 0.08, 0), new T.Vector2(w / 2 + 0.08, 0), new T.Vector2(0, 1.05)]);
  put(b, F, new T.ExtrudeGeometry(s, {depth: 1.3, bevelEnabled: false}), t, y1, out - 1.25, 'slate');
  put(b, F, new T.ConeGeometry(0.06, 0.75, 4).translate(0, 0.37, 0), t, y1 + 1.0, out + 0.02, 'bronze');
  setSink(sink, true);
}

/** End pavilion (edges 30 and 38): two axes, a door between small windows, the balcony, the stepped gable. */
function pavilion(b: BuildingTools, e: number, nw: boolean) {
  const {f: F, len: L} = ringFrame(R, e);
  // axes (2021 crop: x 95-145 and 175-225 for the SE pavilion => 2.67 and 4.43 m from its SE end); the NW one mirrors
  const ax = nw ? [L - 4.43, L - 2.67] : [2.67, 4.43];
  const door = nw ? L - 3.55 : 3.55;
  const openings: BandOpening[] = [{t0: door - 0.85, t1: door + 0.85, y0: 0, y1: 4.2}];
  for (const t of [door - 1.3, door + 1.3]) openings.push({t0: t - 0.4, t1: t + 0.4, y0: 1.6, y1: 3.4});
  bands(b, F, 0.05, L - 0.05, openings);
  // the door under its arched fanlight, two small windows beside (kz-pavilion-doors)
  slab(b, F, door, 0, 1.25, 2.75, 0.17, 'dark');
  archSlab(b, F, door, 2.8, 1.25, 1.15, 0.12, 'glass');
  slab(b, F, door, 2.72, 1.35, 0.1, 0.16, 'frame');
  archBand(b, F, door, 2.8 + 1.25 / 2 - 0.62, 1.8, 1.25, 0.28, 0.24, 'stone', 0, 10);
  for (const s of [-1, 1]) slab(b, F, door + s * 0.75, 0, 0.3, 2.8, 0.22, 'stone');
  for (const t of [door - 1.3, door + 1.3]) crossWindow(b, F, t, [1.7, 3.3], 0.55, false);
  strings(b, F, 0.05, L - 0.05);
  balcony(b, F, (ax[0] + ax[1]) / 2, 4.3, 3);
  for (const t of ax) { crossWindow(b, F, t, Y.f1); crossWindow(b, F, t, Y.f2); sunburst(b, F, t); niche(b, F, t); }
  anchor(b, F, (ax[0] + ax[1]) / 2, Y.fan + 0.25);
  for (const tq of [0.32, L - 0.32]) for (let y = Y.balcony + 0.3, k = 0; y < Y.cornice[0] - 0.3; y += 0.6, k++) slab(b, F, tq, y, k % 2 ? 0.35 : 0.5, 0.3, 0.08, 'stone');
  cornice(b, F, 0.06, L - 0.06);
  // the stepped gable over the 3DBAG triangle (17.0 m at the ends, 21.5 m at mid): five tiers of 1.2 m, 0.65 m runs
  gable(b, F, L / 2, {width: L - 0.1, steps: 4, rise: 1.2, run: 0.65});
  {
    const sk = getSink();
    setSink(0); // the lights stand on the gable's face, not sunk back to the shell wall
    for (const t of [L / 2 - 0.55, L / 2 + 0.55]) crossWindow(b, F, t, [17.15, 18.0], 0.75, false, 0.32);
    setSink(sk, true);
  } // inside the lowest tier
}

/** A wing (edges 32 and 36): three axes, banded ground storey, sunbursts, niches, three dormers. */
function wing(b: BuildingTools, e: number) {
  const {f: F, len: L} = ringFrame(R, e);
  // axes (2021 crop: the SE wing's windows at x 388, 522, 657 => 2.3, 5.3, 8.3 m from its SE end; the NW wing mirrors)
  const ax = e === 32 ? [2.3, 5.3, 8.3] : [L - 8.3, L - 5.3, L - 2.3];
  bands(b, F, 0.05, L - 0.05, ax.map(t => ({t0: t - W / 2 - 0.35, t1: t + W / 2 + 0.35, y0: Y.g[0] - 0.25, y1: Y.g[1] + 0.1})));
  strings(b, F, 0.05, L - 0.05);
  for (const t of ax) {
    crossWindow(b, F, t, Y.g); crossWindow(b, F, t, Y.f1); crossWindow(b, F, t, Y.f2);
    sunburst(b, F, t); niche(b, F, t); dormer(b, F, t);
  }
  for (const t of [ax[0] - 1.5, (ax[0] + ax[1]) / 2, (ax[1] + ax[2]) / 2, ax[2] + 1.5]) { anchor(b, F, t, Y.fan + 0.25); anchor(b, F, t, Y.niche[0]); }
  cornice(b, F, 0.06, L - 0.06);
}

/** The centre risalit (edge 34): the entrance, the balcony, triple windows, the stepped gable with its relief. */
function centre(b: BuildingTools) {
  const {f: F, len: L} = ringFrame(R, 34), tc = L / 2;
  const side = [1.55, L - 1.55];
  const openings: BandOpening[] = [{t0: tc - 1.4, t1: tc + 1.4, y0: 0, y1: 5}, ...side.map(t => ({t0: t - 0.9, t1: t + 0.9, y0: 0, y1: 4.2}))];
  bands(b, F, 0.05, L - 0.05, openings);
  entrance(b, F, tc, side);
  strings(b, F, 0.05, L - 0.05);
  balcony(b, F, tc, 6.6, 4);
  // triple windows between stone mullions (kz-triple-windows)
  for (const r of [Y.f1, Y.f2]) {
    slab(b, F, tc, r[0] - 0.25, 5.3, r[1] - r[0] + 0.5, 0.06, 'stone');
    for (const k of [-1, 0, 1]) crossWindow(b, F, tc + k * 1.62, r, 1.38, false, 0.06);
    for (const k of [-1.5, -0.5, 0.5, 1.5]) slab(b, F, tc + k * 1.62, r[0] - 0.1, 0.24, r[1] - r[0] + 0.2, 0.2, 'stone', 0.06);
  }
  slab(b, F, tc, Y.fan - 0.1, 5.6, 1.0, 0.16, 'stone'); // the carved band over the first-floor triple window
  for (const k of [-1, 0, 1]) slab(b, F, tc + k * 1.62, Y.fan + 0.05, 1.0, 0.7, 0.22, 'sandstone');
  for (const k of [-1, 0, 1]) niche(b, F, tc + k * 1.62, 1.3);
  for (const t of [0.4, L - 0.4]) for (let y = Y.balcony + 0.3, k = 0; y < Y.cornice[0] - 0.3; y += 0.6, k++) slab(b, F, t, y, k % 2 ? 0.35 : 0.55, 0.3, 0.08, 'stone');
  cornice(b, F, 0.06, L - 0.06);
  // the stepped gable over the 3DBAG triangle (17.0 m at the ends, 22.3 m at mid): five tiers of 1.3 m, 0.85 m runs
  const lay = gable(b, F, tc, {width: L - 0.1, steps: 4, rise: 1.3, run: 0.85, finial: 0.4});
  // the semicircular relief field (kz-centre-relief): a raised stone half-disc with relief blocks laid by pedimentRelief
  const ry = Y.cornice[1] + 0.25, rr = 2.05;
  archSlab(b, F, tc, ry, 2 * rr + 0.3, rr + 0.15, 0.1, 'stone', 0.32);
  archSlab(b, F, tc, ry + 0.1, 2 * rr - 0.1, rr - 0.1, 0.06, 'sandstone', 0.42);
  for (const p of layoutRelief({halfWidth: rr - 0.1, rise: rr - 0.2, margin: 0.1, maxHeight: 1.6}, [{kind: 'reclining', u: -0.55}, {kind: 'seated', u: -0.15}, {kind: 'standing', u: 0.15}, {kind: 'reclining', u: 0.55}])) {
    slab(b, F, tc + p.x, ry + 0.12, p.width, p.height, 0.14, 'stone', 0.46);
  }
  // the pedestal and statue on top
  slab(b, F, tc, lay.top + 0.35, 1.0, 0.7, 0.5, 'stone', 0.1);
  put(b, F, new T.CylinderGeometry(0.22, 0.3, 0.9, 8).translate(0, 0.45, 0), tc, lay.top + 1.05, 0.35, 'stone');
}

/** The main entrance (kz-entrance): the arched doorway with fanlight and cartouche, two side doors under oculi. */
function entrance(b: BuildingTools, F: Frame, tc: number, side: number[]) {
  slab(b, F, tc, 0, 3.0, 4.9, 0.16, 'stone');
  slab(b, F, tc, 0, 1.6, 2.4, 0.14, 'dark', 0.1);
  for (const s of [-1, 1]) for (const [y0, y1] of [[0.25, 1.1], [1.3, 2.2]]) slab(b, F, tc + s * 0.38, y0, 0.55, y1 - y0, 0.18, 'dark', 0.1);
  archSlab(b, F, tc, 2.45, 1.6, 1.15, 0.14, 'glass', 0.1);
  slab(b, F, tc, 2.4, 1.7, 0.1, 0.2, 'frame', 0.1);
  archBand(b, F, tc, 2.75, 2.25, 1.5, 0.3, 0.3, 'stone', 0.1, 10);
  for (const s of [-1, 1]) slab(b, F, tc + s * 1.05, 0, 0.38, 2.75, 0.28, 'stone', 0.1);
  poly(b, F, tc, 4.0, [[-0.6, 0], [0.6, 0], [0.75, 0.55], [0.4, 1.1], [-0.4, 1.1], [-0.75, 0.55]], 0.25, 'sandstone', 0.1);
  for (const t of side) {
    slab(b, F, t, 0, 1.6, 4.4, 0.16, 'stone');
    slab(b, F, t, 0, 0.95, 2.4, 0.12, 'dark', 0.1);
    slab(b, F, t, 2.4, 1.2, 0.22, 0.24, 'stone', 0.1);
    ringSlab(b, F, t, 3.35, 0.36, 0.56, 0.12, 'stone', 0.1);
    disc(b, F, t, 3.35, 0.36, 0.1, 'glass', 0.12);
    for (const s of [-1, 1]) disc(b, F, t + s * 0.62, 3.35, 0.16, 0.16, 'sandstone', 0.12);
    slab(b, F, t, 3.95, 0.5, 0.3, 0.22, 'sandstone', 0.1);
  }
}

/** A pair of panelled doors under two round-arched fanlights with a cartouche (kz-se-door, kz-rear-door). */
function doublePortal(b: BuildingTools, F: Frame, t: number) {
  slab(b, F, t, 0, 2.5, 4.25, 0.16, 'stone');
  for (const s of [-1, 1]) {
    slab(b, F, t + s * 0.58, 0, 0.98, 2.75, 0.14, 'dark', 0.1);
    archSlab(b, F, t + s * 0.58, 2.85, 0.98, 0.95, 0.12, 'glass', 0.1);
    slab(b, F, t + s * 0.58, 2.78, 1.04, 0.08, 0.18, 'frame', 0.1);
  }
  put(b, F, new T.CylinderGeometry(0.09, 0.09, 3.3, 8).translate(0, 1.65, 0), t, 0, 0.25, 'stone');
  archBand(b, F, t, 2.9, 2.6, 1.3, 0.22, 0.22, 'stone', 0.1, 10);
  poly(b, F, t, 3.4, [[-0.45, 0], [0.45, 0], [0.55, 0.45], [0, 0.85], [-0.55, 0.45]], 0.24, 'sandstone', 0.12);
}

/** A facet of the rounded corner (kz-rounded-corner): bands, string courses, a window axis on facets 23, 25 and 27, cornice. */
function cornerFacet(b: BuildingTools, e: number) {
  const {f: F, len: L} = ringFrame(R, e), tc = L / 2, win = e === 23 || e === 25 || e === 27;
  bands(b, F, 0.01, L - 0.01, win ? [{t0: tc - 0.5, t1: tc + 0.5, y0: Y.g[0] - 0.25, y1: Y.g[1] + 0.1}] : [], Y.balcony, 0.1);
  strings(b, F, 0.01, L - 0.01, 0.1);
  // The 3DBAG draws this curve as 0.29 m facets that wander 0.07 m either side of the BAG ring: a brick facing slab on the
  // ring facet gives the curve one face per 1.17 m facet, and the lights stand on it (one window axis on each of the
  // three window facets 23, 25 and 27; the short joints between them carry an anchor).
  // The facing slab sinks 0.3 m and tapers to 80% width at its hidden back: an equal-sized back face (alone or merged
  // with the trims' coplanar backs) tied or beat the front, and the openings audit then hosted the lights on that
  // inward plane and read them as buried. The lights share one fixed sink so the stagger cannot set a frame behind the face.
  const fk = 0.3, fg = new T.BoxGeometry(L - 0.08, Y.cornice[0], 0.1 + fk).translate(0, Y.cornice[0] / 2, (0.1 + fk) / 2);
  const fp = fg.getAttribute('position') as T.BufferAttribute;
  for (let i = 0; i < fp.count; i++) if (fp.getZ(i) < 0.01) fp.setX(i, fp.getX(i) * 0.8);
  fg.computeVertexNormals();
  put(b, F, fg, tc, 0, -fk, 'brick');
  const sk = getSink();
  setSink(0.04);
  if (win) for (const r of [Y.g, Y.f1, Y.f2]) crossWindow(b, F, tc, r, 0.75, false, 0.1);
  setSink(sk, true);
  if (!win) anchor(b, F, tc, Y.fan + 0.25, 0.1);
  cornice(b, F, 0.01, L - 0.01, 0.1);
}

/** The SE side (edge 21, t from its SW end): SW pavilion, the door pair, the wing with three axes, two stepped crowns. */
function seSide(b: BuildingTools) {
  const {f: F, len: L} = ringFrame(R, 21);
  // 2024 crop (x / 50): pavilion axes 1.5 and 3.1, the door pair 5.95 under one axis, wing axes 9.3, 11.8, 14.3
  const pav = [1.5, 3.1], wingAx = [9.3, 11.8, 14.3], door = 5.95;
  const openings: BandOpening[] = [{t0: door - 1.35, t1: door + 1.35, y0: 0, y1: 4.3}, ...[...pav, ...wingAx].map(t => ({t0: t - W / 2 - 0.35, t1: t + W / 2 + 0.35, y0: 0.4, y1: Y.g[1] + 0.1}))];
  bands(b, F, 0.05, L - 0.05, openings);
  strings(b, F, 0.05, L - 0.05);
  doublePortal(b, F, door);
  for (const t of pav) {
    crossWindow(b, F, t, [0.6, Y.g[1]], 1.3, false); crossWindow(b, F, t, Y.f1, 1.3, false); crossWindow(b, F, t, Y.f2, 1.3, false);
    // iron balconettes (kz-se-balconettes)
    for (const y of [0.55, Y.f1[0]]) {
      slab(b, F, t, y + 0.05, 1.3, 0.05, 0.3, 'bronze');
      for (let k = -4; k <= 4; k++) slab(b, F, t + k * 0.15, y + 0.1, 0.025, 0.55, 0.28, 'bronze');
      slab(b, F, t, y + 0.62, 1.3, 0.05, 0.3, 'bronze');
    }
    sunburst(b, F, t);
  }
  crossWindow(b, F, door, Y.f1, 1.3); crossWindow(b, F, door, Y.f2, 1.3); sunburst(b, F, door); niche(b, F, door);
  for (const t of wingAx) { crossWindow(b, F, t, Y.g); crossWindow(b, F, t, Y.f1); crossWindow(b, F, t, Y.f2); sunburst(b, F, t); niche(b, F, t); }
  for (const t of [4.6, 7.4, 10.55, 13.05]) anchor(b, F, t, Y.fan + 0.25);
  cornice(b, F, 0.06, L - 0.06);
  // the two stepped crowns (kz-se-crowns) over the 3DBAG gables peaking at ~20.3 m (t 2.4) and 20.4 m (t 12)
  for (const t of [2.4, 11.9]) {
    gable(b, F, t, {width: 4.8, steps: 2, rise: 1.4, run: 0.7, finial: 0.5});
    const sk = getSink();
    setSink(0);
    crossWindow(b, F, t, [17.15, 18.1], 0.9, false, 0.32);
    setSink(sk, true);
  }
  dormer(b, F, 5.9);
}
