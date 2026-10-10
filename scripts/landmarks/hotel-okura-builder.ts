import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, planarPolygon} from './worship-shell';
import {wallsOf, wallTop} from './worship-walls';
import {openTopPrism, upwardRoofPlane} from './house-geometry';
import {slab, frameOf, setSink, type Frame} from './nearbar-kit';
import source from './hotel-okura-footprints.json';

/**
 * Hotel Okura Amsterdam, Ferdinand Bolstraat 333 (Bijvoet & Holt with Taniguchi and Shibata, 1971): a 78 m slab tower of 23 storeys
 * whose grey piers and pink-brown spandrels frame paired windows, topped by an overhanging flat canopy on slim white columns above the
 * glazed rooftop restaurant floor, rising from a long travertine-faced podium.
 *
 * Massing: the 3DBAG LoD2.2 shell of the whole BAG pand (native east/south metres from the BAG centroid), with every surface above 25 m
 * dropped. 3DBAG fuses the canopy overhang into the tower walls, so the tower is rebuilt as its own rectangle fitted to the 73.3 m roof
 * deck: 27.8 x 22.6 m, rotated 4.95 degrees (a along the north front towards east-south-east), NW corner (-4.1, -27.1). The canopy slab
 * overhangs it by 3.2 m. Podium roofs are 10.8-16.2 m, the tower facade runs from 14.2 m to the 73.3 m deck (19 storeys of 3.1 m,
 * the last one a glazed restaurant floor); 3DBAG roofMax 79.7 m includes the plant boxes and mast above the canopy.
 * Window axes: eight on the long (north/south) faces, six on the short (east/west) faces; one stack of balconies on the west face.
 */
type Pt = [number, number];
const TH = Math.atan2(2.4, 27.7);
const EA: Pt = [Math.cos(TH), Math.sin(TH)], EB: Pt = [-Math.sin(TH), Math.cos(TH)];
const NW: Pt = [-4.1, -27.1];
const WT = 27.8, DT = 22.6;
const pt = (a: number, bb: number): Pt => [NW[0] + a * EA[0] + bb * EB[0], NW[1] + a * EA[1] + bb * EB[1]];
const Y0 = 14.2, ROWS = 19, DECK = 73.3, STOREY = (DECK - Y0) / ROWS;
const CAN_LO = 77.0, CAN_HI = 77.9, CAN_OUT = 3.2;

const shapeOf = (pts: Pt[]) => new T.Shape(pts.map(p => new T.Vector2(p[0], p[1])));

export function buildHotelOkura(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  // ---------------------------------------------------------------- podium shell (everything below 25 m)
  // 3DBAG fuses the canopy overhang into the tower walls (full-height walls round the canopy footprint, no podium roof under it), so the
  // tower surfaces are rebuilt separately: tall roofs are dropped and tall walls are cut down to the podium height of their own junction
  // vertices (their highest vertex below 25 m), which keeps every shared vertex with the neighbouring kept podium walls and roofs.
  const high = (s: {rings: number[][][]}) => s.rings[0].some(p => p[1] > 25);
  const kept: {type: string; rings: number[][][]}[] = [];
  // 3DBAG gives the same junction slightly different heights on neighbouring surfaces (10.78 / 10.85 m); snapping every vertex to a
  // 5 cm plan / 25 cm height grid welds those seams without changing any visible dimension.
  const snap = (p: number[]) => [Math.round(p[0] / 0.05) * 0.05, p[1] < 0.5 ? 0 : Math.round(p[1] / 0.25) * 0.25, Math.round(p[2] / 0.05) * 0.05];
  const surfaces = (source.surfaces as {type: string; rings: number[][][]}[]).map(s => ({type: s.type, rings: s.rings.map(r => r.map(snap))}));
  const xz = (p: number[]) => `${p[0].toFixed(2)},${p[2].toFixed(2)}`;
  const heightsAt = new Map<string, Set<number>>();
  for (const s of surfaces) if (!high(s)) for (const r of s.rings) for (const p of r) { const k = xz(p); (heightsAt.get(k) ?? heightsAt.set(k, new Set()).get(k)!).add(p[1]); }
  for (const s of surfaces) if (!high(s)) kept.push(s);
  // cut height of each tall wall: the highest kept junction at its plan vertices; walls with none (they only touch other tall walls)
  // take the cut height of the walls beside them, so a couple of passes propagate it round the canopy footprint
  const tall = surfaces.filter(s => high(s) && s.type === 'WallSurface');
  const capOf = new Map<object, number>();
  for (let pass = 0; pass < 6; pass++) {
    for (const s of tall) {
      if (capOf.has(s)) continue;
      let cap = 0;
      for (const p of s.rings[0]) for (const y of heightsAt.get(xz(p)) ?? []) if (y <= 25) cap = Math.max(cap, y);
      if (cap > 2) {
        capOf.set(s, cap);
        for (const p of s.rings[0]) { const k = xz(p); (heightsAt.get(k) ?? heightsAt.set(k, new Set()).get(k)!).add(cap); }
      }
    }
  }
  for (const s of tall) {
    const cap = capOf.get(s);
    if (cap === undefined) continue;
    const ring: number[][] = [];
    const push = (q: number[]) => { const last = ring[ring.length - 1]; if (!last || last.some((v, i) => Math.abs(v - q[i]) > 1e-6)) ring.push(q); };
    const r0 = s.rings[0].map(p => [p[0], Math.min(p[1], cap), p[2]]);
    for (let i = 0; i < r0.length; i++) {
      const p = r0[i], q = r0[(i + 1) % r0.length];
      push(p);
      if (xz(p) === xz(q) && p[1] !== q[1]) {   // vertical edge: weld to the kept neighbours' junction vertices
        const ys = [...(heightsAt.get(xz(p)) ?? [])].filter(y => y > Math.min(p[1], q[1]) + 1e-6 && y < Math.max(p[1], q[1]) - 1e-6).sort((x, y) => p[1] < q[1] ? x - y : y - x);
        for (const y of ys) push([p[0], y, p[2]]);
      }
    }
    if (ring.length > 1 && ring[0].every((v, i) => Math.abs(v - ring[ring.length - 1][i]) < 1e-6)) ring.pop();
    if (ring.length >= 3) kept.push({type: 'WallSurface', rings: [ring]});
  }
  const shell = {...(source as object), surfaces: kept} as never as typeof source;
  addShell(b, shell as never, {wall: 'stone', roof: 'concrete'});
  // The dropped tower surfaces leave open loops in the kept shell (the concave edges of the 11 m podium roof round the tower and the
  // wall tops beside it). Chain every unmatched above-ground edge into a loop and close it with a flat cap.
  {
    const key = (p: number[]) => p.map(v => v.toFixed(2)).join(',');
    const edges = new Map<string, {a: number[]; b: number[]; n: number}>();
    for (const s of kept) {
      if (s.type === 'GroundSurface' || planarPolygon(s.rings) === null) continue;
      for (const r of s.rings) {
        const pts = r.length > 1 && key(r[0]) === key(r[r.length - 1]) ? r.slice(0, -1) : r;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], c = pts[(i + 1) % pts.length];
          if (key(a) === key(c)) continue;
          const k = [key(a), key(c)].sort().join('|');
          const e = edges.get(k); if (e) e.n++; else edges.set(k, {a, b: c, n: 1});
        }
      }
    }
    const open = [...edges.values()].filter(e => e.n === 1 && e.a[1] > 2 && e.b[1] > 2);
    const next = new Map<string, number[][]>();
    for (const e of open) for (const [p, q] of [[e.a, e.b], [e.b, e.a]]) { const l = next.get(key(p)) ?? []; l.push(q); next.set(key(p), l); }
    const used = new Set<string>();
    const ekey = (p: number[], q: number[]) => [key(p), key(q)].sort().join('|');
    // depth-first cycle search so a vertex shared by two loops cannot strand the chain
    const walk = (start: number[], cur: number[], path: number[][], taken: Set<string>): number[][] | null => {
      for (const q of next.get(key(cur)) ?? []) {
        const ek = ekey(cur, q);
        if (taken.has(ek) || used.has(ek)) continue;
        taken.add(ek);
        if (key(q) === key(start)) return path;
        if (path.length < 300) { const r = walk(start, q, [...path, q], taken); if (r) return r; }
        taken.delete(ek);
      }
      return null;
    };
    for (const e of open) {
      if (used.has(ekey(e.a, e.b))) continue;
      const taken = new Set<string>([ekey(e.a, e.b)]);
      const loop = walk(e.a, e.b, [e.a, e.b], taken);
      if (!loop || loop.length < 3) continue;
      for (const k of taken) used.add(k);
      // Triangulate on a plan projection nudged by a few tenths of a millimetre so that the vertical steps of the loop (equal plan
      // positions) and collinear points are not filtered out by the ear-clipper, which would leave their edges open.
      const nudge = (i: number, f: number) => Math.sin(i * f) * 3e-4;
      const flat = loop.map((p, i) => new T.Vector2(p[0] + nudge(i, 12.9898), p[2] + nudge(i, 78.233)));
      const tris = T.ShapeUtils.triangulateShape(flat, []);
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(loop.flat(), 3));
      const idx: number[] = [];
      for (const [i, j, k] of tris) {
        const A = new T.Vector3(...loop[i]), B = new T.Vector3(...loop[j]), C = new T.Vector3(...loop[k]);
        if (B.clone().sub(A).cross(C.clone().sub(A)).y >= 0) idx.push(i, j, k); else idx.push(i, k, j);
      }
      g.setIndex(idx);
      g.computeVertexNormals();
      g.userData.role = 'roof';
      b.add(g, 'concrete' as never);
    }
  }

  // ---------------------------------------------------------------- tower body
  const rect = (a0: number, a1: number, b0: number, b1: number): Pt[] => [pt(a0, b0), pt(a1, b0), pt(a1, b1), pt(a0, b1)];
  const body = rect(0, WT, 0, DT);
  b.add(openTopPrism(shapeOf(body), 0, DECK), 'greyBrick' as never);
  const deck = upwardRoofPlane(shapeOf(body), DECK); deck.userData.role = 'roof'; b.add(deck, 'concrete' as never);
  // the tower's own cream fascia storey from the podium roof (about 11 m) up to the first window row
  {
    const sq = rect(-0.45, WT + 0.45, -0.45, DT + 0.45);
    b.add(openTopPrism(shapeOf(sq), 0, Y0), 'stone' as never);
    const fc = upwardRoofPlane(shapeOf(sq), Y0); fc.userData.role = 'roof'; b.add(fc, 'concrete' as never);
  }
  b.mark?.('shell');

  // faces: outward normal, tangent = (n.z, -n.x), origin at t = 0, length
  const mk = (n: Pt, origin: Pt, length: number): Frame & {length: number} => ({origin, tangent: [n[1], -n[0]], n, length});
  const faces = {
    north: mk([-EB[0], -EB[1]], pt(WT, 0), WT),
    east: mk(EA, pt(WT, DT), DT),
    south: mk(EB, pt(0, DT), WT),
    west: mk([-EA[0], -EA[1]], pt(0, 0), DT),
  };
  const cols: Record<string, number> = {north: 8, south: 8, east: 6, west: 6};

  setSink(0.3);
  for (const [name, f] of Object.entries(faces)) {
    const nc = cols[name], pitch = f.length / nc;
    for (let r = 0; r < ROWS; r++) {
      const y = Y0 + r * STOREY;
      const top = r === ROWS - 1;
      for (let c = 0; c < nc; c++) {
        const t = (c + 0.5) * pitch;
        if (top) {
          // restaurant floor: tall glazing, dark mullions, no spandrel
          slab(b, f, t, y + 0.1, pitch - 0.7, STOREY - 0.2, 0.12, 'glass');
          slab(b, f, t, y + 0.1, 0.1, STOREY - 0.2, 0.2, 'frame');
          continue;
        }
        slab(b, f, t, y + 0.05, pitch - 1.15, STOREY - 0.1, 0.06, 'pink');
        slab(b, f, t, y + 0.75, pitch - 1.55, 1.45, 0.12, 'glass');
        slab(b, f, t, y + 0.75, 0.07, 1.45, 0.17, 'white');
      }
    }
  }
  // stack of balconies on the west (Ferdinand Bolstraat) face: second axis from the north end (Commons 2016 view from the south-west)
  {
    const f = faces.west, pitch = f.length / cols.west, t = (1 + 0.5) * pitch;
    for (let r = 0; r < ROWS - 1; r++) {
      const y = Y0 + r * STOREY;
      slab(b, f, t, y + 0.05, pitch - 0.9, 0.12, 1.3, 'concrete');
      slab(b, f, t, y + 0.17, pitch - 0.9, 0.9, 0.05, 'glass', 1.25);
    }
  }
  // belt courses at the podium roof and under the deck
  for (const f of Object.values(faces)) {
    slab(b, f, f.length / 2, Y0 - 0.5, f.length + 0.3, 0.5, 0.5, 'dark');
    slab(b, f, f.length / 2, DECK - 0.1, f.length + 0.2, 0.4, 0.2, 'concrete');
  }

  // ---------------------------------------------------------------- crown: pavilion, columns, overhanging canopy
  b.add(openTopPrism(shapeOf(rect(2.5, WT - 2.5, 2.5, DT - 2.5)), DECK, CAN_LO), 'ochre' as never);
  const cx = WT / 2, cz = DT / 2;
  const NC = 9, ND = 7;
  const post = (a: number, bb: number) => { const p = pt(a, bb); b.add(new T.CylinderGeometry(0.17, 0.17, CAN_LO - DECK, 8).translate(0, (CAN_LO - DECK) / 2, 0), 'white' as never, p[0], DECK, p[1]); };
  const ins = 0.9;
  for (let i = 0; i <= NC; i++) { post(ins + i * (WT - 2 * ins) / NC, ins); post(ins + i * (WT - 2 * ins) / NC, DT - ins); }
  for (let j = 1; j < ND; j++) { post(ins, ins + j * (DT - 2 * ins) / ND); post(WT - ins, ins + j * (DT - 2 * ins) / ND); }
  const canopy = rect(-CAN_OUT, WT + CAN_OUT, -CAN_OUT, DT + CAN_OUT);
  b.add(openTopPrism(shapeOf(canopy), CAN_LO, CAN_HI), 'white' as never);
  // tapered soffit: a shallow sloped band between the edge and the tower walls
  const inner = rect(-0.3, WT + 0.3, -0.3, DT + 0.3);
  for (let k = 0; k < 4; k++) {
    const A = canopy[k], B = canopy[(k + 1) % 4], C = inner[(k + 1) % 4], D = inner[k];
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute([A[0], CAN_LO, A[1], B[0], CAN_LO, B[1], C[0], DECK + 3.2, C[1], D[0], DECK + 3.2, D[1]], 3));
    g.setIndex([0, 2, 1, 0, 3, 2]); g.computeVertexNormals();
    b.add(g, 'concrete' as never);
  }
  // roof: flat top with a shallow raised hip over the middle
  const roofFlat = upwardRoofPlane(shapeOf(canopy), CAN_HI); roofFlat.userData.role = 'roof'; b.add(roofFlat, 'white' as never);
  b.add(openTopPrism(shapeOf(rect(6, WT - 6, 5, DT - 5)), CAN_HI, 78.5), 'concrete' as never);
  const lid = upwardRoofPlane(shapeOf(rect(6, WT - 6, 5, DT - 5)), 78.5); lid.userData.role = 'roof'; b.add(lid, 'concrete' as never);
  // plant box and flagpole above the canopy
  b.add(openTopPrism(shapeOf(rect(cx - 3, cx + 3, cz - 2, cz + 2)), 78.5, 79.6), 'dark' as never);
  const lid2 = upwardRoofPlane(shapeOf(rect(cx - 3, cx + 3, cz - 2, cz + 2)), 79.6); lid2.userData.role = 'roof'; b.add(lid2, 'dark' as never);
  { const p = pt(WT - 4, 4); b.add(new T.CylinderGeometry(0.1, 0.1, 5.6, 6).translate(0, 2.8, 0), 'white' as never, p[0], CAN_HI, p[1]); }

  // ---------------------------------------------------------------- podium: ribbon glazing on the long lower walls
  setSink(0.25);
  for (const w of wallsOf(shell as never)) {
    if (w.length < 6) continue;
    const topY = wallTop(w, w.length / 2);
    if (topY < 8 || topY > 25) continue;
    const f = frameOf(w);
    const y = w.base + 3.8, h = Math.min(3.0, topY - y - 1.0);
    if (h < 1.2) continue;
    slab(b, f, w.length / 2, y, w.length - 1.6, h, 0.08, 'glass');
    for (let t = 1.2; t < w.length - 0.9; t += 3.0) slab(b, f, t, y, 0.12, h, 0.14, 'dark');
    slab(b, f, w.length / 2, y + h, w.length - 1.2, 0.35, 0.18, 'dark');
  }
}
