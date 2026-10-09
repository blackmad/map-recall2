/**
 * Automated gates for a compiled building, evaluated on the decoded GLB
 * triangles (what ships), plus the facts it was fitted to. Each gate returns
 * a measured value and a pass flag; nothing here is visual acceptance.
 */
import type {BuildingFacts} from './facts.ts';
import {pointInRing} from './facts.ts';
import type {FitReport} from './fit.ts';

export interface Tri { a: number[]; b: number[]; c: number[]; surface: string; metallic: number }
export interface Gate { id: string; pass: boolean; value: unknown; limit: string }

export const BUDGET_TRIANGLES = 3000;

function footprintIoU(facts: BuildingFacts, modelRingsLocal: number[][][], anchorRD: [number, number]) {
  // Raster IoU on a 10 cm grid in RD, model rings converted back from local (x east, z south).
  const model = modelRingsLocal.map(r => r.map(([x, z]) => [x + anchorRD[0], anchorRD[1] - z]));
  const bag = facts.bagFootprintRD;
  const all = [...model.flat(), ...bag.flat()];
  const [x0, x1] = [Math.min(...all.map(p => p[0])), Math.max(...all.map(p => p[0]))], [y0, y1] = [Math.min(...all.map(p => p[1])), Math.max(...all.map(p => p[1]))];
  let inter = 0, union = 0;
  const step = 0.1;
  const inside = (rings: number[][][], p: number[]) => rings.reduce((s, r) => s + (pointInRing(p, r) ? 1 : 0), 0) % 2 === 1;
  for (let x = x0 + step / 2; x < x1; x += step) for (let y = y0 + step / 2; y < y1; y += step) {
    const a = inside(model, [x, y]), b = inside(bag, [x, y]);
    if (a && b) inter++; if (a || b) union++;
  }
  return union ? inter / union : 0;
}

const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Euclidean distance from a point to a triangle (Ericson, Real-Time Collision Detection 5.1.5). */
export function pointTriangleDistance(p: number[], t: {a: number[]; b: number[]; c: number[]}): number {
  const {a, b, c} = t, ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap); let q: number[];
  const at = (u: number, v: number) => [a[0] + ab[0] * u + ac[0] * v, a[1] + ab[1] * u + ac[1] * v, a[2] + ab[2] * u + ac[2] * v];
  if (d1 <= 0 && d2 <= 0) q = a; else {
    const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) q = b; else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) q = at(d1 / (d1 - d3), 0); else {
        const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
        if (d6 >= 0 && d5 <= d6) q = c; else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) q = at(0, d2 / (d2 - d6)); else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); q = [b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w]; }
            else { const den = 1 / (va + vb + vc); q = at(vb * den, vc * den); }
          }
        }
      }
    }
  }
  return Math.hypot(...sub(p, q));
}

/** Weld at 1 cm, split into connected components, and find components not resting on ground or another component. */
function topology(tris: Tri[]) {
  const key = (p: number[]) => p.map(v => Math.round(v * 100)).join(',');
  const ids = new Map<string, number>(), parent: number[] = [];
  const vid = (p: number[]) => { const k = key(p); if (!ids.has(k)) { ids.set(k, parent.length); parent.push(parent.length); } return ids.get(k)!; };
  const find = (i: number): number => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const edges = new Map<string, {n: number; a: number[]; b: number[]; tri: number}>();
  const triV = tris.map((t, ti) => {
    const v = [vid(t.a), vid(t.b), vid(t.c)];
    parent[find(v[1])] = find(v[0]); parent[find(v[2])] = find(v[0]);
    for (const [i, j, p, q] of [[v[0], v[1], t.a, t.b], [v[1], v[2], t.b, t.c], [v[2], v[0], t.c, t.a]] as const) {
      if (i === j) continue;
      const k = i < j ? `${i}|${j}` : `${j}|${i}`, e = edges.get(k) ?? {n: 0, a: p, b: q, tri: ti}; e.n++; edges.set(k, e);
    }
    return v;
  });
  const comps = new Map<number, number[]>();
  triV.forEach((v, t) => { const r = find(v[0]); comps.set(r, [...(comps.get(r) ?? []), t]); });
  // Bounding boxes per component; a component is supported when it touches the
  // ground or its box overlaps (2 cm slack) a supported component's box.
  const boxes = [...comps.entries()].map(([root, ts]) => {
    const pts = ts.flatMap(t => [tris[t].a, tris[t].b, tris[t].c]);
    return {root, count: ts.length, min: [0, 1, 2].map(i => Math.min(...pts.map(p => p[i]))), max: [0, 1, 2].map(i => Math.max(...pts.map(p => p[i])))};
  });
  const supported = new Set(boxes.filter(b => b.min[1] <= 0.05).map(b => b.root));
  for (let changed = true; changed;) {
    changed = false;
    for (const b of boxes) if (!supported.has(b.root) && boxes.some(o => supported.has(o.root) && [0, 1, 2].every(i => b.min[i] <= o.max[i] + 0.02 && b.max[i] >= o.min[i] - 0.02))) { supported.add(b.root); changed = true; }
  }
  const floating = boxes.filter(b => !supported.has(b.root));
  // Open edges: used once, above the open building base.
  // A once-used edge whose midpoint and quarter points lie on another triangle is a
  // T-junction seam (e.g. roof closure meeting the shell top), not a hole.
  let openLength = 0, openCount = 0;
  for (const e of edges.values()) {
    if (e.n !== 1 || Math.max(e.a[1], e.b[1]) <= 0.05) continue;
    const samples = [0.25, 0.5, 0.75].map(t => e.a.map((v, i) => v + (e.b[i] - v) * t));
    const covered = samples.every(q => tris.some((t, ti) => {
      return ti !== e.tri && pointTriangleDistance(q, t) < 0.02;
    }));
    if (covered) continue;
    openCount++; openLength += Math.hypot(e.a[0] - e.b[0], e.a[1] - e.b[1], e.a[2] - e.b[2]);
  }
  return {components: boxes.length, floating: floating.map(f => ({triangles: f.count, min: f.min.map(v => +v.toFixed(2)), max: f.max.map(v => +v.toFixed(2))})), openEdges: openCount, openEdgeLengthM: openLength};
}

export function evaluateGates(tris: Tri[], facts: BuildingFacts, fit: FitReport, modelRingsLocal: number[][][], anchorRD: [number, number]): {gates: Gate[]; topology: ReturnType<typeof topology>} {
  const gates: Gate[] = [];
  const g = (id: string, pass: boolean, value: unknown, limit: string) => gates.push({id, pass, value, limit});
  g('triangle-budget', tris.length <= BUDGET_TRIANGLES, tris.length, `<= ${BUDGET_TRIANGLES}`);
  g('finite', tris.every(t => [...t.a, ...t.b, ...t.c].every(Number.isFinite)), true, 'all positions finite');
  g('non-metallic', tris.every(t => t.metallic === 0), true, 'metallicFactor 0');
  const iou = footprintIoU(facts, modelRingsLocal, anchorRD);
  g('footprint-vs-bag', iou >= 0.9, +iou.toFixed(3), 'IoU >= 0.90 against BAG LoD0');
  // Roof surfaces only: exact 3DBAG planes, so the max must match the survey.
  const roofY = tris.filter(t => t.surface === 'roof').flatMap(t => [t.a[1], t.b[1], t.c[1]]);
  const roofMax = Math.max(...roofY);
  g('ridge-vs-3dbag', roofMax - facts.heights.roofMaxM <= 0.3 + (fit.roofAllowanceM ?? 0) && facts.heights.roofMaxM - roofMax <= 0.3, {modelM: +roofMax.toFixed(2), threeDBagM: +facts.heights.roofMaxM.toFixed(2)}, '|Δ| <= 0.30 m (roof max vs LoD2.2 roof max); declared dormers may stand 1.9 m above it (LoD2.2 has none)');
  for (const f of fit.fronts) {
    const ff = facts.fronts.find(x => Math.abs(x.widthM - f.widthM) < 0.05) ?? facts.fronts[0];
    g(`eaves-vs-3dbag/${f.id}`, Math.abs(f.eavesM - ff.eavesM) <= 0.3 || fit.fronts.length > 1, {modelM: f.eavesM, threeDBagM: +ff.eavesM.toFixed(2)}, '|Δ| <= 0.30 m');
    const uppers = f.storeyHeightsM.slice(f.storeyHeightsM[0] < 1.5 ? 2 : 1);
    const ok = uppers.every(h => h >= 2.3 && h <= 4.6);
    g(`storey-height/${f.id}`, ok, f.storeyHeightsM, 'upper storeys 2.3–4.6 m (intent storey count vs 3DBAG eaves)');
  }
  const topo = topology(tris);
  g('no-floating-parts', topo.floating.length === 0, topo.floating.length, '0 components detached from ground/shell');
  g('open-edges', topo.openEdgeLengthM <= 2, {edges: topo.openEdges, lengthM: +topo.openEdgeLengthM.toFixed(1)}, '<= 2 m of genuine open edge above ground (T-junction seams excluded)');
  return {gates, topology: topo};
}
