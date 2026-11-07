import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {roofPrism, gridFacade, type GridOptions} from './roof-prism-kit';
import {openTopPrism, upwardRoofPlane} from './house-geometry';
import {archSlab, letters, ringSlab, setSink, slab, type Frame} from './nearbar-kit';
import {bandedCurtain, storeyBands} from '../../src/canalRecall/landmarks/bandedCurtain';
import {arclengthNear, mullionStations, perimeter, roundedRectPlan, slabBandOutline, type PlanPt} from '../../src/canalRecall/landmarks/slabBandPlan';
import source from './atrium-zuidas-footprints.json';

/**
 * The Atrium complex, Strawinskylaan 3001-4129 (Zuidas): five BAG pands in one model, native east/south metres from the
 * Atrium Parkeergarage ring's vertex average (scripts/landmarks/atrium-zuidas-footprints.json, atrium-zuidas-prepare.ts),
 * y above each pand's 3DBAG ground.
 *
 *  - 0363100012074056, the former NMB hoofdkantoor (BAG 1972, opened 1974; called the Atrium since about 1990, nl.wikipedia
 *    "Zuidas"): the 3DBAG LoD2.2 massing, one closed prism per roof plane. Grid blocks (roofs 30-55 m) in light aluminium
 *    grid on blue-grey glass, a tall vision row and a short spandrel row per 3.6 m storey on a wide-wide-narrow
 *    (2.6/2.6/1.0 m) bay rhythm (panorama recording_2024-09-02_09-15-33_01297); granite cores (roofs >= 55 m) with large
 *    arched windows at the top and the emblem panel facing Parnassusweg (Commons Zuidas Strawinsky 04, panorama
 *    recording_2024-09-03_05-15-44_00043); the granite east wing (15-30 m) with ribbon windows (2016 panorama).
 *  - 0363100012246583, the Atrium Zuidtoren (2018 per nl.wikipedia "Lijst van hoogste gebouwen van Amsterdam": 68.0 m,
 *    16 storeys; BAG 2017): a rounded tower with a bronze slab edge at every floor; the slabs stop short of a corner on
 *    groups of storeys, so the curved glass corner shows (Commons Zuidas Strawinsky 02 and 11, panorama w02 2024).
 *  - 0363100012246582, the glazed entrance lobby on Strawinskylaan (BAG 2019, two storeys; 3DBAG 8.6 m): the ATRIUM
 *    letters stand on the canopy at the deck's north edge (panorama recording_2024-09-02_09-15-33_01297). The banded tower
 *    seen behind them from Strawinskylaan is the Zuidtoren (its 22-24 degree width and 32-39 degree height fit the 32 m
 *    north face 80-100 m away; no tower stands on this pand in the 2024 Parnassusweg panorama).
 *  - 0363100012246549, the north-east block on Strawinskylaan (BAG 2018): bronze slabs as on the Zuidtoren, ground storey
 *    6 m, nine floors of 3.75 m to the 39.7 m roof (3DBAG), a set-back top storey to 43.7 m.
 *  - 0363100012244160, the Atrium Parkeergarage (BAG 2018): only its exposed parts, the 8.7 m deck with the canopy along
 *    Strawinskylaan, the 13 m entrance block and the low ramps; its 3DBAG roofs over the other pands are dropped.
 */
type P3 = number[];
type Surf = {type: string; rings: P3[][]};
type Pand = {bagId: string; nativeRing: number[][]; surfaces: Surf[]};
const SRC = source as unknown as {pands: Pand[]};
const pand = (id: string) => SRC.pands.find(p => p.bagId === id)!;
const GARAGE = pand('0363100012244160'), NMB = pand('0363100012074056'), ZUID = pand('0363100012246583'), NORTH = pand('0363100012246582'), NE = pand('0363100012246549');

// ---- plan helpers -----------------------------------------------------------------------------------------------------
/** The Zuidas grid here runs 3.3 degrees off RD north (the BAG edges of all five pands): u east along the fronts, v south. */
const TH = -3.3 * Math.PI / 180, U: PlanPt = [Math.cos(TH), Math.sin(TH)], V: PlanPt = [-Math.sin(TH), Math.cos(TH)];
const toXZ = (p: PlanPt): PlanPt => [p[0] * U[0] + p[1] * V[0], p[0] * U[1] + p[1] * V[1]];
const toUV = (x: number, z: number): PlanPt => [x * U[0] + z * U[1], x * V[0] + z * V[1]];
function inPoly(x: number, z: number, r: number[][]) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const xi = r[i][0], zi = r[i].length > 2 ? r[i][2] : r[i][1], xj = r[j][0], zj = r[j].length > 2 ? r[j][2] : r[j][1];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
}
/** Local rectangle (u0, u1, v0, v1) spanned by the ring points that pass `keep`. */
function uvBox(ring: number[][], keep: (x: number, z: number) => boolean = () => true) {
  const uv = ring.filter(p => keep(p[0], p[1])).map(p => toUV(p[0], p[1]));
  return {u0: Math.min(...uv.map(p => p[0])), u1: Math.max(...uv.map(p => p[0])), v0: Math.min(...uv.map(p => p[1])), v1: Math.max(...uv.map(p => p[1]))};
}
const shapeOf = (outer: PlanPt[], hole?: PlanPt[]) => {
  const s = new T.Shape(outer.map(([x, z]) => new T.Vector2(x, z)));
  if (hole) s.holes.push(new T.Path(hole.map(([x, z]) => new T.Vector2(x, z))));
  return s;
};
const extrude = (s: T.Shape, y: number, h: number, steps = 6) => {
  const g = new T.ExtrudeGeometry(s, {depth: h, bevelEnabled: false, curveSegments: steps});
  g.rotateX(Math.PI / 2); g.translate(0, y + h, 0);
  return g;
};
const area = (r: P3[]) => Math.abs(r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[2] - q[0] * p[2]; }, 0) / 2);
const roofsOf = (p: Pand) => p.surfaces.filter(s => s.type === 'RoofSurface').map(s => ({rings: s.rings, h: s.rings[0].reduce((a, q) => a + q[1], 0) / s.rings[0].length, c: [s.rings[0].reduce((a, q) => a + q[0], 0) / s.rings[0].length, s.rings[0].reduce((a, q) => a + q[2], 0) / s.rings[0].length] as PlanPt}));

// ---- banded towers ----------------------------------------------------------------------------------------------------
type Corner = 'NE' | 'SE' | 'SW' | 'NW';
type Tower = {
  box: {u0: number; u1: number; v0: number; v1: number}; r: number; base: number; top: number;
  slabs: {y: number; h: number; out: number; open?: Corner[]}[]; gap: number; inset: number;
  module: number; glass: string; band: string; fin: string;
};
/** roundedRectPlan's corners in ring order (it starts at the north face's east end and runs NE, SE, SW, NW). */
const CORNERS: Corner[] = ['NE', 'SE', 'SW', 'NW'];
function towerRing(t: Tower, grow = 0): PlanPt[] {
  return roundedRectPlan(t.box.u0 - grow, t.box.u1 + grow, t.box.v0 - grow, t.box.v1 + grow, t.r + grow, 8).map(toXZ);
}
function bandedTower(b: BuildingTools, t: Tower) {
  const ring = towerRing(t);
  b.add(openTopPrism(shapeOf(ring), t.base, t.top), t.glass as never);
  b.add(upwardRoofPlane(shapeOf(ring), t.top), 'slate' as never);
  const {total} = perimeter(ring);
  const cornerAt = (c: Corner) => {
    const {u0, u1, v0, v1} = t.box, k = t.r * (1 - Math.SQRT1_2);
    const uv: PlanPt = c === 'NE' ? [u1 - k, v0 + k] : c === 'SE' ? [u1 - k, v1 - k] : c === 'SW' ? [u0 + k, v1 - k] : [u0 + k, v0 + k];
    return arclengthNear(ring, toXZ(uv));
  };
  const half = Math.PI * t.r / 4 + t.gap;
  for (const s of t.slabs) {
    const gaps = (s.open ?? []).map(c => cornerAt(c)).sort((a, b) => a - b);
    if (!gaps.length) {
      const o = slabBandOutline(ring, {out: s.out, inset: t.inset});
      b.add(extrude(shapeOf(o.outer, o.hole), s.y, s.h), t.band as never);
      continue;
    }
    for (let i = 0; i < gaps.length; i++) {
      const from = gaps[i] + half, to = (i + 1 < gaps.length ? gaps[i + 1] : gaps[0] + total) - half;
      if (to - from < 1) continue;
      const o = slabBandOutline(ring, {out: s.out, inset: t.inset, from, to, tipSteps: 6});
      b.add(extrude(shapeOf(o.outer), s.y, s.h), t.band as never);
    }
  }
  // mullion fins on the straight faces, full height behind the slabs
  for (const m of mullionStations(ring, t.module, 2, 0.6)) {
    const H = t.top - t.base - 0.3, g = new T.BoxGeometry(0.09, H, 0.2).translate(0, H / 2, 0.12);
    g.rotateY(Math.atan2(m.n[0], m.n[1])); g.translate(m.p[0], t.base + 0.15, m.p[1]);
    b.add(g, t.fin as never);
  }
  return ring;
}
/** Frame along a -> b with the normal on the side `put` rotates local +z to when the tangent is local +x (viewer's right). */
const frameOn = (a: PlanPt, b: PlanPt): Frame => {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), tg: PlanPt = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  return {origin: a, tangent: tg, n: [-tg[1], tg[0]]};
};

// ---- the models -------------------------------------------------------------------------------------------------------
export function buildAtriumZuidas(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  // Volumes already placed, for the exposure test of the dressed walls: [ring (x,z), top].
  const vols: {ring: number[][]; h: number}[] = [];
  const heightAt = (x: number, z: number) => vols.reduce((m, v) => (inPoly(x, z, v.ring) ? Math.max(m, v.h) : m), 0);

  // ---- towers (clean volumes over the 3DBAG) ----
  const zBox = uvBox(ZUID.nativeRing, (x, z) => x < -20.1 && z > 30.5);
  const zuid: Tower = {
    box: zBox, r: 3.3, base: 0, top: 66.1, gap: 3.5, inset: 0.35, module: 1.5, glass: 'glass', band: 'bronze', fin: 'dark',
    // ground storey to 7.0 m, 15 floors of 3.9 m, the roof band; short floors read off Commons Strawinsky 02/11 and w02
    slabs: [
      {y: 6.6, h: 0.8, out: 1.1},
      ...Array.from({length: 14}, (_, k) => ({y: 10.9 + k * 3.9 - 0.75, h: 0.75, out: 0.9, open: ([
        [], [], [], ['NW'], ['NW'], ['NW'], [], ['SE'], ['SE'], ['NW', 'NE'], ['NE'], [], ['SW'], ['SW'],
      ] as Corner[][])[k]})),
      {y: 64.9, h: 1.5, out: 0.9},
    ],
  };
  // shrink the box to the glass line: the BAG ring is the slab edge
  for (const k of ['u0', 'v0'] as const) zuid.box[k] += 0.6;
  for (const k of ['u1', 'v1'] as const) zuid.box[k] -= 0.6;
  const zRing = bandedTower(b, zuid);
  vols.push({ring: zRing, h: 66.1});
  // the plant screen on the roof (3DBAG 68.1 m over the middle)
  {
    const pr = roundedRectPlan(zuid.box.u0 + 7.5, zuid.box.u1 - 5.5, zuid.box.v0 + 6.5, zuid.box.v1 - 6.5, 1.0, 3).map(toXZ);
    b.add(openTopPrism(shapeOf(pr), 65.9, 68.1), 'bronze' as never);
    b.add(upwardRoofPlane(shapeOf(pr), 68.1), 'slate' as never);
  }

  const eBox = uvBox(NE.nativeRing);
  const ne: Tower = {
    box: {u0: eBox.u0 + 0.6, u1: eBox.u1 - 0.6, v0: eBox.v0 + 0.6, v1: eBox.v1 - 0.6}, r: 3.0, base: 0, top: 39.7, gap: 4.0, inset: 0.35, module: 1.5,
    glass: 'glass', band: 'bronze', fin: 'dark',
    slabs: [
      {y: 5.6, h: 0.8, out: 1.0},
      ...Array.from({length: 8}, (_, k) => ({y: 9.75 + k * 3.75 - 0.75, h: 0.75, out: 0.9, open: ([[], ['NW'], [], [], ['NE'], [], ['NW'], []] as Corner[][])[k]})),
      {y: 38.9, h: 1.1, out: 0.9},
    ],
  };
  const eRing = bandedTower(b, ne);
  vols.push({ring: eRing, h: 39.7});
  {
    // set-back top storey (3DBAG 43.7 m over the middle)
    const top = roundedRectPlan(ne.box.u0 + 6.5, ne.box.u1 - 3.0, ne.box.v0 + 3.6, ne.box.v1 - 3.6, 2.0, 4).map(toXZ);
    b.add(openTopPrism(shapeOf(top), 39.5, 43.7), 'glass' as never);
    b.add(upwardRoofPlane(shapeOf(top), 43.7), 'slate' as never);
    const o = slabBandOutline(top, {out: 0.5, inset: 0.3});
    b.add(extrude(shapeOf(o.outer, o.hole), 43.3, 0.6), 'bronze' as never);
  }
  b.mark?.('towers');

  // ---- 3DBAG massing: NMB, Zuidtoren plinth, garage deck ----
  type Block = {rings: P3[][]; h: number; kind: 'grid' | 'core' | 'wing' | 'plinth' | 'deck' | 'lobby'};
  const blocks: Block[] = [];
  const inside = (c: PlanPt, ...rs: number[][][]) => rs.some(r => inPoly(c[0], c[1], r));
  for (const r of roofsOf(NMB)) {
    if (area(r.rings[0]) < 1.5) continue;
    const shaft = r.c[0] < -26 && r.h > 40;
    // the granite shaft on Parnassusweg stands about 4 m above the grid block's parapet in panorama w02 (2024), where
    // 3DBAG has it 0.6 m below: the photo decides the crown
    const lift = shaft && r.h < 50 ? 4 : 0;
    const rings = lift ? r.rings.map(g => g.map(q => [q[0], q[1] + lift, q[2]] as P3)) : r.rings;
    blocks.push({rings, h: r.h + lift, kind: r.h >= 55 || shaft ? 'core' : r.h >= 30 ? 'grid' : r.h >= 15 ? 'wing' : 'plinth'});
  }
  // (planes above 12 m on the lobby and garage pands are 3DBAG slivers of the NMB block's west wall, drawn there already)
  // the lobby roof sits 3DBAG-flush with the deck that wraps it; lift its planes 0.2 m so the two never share a plane
  for (const r of roofsOf(NORTH)) if (area(r.rings[0]) > 1.5 && r.h < 12) blocks.push({rings: r.rings.map(g => g.map(q => [q[0], q[1] + 0.2, q[2]] as P3)), h: r.h + 0.2, kind: 'lobby'});
  for (const r of roofsOf(ZUID)) if (r.h < 20 && !inPoly(r.c[0], r.c[1], zRing) && area(r.rings[0]) > 1.5) blocks.push({rings: r.rings, h: r.h, kind: 'plinth'});
  for (const r of roofsOf(GARAGE)) {
    if (r.h > 12 || area(r.rings[0]) < 1.5) continue;
    if (inside(r.c, NMB.nativeRing, ZUID.nativeRing, NE.nativeRing)) continue;
    // small 3DBAG deck patches over the lobby duplicate the lobby's own roof planes (z-fight); the lobby keeps its roofs
    if (area(r.rings[0]) < 100 && inside(r.c, NORTH.nativeRing)) continue;
    blocks.push({rings: r.rings, h: r.h, kind: r.h > 8 && r.h < 9.5 ? 'deck' : 'plinth'});
  }
  const WALL: Record<Block['kind'], string> = {grid: 'canopyGlass', core: 'stone', wing: 'stone', plinth: 'glass', deck: 'glass', lobby: 'glass'};
  for (const k of blocks) {
    roofPrism(b, k.rings, WALL[k.kind], k.kind === 'deck' ? 'concrete' : 'slate');
    vols.push({ring: k.rings[0], h: k.h});
  }
  b.mark?.('massing');

  // ---- dress the exposed walls of the 3DBAG blocks ----
  // Each roof-polygon edge is split into runs of equal exposure (the height of whatever stands 0.8 m in front of it,
  // sampled every metre), and each run of at least 3 m is dressed from just above that height to under the roof edge.
  const FLOOR = 3.6, BREAK = 18.8;
  const gridLines = (L: number) => {
    const out: number[] = [];
    for (let t = 0.4, k = 0; t < L - 0.3; k++) { out.push(t); t += k % 3 === 2 ? 1.0 : 2.6; }
    return out;
  };
  const sub = (f: Frame, t0: number): Frame => ({origin: [f.origin[0] + f.tangent[0] * t0, f.origin[1] + f.tangent[1] * t0], tangent: f.tangent, n: f.n});
  const runsOf = (f: Frame, L: number) => {
    const n = Math.max(2, Math.ceil(L)), hs: number[] = [];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) * L / n;
      hs.push(heightAt(f.origin[0] + f.tangent[0] * t + f.n[0] * 0.8, f.origin[1] + f.tangent[1] * t + f.n[1] * 0.8));
    }
    const runs: {t0: number; t1: number; h: number}[] = [];
    for (let i = 0; i < n; i++) {
      const last = runs[runs.length - 1];
      if (last && Math.abs(hs[i] - last.h) < 0.5) last.t1 = (i + 1) * L / n; else runs.push({t0: i * L / n, t1: (i + 1) * L / n, h: hs[i]});
    }
    return runs.map(r => ({...r, h: Math.max(r.h, ...hs.slice(Math.floor(r.t0 / L * n), Math.ceil(r.t1 / L * n)))}));
  };
  /** Outward frame of edge i of ring r (tangent to the viewer's right, as `put` and `letters` expect). */
  const edgeFrame = (r: P3[], i: number) => {
    const p = r[i], q = r[(i + 1) % r.length];
    let f = frameOn([p[0], p[2]], [q[0], q[2]]);
    const m: PlanPt = [(p[0] + q[0]) / 2, (p[2] + q[2]) / 2];
    if (inPoly(m[0] + f.n[0] * 0.6, m[1] + f.n[1] * 0.6, r)) f = frameOn([q[0], q[2]], [p[0], p[2]]);
    return {f, L: Math.hypot(q[0] - p[0], q[2] - p[2]), top: Math.min(p[1], q[1]), m};
  };
  setSink(0.05);
  const ribbon: GridOptions = {y0: 4.4, pitch: 3.5, colPitch: 1.8, pierW: 0.16, pierD: 0.12, winBottom: 1.0, winH: 1.6, pier: 'stone', glass: 'canopyGlass', margin: 0.5};
  let bay: {f: Frame; L: number; y0: number; top: number} | null = null;
  for (const k of blocks) {
    if (k.kind === 'plinth' || k.kind === 'deck') continue;
    const r = k.rings[0];
    for (let i = 0; i < r.length; i++) {
      const e0 = edgeFrame(r, i);
      if (e0.L < 4) continue;
      const top = e0.top - 0.4;
      for (const run of runsOf(e0.f, e0.L)) {
        const L = run.t1 - run.t0 - 0.3, y0 = Math.max(0.3, run.h + 0.3);
        if (L < 3 || top - y0 < 3) continue;
        const f = sub(e0.f, run.t0 + 0.15);
        if (k.kind === 'grid') {
          const floors: number[] = [];
          for (let y = 0.6 + FLOOR; y + 0.65 < top - 0.3; y += FLOOR) floors.push(y);
          const bands = storeyBands(floors, top, 1.0, 0.35);
          for (const pc of bandedCurtain({length: L, y0, y1: top, bands, lines: gridLines(L), transom: {w: 0.12, depth: 0.12}, mullion: {w: 0.12, depth: 0.14}})) {
            if (pc.part === 'vision') continue;
            if (pc.part === 'spandrel') slab(b, f, (pc.t0 + pc.t1) / 2, pc.y0, pc.t1 - pc.t0 - 0.1, pc.y1 - pc.y0, 0.08, 'greyBrick');
            else if (pc.part === 'transom') slab(b, f, (pc.t0 + pc.t1) / 2, pc.y0, pc.t1 - pc.t0 - 0.2, pc.y1 - pc.y0, pc.depth, 'frame');
            else slab(b, f, (pc.t0 + pc.t1) / 2, pc.y0, pc.t1 - pc.t0, pc.y1 - pc.y0, pc.depth, 'frame');
          }
          // the cantilever line: the grid storeys overhang a recessed lower band (w01 2021, thumb w04)
          const near = heightAt(f.origin[0] + f.tangent[0] * L / 2 + f.n[0] * 0.25, f.origin[1] + f.tangent[1] * L / 2 + f.n[1] * 0.25);
          if (y0 < BREAK - 1 && top > BREAK + 4 && near < BREAK - 1) slab(b, f, L / 2, BREAK - 0.55, L - 0.2, 0.55, 0.22, 'dark');
          if (e0.f.n[1] < -0.95 && L > 30 && (!bay || L > bay.L)) bay = {f, L, y0: Math.max(y0, BREAK), top};
        } else if (k.kind === 'lobby' && heightAt(f.origin[0] + f.tangent[0] * L / 2 + f.n[0] * 0.25, f.origin[1] + f.tangent[1] * L / 2 + f.n[1] * 0.25) < y0 + 0.5) {
          // the two-storey glazed lobby (w04 2024): slim mullions about 1.5 m apart and one transom at the mezzanine
          const n = Math.max(1, Math.round(L / 1.5));
          for (let j = 1; j < n; j++) slab(b, f, (L * j) / n, y0, 0.08, top - y0, 0.12, 'frame');
          if (y0 < 4) slab(b, f, L / 2, 4.3, L - 0.1, 0.1, 0.1, 'frame');
        } else if (k.kind === 'wing') {
          gridFacade(b, {origin: f.origin, tangent: f.tangent, n: f.n, length: L, base: y0, poly: [[0, y0], [L, y0], [L, top + 0.4], [0, top + 0.4]], index: 0}, ribbon);
        } else if (k.kind === 'core' && L > 4 && top - y0 > 8 && !r.every(p => p[0] < -24)) {
          // large arched windows under the parapet (Commons Strawinsky 04), one per 6.5 m of exposed face
          const n = Math.max(1, Math.floor(L / 6.5)), pitch = L / n, w = Math.min(4.6, pitch - 1.4);
          if (w > 1.5) for (let j = 0; j < n; j++) archSlab(b, f, pitch * (j + 0.5), top - 6.4, w, 5.0, 0.08, 'canopyGlass', 0, 6);
        }
      }
    }
  }
  // the projecting glazed bay in the middle of the NMB block's north grid (w01 2021): 3.5 m wide, 0.9 m proud
  if (bay) {
    const {f, L, y0, top} = bay;
    slab(b, f, L / 2, y0, 3.5, top - y0 - 0.2, 0.9, 'canopyGlass');
    for (const dt of [-1.75, -0.6, 0.6, 1.75]) slab(b, f, L / 2 + dt, y0, 0.12, top - y0 - 0.15, 0.84, 'frame', 0.17);
    for (let y = y0 + FLOOR; y < top - 0.5; y += FLOOR) slab(b, f, L / 2, y, 3.38, 0.12, 0.84, 'frame', 0.17);
  }
  // the T window near the top of the granite shaft facing Parnassusweg and the small window at mid-height (panorama w02,
  // 2024): a fanlight over a narrow three-pane stem, white frames, centred on the face; a four-pane window 1.3 x 2.5 m
  {
    const shaft = blocks.filter(k => k.kind === 'core' && k.rings[0].every(p => p[0] < -24)).sort((a, c) => c.h - a.h)[0];
    if (shaft) {
      const r = shaft.rings[0];
      const ws = r.map((_, i) => edgeFrame(r, i)).filter(e => e.f.n[0] < -0.9 && e.L > 3).sort((a, c) => c.L - a.L)[0];
      if (ws && heightAt(ws.m[0] - 1, ws.m[1]) < shaft.h - 8) {
        // centred on the shaft's exposed west edge (the stone face left of the grid block in the w02 elevation)
        const f = ws.f, t = ws.L / 2, H = shaft.h, yf = H - 2.6, ys = yf - 1.8;
        const bar = (dt: number, y: number, w: number, h: number) => slab(b, f, t + dt, y, w, h, 0.14, 'white');
        archSlab(b, f, t, yf, 3.2, 0.02, 0.08, 'canopyGlass', 0, 10);   // the fanlight (a half disc; the photo's is flatter)
        slab(b, f, t, ys, 1.0, 1.8, 0.08, 'canopyGlass');
        bar(0, yf - 0.04, 3.1, 0.1);
        for (const dt of [-0.5, -0.17, 0.17, 0.5]) bar(dt, ys + 0.01, 0.08, dt * dt > 0.2 ? 1.78 : 3.2);
        for (const dt of [-1.05, 1.05]) bar(dt, yf + 0.04, 0.08, 1.0);
        const yw = Math.max(heightAt(ws.m[0] - 1, ws.m[1]) + 1.5, H - 28.8);
        slab(b, f, t, yw, 1.3, 2.5, 0.08, 'canopyGlass');
        bar(0, yw + 0.01, 0.08, 2.48);
        bar(0, yw + 1.2, 1.28, 0.08);
        for (const dt of [-0.62, 0.62]) bar(dt, yw + 0.01, 0.06, 2.48);
      }
    }
  }
  b.mark?.('facades');

  // ---- the deck canopy along Strawinskylaan and the ATRIUM letters standing on it (w01 2021, panorama w04 2024) ----
  {
    const deck = blocks.filter(k => k.kind === 'deck').sort((a, c) => area(c.rings[0]) - area(a.rings[0]))[0];
    if (deck) {
      const r = deck.rings[0], top = deck.h;
      for (let i = 0; i < r.length; i++) {
        const e0 = edgeFrame(r, i);
        if (e0.L < 6 || e0.f.n[1] > -0.9) continue; // north-facing edges only
        if (heightAt(e0.m[0] + e0.f.n[0] * 1.0, e0.m[1] + e0.f.n[1] * 1.0) > 1) continue;
        slab(b, e0.f, e0.L / 2, top - 0.55, e0.L - 0.4, 0.8, 1.8, 'white', -0.3);
        // the letters, about 7 m wide and 0.9 m tall (camera-matched on the w04 review overlay), centred over x = -47 (the lobby entrance)
        const t = (-47 - e0.f.origin[0]) / e0.f.tangent[0];
        if (Math.abs(e0.f.tangent[0]) > 0.9 && t > 4.5 && t < e0.L - 4.5) letters(b, e0.f, 'ATRIUM', t, top + 0.25, 0.5, 0.2, 0.14, 'dark', 0.13);
      }
    }
  }
  setSink(0);
}
