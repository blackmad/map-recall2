import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {raisedLettering} from './ornament-kit';
import {Mesh, edgeFrame, holed, type Cut, type V2} from './houthavens-kit';
import source from './de-bonte-zwaan-footprints.json';

/**
 * De Bonte Zwaan, Haparandadam 7 (BAG pand 0363100012240915, bouwjaar 1966): a floating office building on a steel
 * pontoon in the Houthavens, built in 1966 at the NDSM yard for the KNSM shipping line (mva.nl letting text for
 * "BOG Haparandadam 7"); now a 'bedrijfsverzamelgebouw' of studios. It floats: the water under it is correct, it is
 * reached by two white trussed gangways from the dam (PDOK 2025 orthophoto, panorama w01-140).
 *
 * Native frame of de-bonte-zwaan-footprints.json (x east, z south). The game draws y = 0 at the water line here; the
 * 3DBAG "ground" of this pand (-2.52 m NAP) is the harbour bed, so heights below are above the water (IJ ~ -0.4 m NAP):
 * 3DBAG eaves 11.7 m NAP -> 12.1, ridge 12.7-12.8 m NAP -> 13.1.
 *
 * Measured on rectified Gemeente Amsterdam panoramas (CC BY 4.0), crops of scripts/landmarks/landmark-brief.ts:
 *  - w02-320 (NW, 2021-01-21, 48.9 px/m): black hull 0-2.0 with a row of portholes (0.33 m, centre 0.95, ~1.45 m pitch);
 *    ground storey in dark cladding 2.0-3.9 with a ribbon of windows 2.3-3.75; pale grey corrugated siding 3.9-12.0
 *    with two window rows 5.9-7.45 and 9.5-11.0, fourteen 3.03 m bays, white posts between the windows; fascia
 *    12.0-12.4 with a 0.45 m overhang; the hull runs 1.7-2.6 m past the building at the NE end (a landing deck).
 *  - w01-140 (SE, 2021-03-24, sunlit): the same rows; the ground storey behind a walkway with a railing on the hull.
 *  - w03-230 (SW end, 2020/2022): a white stair tower 6.2-13.6 m from the NW corner carrying the winged-ship emblem and
 *    BONTE ZWAAN lettering, a tall glazed strip at 10.7-12.7 m; low saddle roof, crown near the middle, 0.9 m rise.
 *  - w04-50 (NE end, 2016): a black-clad stair tower in the middle rising a little above the eaves, small windows,
 *    white railings on the deck.
 * Colours: sunlit crop medians (w01 siding #c8cfc8, hull #1d1f27 overcast); see the catalogue materialOverrides.
 */
type C = 'pink' | 'stone' | 'slate' | 'dark' | 'glass' | 'frame' | 'concrete' | 'greyBrick' | 'blue' | 'bronze';
const RING = (source as {facadeRing: number[][]}).facadeRing.map(p => [p[0], p[1]] as V2);
// edges: 0 NW face (46 m), 1 SW end (19.8 m), 2 SE face (46 m), 3 NE end (19.7 m)
const HULL_TOP = 2.0, HULL_BOT = 0, GROUND_TOP = 3.9, EAVE = 12.0, FASCIA = 12.4, RIDGE = 13.1;
const ROWS: [number, number][] = [[5.9, 7.45], [9.5, 11.0]];
const GROUND_ROW: [number, number] = [2.3, 3.75];
const BODY_SW = 1.0, BODY_NE = 43.6, SIDE_IN = 0.3, WALKWAY = 1.2;

let m: Mesh;
let b: BuildingTools;

/** Point at u metres from the SW end along the long axis and v metres from the NW face into the building. */
function uv(u: number, v: number): V2 {
  const sw = RING[1], nw = RING[0], se = RING[2]; // SW end runs from RING[1] (W corner, on the NW face) to RING[2]
  const L = Math.hypot(nw[0] - sw[0], nw[1] - sw[1]), W = Math.hypot(se[0] - sw[0], se[1] - sw[1]);
  const ax = [(nw[0] - sw[0]) / L, (nw[1] - sw[1]) / L], ay = [(se[0] - sw[0]) / W, (se[1] - sw[1]) / W];
  return [sw[0] + ax[0] * u + ay[0] * v, sw[1] + ax[1] * u + ay[1] * v];
}
const WIDTH = Math.hypot(RING[2][0] - RING[1][0], RING[2][1] - RING[1][1]);

function hull() {
  const ring = RING;
  for (let i = 0; i < 4; i++) {
    const {f, len} = edgeFrame(ring, i);
    m.rect(f, 0, len, HULL_BOT, HULL_TOP, 0, 'dark');
    // deck edge: a 12 cm rubbing strake
    m.box(f, 0, len, HULL_TOP - 0.25, HULL_TOP - 0.1, 0, 0.12, 'dark', ['back']);
    if (i === 0) for (let t = 1.2; t < len - 1; t += 1.45) {           // portholes, NW face (w02-320)
      const g = new T.CylinderGeometry(0.17, 0.17, 0.06, 10).rotateX(Math.PI / 2);
      g.translate(0, 0.95, 0.02);
      g.rotateY(Math.atan2(f.n[0], f.n[1]));
      g.translate(f.origin[0] + f.tangent[0] * t, 0, f.origin[1] + f.tangent[1] * t);
      b.add(g, 'glass');
    }
  }
  m.flat(ring, HULL_TOP, 'concrete');
}

/** Long face: ground storey, two siding rows with fourteen bays each. `side` 0 = NW, 2 = SE. */
function longFace(edge: 0 | 2) {
  const body: V2[] = [uv(BODY_SW, SIDE_IN), uv(BODY_NE, SIDE_IN), uv(BODY_NE, WIDTH - SIDE_IN), uv(BODY_SW, WIDTH - SIDE_IN)];
  // body ring edges: 0 NW, 1 NE, 2 SE, 3 SW
  const bi = edge === 0 ? 0 : 2;
  const {f, len} = edgeFrame(body, bi);
  const pitch = len / 14;
  const cuts: Cut[] = [];
  for (let k = 0; k < 14; k++) for (const [y0, y1] of ROWS) cuts.push({t0: k * pitch + 0.33, t1: (k + 1) * pitch - 0.02, y0, y1, depth: 0.12, back: 'glass', reveal: 'frame'});
  holed(m, f, len, GROUND_TOP, EAVE, 'stone', cuts);
  for (const c of cuts) {
    const w = c.t1 - c.t0;
    for (const s of [0.36, 0.68]) m.box(f, c.t0 + w * s - 0.03, c.t0 + w * s + 0.03, c.y0, c.y1, -0.12, -0.02, 'frame', ['back']);
    m.box(f, c.t0 - 0.3, c.t0 - 0.02, c.y0 - 0.05, c.y1 + 0.05, 0, 0.07, 'pink', ['back']);              // white post
    m.box(f, c.t0 - 0.05, c.t1 + 0.05, c.y0 - 0.06, c.y0, 0, 0.06, 'frame', ['back']);                  // sill
  }
  // ground storey: dark cladding with a window ribbon (NW flush; SE set back behind the walkway)
  if (edge === 0) {
    const g: Cut[] = [];
    for (let k = 0; k < 14; k++) g.push({t0: k * pitch + 0.2, t1: (k + 1) * pitch - 0.1, y0: GROUND_ROW[0], y1: GROUND_ROW[1], depth: 0.1, back: 'glass', reveal: 'frame'});
    holed(m, f, len, HULL_TOP, GROUND_TOP, 'greyBrick', g);
    for (const c of g) m.box(f, (c.t0 + c.t1) / 2 - 0.03, (c.t0 + c.t1) / 2 + 0.03, c.y0, c.y1, -0.1, -0.02, 'frame', ['back']);
  } else {
    // soffit of the overhanging upper storeys, recessed glass front, railing on the hull edge
    const back = {...f, origin: [f.origin[0] - f.n[0] * WALKWAY, f.origin[1] - f.n[1] * WALKWAY] as [number, number]};
    const g: Cut[] = [];
    for (let k = 0; k < 14; k++) g.push({t0: k * pitch + 0.15, t1: (k + 1) * pitch - 0.05, y0: GROUND_ROW[0] - 0.2, y1: GROUND_ROW[1], depth: 0.08, back: 'glass', reveal: 'frame'});
    holed(m, back, len, HULL_TOP, GROUND_TOP, 'greyBrick', g);
    m.quad(f, {pts: [[0, GROUND_TOP, 0], [0, GROUND_TOP, -WALKWAY], [len, GROUND_TOP, -WALKWAY], [len, GROUND_TOP, 0]]}, 'stone');
    for (const t of [0, len]) m.quad(f, {pts: t === 0 ? [[0, HULL_TOP, -WALKWAY], [0, HULL_TOP, 0], [0, GROUND_TOP, 0], [0, GROUND_TOP, -WALKWAY]].reverse() : [[len, HULL_TOP, 0], [len, HULL_TOP, -WALKWAY], [len, GROUND_TOP, -WALKWAY], [len, GROUND_TOP, 0]].reverse()}, 'greyBrick');
  }
  // ends of the siding band (0.3 m strip between hull edge and body): handled by the hull deck
  return {f, len};
}

function railing(f: ReturnType<typeof edgeFrame>['f'], t0: number, t1: number, o: number) {
  m.box(f, t0, t1, HULL_TOP + 1.0, HULL_TOP + 1.06, o, o + 0.06, 'pink');
  m.box(f, t0, t1, HULL_TOP + 0.5, HULL_TOP + 0.54, o, o + 0.04, 'pink');
  for (let t = t0; t <= t1 + 1e-6; t += 1.5) m.box(f, t - 0.03, t + 0.03, HULL_TOP, HULL_TOP + 1.0, o, o + 0.06, 'pink');
}

function ends() {
  const body: V2[] = [uv(BODY_SW, SIDE_IN), uv(BODY_NE, SIDE_IN), uv(BODY_NE, WIDTH - SIDE_IN), uv(BODY_SW, WIDTH - SIDE_IN)];
  const bw = WIDTH - 2 * SIDE_IN;
  // SW end (body edge 3): viewer's left = NW. Tower 6.2-13.6 from the NW hull corner -> body t 5.9-13.3.
  {
    const {f, len} = edgeFrame(body, 3);
    const tw0 = 6.2 - SIDE_IN, tw1 = 13.6 - SIDE_IN;
    const small: Cut[] = [{t0: 1.8, t1: 2.8, y0: 10.2, y1: 10.75, depth: 0.1, back: 'glass', reveal: 'frame'}, {t0: 4.7, t1: 5.1, y0: 6.0, y1: 6.5, depth: 0.1, back: 'glass', reveal: 'frame'},
      {t0: 15.5, t1: 16.4, y0: 9.4, y1: 10.8, depth: 0.1, back: 'glass', reveal: 'frame'}, {t0: 15.5, t1: 16.4, y0: 6.0, y1: 7.4, depth: 0.1, back: 'glass', reveal: 'frame'}];
    holed(m, f, len, GROUND_TOP, EAVE, 'stone', small);
    const g: Cut[] = [{t0: 0.4, t1: tw0 - 0.3, y0: 2.3, y1: 3.75, depth: 0.1, back: 'glass', reveal: 'frame'}, {t0: tw1 + 0.6, t1: len - 0.4, y0: 2.3, y1: 3.75, depth: 0.1, back: 'glass', reveal: 'frame'}];
    holed(m, f, len, HULL_TOP, GROUND_TOP, 'greyBrick', g);
    // white tower, 0.6 m proud, glazed strip on its right part
    const TO = 0.6, gl0 = 10.7 - SIDE_IN, gl1 = 12.7 - SIDE_IN;
    m.box(f, tw0, gl0, HULL_TOP, EAVE, 0, TO, 'pink', ['back']);
    m.box(f, gl1, tw1, HULL_TOP, EAVE, 0, TO, 'pink', ['back']);
    m.box(f, gl0, gl1, HULL_TOP, 2.6, 0, TO, 'pink', ['back']);
    m.box(f, gl0, gl1, 2.6, EAVE, 0, TO - 0.15, 'glass', ['back']);
    for (const y of [4.1, 7.1, 9.9]) m.box(f, gl0, gl1, y, y + 0.12, TO - 0.15, TO - 0.05, 'frame', ['back']);
    m.box(f, (gl0 + gl1) / 2 - 0.04, (gl0 + gl1) / 2 + 0.04, 2.6, EAVE, TO - 0.15, TO - 0.05, 'frame', ['back']);
    // emblem: a winged ship's bow (w03-230): a dark bow shield between two grey wings, ~4.0 x 1.6 m, centre 9.6 m
    const ec = (tw0 + gl0) / 2 + 0.2, ey = 9.3;
    m.facePoly(f, [[ec - 0.55, ey + 0.75], [ec + 0.55, ey + 0.75], [ec + 0.45, ey - 0.15], [ec, ey - 0.55], [ec - 0.45, ey - 0.15]], TO + 0.06, 'bronze');
    for (const s of [-1, 1]) m.facePoly(f, s < 0
      ? [[ec - 0.5, ey + 0.1], [ec - 2.1, ey + 1.05], [ec - 1.9, ey + 0.55], [ec - 1.3, ey - 0.05], [ec - 0.5, ey - 0.25]]
      : [[ec + 0.5, ey - 0.25], [ec + 1.3, ey - 0.05], [ec + 1.9, ey + 0.55], [ec + 2.1, ey + 1.05], [ec + 0.5, ey + 0.1]], TO + 0.06, 'slate');
    // BONTE / ZWAAN lettering, dark, 0.42 m capitals, left-aligned under the emblem (w03-230)
    for (const [text, y] of [['BONTE', 7.75], ['ZWAAN', 7.15]] as [string, number][]) {
      const L = raisedLettering({text, heightM: 0.42, maxWidthM: 1.9, depthM: 0.04});
      const g = L.geometry; g.translate(L.widthM / 2, y + L.heightM / 2, 0);
      g.rotateY(Math.atan2(f.n[0], f.n[1]));
      const t = ec - 2.0;
      g.translate(f.origin[0] + f.tangent[0] * t + f.n[0] * (TO + 0.01), 0, f.origin[1] + f.tangent[1] * t + f.n[1] * (TO + 0.01));
      b.add(g, 'bronze');
    }
    for (const y of [8.3, 6.85]) m.box(f, ec - 2.0, ec + 1.9, y, y + 0.03, TO, TO + 0.05, 'bronze', ['back']);
  }
  // NE end (body edge 1): black stair tower in the middle, 1.5 m proud, 0.7 m above the eaves (w04-50)
  {
    const {f, len} = edgeFrame(body, 1);
    const tw0 = len / 2 - 3.2, tw1 = len / 2 + 2.6;
    const small: Cut[] = [];
    for (const t of [2.2, len - 3.4]) for (const y of [6.2, 9.8]) small.push({t0: t, t1: t + 1.0, y0: y, y1: y + 0.55, depth: 0.1, back: 'glass', reveal: 'frame'});
    holed(m, f, len, GROUND_TOP, EAVE, 'stone', small);
    holed(m, f, len, HULL_TOP, GROUND_TOP, 'greyBrick', [{t0: tw1 + 0.6, t1: tw1 + 2.4, y0: 2.2, y1: 3.6, depth: 0.1, back: 'glass', reveal: 'frame'}]);
    const TO = 1.5, top = EAVE + 0.7;
    const tcuts: Cut[] = [];
    for (const y of [2.6, 6.0, 9.4]) tcuts.push({t0: 1.6, t1: 2.3, y0: y, y1: y + 1.1, depth: 0.12, back: 'glass', reveal: 'frame'});
    const tf = {...f, origin: [f.origin[0] + f.n[0] * TO + f.tangent[0] * tw0, f.origin[1] + f.n[1] * TO + f.tangent[1] * tw0] as [number, number]};
    holed(m, tf, tw1 - tw0, HULL_TOP, top, 'dark', tcuts);
    for (const t of [tw0, tw1]) m.quad(f, {pts: t === tw0 ? [[t, HULL_TOP, 0], [t, HULL_TOP, TO], [t, top, TO], [t, top, 0]] : [[t, HULL_TOP, TO], [t, HULL_TOP, 0], [t, top, 0], [t, top, TO]]}, 'dark');
    m.box(f, tw0 - 0.1, tw1 + 0.1, top, top + 0.25, -1.0, TO + 0.1, 'blue');
    // deck railings on the landing beside the tower
    railing(f, 0.2, tw0 - 0.2, 1.9);
    railing(f, tw1 + 0.2, len - 0.2, 1.9);
  }
}

function roof() {
  // saddle roof, ridge on the long axis, eaves 12.0 (fascia to 12.4), crown 13.1; overhang 0.45 sides, 0.8 ends
  const o = 0.45, e = 0.8, v0 = SIDE_IN - o, v1 = WIDTH - SIDE_IN + o, vr = WIDTH / 2, u0 = BODY_SW - e, u1 = BODY_NE + 0.2;
  const P = (u: number, v: number, y: number) => { const p = uv(u, v); return [p[0], y, p[1]]; };
  const a = P(u0, v0, FASCIA), bq = P(u1, v0, FASCIA), r0 = P(u0, vr, RIDGE), r1 = P(u1, vr, RIDGE), c = P(u1, v1, FASCIA), d = P(u0, v1, FASCIA);
  // NW slope (a, bq, r1, r0) and SE slope (r0, r1, c, d): wind so the normals face up
  const tri = (p: number[], q: number[], s: number[]) => m.triFacing('slate', p, q, s);
  tri(a, bq, r1); tri(a, r1, r0); tri(r0, r1, c); tri(r0, c, d);
  // fascia band around the eaves and the gable verges
  const ring: V2[] = [uv(u0, v0), uv(u1, v0), uv(u1, v1), uv(u0, v1)];
  for (let i = 0; i < 4; i++) {
    const {f, len} = edgeFrame(ring, i);
    if (i === 0 || i === 2) m.rect(f, 0, len, EAVE, FASCIA, 0, 'blue');
    else {
      // gable verge: fascia following the low pitch, and the gable triangle between eaves and crown
      const mid = len / 2;
      // the verge board closes the gable overhang down to the eaves line, so the soffit never shows from outside
      m.facePoly(f, [[0, EAVE], [len, EAVE], [len, FASCIA], [mid, RIDGE], [0, FASCIA]], 0, 'blue');
    }
  }
  // soffit under the overhang (faces down)
  const outer: V2[] = ring, inner: V2[] = [uv(BODY_SW, SIDE_IN), uv(BODY_NE, SIDE_IN), uv(BODY_NE, WIDTH - SIDE_IN), uv(BODY_SW, WIDTH - SIDE_IN)];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4, p = (q: V2) => [q[0], EAVE, q[1]];
    m.triFacing('stone', p(outer[i]), p(inner[i]), p(inner[j]), false); m.triFacing('stone', p(outer[i]), p(inner[j]), p(outer[j]), false);
  }
  // gable infill between the eaves line and the roof over the body ends
  const body: V2[] = [uv(BODY_SW, SIDE_IN), uv(BODY_NE, SIDE_IN), uv(BODY_NE, WIDTH - SIDE_IN), uv(BODY_SW, WIDTH - SIDE_IN)];
  for (const i of [1, 3]) {
    const {f, len} = edgeFrame(body, i);
    m.facePoly(f, [[0, EAVE], [len, EAVE], [len / 2, RIDGE - 0.35]], 0, 'stone');
  }
}

/** Two trussed gangways to the dam on the SE side (orthophoto, w01-140): white rails, 7 m, sloping down to the quay. */
function gangways() {
  const {f} = edgeFrame(RING, 2);           // SE face, t from the SW end
  for (const t of [18.9, 44.2]) {
    const L = 7.0, w = 1.4, yIn = HULL_TOP, yOut = 1.4;
    const P = (dt: number, o: number, y: number) => m.world(f, t + dt, y, o);
    // deck
    const a = P(-w / 2, 0, yIn), bq = P(w / 2, 0, yIn), c = P(w / 2, L, yOut), d = P(-w / 2, L, yOut);
    m.triFacing('concrete', a, c, bq); m.triFacing('concrete', a, d, c);
    // side stringers (0.55 m deep) and the landing beam at the quay end: the gangway is a closed truss bridge, not a slab
    for (const sx of [-1, 1]) {
      const x = t + sx * w / 2;
      const g = new T.BoxGeometry(0.08, 0.55, Math.hypot(L, yIn - yOut)).rotateX(Math.atan2(yIn - yOut, L)).translate(0, (yIn + yOut) / 2 - 0.36, L / 2);
      place(g, f, x, 0, 'pink');
    }
    { const g = new T.BoxGeometry(w + 0.1, 0.55, 0.1).translate(0, yOut - 0.36, L - 0.05); place(g, f, t, 0, 'pink'); }
    // trussed side rails: top chord and diagonals as thin boxes
    for (const s of [-1, 1]) {
      const n = 6;
      for (let k = 0; k <= n; k++) {
        const o = (L * k) / n, y = yIn + (yOut - yIn) * (k / n);
        const g = new T.BoxGeometry(0.05, 1.05, 0.05).translate(0, y + 0.52, 0);
        place(g, f, t + s * w / 2, o, 'pink');
      }
      const top0 = yIn + 1.05, top1 = yOut + 1.05, len = Math.hypot(L, top1 - top0);
      const chord = new T.BoxGeometry(0.06, 0.06, len).rotateX(Math.atan2(top0 - top1, L)).translate(0, (top0 + top1) / 2, L / 2);
      place(chord, f, t + s * w / 2, 0, 'pink');
      for (let k = 0; k < n; k++) {
        const o0 = (L * k) / n, o1 = (L * (k + 1)) / n, y0 = yIn + (yOut - yIn) * (k / n) + 0.05, y1 = yIn + (yOut - yIn) * ((k + 1) / n) + 1.0;
        const lseg = Math.hypot(o1 - o0, y1 - y0);
        const diag = new T.BoxGeometry(0.04, 0.04, lseg).rotateX(-Math.atan2(y1 - y0, o1 - o0)).translate(0, (y0 + y1) / 2, (o0 + o1) / 2);
        place(diag, f, t + s * w / 2, 0, 'pink');
      }
    }
  }
}
function place(g: T.BufferGeometry, f: ReturnType<typeof edgeFrame>['f'], t: number, o: number, c: C) {
  g.rotateY(Math.atan2(f.n[0], f.n[1]));
  g.translate(f.origin[0] + f.tangent[0] * t + f.n[0] * o, 0, f.origin[1] + f.tangent[1] * t + f.n[1] * o);
  b.add(g, c);
}

export function buildDeBonteZwaan(_w: number, _d: number, tools: BuildingTools) {
  b = tools;
  m = new Mesh(tools);
  hull();
  // the body's floor plate on the deck is hidden by the walls; upper floor plate not needed (closed by the roof)
  const body: V2[] = [uv(BODY_SW, SIDE_IN), uv(BODY_NE, SIDE_IN), uv(BODY_NE, WIDTH - SIDE_IN), uv(BODY_SW, WIDTH - SIDE_IN)];
  void body;
  longFace(0);
  longFace(2);
  ends();
  roof();
  // SE walkway railing on the hull edge, and NW recessed terrace railing omitted (simplified)
  {
    const {f, len} = edgeFrame(RING, 2);
    railing(f, BODY_SW + 0.2, 18.2, -0.15);
    railing(f, 19.6, Math.min(len - 0.2, 43.5), -0.15);
  }
  gangways();
  m.flush();
}
